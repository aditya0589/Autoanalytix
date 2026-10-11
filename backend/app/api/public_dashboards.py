from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Dashboard, DashboardItem
from app.schemas.all_schemas import PublicDashboardResponse, DashboardItemResponse

router = APIRouter(prefix="/public/dashboards", tags=["Public Dashboards"])

@router.get("/{share_token}", response_model=PublicDashboardResponse)
def get_public_dashboard(share_token: str, db: Session = Depends(get_db)):
    """
    Public dashboard viewer endpoint.
    Requires NO authentication and NO user AI provider keys.
    Exposes ONLY sanitized visualization specs and cached data.
    """
    dashboard = (
        db.query(Dashboard)
        .filter(Dashboard.share_token == share_token, Dashboard.is_public == True)
        .first()
    )
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared dashboard not found or link has expired."
        )

    if dashboard.share_expires_at:
        if datetime.now(timezone.utc) > dashboard.share_expires_at.replace(tzinfo=timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This dashboard share link has expired."
            )

    items = (
        db.query(DashboardItem)
        .filter(DashboardItem.dashboard_id == dashboard.id)
        .order_by(DashboardItem.created_at.asc())
        .all()
    )

    item_responses = [
        DashboardItemResponse(
            id=item.id,
            dashboard_id="",  # Redacted
            analysis_id=None,  # Redacted
            title=item.title,
            widget_type=item.widget_type,
            grid_pos=item.grid_pos,
            chart_spec=item.chart_spec,
            cached_data=item.cached_data,
            config=None,  # Redacted raw configs
            created_at=item.created_at
        )
        for item in items
    ]

    if dashboard.layout and isinstance(dashboard.layout, dict) and "item_order" in dashboard.layout and isinstance(dashboard.layout["item_order"], list):
        order_map = {item_id: idx for idx, item_id in enumerate(dashboard.layout["item_order"])}
        item_responses.sort(key=lambda it: order_map.get(it.id, 9999))

    return PublicDashboardResponse(
        title=dashboard.title,
        description=dashboard.description,
        items=item_responses,
        created_at=dashboard.created_at
    )
