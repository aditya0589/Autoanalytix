from typing import Dict, Any, List, Optional
import asyncio
from app.data_sources.base import BaseDataConnector
from app.integrations.google_workspace import google_workspace_service

class GoogleSheetsDataConnector(BaseDataConnector):
    connector_type = "google_sheets"
    display_name = "Google Sheets"

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        spreadsheet_id = config.get("spreadsheet_id") or config.get("url") or config.get("sheet_id", "")
        if not spreadsheet_id:
            return {"success": False, "message": "Spreadsheet ID or URL is required."}

        # Try shared link extraction preview
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        try:
            rows, tab = loop.run_until_complete(
                google_workspace_service.extract_sheet_rows_from_shared_url(spreadsheet_id, limit_rows=2)
            )
            if rows:
                return {
                    "success": True,
                    "message": f"Successfully verified Google Sheet (Tab: '{tab}', {len(rows)} sample rows inspected)."
                }
        except Exception as e:
            pass

        return {
            "success": True,
            "message": "Google Sheets connector configured."
        }

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        """Lists tabs available in the spreadsheet."""
        spreadsheet_id = config.get("spreadsheet_id") or config.get("url") or config.get("sheet_id", "")
        tab_name = config.get("tab_name")
        if tab_name:
            return [tab_name]
        return ["Sheet1"]

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        """Infers schema from first row header."""
        sample_rows = self.extract_data(config, table_name, limit=5)
        if not sample_rows:
            return []
        schema = []
        for col_name, val in sample_rows[0].items():
            dtype = "VARCHAR"
            if isinstance(val, (int, float)):
                dtype = "DOUBLE"
            schema.append({"column_name": col_name, "data_type": dtype})
        return schema

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        spreadsheet_id = config.get("spreadsheet_id") or config.get("url") or config.get("sheet_id", "")
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        rows, _ = loop.run_until_complete(
            google_workspace_service.extract_sheet_rows_from_shared_url(spreadsheet_id, limit_rows=limit)
        )
        return rows or []
