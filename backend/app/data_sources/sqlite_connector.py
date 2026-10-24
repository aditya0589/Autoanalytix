import sqlite3
import os
import re
from typing import Dict, Any, List
from app.core.config import settings
from app.data_sources.base import BaseDataConnector

FORBIDDEN_INTERNAL_DATABASES = {
    "autoanalytix.db",
    "autoanalytix_store.db",
    "analytics.duckdb",
}

class SQLiteDataConnector(BaseDataConnector):
    connector_type = "sqlite"
    display_name = "SQLite Database / External SQL File"

    def _validate_db_path(self, db_path: str) -> str:
        """Validates that the SQLite path is safe, exists, and does not target internal databases."""
        if not db_path or not isinstance(db_path, str):
            raise ValueError("Database path is required.")

        clean_path = db_path.strip()
        if ".." in clean_path:
            raise ValueError("Directory traversal is not permitted in database path.")

        abs_path = os.path.abspath(clean_path)
        base_name = os.path.basename(abs_path).lower()

        if base_name in FORBIDDEN_INTERNAL_DATABASES:
            raise ValueError("Access to internal platform databases is strictly forbidden.")

        # Ensure the file exists and is a regular file
        if not os.path.isfile(abs_path):
            raise ValueError(f"SQLite database file not found: {base_name}")

        return abs_path

    def _validate_table_name(self, table_name: str) -> str:
        """Strictly validates SQL table identifiers to prevent SQL injection."""
        clean_name = table_name.strip()
        if not re.match(r"^[a-zA-Z0-9_]+$", clean_name):
            raise ValueError("Invalid table name. Identifiers must be alphanumeric characters or underscores only.")
        return clean_name

    def _get_connection(self, db_path: str) -> sqlite3.Connection:
        safe_path = self._validate_db_path(db_path)
        # Open in strictly read-only mode via URI filename
        norm_path = safe_path.replace("\\", "/")
        return sqlite3.connect(f"file:{norm_path}?mode=ro", uri=True)

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        db_path = config.get("database_path", "")
        try:
            conn = self._get_connection(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            return {"success": True, "message": "Successfully connected to SQLite database (Read-Only)."}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        db_path = config.get("database_path", "")
        conn = self._get_connection(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [r[0] for r in cursor.fetchall()]
            return tables
        finally:
            conn.close()

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        db_path = config.get("database_path", "")
        clean_table = self._validate_table_name(table_name)
        conn = self._get_connection(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(f"PRAGMA table_info({clean_table});")
            cols = [{"column_name": r[1], "data_type": r[2]} for r in cursor.fetchall()]
            return cols
        finally:
            conn.close()

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        db_path = config.get("database_path", "")
        clean_table = self._validate_table_name(table_name)
        safe_limit = max(1, min(int(limit), 50000))

        conn = self._get_connection(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {clean_table} LIMIT {safe_limit}")
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, r)) for r in rows]
        finally:
            conn.close()
