import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import DataSource, User
from app.schemas.all_schemas import (
    DataSourceCreate,
    DataSourceResponse
)
from app.api.deps import get_current_user, get_current_workspace
from app.data_sources.sqlite_connector import SQLiteDataConnector

router = APIRouter(prefix="/data-sources", tags=["External Data Sources"])

CONNECTORS = {
    "sqlite": SQLiteDataConnector()
}

@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)
    sources = db.query(DataSource).filter(DataSource.workspace_id == workspace_id).all()
    return [DataSourceResponse.model_validate(s) for s in sources]

@router.post("", response_model=DataSourceResponse)
def create_data_source(
    ds_in: DataSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(ds_in.workspace_id, current_user, db)
    
    source = DataSource(
        workspace_id=ds_in.workspace_id,
        user_id=current_user.id,
        name=ds_in.name,
        source_type=ds_in.source_type,
        connection_config=ds_in.connection_config,
        status="active"
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return DataSourceResponse.model_validate(source)

@router.post("/test")
def test_connection_adhoc(
    source_type: str,
    config: dict,
    current_user: User = Depends(get_current_user)
):
    connector = CONNECTORS.get(source_type.lower())
    if not connector:
        raise HTTPException(status_code=400, detail=f"Unsupported connector type '{source_type}'.")
    return connector.test_connection(config)

@router.delete("/{source_id}")
def delete_data_source(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    s = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Data source not found.")
    get_current_workspace(s.workspace_id, current_user, db)

    db.delete(s)
    db.commit()
    return {"message": "Data source removed."}
