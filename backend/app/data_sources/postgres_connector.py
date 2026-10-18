import os
from typing import Dict, Any, List, Optional
from datetime import datetime, date, time
from decimal import Decimal
import uuid
import json

from app.data_sources.base import BaseDataConnector

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


class PostgreSQLDataConnector(BaseDataConnector):
    connector_type = "postgresql"
    display_name = "PostgreSQL Database"

    def _parse_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts and normalizes PostgreSQL connection parameters."""
        conn_str = config.get("connection_string") or config.get("uri")
        if conn_str:
            return {"dsn": conn_str, "connect_timeout": 5}

        host = config.get("host", "localhost")
        port = int(config.get("port") or 5432)
        database = config.get("database") or config.get("dbname", "")
        user = config.get("user") or config.get("username", "postgres")
        password = config.get("password", "")
        sslmode = config.get("sslmode", "prefer")

        params: Dict[str, Any] = {
            "host": host,
            "port": port,
            "dbname": database,
            "user": user,
            "connect_timeout": 5,
        }
        if password:
            params["password"] = password
        if sslmode:
            params["sslmode"] = sslmode

        return params

    def _get_connection(self, config: Dict[str, Any]):
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError("psycopg2-binary is not installed in the python environment.")
        params = self._parse_config(config)
        return psycopg2.connect(**params)

    def _serialize_value(self, val: Any) -> Any:
        """Converts PostgreSQL specific types into JSON and DuckDB safe python primitives."""
        if val is None:
            return None
        if isinstance(val, (datetime, date, time)):
            return val.isoformat()
        if isinstance(val, Decimal):
            return float(val) if (val % 1 != 0) else int(val)
        if isinstance(val, uuid.UUID):
            return str(val)
        if isinstance(val, (bytes, memoryview)):
            return bytes(val).hex()
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        if not PSYCOPG2_AVAILABLE:
            return {"success": False, "message": "PostgreSQL driver (psycopg2) is not installed."}
        try:
            conn = self._get_connection(config)
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
            conn.close()
            return {"success": True, "message": "Successfully connected to PostgreSQL database."}
        except Exception as e:
            return {"success": False, "message": f"PostgreSQL connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        target_schema = config.get("schema") or "public"
        conn = self._get_connection(config)
        tables: List[str] = []
        try:
            with conn.cursor() as cur:
                if target_schema:
                    cur.execute(
                        """
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = %s 
                          AND table_type = 'BASE TABLE'
                        ORDER BY table_name;
                        """,
                        (target_schema,)
                    )
                    tables = [r[0] for r in cur.fetchall()]
                else:
                    cur.execute(
                        """
                        SELECT table_schema || '.' || table_name 
                        FROM information_schema.tables 
                        WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
                          AND table_type = 'BASE TABLE'
                        ORDER BY table_schema, table_name;
                        """
                    )
                    tables = [r[0] for r in cur.fetchall()]
        finally:
            conn.close()
        return tables

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        target_schema = config.get("schema") or "public"
        if "." in table_name:
            target_schema, raw_table_name = table_name.split(".", 1)
        else:
            raw_table_name = table_name

        conn = self._get_connection(config)
        columns: List[Dict[str, str]] = []
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position;
                    """,
                    (target_schema, raw_table_name)
                )
                columns = [{"column_name": r[0], "data_type": r[1]} for r in cur.fetchall()]
        finally:
            conn.close()
        return columns

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        target_schema = config.get("schema") or "public"
        if "." in table_name:
            target_schema, raw_table_name = table_name.split(".", 1)
        else:
            raw_table_name = table_name

        conn = self._get_connection(config)
        rows: List[Dict[str, Any]] = []
        try:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT * FROM {}.{} LIMIT %s").format(
                    sql.Identifier(target_schema),
                    sql.Identifier(raw_table_name)
                )
                cur.execute(query, (limit,))
                col_names = [desc[0] for desc in cur.description]
                raw_rows = cur.fetchall()
                for r in raw_rows:
                    row_dict = {}
                    for col, val in zip(col_names, r):
                        row_dict[col] = self._serialize_value(val)
                    rows.append(row_dict)
        finally:
            conn.close()
        return rows
