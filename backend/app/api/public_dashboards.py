from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status

from app.core.dynamodb import dynamodb_store
from app.schemas.all_schemas import PublicDashboardResponse, DashboardItemResponse

router = APIRouter(prefix="/public/dashboards", tags=["Public Dashboards"])

@router.get("/{share_token}", response_model=PublicDashboardResponse)
def get_public_dashboard(share_token: str):
    """
    Public dashboard viewer endpoint.
    Requires NO authentication and NO user AI provider keys.
    Exposes ONLY sanitized visualization specs and cached data.
    """
    dashboard = dynamodb_store.get_dashboard_by_share_token(share_token)
    if not dashboard or not dashboard.get("is_public"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared dashboard not found or link has expired."
        )

    share_expires_at = dashboard.get("share_expires_at")
    if share_expires_at:
        try:
            exp_dt = datetime.fromisoformat(share_expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This dashboard share link has expired."
                )
        except Exception:
            pass

    items = dashboard.get("items", [])
    item_responses = [
        DashboardItemResponse(
            id=item["id"],
            dashboard_id="",  # Redacted
            analysis_id=None,  # Redacted
            title=item.get("title", ""),
            widget_type=item.get("widget_type", "chart"),
            grid_pos=item.get("grid_pos", {}),
            chart_spec=item.get("chart_spec"),
            cached_data=item.get("cached_data"),
            config=None,  # Redacted raw configs
            created_at=item.get("created_at") or datetime.now(timezone.utc)
        )
        for item in items
    ]

    layout = dashboard.get("layout")
    if layout and isinstance(layout, dict) and "item_order" in layout and isinstance(layout["item_order"], list):
        order_map = {item_id: idx for idx, item_id in enumerate(layout["item_order"])}
        item_responses.sort(key=lambda it: order_map.get(it.id, 9999))

    return PublicDashboardResponse(
        title=dashboard["title"],
        description=dashboard.get("description"),
        items=item_responses,
        created_at=dashboard.get("created_at") or datetime.now(timezone.utc)
    )
