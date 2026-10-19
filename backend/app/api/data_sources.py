import os
import csv
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.dynamodb import dynamodb_store
from app.core.security import encrypt_credential, decrypt_credential
from app.core.s3_storage import s3_storage
from app.schemas.all_schemas import (
    DataSourceCreate,
    DataSourceResponse,
    DataSourceTableIngestRequest,
    DatasetResponse,
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.data_sources.sqlite_connector import SQLiteDataConnector
from app.data_sources.postgres_connector import PostgreSQLDataConnector
from app.data_sources.bigquery_connector import BigQueryDataConnector
from app.data_sources.snowflake_connector import SnowflakeDataConnector
from app.data_sources.databricks_connector import DatabricksDataConnector
from app.data_sources.google_sheets_connector import GoogleSheetsDataConnector
from app.data_sources.s3_connector import S3DataConnector
from app.ingestion.parser import DataParser
from app.analytics.profiler import DatasetProfiler
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/data-sources", tags=["External Data Sources"])

CONNECTORS = {
    "sqlite": SQLiteDataConnector(),
    "postgresql": PostgreSQLDataConnector(),
    "bigquery": BigQueryDataConnector(),
    "snowflake": SnowflakeDataConnector(),
    "databricks": DatabricksDataConnector(),
    "google_sheets": GoogleSheetsDataConnector(),
    "s3": S3DataConnector(),
}

SENSITIVE_CONFIG_KEYS = {
    "password",
    "access_token",
    "token",
    "api_key",
    "service_account_json",
    "credentials_json",
    "private_key",
    "secret",
    "aws_secret_access_key",
    "secret_access_key",
    "secret_key",
}


def _encrypt_connection_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Encrypts passwords, service account keys, and private secrets at rest."""
    encrypted = dict(cfg)
    for k in SENSITIVE_CONFIG_KEYS:
        val = encrypted.get(k)
        if val and isinstance(val, str) and not val.startswith("ENC:"):
            try:
                encrypted[k] = f"ENC:{encrypt_credential(val)}"
            except Exception:
                encrypted[k] = val
    return encrypted


def _decrypt_connection_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Decrypts credentials in-memory for connector driver executions."""
    decrypted = dict(cfg)
    for k in SENSITIVE_CONFIG_KEYS:
        val = decrypted.get(k)
        if val and isinstance(val, str) and val.startswith("ENC:"):
            try:
                raw_cipher = val[4:]
                decrypted[k] = decrypt_credential(raw_cipher)
            except Exception:
                pass
    return decrypted


def _mask_connection_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Replaces secret passwords and private keys with masked strings for API clients."""
    masked = dict(cfg)
    for k in SENSITIVE_CONFIG_KEYS:
        if k in masked and masked[k]:
            masked[k] = "••••••••"
    return masked


@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    sources = dynamodb_store.list_data_sources(workspace_id)
    sanitized = []
    for s in sources:
        s_copy = dict(s)
        if "connection_config" in s_copy and isinstance(s_copy["connection_config"], dict):
            s_copy["connection_config"] = _mask_connection_config(s_copy["connection_config"])
        sanitized.append(DataSourceResponse.model_validate(s_copy))
    return sanitized


@router.post("", response_model=DataSourceResponse)
def create_data_source(
    ds_in: DataSourceCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(ds_in.workspace_id, current_user)

    st = ds_in.source_type.lower()
    if st not in CONNECTORS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported connector type '{ds_in.source_type}'. Supported: {list(CONNECTORS.keys())}"
        )

    # Normalize connector specific parameters if applicable
    raw_config = dict(ds_in.connection_config)
    if st == "snowflake" and "account" in raw_config:
        raw_config["account"] = SnowflakeDataConnector.clean_account(raw_config["account"])
    elif st == "databricks":
        if "server_hostname" in raw_config:
            raw_config["server_hostname"] = DatabricksDataConnector.clean_hostname(raw_config["server_hostname"])
        if "http_path" in raw_config:
            raw_config["http_path"] = DatabricksDataConnector.clean_http_path(raw_config["http_path"])
    elif st == "s3":
        for k in ("s3_path", "aws_access_key_id", "aws_secret_access_key", "region_name"):
            if k in raw_config and isinstance(raw_config[k], str):
                raw_config[k] = raw_config[k].strip()

    # Securely encrypt sensitive credentials before writing to DynamoDB
    secure_config = _encrypt_connection_config(raw_config)

    source_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()
    source_dict = {
        "id": source_id,
        "workspace_id": ds_in.workspace_id,
        "user_id": current_user.id,
        "name": ds_in.name,
        "source_type": st,
        "connection_config": secure_config,
        "status": "active",
        "last_sync_at": None,
        "created_at": now_str,
    }

    created = dynamodb_store.create_data_source(source_dict)
    resp_dict = dict(created)
    resp_dict["connection_config"] = _mask_connection_config(raw_config)
    return DataSourceResponse.model_validate(resp_dict)


@router.post("/test")
def test_connection_adhoc(
    source_type: str,
    config: dict,
    source_id: Optional[str] = None,
    current_user: ItemObject = Depends(get_current_user)
):
    """Tests connectivity to a remote database or cloud data warehouse."""
    st = source_type.lower()
    connector = CONNECTORS.get(st)
    if not connector:
        raise HTTPException(status_code=400, detail=f"Unsupported connector type '{source_type}'.")

    # If testing an existing source and password was omitted/masked, load saved credentials
    effective_config = dict(config)
    if source_id:
        existing = dynamodb_store.get_data_source_by_id(source_id)
        if existing:
            get_current_workspace(existing["workspace_id"], current_user)
            saved_decrypted = _decrypt_connection_config(existing.get("connection_config", {}))
            for k, v in saved_decrypted.items():
                if effective_config.get(k) in ("", None, "••••••••"):
                    effective_config[k] = v

    if st == "snowflake" and "account" in effective_config:
        effective_config["account"] = SnowflakeDataConnector.clean_account(effective_config["account"])
    elif st == "databricks":
        if "server_hostname" in effective_config:
            effective_config["server_hostname"] = DatabricksDataConnector.clean_hostname(effective_config["server_hostname"])
        if "http_path" in effective_config:
            effective_config["http_path"] = DatabricksDataConnector.clean_http_path(effective_config["http_path"])
    elif st == "s3":
        for k in ("s3_path", "aws_access_key_id", "aws_secret_access_key", "region_name"):
            if k in effective_config and isinstance(effective_config[k], str):
                effective_config[k] = effective_config[k].strip()

    # Decrypt any encrypted fields passed
    effective_config = _decrypt_connection_config(effective_config)
    return connector.test_connection(effective_config)


@router.get("/{source_id}/tables")
def list_source_tables(
    source_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Lists accessible tables/sheets from a configured data connector."""
    s = dynamodb_store.get_data_source_by_id(source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Data source not found.")
    get_current_workspace(s["workspace_id"], current_user)

    connector = CONNECTORS.get(s["source_type"])
    if not connector:
        raise HTTPException(status_code=400, detail=f"No connector driver for '{s['source_type']}'.")

    decrypted_config = _decrypt_connection_config(s.get("connection_config", {}))
    try:
        tables = connector.list_tables(decrypted_config)
        return {"source_id": source_id, "source_type": s["source_type"], "tables": tables}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list tables from {connector.display_name}: {str(e)}"
        )


@router.get("/{source_id}/tables/{table_name}/schema")
def get_source_table_schema(
    source_id: str,
    table_name: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Inspects column definitions for a selected table."""
    s = dynamodb_store.get_data_source_by_id(source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Data source not found.")
    get_current_workspace(s["workspace_id"], current_user)

    connector = CONNECTORS.get(s["source_type"])
    if not connector:
        raise HTTPException(status_code=400, detail=f"No connector driver for '{s['source_type']}'.")

    decrypted_config = _decrypt_connection_config(s.get("connection_config", {}))
    try:
        cols = connector.get_table_schema(decrypted_config, table_name)
        return {"source_id": source_id, "table_name": table_name, "columns": cols}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to inspect schema for '{table_name}': {str(e)}"
        )


@router.post("/{source_id}/tables/{table_name}/ingest", response_model=DatasetResponse)
def ingest_source_table_as_dataset(
    source_id: str,
    table_name: str,
    req: DataSourceTableIngestRequest = DataSourceTableIngestRequest(),
    current_user: ItemObject = Depends(get_current_user)
):
    """Extracts rows from a connected database table and ingests into DuckDB as an Autoanalytix dataset."""
    s = dynamodb_store.get_data_source_by_id(source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Data source not found.")
    get_current_workspace(s["workspace_id"], current_user)

    connector = CONNECTORS.get(s["source_type"])
    if not connector:
        raise HTTPException(status_code=400, detail=f"No connector driver for '{s['source_type']}'.")

    decrypted_config = _decrypt_connection_config(s.get("connection_config", {}))
    limit = req.limit or 10000

    try:
        rows = connector.extract_data(decrypted_config, table_name, limit=limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to extract records from '{table_name}': {str(e)}"
        )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table '{table_name}' returned 0 records or is empty."
        )

    # Convert rows to a temporary CSV and parse via DataParser into Parquet & DuckDB
    file_id = str(uuid.uuid4())
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"
    dataset_name = req.dataset_name or f"{s['name']}: {table_name}"
    os.makedirs(os.path.join(settings.STORAGE_DIR, "uploads"), exist_ok=True)
    temp_csv_path = os.path.join(settings.STORAGE_DIR, "uploads", f"temp_{file_id}.csv")

    headers = list(rows[0].keys())
    with open(temp_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

    try:
        df, type_map, orig_cols = DataParser.parse_file(temp_csv_path, "csv")
        parquet_filename = f"{clean_table_name}.parquet"
        parquet_path = os.path.join(settings.STORAGE_DIR, "uploads", parquet_filename)
        df.write_parquet(parquet_path)
    finally:
        if os.path.exists(temp_csv_path):
            try:
                os.remove(temp_csv_path)
            except Exception:
                pass

    # Upload to S3 if configured
    try:
        s3_storage.upload_file(parquet_path, f"uploads/{parquet_filename}")
    except Exception as e:
        print(f"[!] Warning: S3 upload failed: {e}")

    # Register in DuckDB analytical engine
    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")

    # Generate Profile
    profile_data = DatasetProfiler.profile_dataframe(df, type_map, orig_cols)

    cols_list = []
    for col_info in profile_data.get("columns", []):
        cols_list.append({
            "id": str(uuid.uuid4()),
            "name": col_info["name"],
            "original_name": col_info["original_name"],
            "data_type": col_info["data_type"],
            "duckdb_type": col_info["duckdb_type"],
            "null_count": col_info["null_count"],
            "unique_count": col_info["unique_count"],
            "sample_values": col_info.get("sample_values"),
            "stats": col_info.get("stats")
        })

    rel_parquet_path = f"storage/uploads/{parquet_filename}"
    now_str = datetime.now(timezone.utc).isoformat()
    size_bytes = os.path.getsize(parquet_path) if os.path.exists(parquet_path) else 0

    dataset_dict = {
        "id": file_id,
        "workspace_id": s["workspace_id"],
        "user_id": current_user.id,
        "name": dataset_name,
        "original_filename": f"{s['source_type']}_{table_name}.parquet",
        "file_type": s["source_type"],
        "file_path": rel_parquet_path,
        "duckdb_table_name": clean_table_name,
        "row_count": df.height,
        "column_count": df.width,
        "size_bytes": size_bytes,
        "sheet_name": None,
        "status": "ready",
        "profile_summary": profile_data,
        "columns": cols_list,
        "created_at": now_str,
        "updated_at": now_str,
    }

    created = dynamodb_store.create_dataset(dataset_dict)

    # Update last_sync_at on the data source
    try:
        s["last_sync_at"] = now_str
        dynamodb_store.update_data_source(s)
    except Exception as e:
        print(f"[!] Warning: Failed to update last_sync_at: {e}")

    return DatasetResponse.model_validate(created)


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
