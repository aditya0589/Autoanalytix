import secrets
import os
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
    AIDashboardGenerateRequest
)
from app.api.deps import get_current_user, get_current_workspace
from app.ai.providers.factory import get_chat_model_for_config
from app.ai.agents.dashboard_graph import DashboardGeneratorWorkflow
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

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
    return [DashboardResponse.model_validate(d) for d in dashboards]

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
    return DashboardResponse.model_validate(dashboard)

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
    return DashboardResponse.model_validate(d)

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
        d.layout = d_update.layout
    if d_update.filters is not None:
        d.filters = d_update.filters
    if d_update.is_public is not None:
        d.is_public = d_update.is_public
        if d.is_public and not d.share_token:
            d.share_token = secrets.token_urlsafe(32)

    db.commit()
    db.refresh(d)
    return DashboardResponse.model_validate(d)

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
