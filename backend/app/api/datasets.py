import os
import shutil
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from app.core.config import settings
from app.core.dynamodb import dynamodb_store
from app.core.s3_storage import s3_storage
from app.schemas.all_schemas import (
    DatasetResponse,
    DatasetPreviewResponse,
    DatasetProfileResponse,
    ColumnStat
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.ingestion.parser import DataParser
from app.analytics.profiler import DatasetProfiler
from app.analytics.engine import analytics_engine
from app.ingestion.demo_data import generate_demo_dataset

router = APIRouter(prefix="/datasets", tags=["Datasets"])

@router.get("/presigned-upload-url")
def get_presigned_upload_url(
    filename: str,
    workspace_id: Optional[str] = None,
    content_type: str = "application/octet-stream",
    current_user: ItemObject = Depends(get_current_user)
):
    """Generates a presigned S3 upload URL for direct browser uploads (Platform or BYOC)."""
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}_{filename}"
    s3_key = f"uploads/{stored_filename}"
    storage = s3_storage.for_workspace(workspace_id) if workspace_id else s3_storage
    return storage.generate_presigned_upload_url(s3_key, content_type)

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    workspace_id: str = Form(...),
    name: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: ItemObject = Depends(get_current_user)
):
    workspace = get_current_workspace(workspace_id, current_user)
    storage = s3_storage.for_workspace(workspace)

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("csv", "xlsx", "xls", "parquet"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Supported formats are: CSV, XLSX, XLS, Parquet."
        )

    # Save original file locally
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}_{file.filename}"
    save_path = os.path.join(settings.STORAGE_DIR, "uploads", stored_filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_bytes = os.path.getsize(save_path)
    dataset_name = name or file.filename.rsplit(".", 1)[0].replace("_", " ").title()
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"

    # Upload raw file to S3 (Platform or BYOC)
    try:
        storage.upload_file(save_path, f"uploads/{stored_filename}")
    except Exception as e:
        print(f"[!] Warning: Storage raw file upload failed: {e}")

    # Parse file into Polars DataFrame
    try:
        df, type_map, orig_cols = DataParser.parse_file(save_path, ext, sheet_name)
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded data: {str(e)}")

    # Register in DuckDB and write Parquet
    parquet_path = os.path.join(settings.STORAGE_DIR, "uploads", f"{clean_table_name}.parquet")
    df.write_parquet(parquet_path)
    
    # Upload parquet to S3 (Platform or BYOC) for durable persistence
    try:
        storage.upload_file(parquet_path, f"uploads/{clean_table_name}.parquet")
    except Exception as e:
        print(f"[!] Warning: Storage parquet upload failed: {e}")

    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")

    # Generate Profile
    profile_data = DatasetProfiler.profile_dataframe(df, type_map, orig_cols)

    # Save column stats
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

    rel_parquet_path = f"storage/uploads/{clean_table_name}.parquet"
    now_str = datetime.now(timezone.utc).isoformat()
    dataset_dict = {
        "id": file_id,
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "name": dataset_name,
        "original_filename": file.filename,
        "file_type": ext,
        "file_path": rel_parquet_path,
        "duckdb_table_name": clean_table_name,
        "row_count": df.height,
        "column_count": df.width,
        "size_bytes": size_bytes,
        "sheet_name": sheet_name,
        "status": "ready",
        "profile_summary": profile_data,
        "columns": cols_list,
        "created_at": now_str,
        "updated_at": now_str,
    }

    created = dynamodb_store.create_dataset(dataset_dict)
    return DatasetResponse.model_validate(created)

@router.post("/demo", response_model=DatasetResponse)
def create_demo_dataset_endpoint(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Loads the pre-built, realistic B2B SaaS sales dataset with 1-click."""
    get_current_workspace(workspace_id, current_user)

    csv_path = generate_demo_dataset()
    file_id = str(uuid.uuid4())
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"
    
    df, type_map, orig_cols = DataParser.parse_file(csv_path, "csv")
    parquet_path = os.path.join(settings.STORAGE_DIR, "uploads", f"{clean_table_name}.parquet")
    os.makedirs(os.path.dirname(parquet_path), exist_ok=True)
    df.write_parquet(parquet_path)
    
    # Upload parquet to S3
    try:
        s3_storage.upload_file(parquet_path, f"uploads/{clean_table_name}.parquet")
    except Exception as e:
        print(f"[!] Warning: S3 parquet upload failed: {e}")

    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")
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

    rel_parquet_path = f"storage/uploads/{clean_table_name}.parquet"
    now_str = datetime.now(timezone.utc).isoformat()
    dataset_dict = {
        "id": file_id,
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "name": "B2B SaaS Sales & Revenue (Demo)",
        "description": "Comprehensive 2025-2026 sales orders across Enterprise, Mid-Market, and SMB tiers.",
        "original_filename": "b2b_saas_sales_2025_2026.csv",
        "file_type": "csv",
        "file_path": rel_parquet_path,
        "duckdb_table_name": clean_table_name,
        "row_count": df.height,
        "column_count": df.width,
        "size_bytes": os.path.getsize(csv_path),
        "status": "ready",
        "profile_summary": profile_data,
        "columns": cols_list,
        "created_at": now_str,
        "updated_at": now_str,
    }

    created = dynamodb_store.create_dataset(dataset_dict)
    return DatasetResponse.model_validate(created)

@router.get("", response_model=List[DatasetResponse])
def list_datasets(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    datasets = dynamodb_store.list_datasets(workspace_id)
    # Sort descending by created_at
    datasets.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
    return [DatasetResponse.model_validate(d) for d in datasets]

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    dataset = dynamodb_store.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset["workspace_id"], current_user)
    return DatasetResponse.model_validate(dataset)

@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: str,
    limit: int = 100,
    current_user: ItemObject = Depends(get_current_user)
):
    dataset = dynamodb_store.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset["workspace_id"], current_user)

    # Ensure table is cached locally and loaded into DuckDB
    storage = s3_storage.for_workspace(dataset.get("workspace_id"))
    local_path = storage.ensure_local_cache(dataset.get("file_path", ""))
    analytics_engine.register_dataset(dataset["duckdb_table_name"], local_path, "parquet")

    # Fetch rows
    res = analytics_engine.execute_query(
        f"SELECT * FROM {dataset['duckdb_table_name']} LIMIT {limit}",
        dataset["duckdb_table_name"]
    )

    columns = dataset.get("columns", [])
    row_count = dataset.get("row_count", 0)
    column_stats = [
        ColumnStat(
            name=c["name"],
            original_name=c.get("original_name", c["name"]),
            data_type=c.get("data_type", "categorical"),
            duckdb_type=c.get("duckdb_type", "VARCHAR"),
            null_count=c.get("null_count", 0),
            null_percentage=round((c.get("null_count", 0) / row_count) * 100, 2) if row_count > 0 else 0.0,
            unique_count=c.get("unique_count", 0),
            sample_values=c.get("sample_values") or [],
            stats=c.get("stats") or {}
        )
        for c in columns
    ]

    return DatasetPreviewResponse(
        dataset_id=dataset["id"],
        name=dataset["name"],
        row_count=row_count,
        column_count=dataset.get("column_count", len(columns)),
        columns=column_stats,
        rows=res["rows"]
    )

@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    dataset = dynamodb_store.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset["workspace_id"], current_user)

    prof = dataset.get("profile_summary") or {}
    columns = dataset.get("columns", [])
    row_count = dataset.get("row_count", 0)
    col_count = dataset.get("column_count", len(columns))

    column_stats = [
        ColumnStat(
            name=c["name"],
            original_name=c.get("original_name", c["name"]),
            data_type=c.get("data_type", "categorical"),
            duckdb_type=c.get("duckdb_type", "VARCHAR"),
            null_count=c.get("null_count", 0),
            null_percentage=round((c.get("null_count", 0) / row_count) * 100, 2) if row_count > 0 else 0.0,
            unique_count=c.get("unique_count", 0),
            sample_values=c.get("sample_values") or [],
            stats=c.get("stats") or {}
        )
        for c in columns
    ]

    return DatasetProfileResponse(
        dataset_id=dataset["id"],
        name=dataset["name"],
        row_count=row_count,
        column_count=col_count,
        size_bytes=dataset.get("size_bytes", 0),
        duplicate_rows_count=prof.get("duplicate_rows_count", 0),
        total_cells=prof.get("total_cells", row_count * col_count),
        missing_cells_count=prof.get("missing_cells_count", 0),
        missing_cells_percentage=prof.get("missing_cells_percentage", 0.0),
        columns=column_stats,
        summary_insights=prof.get("summary_insights", []),
        suggested_questions=prof.get("suggested_questions", [])
    )

@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    dataset = dynamodb_store.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset["workspace_id"], current_user)

    # Drop DuckDB table
    try:
        analytics_engine.conn.execute(f"DROP TABLE IF EXISTS {dataset['duckdb_table_name']}")
    except Exception:
        pass

    # Remove local file if present
    file_path = dataset.get("file_path", "")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    # Remove from S3 (Platform or BYOC)
    s3_key = file_path.replace("\\", "/")
    if "storage/" in s3_key:
        s3_key = s3_key.split("storage/", 1)[1]
    storage = s3_storage.for_workspace(dataset.get("workspace_id"))
    storage.delete_file(s3_key)

    dynamodb_store.delete_dataset(dataset["workspace_id"], dataset_id)
    return {"message": "Dataset successfully deleted."}
