import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.all_models import Dataset, DatasetColumn, User
from app.schemas.all_schemas import (
    DatasetResponse,
    DatasetPreviewResponse,
    DatasetProfileResponse,
    ColumnStat
)
from app.api.deps import get_current_user, get_current_workspace
from app.ingestion.parser import DataParser
from app.analytics.profiler import DatasetProfiler
from app.analytics.engine import analytics_engine
from app.ingestion.demo_data import generate_demo_dataset

router = APIRouter(prefix="/datasets", tags=["Datasets"])

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    workspace_id: str = Form(...),
    name: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("csv", "xlsx", "xls", "parquet"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Supported formats are: CSV, XLSX, XLS."
        )

    # Save original file
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}_{file.filename}"
    save_path = os.path.join(settings.STORAGE_DIR, "uploads", stored_filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_bytes = os.path.getsize(save_path)
    dataset_name = name or file.filename.rsplit(".", 1)[0].replace("_", " ").title()
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"

    # Parse file into Polars DataFrame
    try:
        df, type_map, orig_cols = DataParser.parse_file(save_path, ext, sheet_name)
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded data: {str(e)}")

    # Register in DuckDB
    parquet_path = os.path.join(settings.STORAGE_DIR, "uploads", f"{clean_table_name}.parquet")
    df.write_parquet(parquet_path)
    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")

    # Generate Profile
    profile_data = DatasetProfiler.profile_dataframe(df, type_map, orig_cols)

    # Create Dataset in Postgres/SQLite
    dataset = Dataset(
        id=file_id,
        workspace_id=workspace_id,
        user_id=current_user.id,
        name=dataset_name,
        original_filename=file.filename,
        file_type=ext,
        file_path=parquet_path,
        duckdb_table_name=clean_table_name,
        row_count=df.height,
        column_count=df.width,
        size_bytes=size_bytes,
        sheet_name=sheet_name,
        status="ready",
        profile_summary=profile_data
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Save individual columns
    for col_info in profile_data.get("columns", []):
        col_rec = DatasetColumn(
            dataset_id=dataset.id,
            name=col_info["name"],
            original_name=col_info["original_name"],
            data_type=col_info["data_type"],
            duckdb_type=col_info["duckdb_type"],
            null_count=col_info["null_count"],
            unique_count=col_info["unique_count"],
            sample_values=col_info.get("sample_values"),
            stats=col_info.get("stats")
        )
        db.add(col_rec)
    db.commit()

    return DatasetResponse.model_validate(dataset)

@router.post("/demo", response_model=DatasetResponse)
def create_demo_dataset_endpoint(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Loads the pre-built, realistic B2B SaaS sales dataset with 1-click."""
    get_current_workspace(workspace_id, current_user, db)

    csv_path = generate_demo_dataset()
    file_id = str(uuid.uuid4())
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"
    
    df, type_map, orig_cols = DataParser.parse_file(csv_path, "csv")
    parquet_path = os.path.join(settings.STORAGE_DIR, "uploads", f"{clean_table_name}.parquet")
    df.write_parquet(parquet_path)
    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")

    profile_data = DatasetProfiler.profile_dataframe(df, type_map, orig_cols)

    dataset = Dataset(
        id=file_id,
        workspace_id=workspace_id,
        user_id=current_user.id,
        name="B2B SaaS Sales & Revenue (Demo)",
        description="Comprehensive 2025-2026 sales orders across Enterprise, Mid-Market, and SMB tiers.",
        original_filename="b2b_saas_sales_2025_2026.csv",
        file_type="csv",
        file_path=parquet_path,
        duckdb_table_name=clean_table_name,
        row_count=df.height,
        column_count=df.width,
        size_bytes=os.path.getsize(csv_path),
        status="ready",
        profile_summary=profile_data
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    for col_info in profile_data.get("columns", []):
        col_rec = DatasetColumn(
            dataset_id=dataset.id,
            name=col_info["name"],
            original_name=col_info["original_name"],
            data_type=col_info["data_type"],
            duckdb_type=col_info["duckdb_type"],
            null_count=col_info["null_count"],
            unique_count=col_info["unique_count"],
            sample_values=col_info.get("sample_values"),
            stats=col_info.get("stats")
        )
        db.add(col_rec)
    db.commit()

    return DatasetResponse.model_validate(dataset)

@router.get("", response_model=List[DatasetResponse])
def list_datasets(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)
    datasets = (
        db.query(Dataset)
        .filter(Dataset.workspace_id == workspace_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    return [DatasetResponse.model_validate(d) for d in datasets]

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset.workspace_id, current_user, db)
    return DatasetResponse.model_validate(dataset)

@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset.workspace_id, current_user, db)

    # Ensure table is loaded in DuckDB
    if os.path.exists(dataset.file_path):
        analytics_engine.register_dataset(dataset.duckdb_table_name, dataset.file_path, "parquet")

    # Fetch rows
    res = analytics_engine.execute_query(
        f"SELECT * FROM {dataset.duckdb_table_name} LIMIT {limit}",
        dataset.duckdb_table_name
    )

    columns = (
        db.query(DatasetColumn)
        .filter(DatasetColumn.dataset_id == dataset_id)
        .all()
    )

    column_stats = [
        ColumnStat(
            name=c.name,
            original_name=c.original_name,
            data_type=c.data_type,
            duckdb_type=c.duckdb_type,
            null_count=c.null_count,
            null_percentage=round((c.null_count / dataset.row_count) * 100, 2) if dataset.row_count > 0 else 0.0,
            unique_count=c.unique_count,
            sample_values=c.sample_values or [],
            stats=c.stats or {}
        )
        for c in columns
    ]

    return DatasetPreviewResponse(
        dataset_id=dataset.id,
        name=dataset.name,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        columns=column_stats,
        rows=res["rows"]
    )

@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset.workspace_id, current_user, db)

    prof = dataset.profile_summary or {}
    columns = (
        db.query(DatasetColumn)
        .filter(DatasetColumn.dataset_id == dataset_id)
        .all()
    )

    column_stats = [
        ColumnStat(
            name=c.name,
            original_name=c.original_name,
            data_type=c.data_type,
            duckdb_type=c.duckdb_type,
            null_count=c.null_count,
            null_percentage=round((c.null_count / dataset.row_count) * 100, 2) if dataset.row_count > 0 else 0.0,
            unique_count=c.unique_count,
            sample_values=c.sample_values or [],
            stats=c.stats or {}
        )
        for c in columns
    ]

    return DatasetProfileResponse(
        dataset_id=dataset.id,
        name=dataset.name,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        size_bytes=dataset.size_bytes,
        duplicate_rows_count=prof.get("duplicate_rows_count", 0),
        total_cells=prof.get("total_cells", dataset.row_count * dataset.column_count),
        missing_cells_count=prof.get("missing_cells_count", 0),
        missing_cells_percentage=prof.get("missing_cells_percentage", 0.0),
        columns=column_stats,
        summary_insights=prof.get("summary_insights", []),
        suggested_questions=prof.get("suggested_questions", [])
    )

@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    get_current_workspace(dataset.workspace_id, current_user, db)

    # Drop DuckDB table
    try:
        analytics_engine.conn.execute(f"DROP TABLE IF EXISTS {dataset.duckdb_table_name}")
    except Exception:
        pass

    # Remove parquet file
    if os.path.exists(dataset.file_path):
        try:
            os.remove(dataset.file_path)
        except Exception:
            pass

    db.delete(dataset)
    db.commit()
    return {"message": "Dataset successfully deleted."}
