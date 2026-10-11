import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.core.dynamodb import dynamodb_store
from app.schemas.all_schemas import (
    DataSourceCreate,
    DataSourceResponse
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.data_sources.sqlite_connector import SQLiteDataConnector

router = APIRouter(prefix="/data-sources", tags=["External Data Sources"])

CONNECTORS = {
    "sqlite": SQLiteDataConnector()
}

@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    sources = dynamodb_store.list_data_sources(workspace_id)
    return [DataSourceResponse.model_validate(s) for s in sources]

@router.post("", response_model=DataSourceResponse)
def create_data_source(
    ds_in: DataSourceCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(ds_in.workspace_id, current_user)
    
    source_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()
    source_dict = {
        "id": source_id,
        "workspace_id": ds_in.workspace_id,
        "user_id": current_user.id,
        "name": ds_in.name,
        "source_type": ds_in.source_type,
        "connection_config": ds_in.connection_config,
        "status": "active",
        "last_sync_at": None,
        "created_at": now_str,
    }

    created = dynamodb_store.create_data_source(source_dict)
    return DataSourceResponse.model_validate(created)

@router.post("/test")
def test_connection_adhoc(
    source_type: str,
    config: dict,
    current_user: ItemObject = Depends(get_current_user)
):
    connector = CONNECTORS.get(source_type.lower())
    if not connector:
        raise HTTPException(status_code=400, detail=f"Unsupported connector type '{source_type}'.")
    return connector.test_connection(config)

@router.delete("/{source_id}")
def delete_data_source(
    source_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    s = dynamodb_store.get_data_source_by_id(source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Data source not found.")
    get_current_workspace(s["workspace_id"], current_user)

    dynamodb_store.delete_data_source(s["workspace_id"], source_id)
    return {"message": "Data source removed."}
