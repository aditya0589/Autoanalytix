import uuid
import secrets
import os
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dynamodb import dynamodb_store
from app.core.s3_storage import s3_storage
from app.schemas.all_schemas import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardItemCreate,
    DashboardItemResponse,
    DashboardItemUpdate,
    AIDashboardGenerateRequest
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.ai.providers.factory import get_chat_model_for_config
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

def _build_dashboard_response(d: Dict[str, Any]) -> DashboardResponse:
    # Ensure items exist
    items_list = d.get("items") or []
    
    # Sort items by item_order in layout if specified
    layout = d.get("layout")
    if layout and isinstance(layout, dict) and "item_order" in layout and isinstance(layout["item_order"], list):
        order_map = {item_id: idx for idx, item_id in enumerate(layout["item_order"])}
        items_list = sorted(items_list, key=lambda it: order_map.get(it.get("id"), 9999))

    d_copy = {**d, "items": items_list}
    return DashboardResponse.model_validate(d_copy)

@router.get("", response_model=List[DashboardResponse])
def list_dashboards(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    dashboards = dynamodb_store.list_dashboards(workspace_id)
    dashboards.sort(key=lambda d: str(d.get("updated_at", d.get("created_at", ""))), reverse=True)
    return [_build_dashboard_response(d) for d in dashboards]

@router.post("", response_model=DashboardResponse)
def create_dashboard(
    d_in: DashboardCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(d_in.workspace_id, current_user)
    dashboard_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()

    dashboard_dict = {
        "id": dashboard_id,
        "workspace_id": d_in.workspace_id,
        "user_id": current_user.id,
        "title": d_in.title,
        "description": d_in.description,
        "is_public": False,
        "share_token": None,
        "share_expires_at": None,
        "layout": d_in.layout or {},
        "filters": d_in.filters or {},
        "items": [],
        "created_at": now_str,
        "updated_at": now_str,
    }

    created = dynamodb_store.create_dashboard(dashboard_dict)
    return _build_dashboard_response(created)

@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)
    return _build_dashboard_response(d)

@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    d_update: DashboardUpdate,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    if d_update.title is not None:
        d["title"] = d_update.title
    if d_update.description is not None:
        d["description"] = d_update.description
    if d_update.layout is not None:
        d["layout"] = dict(d_update.layout)
    if d_update.filters is not None:
        d["filters"] = dict(d_update.filters)
    if d_update.is_public is not None:
        d["is_public"] = d_update.is_public
        if d["is_public"] and not d.get("share_token"):
            d["share_token"] = secrets.token_urlsafe(32)

    existing_items = {item["id"]: item for item in d.get("items", [])}

    # Update items provided directly in d_update.items
    if d_update.items is not None:
        for item_data in d_update.items:
            if item_data.id and item_data.id in existing_items:
                item = existing_items[item_data.id]
                if item_data.title is not None:
                    item["title"] = item_data.title
                if item_data.widget_type is not None:
                    item["widget_type"] = item_data.widget_type
                if item_data.grid_pos is not None:
                    item["grid_pos"] = dict(item_data.grid_pos)
                if item_data.chart_spec is not None:
                    item["chart_spec"] = item_data.chart_spec
                if item_data.cached_data is not None:
                    item["cached_data"] = item_data.cached_data
                if item_data.config is not None:
                    item["config"] = item_data.config

    # If layout contains items with grid_pos, sync them to items as well
    layout = d.get("layout")
    if layout and isinstance(layout, dict) and "items" in layout and isinstance(layout["items"], list):
        for it in layout["items"]:
            if isinstance(it, dict) and it.get("id") in existing_items and "grid_pos" in it:
                existing_items[it["id"]]["grid_pos"] = dict(it["grid_pos"])

    d["items"] = list(existing_items.values())
    d["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated = dynamodb_store.update_dashboard(d["workspace_id"], dashboard_id, d)
    return _build_dashboard_response(updated)

@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    dynamodb_store.delete_dashboard(d["workspace_id"], dashboard_id)
    return {"message": "Dashboard successfully deleted."}

@router.post("/{dashboard_id}/items", response_model=DashboardItemResponse)
def add_dashboard_item(
    dashboard_id: str,
    item_in: DashboardItemCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    chart_dict = item_in.chart_spec.model_dump() if item_in.chart_spec else None

    # If linked to an analysis, grab chart spec and cached data from it
    if item_in.analysis_id and not chart_dict:
        a = dynamodb_store.get_analysis_by_id(item_in.analysis_id)
        if a and a.get("chart_spec"):
            chart_dict = a["chart_spec"]

    item_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()
    new_item = {
        "id": item_id,
        "dashboard_id": dashboard_id,
        "analysis_id": item_in.analysis_id,
        "title": item_in.title,
        "widget_type": item_in.widget_type,
        "grid_pos": item_in.grid_pos,
        "chart_spec": chart_dict,
        "cached_data": item_in.cached_data,
        "config": item_in.config or {},
        "created_at": now_str
    }

    items = d.get("items", [])
    items.append(new_item)
    d["items"] = items

    layout = d.get("layout")
    if layout and isinstance(layout, dict) and "item_order" in layout and isinstance(layout["item_order"], list):
        layout["item_order"].append(item_id)
        d["layout"] = layout

    d["updated_at"] = now_str
    dynamodb_store.update_dashboard(d["workspace_id"], dashboard_id, d)
    return DashboardItemResponse.model_validate(new_item)

@router.put("/{dashboard_id}/items/{item_id}", response_model=DashboardItemResponse)
def update_dashboard_item(
    dashboard_id: str,
    item_id: str,
    item_in: DashboardItemUpdate,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    items = d.get("items", [])
    target = None
    for item in items:
        if item["id"] == item_id:
            target = item
            break

    if not target:
        raise HTTPException(status_code=404, detail="Dashboard item not found.")

    if item_in.title is not None:
        target["title"] = item_in.title
    if item_in.widget_type is not None:
        target["widget_type"] = item_in.widget_type
    if item_in.grid_pos is not None:
        target["grid_pos"] = dict(item_in.grid_pos)
    if item_in.chart_spec is not None:
        target["chart_spec"] = item_in.chart_spec
    if item_in.cached_data is not None:
        target["cached_data"] = item_in.cached_data
    if item_in.config is not None:
        target["config"] = item_in.config

    d["items"] = items
    d["updated_at"] = datetime.now(timezone.utc).isoformat()
    dynamodb_store.update_dashboard(d["workspace_id"], dashboard_id, d)
    return DashboardItemResponse.model_validate(target)

@router.delete("/{dashboard_id}/items/{item_id}")
def delete_dashboard_item(
    dashboard_id: str,
    item_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    items = [it for it in d.get("items", []) if it["id"] != item_id]
    d["items"] = items

    layout = d.get("layout")
    if layout and isinstance(layout, dict) and "item_order" in layout and isinstance(layout["item_order"], list):
        layout["item_order"] = [iid for iid in layout["item_order"] if iid != item_id]
        d["layout"] = layout

    d["updated_at"] = datetime.now(timezone.utc).isoformat()
    dynamodb_store.update_dashboard(d["workspace_id"], dashboard_id, d)
    return {"message": "Widget removed from dashboard."}

@router.post("/{dashboard_id}/share")
def configure_dashboard_sharing(
    dashboard_id: str,
    enable: bool,
    expires_in_days: Optional[int] = None,
    current_user: ItemObject = Depends(get_current_user)
):
    d = dynamodb_store.get_dashboard_by_id(dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d["workspace_id"], current_user)

    now_dt = datetime.now(timezone.utc)
    if enable:
        d["is_public"] = True
        if not d.get("share_token"):
            d["share_token"] = secrets.token_urlsafe(32)
        if expires_in_days:
            d["share_expires_at"] = (now_dt + timedelta(days=expires_in_days)).isoformat()
        else:
            d["share_expires_at"] = None
    else:
        d["is_public"] = False
        d["share_token"] = None
        d["share_expires_at"] = None

    d["updated_at"] = now_dt.isoformat()
    dynamodb_store.update_dashboard(d["workspace_id"], dashboard_id, d)
    return {
        "is_public": d["is_public"],
        "share_token": d.get("share_token"),
        "share_expires_at": d.get("share_expires_at")
    }

@router.post("/generate", response_model=DashboardResponse)
def generate_ai_dashboard(
    req: AIDashboardGenerateRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(req.workspace_id, current_user)

    dataset = dynamodb_store.get_dataset_by_id(req.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # Resolve AI config
    ai_config_dict = None
    if req.provider_config_id:
        ai_config_dict = dynamodb_store.get_ai_config(req.workspace_id, req.provider_config_id)
    else:
        configs = dynamodb_store.list_ai_configs(req.workspace_id)
        if configs:
            # Prefer is_default
            default_cfgs = [c for c in configs if c.get("is_default")]
            ai_config_dict = default_cfgs[0] if default_cfgs else configs[0]

    chat_model = None
    if ai_config_dict:
        try:
            chat_model = get_chat_model_for_config(ItemObject(ai_config_dict))
        except Exception:
            chat_model = None

    # Ensure dataset is loaded in DuckDB (Platform or BYOC)
    storage = s3_storage.for_workspace(dataset.get("workspace_id"))
    local_path = storage.ensure_local_cache(dataset.get("file_path", ""))
    analytics_engine.register_dataset(dataset["duckdb_table_name"], local_path, "parquet")

    columns = dataset.get("columns", [])
    schema_list = [{"name": c["name"], "data_type": c.get("data_type", "categorical")} for c in columns]

    # Run AI Dashboard Generator
    from app.ai.agents.dashboard_graph import DashboardGeneratorWorkflow
    workflow = DashboardGeneratorWorkflow(llm=chat_model)
    generated = workflow.generate_dashboard(
        table_name=dataset["duckdb_table_name"],
        columns=schema_list,
        prompt=req.prompt
    )

    now_str = datetime.now(timezone.utc).isoformat()
    dashboard_id = str(uuid.uuid4())

    # Build items
    items_list = []
    item_order = []
    for w in generated["widgets"]:
        item_id = str(uuid.uuid4())
        item_order.append(item_id)
        items_list.append({
            "id": item_id,
            "dashboard_id": dashboard_id,
            "title": w["title"],
            "widget_type": w["widget_type"],
            "grid_pos": w["grid_pos"],
            "chart_spec": w["chart_spec"],
            "cached_data": w["cached_data"],
            "config": w.get("config"),
            "created_at": now_str
        })

    dashboard_dict = {
        "id": dashboard_id,
        "workspace_id": req.workspace_id,
        "user_id": current_user.id,
        "title": generated["title"],
        "description": generated["description"],
        "is_public": False,
        "share_token": None,
        "share_expires_at": None,
        "layout": {"item_order": item_order},
        "filters": {},
        "items": items_list,
        "created_at": now_str,
        "updated_at": now_str,
    }

    created = dynamodb_store.create_dashboard(dashboard_dict)
    return _build_dashboard_response(created)
