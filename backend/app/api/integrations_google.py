import os
import uuid
import json
import csv
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import encrypt_credential, decrypt_credential
from app.core.dynamodb import dynamodb_store
from app.core.s3_storage import s3_storage
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.integrations.google_workspace import google_workspace_service
from app.ingestion.parser import DataParser
from app.analytics.profiler import DatasetProfiler
from app.analytics.engine import analytics_engine
from app.schemas.all_schemas import (
    GoogleAuthUrlResponse,
    GoogleAuthCallbackRequest,
    GoogleIntegrationStatusResponse,
    GoogleDriveFileItem,
    GoogleDocExportRequest,
    GoogleDocExportResponse,
    GoogleDocContentResponse,
    GoogleSheetImportRequest,
    GoogleSheetImportResponse
)

router = APIRouter(prefix="/integrations/google", tags=["Google Workspace Integration"])


@router.get("/status", response_model=GoogleIntegrationStatusResponse)
def get_google_integration_status(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Returns the current connection status of Google Workspace for the given workspace."""
    get_current_workspace(workspace_id, current_user)
    integration = dynamodb_store.get_workspace_integration(workspace_id, "google_workspace")

    if not integration or integration.get("status") != "connected":
        return GoogleIntegrationStatusResponse(
            connected=False,
            status="disconnected",
            has_custom_credentials=google_workspace_service.is_configured()
        )

    meta = integration.get("metadata_info") or {}
    scopes = meta.get("scopes", [])
    if isinstance(scopes, str):
        scopes = scopes.split(" ")

    return GoogleIntegrationStatusResponse(
        connected=True,
        account_email=integration.get("account_email"),
        status=integration.get("status", "connected"),
        scopes=scopes,
        last_synced_at=integration.get("last_synced_at"),
        has_custom_credentials=google_workspace_service.is_configured()
    )


@router.get("/auth-url", response_model=GoogleAuthUrlResponse)
def get_google_auth_url(
    workspace_id: str,
    redirect_uri: Optional[str] = None,
    current_user: ItemObject = Depends(get_current_user)
):
    """Generates the Google OAuth 2.0 consent URL."""
    get_current_workspace(workspace_id, current_user)
    auth_url, state = google_workspace_service.generate_auth_url(workspace_id, redirect_uri)
    return GoogleAuthUrlResponse(auth_url=auth_url, state=state)


@router.post("/callback", response_model=GoogleIntegrationStatusResponse)
async def google_oauth_callback(
    req: GoogleAuthCallbackRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    """Exchanges Google OAuth code for tokens, encrypts them at rest, and connects the workspace."""
    get_current_workspace(req.workspace_id, current_user)

    try:
        tokens = await google_workspace_service.exchange_code_for_tokens(
            code=req.code,
            redirect_uri=req.redirect_uri
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth authorization exchange failed: {str(e)}"
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    encrypted_creds = encrypt_credential(json.dumps(tokens))
    account_email = tokens.get("email") or f"{current_user.email} (Google)"

    integration_payload = {
        "id": str(uuid.uuid4()),
        "workspace_id": req.workspace_id,
        "user_id": current_user.id,
        "provider": "google_workspace",
        "account_email": account_email,
        "encrypted_credentials": encrypted_creds,
        "status": "connected",
        "metadata_info": {
            "account_name": tokens.get("name", ""),
            "scopes": tokens.get("scope", "").split(" ") if tokens.get("scope") else [],
        },
        "last_synced_at": now_iso,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    dynamodb_store.save_workspace_integration(integration_payload)

    return GoogleIntegrationStatusResponse(
        connected=True,
        account_email=account_email,
        status="connected",
        scopes=tokens.get("scope", "").split(" ") if tokens.get("scope") else [],
        last_synced_at=now_iso,
        has_custom_credentials=google_workspace_service.is_configured()
    )


@router.post("/disconnect")
def disconnect_google_workspace(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Disconnects Google Workspace and deletes encrypted tokens from the workspace."""
    get_current_workspace(workspace_id, current_user)
    dynamodb_store.delete_workspace_integration(workspace_id, "google_workspace")
    return {"message": "Google Workspace integration disconnected successfully."}


@router.get("/drive/files", response_model=List[GoogleDriveFileItem])
async def list_drive_files(
    workspace_id: str,
    mime_type: Optional[str] = None,
    query: Optional[str] = None,
    current_user: ItemObject = Depends(get_current_user)
):
    """Lists Google Docs and Google Sheets accessible in the connected Google account."""
    get_current_workspace(workspace_id, current_user)
    try:
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        files = await google_workspace_service.list_drive_files(token, mime_type, query)
        return [GoogleDriveFileItem(**f) for f in files]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch files from Google Drive: {str(e)}"
        )


@router.get("/docs/{doc_id}", response_model=GoogleDocContentResponse)
async def get_google_doc_content(
    workspace_id: str,
    doc_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Retrieves text and markdown from a Google Doc for AI context grounding."""
    get_current_workspace(workspace_id, current_user)
    try:
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        title, md, char_count = await google_workspace_service.get_document_markdown(token, doc_id)
        return GoogleDocContentResponse(
            document_id=doc_id,
            title=title,
            content_markdown=md,
            raw_character_count=char_count
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read Google Doc: {str(e)}"
        )


@router.post("/docs/export", response_model=GoogleDocExportResponse)
async def export_analysis_to_google_doc(
    req: GoogleDocExportRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    """Exports an AI analysis or executive dashboard findings to a newly formatted Google Doc."""
    get_current_workspace(req.workspace_id, current_user)
    try:
        token = await google_workspace_service.get_valid_access_token(req.workspace_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google Workspace is not connected: {str(e)}"
        )

    # Pull details if an analysis_id was specified
    exec_summary = req.executive_summary
    markdown_content = req.markdown_content
    sql_query = None
    table_cols = None
    table_rows = None

    if req.analysis_id:
        analysis = dynamodb_store.get_analysis(req.workspace_id, req.analysis_id)
        if analysis:
            if not exec_summary:
                exec_summary = analysis.get("explanation")
            if req.include_sql:
                sql_query = analysis.get("generated_sql")
            if req.include_tables and analysis.get("results_preview"):
                table_cols = analysis.get("results_columns")
                table_rows = analysis.get("results_preview")

    try:
        doc_id, doc_url = await google_workspace_service.create_formatted_report(
            access_token=token,
            title=req.title,
            executive_summary=exec_summary,
            markdown_content=markdown_content,
            sql_query=sql_query,
            table_columns=table_cols,
            table_rows=table_rows
        )
        return GoogleDocExportResponse(
            document_id=doc_id,
            title=req.title,
            document_url=doc_url,
            message="Google Doc generated successfully."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export Google Doc: {str(e)}"
        )


@router.get("/sheets/{sheet_id}/tabs")
async def list_sheet_tabs(
    workspace_id: str,
    sheet_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Lists sheet tabs in a Google Spreadsheet."""
    get_current_workspace(workspace_id, current_user)
    try:
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        tabs = await google_workspace_service.list_spreadsheet_tabs(token, sheet_id)
        return {"spreadsheet_id": sheet_id, "tabs": tabs}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch spreadsheet tabs: {str(e)}"
        )


@router.post("/sheets/import", response_model=GoogleSheetImportResponse)
async def import_google_sheet_as_dataset(
    req: GoogleSheetImportRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    """Extracts rows from a Google Sheet tab and ingests them into DuckDB as an Autoanalytix dataset."""
    # 1. Attempt direct extraction via shared link (Zero OAuth / Google Cloud credentials required)
    rows = None
    tab_name = req.tab_name or "Sheet1"
    direct_error = None

    try:
        url_rows, detected_tab = await google_workspace_service.extract_sheet_rows_from_shared_url(
            req.spreadsheet_id,
            limit_rows=req.limit_rows
        )
        if url_rows:
            rows = url_rows
            if not req.tab_name and detected_tab:
                tab_name = detected_tab
    except Exception as e:
        direct_error = str(e)

    # 2. If direct extraction didn't work (e.g. private sheet), attempt authenticated OAuth flow
    if not rows:
        try:
            token = await google_workspace_service.get_valid_access_token(req.workspace_id)
            if not req.tab_name:
                tabs = await google_workspace_service.list_spreadsheet_tabs(token, req.spreadsheet_id)
                if tabs:
                    tab_name = tabs[0]
            rows = await google_workspace_service.extract_sheet_rows(
                access_token=token,
                spreadsheet_id=req.spreadsheet_id,
                tab_name=tab_name,
                limit_rows=req.limit_rows
            )
        except Exception as oauth_err:
            error_detail = (
                f"Could not read Google Sheet. {direct_error or ''} "
                "Ensure link sharing is set to 'Anyone with the link can view', or verify your Google connection."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail.strip()
            )

    if not rows:
        raise HTTPException(status_code=400, detail=f"No data rows found in Google Sheet '{tab_name}'.")

    # 3. Save rows to a temporary CSV and parse via DataParser (backed by pure DuckDB)
    file_id = str(uuid.uuid4())
    dataset_name = req.dataset_name or f"Google Sheet: {tab_name}"
    clean_table_name = f"dataset_{file_id.replace('-', '_')[:16]}"
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

    try:
        s3_storage.upload_file(parquet_path, f"uploads/{parquet_filename}")
    except Exception as e:
        print(f"[!] Warning: S3 upload failed: {e}")

    # 5. Register in DuckDB
    analytics_engine.register_dataset(clean_table_name, parquet_path, "parquet")

    # 6. Profile DataFrame
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
        "workspace_id": req.workspace_id,
        "user_id": current_user.id,
        "name": dataset_name,
        "original_filename": f"Google Sheet ({tab_name or 'Sheet1'}).xlsx",
        "file_type": "google_sheet",
        "file_path": rel_parquet_path,
        "duckdb_table_name": clean_table_name,
        "row_count": df.height,
        "column_count": df.width,
        "size_bytes": size_bytes,
        "sheet_name": tab_name,
        "status": "ready",
        "profile_summary": profile_data,
        "columns": cols_list,
        "created_at": now_str,
        "updated_at": now_str,
    }

    dynamodb_store.create_dataset(dataset_dict)

    return GoogleSheetImportResponse(
        dataset_id=file_id,
        dataset_name=dataset_name,
        row_count=df.height,
        column_count=df.width,
        duckdb_table_name=clean_table_name,
        message=f"Successfully ingested {df.height} rows from '{tab_name}' into DuckDB analytical engine."
    )
