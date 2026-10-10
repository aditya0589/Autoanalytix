import sqlite3
import os
from typing import Dict, Any, List
import polars as pl
from app.data_sources.base import BaseDataConnector

class SQLiteDataConnector(BaseDataConnector):
    connector_type = "sqlite"
    display_name = "SQLite Database / External SQL File"

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        db_path = config.get("database_path", "")
        if not db_path:
            return {"success": False, "message": "Database path is required."}
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            return {"success": True, "message": "Successfully connected to SQLite database."}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        db_path = config.get("database_path", "")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [r[0] for r in cursor.fetchall()]
        conn.close()
        return tables

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        db_path = config.get("database_path", "")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        cols = [{"column_name": r[1], "data_type": r[2]} for r in cursor.fetchall()]
        conn.close()
        return cols

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> pl.DataFrame:
        db_path = config.get("database_path", "")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        conn.close()
        
        col_dict = {col: [r[i] for r in rows] for i, col in enumerate(columns)}
        return pl.DataFrame(col_dict)
