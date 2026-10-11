import secrets
import os
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.models.all_models import (
    Dashboard,
    DashboardItem,
    Dataset,
    DatasetColumn,
    AIProviderConfig,
    Analysis,
    User
)
from app.schemas.all_schemas import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardItemCreate,
    DashboardItemResponse,
    DashboardItemUpdate,
    AIDashboardGenerateRequest
)
from app.api.deps import get_current_user, get_current_workspace
from app.ai.providers.factory import get_chat_model_for_config
from app.ai.agents.dashboard_graph import DashboardGeneratorWorkflow
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

def _build_dashboard_response(dashboard: Dashboard) -> DashboardResponse:
    res = DashboardResponse.model_validate(dashboard)
    if dashboard.layout and isinstance(dashboard.layout, dict) and "item_order" in dashboard.layout:
        order_map = {item_id: idx for idx, item_id in enumerate(dashboard.layout["item_order"])}
        res.items.sort(key=lambda it: order_map.get(it.id, 9999))
    return res

@router.get("", response_model=List[DashboardResponse])
def list_dashboards(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)
    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.workspace_id == workspace_id)
        .order_by(Dashboard.updated_at.desc())
        .all()
    )
    return [_build_dashboard_response(d) for d in dashboards]

@router.post("", response_model=DashboardResponse)
def create_dashboard(
    d_in: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(d_in.workspace_id, current_user, db)
    dashboard = Dashboard(
        workspace_id=d_in.workspace_id,
        user_id=current_user.id,
        title=d_in.title,
        description=d_in.description,
        is_public=False,
        layout=d_in.layout or {},
        filters=d_in.filters or {}
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return _build_dashboard_response(dashboard)

@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)
    return _build_dashboard_response(d)

@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    d_update: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    if d_update.title is not None:
        d.title = d_update.title
    if d_update.description is not None:
        d.description = d_update.description
    if d_update.layout is not None:
        d.layout = dict(d_update.layout)
        flag_modified(d, "layout")
    if d_update.filters is not None:
        d.filters = dict(d_update.filters)
        flag_modified(d, "filters")
    if d_update.is_public is not None:
        d.is_public = d_update.is_public
        if d.is_public and not d.share_token:
            d.share_token = secrets.token_urlsafe(32)

    existing_items = {item.id: item for item in d.items}

    # Update items provided directly in d_update.items
    if d_update.items is not None:
        for item_data in d_update.items:
            if item_data.id and item_data.id in existing_items:
                item = existing_items[item_data.id]
                if item_data.title is not None:
                    item.title = item_data.title
                if item_data.widget_type is not None:
                    item.widget_type = item_data.widget_type
                if item_data.grid_pos is not None:
                    item.grid_pos = dict(item_data.grid_pos)
                    flag_modified(item, "grid_pos")
                if item_data.chart_spec is not None:
                    item.chart_spec = item_data.chart_spec
                    flag_modified(item, "chart_spec")
                if item_data.cached_data is not None:
                    item.cached_data = item_data.cached_data
                    flag_modified(item, "cached_data")
                if item_data.config is not None:
                    item.config = item_data.config
                    flag_modified(item, "config")

    # If layout contains items with grid_pos, sync them to items as well
    if d.layout and isinstance(d.layout, dict) and "items" in d.layout and isinstance(d.layout["items"], list):
        for it in d.layout["items"]:
            if isinstance(it, dict) and it.get("id") in existing_items and "grid_pos" in it:
                item = existing_items[it["id"]]
                item.grid_pos = dict(it["grid_pos"])
                flag_modified(item, "grid_pos")

    db.commit()
    db.refresh(d)
    return _build_dashboard_response(d)

@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    db.delete(d)
    db.commit()
    return {"message": "Dashboard successfully deleted."}

@router.post("/{dashboard_id}/items", response_model=DashboardItemResponse)
def add_dashboard_item(
    dashboard_id: str,
    item_in: DashboardItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    chart_dict = item_in.chart_spec.model_dump() if item_in.chart_spec else None

    # If linked to an analysis, grab chart spec and cached data from it
    if item_in.analysis_id and not chart_dict:
        a = db.query(Analysis).filter(Analysis.id == item_in.analysis_id).first()
        if a and a.chart_spec:
            chart_dict = a.chart_spec

    item = DashboardItem(
        dashboard_id=dashboard_id,
        analysis_id=item_in.analysis_id,
        title=item_in.title,
        widget_type=item_in.widget_type,
        grid_pos=item_in.grid_pos,
        chart_spec=chart_dict,
        cached_data=item_in.cached_data,
        config=item_in.config or {}
    )
    db.add(item)
    # If dashboard has item_order in layout, append new item id
    if d.layout and isinstance(d.layout, dict) and "item_order" in d.layout and isinstance(d.layout["item_order"], list):
        d.layout["item_order"].append(item.id)
        flag_modified(d, "layout")
    db.commit()
    db.refresh(item)
    return DashboardItemResponse.model_validate(item)

@router.put("/{dashboard_id}/items/{item_id}", response_model=DashboardItemResponse)
def update_dashboard_item(
    dashboard_id: str,
    item_id: str,
    item_in: DashboardItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    item = db.query(DashboardItem).filter(
        DashboardItem.id == item_id,
        DashboardItem.dashboard_id == dashboard_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard item not found.")

    if item_in.title is not None:
        item.title = item_in.title
    if item_in.widget_type is not None:
        item.widget_type = item_in.widget_type
    if item_in.grid_pos is not None:
        item.grid_pos = dict(item_in.grid_pos)
        flag_modified(item, "grid_pos")
    if item_in.chart_spec is not None:
        item.chart_spec = item_in.chart_spec
        flag_modified(item, "chart_spec")
    if item_in.cached_data is not None:
        item.cached_data = item_in.cached_data
        flag_modified(item, "cached_data")
    if item_in.config is not None:
        item.config = item_in.config
        flag_modified(item, "config")

    db.commit()
    db.refresh(item)
    return DashboardItemResponse.model_validate(item)

@router.delete("/{dashboard_id}/items/{item_id}")
def delete_dashboard_item(
    dashboard_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    item = db.query(DashboardItem).filter(DashboardItem.id == item_id, DashboardItem.dashboard_id == dashboard_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard item not found.")

    db.delete(item)
    if d.layout and isinstance(d.layout, dict) and "item_order" in d.layout and isinstance(d.layout["item_order"], list):
        d.layout["item_order"] = [iid for iid in d.layout["item_order"] if iid != item_id]
        flag_modified(d, "layout")
    db.commit()
    return {"message": "Widget removed from dashboard."}

@router.post("/{dashboard_id}/share")
def configure_dashboard_sharing(
    dashboard_id: str,
    enable: bool,
    expires_in_days: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    get_current_workspace(d.workspace_id, current_user, db)

    if enable:
        d.is_public = True
        if not d.share_token:
            d.share_token = secrets.token_urlsafe(32)
        if expires_in_days:
            d.share_expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        else:
            d.share_expires_at = None
    else:
        d.is_public = False
        d.share_token = None
        d.share_expires_at = None

    db.commit()
    db.refresh(d)
    return {
        "is_public": d.is_public,
        "share_token": d.share_token,
        "share_expires_at": d.share_expires_at
    }

@router.post("/generate", response_model=DashboardResponse)
def generate_ai_dashboard(
    req: AIDashboardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(req.workspace_id, current_user, db)

    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # Resolve AI config
    ai_config = None
    if req.provider_config_id:
        ai_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.id == req.provider_config_id,
            AIProviderConfig.workspace_id == req.workspace_id
        ).first()
    else:
        ai_config = (
            db.query(AIProviderConfig)
            .filter(AIProviderConfig.workspace_id == req.workspace_id)
            .order_by(AIProviderConfig.is_default.desc(), AIProviderConfig.created_at.desc())
            .first()
        )

    chat_model = None
    if ai_config:
        try:
            chat_model = get_chat_model_for_config(ai_config)
        except Exception:
            chat_model = None

    # Ensure dataset is loaded in DuckDB
    if os.path.exists(dataset.file_path):
        analytics_engine.register_dataset(dataset.duckdb_table_name, dataset.file_path, "parquet")

    columns = db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset.id).all()
    schema_list = [{"name": c.name, "data_type": c.data_type} for c in columns]

    # Run AI Dashboard Generator
    workflow = DashboardGeneratorWorkflow(llm=chat_model)
    generated = workflow.generate_dashboard(
        table_name=dataset.duckdb_table_name,
        columns=schema_list,
        prompt=req.prompt
    )

    # Persist Dashboard
    dashboard = Dashboard(
        workspace_id=req.workspace_id,
        user_id=current_user.id,
        title=generated["title"],
        description=generated["description"],
        is_public=False
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)

    # Persist Items
    for w in generated["widgets"]:
        item = DashboardItem(
            dashboard_id=dashboard.id,
            title=w["title"],
            widget_type=w["widget_type"],
            grid_pos=w["grid_pos"],
            chart_spec=w["chart_spec"],
            cached_data=w["cached_data"],
            config=w.get("config")
        )
        db.add(item)
    db.commit()
    db.refresh(dashboard)

    return DashboardResponse.model_validate(dashboard)
