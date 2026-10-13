import asyncio
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

from app.integrations.google_workspace import google_workspace_service


@tool
def search_google_docs(workspace_id: str, query: str) -> str:
    """Searches company Google Docs and Drive for relevant strategy, PRDs, KPIs, or metric definitions.
    Use this tool when the user's question references business documents or specific company terminology.
    """
    try:
        # Run async in sync tool runner
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
    except Exception:
        pass

    async def _search():
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        files = await google_workspace_service.list_drive_files(
            access_token=token,
            mime_type="application/vnd.google-apps.document",
            query=query
        )
        return files

    try:
        results = asyncio.run(_search())
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
    Use this to inspect company definitions, targets, or business context before formulating SQL or insights.
    """
    async def _read():
        token = await google_workspace_service.get_valid_access_token(workspace_id)
        title, md, _ = await google_workspace_service.get_document_markdown(token, document_id)
        return title, md

    try:
        title, md = asyncio.run(_read())
        return f"### Google Doc: {title}\n\n{md}"
    except Exception as e:
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
        doc_id, doc_url = asyncio.run(_create())
        return f"Successfully generated Google Doc report!\n- Title: **{title}**\n- Document URL: {doc_url}"
    except Exception as e:
        return f"Could not create Google Doc report: {str(e)}"
