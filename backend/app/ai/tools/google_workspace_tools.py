import asyncio
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

from app.integrations.google_workspace import google_workspace_service


def _run_async(coro):
    """Safely runs an async coroutine inside sync tool execution."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
    except Exception:
        pass
    return asyncio.run(coro)


@tool
def read_google_sheet_from_link(url: str, limit_rows: int = 25) -> str:
    """Reads tabular data from a shared Google Sheets link (e.g. 'https://docs.google.com/spreadsheets/d/...').
    The Google Sheet must have 'Anyone with the link can view' permission enabled.
    Returns column headers, row counts, and sample records in Markdown table format.
    Use this when the user pastes a Google Sheets link or asks to inspect data from a sheet.
    """
    try:
        rows, tab_name = _run_async(
            google_workspace_service.extract_sheet_rows_from_shared_url(url, limit_rows=limit_rows)
        )
        if not rows:
            return f"The Google Sheet ({tab_name}) was accessed, but contains no data rows."

        headers = list(rows[0].keys())
        md_lines = [
            f"### Google Sheet Data Preview (`{tab_name}`)",
            f"**Total Sample Rows Read:** {len(rows)} | **Columns:** {len(headers)}",
            "",
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join(["---"] * len(headers)) + " |"
        ]

        for r in rows[:limit_rows]:
            row_str = " | ".join(str(r.get(h, "")) if r.get(h) is not None else "" for h in headers)
            md_lines.append(f"| {row_str} |")

        return "\n".join(md_lines)
    except Exception as e:
        return f"Could not read Google Sheet from link: {str(e)}"


@tool
def read_google_doc_from_link(url: str) -> str:
    """Reads the full text content from a shared Google Docs link (e.g. 'https://docs.google.com/document/d/...').
    The Google Doc must have 'Anyone with the link can view' permission enabled.
    Use this to pull business strategy, definitions, or KPI benchmarks into the analysis.
    """
    try:
        text = _run_async(google_workspace_service.read_doc_from_shared_url(url))
        preview = text[:3000] + ("\n\n... (truncated)" if len(text) > 3000 else "")
        return f"### Google Doc Content\n\n{preview}"
    except Exception as e:
        return f"Could not read Google Doc from link: {str(e)}"


@tool
def read_google_drive_file_from_link(url: str) -> str:
    """Downloads and inspects a shared file from a Google Drive link (e.g. 'https://drive.google.com/file/d/...').
    The file must have 'Anyone with the link can view' permission enabled.
    """
    try:
        content, name = _run_async(google_workspace_service.read_drive_file_from_shared_url(url))
        text_preview = content[:2000].decode("utf-8", errors="replace")
        return f"### Google Drive File: {name} ({len(content)} bytes)\n\n```text\n{text_preview}\n```"
    except Exception as e:
        return f"Could not read Google Drive file from link: {str(e)}"


@tool
def search_google_docs(workspace_id: str, query: str) -> str:
    """Searches company Google Docs and Drive for relevant strategy, PRDs, KPIs, or metric definitions.
    Use this tool when the user's question references business documents or specific company terminology.
    """
    async def _search():
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        files = await google_workspace_service.list_drive_files(
            access_token=token,
            mime_type="application/vnd.google-apps.document",
            query=query
        )
        return files

    try:
        results = _run_async(_search())
        if not results:
            return f"No Google Docs found matching query: '{query}'."
        formatted = ["Found matching company documents:"]
        for f in results:
            formatted.append(f"- **{f['name']}** (ID: `{f['id']}`) - [Link]({f.get('web_view_link', '#')})")
        return "\n".join(formatted)
    except Exception as e:
        return f"Could not search Google Docs: {str(e)}"


@tool
def read_google_doc(workspace_id: str, document_id: str) -> str:
    """Reads the full text and structure of a Google Doc into Markdown format.
    Accepts either a document ID or a full Google Docs URL.
    Use this to inspect company definitions, targets, or business context before formulating SQL or insights.
    """
    # If a full URL is passed, use direct link reader (no OAuth needed)
    if "docs.google.com" in document_id:
        return read_google_doc_from_link(document_id)

    async def _read():
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        title, md, _ = await google_workspace_service.get_document_markdown(token, document_id)
        return title, md

    try:
        title, md = _run_async(_read())
        return f"### Google Doc: {title}\n\n{md}"
    except Exception as e:
        # Fallback to direct public export attempt with ID
        try:
            text = _run_async(google_workspace_service.read_doc_from_shared_url(document_id))
            return f"### Google Doc: {document_id}\n\n{text[:3000]}"
        except Exception:
            return f"Could not read Google Doc `{document_id}`: {str(e)}"


@tool
def create_google_doc_report(
    workspace_id: str,
    title: str,
    executive_summary: str,
    detailed_findings: Optional[str] = None
) -> str:
    """Creates a new formatted Google Doc containing an executive report of findings.
    Use this when the user asks to save, draft, export, or create a Google Doc report of their data analysis.
    """
    async def _create():
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        doc_id, doc_url = await google_workspace_service.create_formatted_report(
            access_token=token,
            title=title,
            executive_summary=executive_summary,
            markdown_content=detailed_findings
        )
        return doc_id, doc_url

    try:
        doc_id, doc_url = _run_async(_create())
        return f"Successfully generated Google Doc report!\n- Title: **{title}**\n- Document URL: {doc_url}"
    except Exception as e:
        return f"Could not create Google Doc report: {str(e)}"
