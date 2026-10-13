import json
import logging
import urllib.parse
import io
import csv
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import httpx

from app.core.config import settings
from app.core.security import encrypt_credential, decrypt_credential
from app.core.dynamodb import dynamodb_store

logger = logging.getLogger(__name__)

# Standard Google OAuth & API endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

GOOGLE_DOCS_API_BASE = "https://docs.googleapis.com/v1/documents"
GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files"
GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]


class GoogleWorkspaceService:
    """Production service for Google Workspace (Docs, Sheets, Drive) integration

    Supports:
    - OAuth 2.0 PKCE / Server flow with encrypted token persistence
    - Automatic token refresh via refresh_token
    - Google Docs: Exporting formatted executive reports & reading document text
    - Google Drive: Browsing accessible Docs and Spreadsheets
    - Google Sheets: Extracting tabular sheet data for DuckDB ingestion
    - Graceful demo/fallback mode if Client ID/Secret is pending
    """

    @property
    def client_id(self) -> str:
        return settings.GOOGLE_CLIENT_ID or ""

    @property
    def client_secret(self) -> str:
        return settings.GOOGLE_CLIENT_SECRET or ""

    @property
    def redirect_uri(self) -> str:
        return settings.GOOGLE_REDIRECT_URI or "http://localhost:5173/integrations/google/callback"

    def is_configured(self) -> bool:
        """Checks if real Google OAuth application credentials are configured."""
        return bool(self.client_id and self.client_secret)

    def generate_auth_url(self, workspace_id: str, redirect_uri: Optional[str] = None) -> Tuple[str, str]:
        """Generates Google OAuth 2.0 authorization URL with offline access for refresh tokens."""
        state_payload = {
            "workspace_id": workspace_id,
            "nonce": datetime.now(timezone.utc).timestamp()
        }
        state = urllib.parse.quote(json.dumps(state_payload))
        target_redirect = redirect_uri or self.redirect_uri

        params = {
            "client_id": self.client_id or "autoanalytix-demo-client-id",
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state
        }
        query_string = urllib.parse.urlencode(params)
        auth_url = f"{GOOGLE_AUTH_URL}?{query_string}"
        return auth_url, state

    async def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchanges authorization code for access and refresh tokens."""
        target_redirect = redirect_uri or self.redirect_uri

        # If real credentials are not set, return simulated live tokens for development/preview
        if not self.is_configured():
            logger.warning("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured. Providing local test tokens.")
            return {
                "access_token": f"mock_google_token_{datetime.now(timezone.utc).timestamp()}",
                "refresh_token": "mock_google_refresh_token",
                "expires_in": 3600,
                "scope": " ".join(SCOPES),
                "email": "analyst@demo-workspace.google",
                "name": "Demo Analyst"
            }

        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": target_redirect
                }
            )

            if token_resp.status_code != 200:
                raise ValueError(f"Failed to exchange Google OAuth code: {token_resp.text}")

            token_data = token_resp.json()
            access_token = token_data.get("access_token")

            # Fetch account profile / email
            user_email = ""
            user_name = ""
            try:
                user_resp = await client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if user_resp.status_code == 200:
                    profile = user_resp.json()
                    user_email = profile.get("email", "")
                    user_name = profile.get("name", "")
            except Exception as e:
                logger.warning("Failed to fetch Google profile: %s", e)

            return {
                **token_data,
                "email": user_email,
                "name": user_name
            }

    async def get_valid_access_token(self, workspace_id: str) -> str:
        """Retrieves and refreshes the Google Workspace access token for a workspace."""
        integration = dynamodb_store.get_workspace_integration(workspace_id, "google_workspace")
        if not integration:
            raise ValueError("Google Workspace is not connected for this workspace.")

        encrypted_creds = integration.get("encrypted_credentials", "")
        if not encrypted_creds:
            raise ValueError("No stored credentials found for Google Workspace.")

        creds = json.loads(decrypt_credential(encrypted_creds))
        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        expires_at_str = creds.get("expires_at")

        # In mock/demo mode
        if access_token and access_token.startswith("mock_google_token"):
            return access_token

        # Check expiration
        is_expired = True
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
                # Refresh 5 minutes before actual expiration
                if datetime.now(timezone.utc) < (expires_at - timedelta(minutes=5)):
                    is_expired = False
            except Exception:
                is_expired = True

        if not is_expired and access_token:
            return access_token

        # If expired and we have refresh_token, refresh it
        if refresh_token and self.is_configured():
            async with httpx.AsyncClient(timeout=15.0) as client:
                refresh_resp = await client.post(
                    GOOGLE_TOKEN_URL,
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token"
                    }
                )
                if refresh_resp.status_code == 200:
                    new_tokens = refresh_resp.json()
                    new_access_token = new_tokens.get("access_token")
                    expires_in = new_tokens.get("expires_in", 3600)
                    new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

                    creds["access_token"] = new_access_token
                    creds["expires_at"] = new_expires_at
                    if new_tokens.get("refresh_token"):
                        creds["refresh_token"] = new_tokens["refresh_token"]

                    # Save updated credentials
                    integration["encrypted_credentials"] = encrypt_credential(json.dumps(creds))
                    integration["last_synced_at"] = datetime.now(timezone.utc).isoformat()
                    dynamodb_store.save_workspace_integration(integration)
                    return new_access_token

        return access_token or ""

    # ==================== GOOGLE DRIVE OPERATIONS ====================

    async def list_drive_files(
        self,
        access_token: str,
        mime_type: Optional[str] = None,
        query: Optional[str] = None,
        page_size: int = 25
    ) -> List[Dict[str, Any]]:
        """Lists Google Docs and Google Sheets accessible to the authorized user."""
        if access_token.startswith("mock_google_token"):
            return [
                {
                    "id": "mock_doc_1",
                    "name": "Q3 SaaS Expansion Strategy & Churn Targets.docx",
                    "mime_type": "application/vnd.google-apps.document",
                    "modified_time": datetime.now(timezone.utc).isoformat(),
                    "web_view_link": "https://docs.google.com/document/d/mock_doc_1/edit",
                    "size": 24500
                },
                {
                    "id": "mock_sheet_1",
                    "name": "2026 Enterprise Pipeline & ACV Metrics",
                    "mime_type": "application/vnd.google-apps.spreadsheet",
                    "modified_time": datetime.now(timezone.utc).isoformat(),
                    "web_view_link": "https://docs.google.com/spreadsheets/d/mock_sheet_1/edit",
                    "size": 118400
                },
                {
                    "id": "mock_doc_2",
                    "name": "Product Analytics Key Performance Indicators (KPIs)",
                    "mime_type": "application/vnd.google-apps.document",
                    "modified_time": datetime.now(timezone.utc).isoformat(),
                    "web_view_link": "https://docs.google.com/document/d/mock_doc_2/edit",
                    "size": 18200
                }
            ]

        q_parts = ["trashed = false"]
        if mime_type:
            q_parts.append(f"mimeType = '{mime_type}'")
        else:
            q_parts.append("(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet')")

        if query:
            clean_q = query.replace("'", "\\'")
            q_parts.append(f"name contains '{clean_q}'")

        params = {
            "q": " and ".join(q_parts),
            "pageSize": page_size,
            "fields": "files(id, name, mimeType, modifiedTime, webViewLink, size)",
            "orderBy": "modifiedTime desc"
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                GOOGLE_DRIVE_API_BASE,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params
            )
            if resp.status_code != 200:
                raise ValueError(f"Drive API error: {resp.text}")
            data = resp.json()
            return [
                {
                    "id": f.get("id"),
                    "name": f.get("name"),
                    "mime_type": f.get("mimeType"),
                    "modified_time": f.get("modifiedTime"),
                    "web_view_link": f.get("webViewLink"),
                    "size": int(f.get("size", 0)) if f.get("size") else None
                }
                for f in data.get("files", [])
            ]

    # ==================== GOOGLE DOCS OPERATIONS ====================

    async def get_document_markdown(self, access_token: str, document_id: str) -> Tuple[str, str, int]:
        """Reads a Google Doc and converts its elements to Markdown for LLM analysis."""
        if access_token.startswith("mock_google_token") or document_id.startswith("mock_doc"):
            title = "Q3 SaaS Expansion Strategy & Churn Targets"
            mock_md = f"""# {title}

## Executive Summary
This document outlines our company's expansion goals across Enterprise and SMB segments for 2026.

### Key Targets:
- **Net Revenue Retention (NRR):** Target is 120% or higher.
- **Monthly Recurring Revenue (MRR) Churn:** Acceptable threshold is below 1.5%.
- **Average Contract Value (ACV):** Target is $45,000 for Enterprise deals.

### Calculation Definitions:
- **Active User:** A user who executed at least 3 analytics queries in the last 14 days.
- **Churn Date:** The date on which the cancellation invoice was finalized.
"""
            return title, mock_md, len(mock_md)

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{GOOGLE_DOCS_API_BASE}/{document_id}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code != 200:
                raise ValueError(f"Docs API error: {resp.text}")

            doc = resp.json()
            title = doc.get("title", "Untitled Document")
            body = doc.get("body", {}).get("content", [])

            # Parse elements into markdown
            lines = []
            for element in body:
                if "paragraph" in element:
                    para = element["paragraph"]
                    style = para.get("paragraphStyle", {}).get("namedStyleType", "NORMAL_TEXT")
                    text_parts = []
                    for el in para.get("elements", []):
                        if "textRun" in el:
                            content = el["textRun"].get("content", "")
                            text_parts.append(content)
                    para_text = "".join(text_parts).rstrip("\n")

                    if not para_text.strip():
                        continue

                    if style == "TITLE":
                        lines.append(f"# {para_text}\n")
                    elif style == "HEADING_1":
                        lines.append(f"\n## {para_text}\n")
                    elif style == "HEADING_2":
                        lines.append(f"\n### {para_text}\n")
                    elif style == "HEADING_3":
                        lines.append(f"\n#### {para_text}\n")
                    else:
                        lines.append(para_text)

            markdown_output = "\n".join(lines)
            return title, markdown_output, len(markdown_output)

    async def create_formatted_report(
        self,
        access_token: str,
        title: str,
        executive_summary: Optional[str] = None,
        markdown_content: Optional[str] = None,
        sql_query: Optional[str] = None,
        table_columns: Optional[List[str]] = None,
        table_rows: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[str, str]:
        """Creates a beautifully formatted Google Doc containing analysis, KPIs, tables, and SQL."""
        now_str = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")

        # Mock / local dev simulation
        if access_token.startswith("mock_google_token"):
            mock_id = f"gdoc_{int(datetime.now(timezone.utc).timestamp())}"
            mock_url = f"https://docs.google.com/document/d/{mock_id}/edit"
            return mock_id, mock_url

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. Create Blank Document
            create_resp = await client.post(
                GOOGLE_DOCS_API_BASE,
                headers={"Authorization": f"Bearer {access_token}"},
                json={"title": title}
            )
            if create_resp.status_code != 200:
                raise ValueError(f"Failed to create Google Doc: {create_resp.text}")

            created_doc = create_resp.json()
            doc_id = created_doc["documentId"]
            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"

            # 2. Build Structured Text Buffer
            content_builder = []
            content_builder.append(f"{title}\n")
            content_builder.append(f"Autoanalytix Executive Analysis Briefing — Generated {now_str}\n\n")

            if executive_summary:
                content_builder.append("Executive Summary & Core Insights\n")
                content_builder.append(f"{executive_summary.strip()}\n\n")

            if markdown_content:
                content_builder.append("Detailed Findings & Key Drivers\n")
                content_builder.append(f"{markdown_content.strip()}\n\n")

            if table_columns and table_rows:
                content_builder.append("Analytical Data Highlights\n")
                header_line = " | ".join(str(c) for c in table_columns)
                content_builder.append(f"{header_line}\n")
                for r in table_rows[:25]:  # Top 25 rows
                    row_line = " | ".join(str(r.get(c, "")) for c in table_columns)
                    content_builder.append(f"{row_line}\n")
                content_builder.append("\n")

            if sql_query:
                content_builder.append("Verified DuckDB SQL Query\n")
                content_builder.append(f"{sql_query.strip()}\n\n")

            content_builder.append("—\nGenerated autonomously by Autoanalytix AI Engine.")

            full_text = "".join(content_builder)

            # 3. Batch Update Document
            requests = [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": full_text
                    }
                }
            ]

            update_resp = await client.post(
                f"{GOOGLE_DOCS_API_BASE}/{doc_id}:batchUpdate",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"requests": requests}
            )

            if update_resp.status_code != 200:
                logger.warning("Docs batchUpdate styling warning: %s", update_resp.text)

            return doc_id, doc_url

    # ==================== GOOGLE SHEETS OPERATIONS ====================

    async def list_spreadsheet_tabs(self, access_token: str, spreadsheet_id: str) -> List[str]:
        """Lists sheet tab names for a spreadsheet."""
        if access_token.startswith("mock_google_token") or spreadsheet_id.startswith("mock_sheet"):
            return ["Q1 Sales Orders", "Customer Accounts", "Product Catalog", "Targets & Quotas"]

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{GOOGLE_SHEETS_API_BASE}/{spreadsheet_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "sheets(properties(title))"}
            )
            if resp.status_code != 200:
                raise ValueError(f"Sheets API error: {resp.text}")
            data = resp.json()
            return [s["properties"]["title"] for s in data.get("sheets", [])]

    async def extract_sheet_rows(
        self,
        access_token: str,
        spreadsheet_id: str,
        tab_name: str,
        limit_rows: int = 50000
    ) -> List[Dict[str, Any]]:
        """Extracts tabular data from a Google Sheet tab into a list of row dictionaries."""
        if access_token.startswith("mock_google_token") or spreadsheet_id.startswith("mock_sheet"):
            # Provide sample enterprise data for demo
            return [
                {"order_id": "ORD-101", "customer": "Acme Corp", "segment": "Enterprise", "amount": 12500.0, "status": "Closed Won"},
                {"order_id": "ORD-102", "customer": "NovaTech Inc", "segment": "Mid-Market", "amount": 4200.0, "status": "Closed Won"},
                {"order_id": "ORD-103", "customer": "Starlight AI", "segment": "SMB", "amount": 1800.0, "status": "Pending"},
                {"order_id": "ORD-104", "customer": "Global Dynamics", "segment": "Enterprise", "amount": 28400.0, "status": "Closed Won"},
                {"order_id": "ORD-105", "customer": "Apex Solutions", "segment": "Enterprise", "amount": 15000.0, "status": "Closed Won"}
            ]

        safe_tab = urllib.parse.quote(tab_name)
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(
                f"{GOOGLE_SHEETS_API_BASE}/{spreadsheet_id}/values/{safe_tab}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code != 200:
                raise ValueError(f"Failed to fetch values from Google Sheet: {resp.text}")

            values = resp.json().get("values", [])
            if not values:
                return []

            headers = [str(h).strip() for h in values[0]]
            rows = []
            for raw_row in values[1:limit_rows + 1]:
                row_dict = {}
                for idx, col_name in enumerate(headers):
                    val = raw_row[idx] if idx < len(raw_row) else None
                    row_dict[col_name] = val
                rows.append(row_dict)

            return rows

    # ==================== DIRECT SHARED LINK / MCP OPERATIONS ====================

    @staticmethod
    def parse_google_url(url_or_id: str) -> Dict[str, Any]:
        """Parses a Google Sheets, Docs, or Drive URL or ID into structured components."""
        clean = url_or_id.strip()
        result = {
            "type": "unknown",
            "id": clean,
            "gid": "0",
            "original": clean
        }

        # 1. Google Sheets
        sheet_match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", clean)
        if sheet_match:
            result["type"] = "sheets"
            result["id"] = sheet_match.group(1)
            gid_match = re.search(r"[?&#]gid=([0-9]+)", clean)
            if gid_match:
                result["gid"] = gid_match.group(1)
            return result

        # 2. Google Docs
        doc_match = re.search(r"/document/d/([a-zA-Z0-9-_]+)", clean)
        if doc_match:
            result["type"] = "docs"
            result["id"] = doc_match.group(1)
            return result

        # 3. Google Drive file
        drive_match = re.search(r"(?:/file/d/|[?&]id=)([a-zA-Z0-9-_]+)", clean)
        if drive_match:
            result["type"] = "drive"
            result["id"] = drive_match.group(1)
            return result

        # 4. Fallback for raw IDs
        if re.match(r"^[a-zA-Z0-9-_]{20,70}$", clean):
            result["type"] = "sheets"
            result["id"] = clean
            return result

        return result

    async def extract_sheet_rows_from_shared_url(
        self,
        url_or_id: str,
        gid: Optional[str] = None,
        limit_rows: int = 50000
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Directly fetches and extracts tabular rows from a shared Google Sheet URL.
        Requires 'Anyone with the link can view' permission on the spreadsheet.
        Zero OAuth or API key credentials required.
        """
        parsed = self.parse_google_url(url_or_id)
        spreadsheet_id = parsed["id"]
        target_gid = gid or parsed.get("gid") or "0"

        export_urls = [
            f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={target_gid}",
            f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&gid={target_gid}"
        ]

        csv_text = None
        last_error = ""

        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            for url in export_urls:
                try:
                    resp = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Autoanalytix/1.0"
                    })
                    if resp.status_code == 200:
                        body = resp.text
                        # Check if Google returned a login/HTML screen
                        if "accounts.google.com" in str(resp.url) or ("<html" in body[:300].lower() and "google" in body[:300].lower()):
                            last_error = "The Google Sheet is private. Please ensure 'Anyone with the link can view' is enabled in Share settings."
                            continue
                        csv_text = body
                        break
                    elif resp.status_code in (401, 403):
                        last_error = "Access denied. Ensure the Google Sheet is shared with 'Anyone with the link can view'."
                    elif resp.status_code == 404:
                        last_error = "Spreadsheet not found. Please verify the URL or spreadsheet ID."
                except Exception as e:
                    last_error = str(e)

        if not csv_text:
            raise ValueError(last_error or "Could not retrieve CSV from the provided Google Sheet link.")

        reader = csv.reader(io.StringIO(csv_text))
        rows_raw = list(reader)
        if not rows_raw:
            return [], f"Sheet_{target_gid}"

        headers = [str(h).strip() for h in rows_raw[0]]
        seen: Dict[str, int] = {}
        cleaned_headers: List[str] = []
        for idx, h in enumerate(headers):
            col_name = h if h else f"col_{idx+1}"
            if col_name in seen:
                seen[col_name] += 1
                col_name = f"{col_name}_{seen[col_name]}"
            else:
                seen[col_name] = 1
            cleaned_headers.append(col_name)

        rows: List[Dict[str, Any]] = []
        for raw_row in rows_raw[1:limit_rows + 1]:
            if not any(str(c).strip() for c in raw_row):
                continue
            row_dict = {}
            for idx, col in enumerate(cleaned_headers):
                val = raw_row[idx] if idx < len(raw_row) else None
                if val is not None and isinstance(val, str):
                    val_clean = val.strip()
                    val = None if val_clean == "" else val_clean
                row_dict[col] = val
            rows.append(row_dict)

        return rows, f"Sheet_gid_{target_gid}"

    async def read_doc_from_shared_url(self, url_or_id: str) -> str:
        """Reads plain text from a shared Google Doc without OAuth."""
        parsed = self.parse_google_url(url_or_id)
        doc_id = parsed["id"]
        export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"

        async with httpx.AsyncClient(follow_redirects=True, timeout=25.0) as client:
            resp = await client.get(export_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Autoanalytix/1.0"
            })
            if resp.status_code == 200:
                if "accounts.google.com" in str(resp.url) or "<html" in resp.text[:300].lower():
                    raise ValueError("The Google Doc is private. Please set link sharing to 'Anyone with the link can view'.")
                return resp.text
            elif resp.status_code in (401, 403):
                raise ValueError("Access denied. Ensure the Google Doc is shared with 'Anyone with the link can view'.")
            else:
                raise ValueError(f"Could not load Google Doc: status {resp.status_code}")

    async def read_drive_file_from_shared_url(self, url_or_id: str) -> Tuple[bytes, str]:
        """Downloads a shared Google Drive file without OAuth."""
        parsed = self.parse_google_url(url_or_id)
        file_id = parsed["id"]
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"

        async with httpx.AsyncClient(follow_redirects=True, timeout=45.0) as client:
            resp = await client.get(download_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Autoanalytix/1.0"
            })
            if resp.status_code == 200:
                if "accounts.google.com" in str(resp.url) or ("<html" in resp.text[:300].lower() and "google" in resp.text[:300].lower()):
                    raise ValueError("The Google Drive file is private. Please set link sharing to 'Anyone with the link can view'.")
                return resp.content, f"drive_{file_id}"
            else:
                raise ValueError(f"Could not download Google Drive file: status {resp.status_code}")


google_workspace_service = GoogleWorkspaceService()
