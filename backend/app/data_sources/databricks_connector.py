import os
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, date, time
from decimal import Decimal
import uuid
import json

from app.data_sources.base import BaseDataConnector

try:
    from databricks import sql as databricks_sql
    DATABRICKS_AVAILABLE = True
except ImportError:
    DATABRICKS_AVAILABLE = False


class DatabricksDataConnector(BaseDataConnector):
    connector_type = "databricks"
    display_name = "Databricks Lakehouse"

    @classmethod
    def clean_hostname(cls, hostname: str) -> str:
        """Strips URL protocol, trailing slashes, and paths from server_hostname."""
        if not hostname:
            return ""
        val = str(hostname).strip()
        if val.startswith(("http://", "https://")):
            from urllib.parse import urlparse
            try:
                parsed = urlparse(val)
                val = parsed.netloc or parsed.path.split("/")[0]
            except Exception:
                pass
        val = val.rstrip("/")
        if ":" in val:
            val = val.split(":")[0]
        return val

    @classmethod
    def clean_http_path(cls, path: str) -> str:
        """Ensures http_path starts with '/' and extracts path if user pasted a full URL."""
        if not path:
            return ""
        val = str(path).strip()
        if val.startswith(("http://", "https://")):
            from urllib.parse import urlparse
            try:
                parsed = urlparse(val)
                val = parsed.path
            except Exception:
                pass
        if not val.startswith("/"):
            val = f"/{val}"
        return val

    def _parse_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        raw_host = config.get("server_hostname") or config.get("host", "")
        raw_path = config.get("http_path") or config.get("path", "")
        token = (config.get("access_token") or config.get("token") or config.get("password", "")).strip()
        catalog = (config.get("catalog") or "").strip()
        schema = (config.get("schema") or "default").strip()

        server_hostname = self.clean_hostname(raw_host)
        http_path = self.clean_http_path(raw_path)

        if not server_hostname:
            raise ValueError("Databricks 'server_hostname' is required (e.g. 'adb-xxx.azuredatabricks.net' or 'dbc-xxx.cloud.databricks.com').")
        if not http_path:
            raise ValueError("Databricks 'http_path' is required (e.g. '/sql/1.0/warehouses/xxxx').")
        if not token:
            raise ValueError("Databricks 'access_token' (Personal Access Token) is required.")

        params: Dict[str, Any] = {
            "server_hostname": server_hostname,
            "http_path": http_path,
            "access_token": token,
            "_user_agent_entry": "AutoAnalytix",
        }
        if catalog:
            params["catalog"] = catalog
        if schema:
            params["schema"] = schema

        return params

    def _get_connection(self, config: Dict[str, Any]):
        if not DATABRICKS_AVAILABLE:
            raise RuntimeError("databricks-sql-connector is not installed in the python environment.")
        params = self._parse_config(config)
        return databricks_sql.connect(**params)

    def _serialize_value(self, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, (datetime, date, time)):
            return val.isoformat()
        if isinstance(val, Decimal):
            return float(val) if (val % 1 != 0) else int(val)
        if isinstance(val, (bytes, memoryview, bytearray)):
            return bytes(val).hex()
        if isinstance(val, uuid.UUID):
            return str(val)
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        if not DATABRICKS_AVAILABLE:
            return {"success": False, "message": "Databricks SQL driver is not installed."}
        try:
            params = self._parse_config(config)
            conn = databricks_sql.connect(**params)
            with conn.cursor() as cur:
                cur.execute("SELECT current_version(), current_catalog(), current_schema();")
                row = cur.fetchone()
                version = row[0] if row and len(row) > 0 else "unknown"
                cat = row[1] if row and len(row) > 1 else params.get("catalog", "default")
                sch = row[2] if row and len(row) > 2 else params.get("schema", "default")
            conn.close()
            return {
                "success": True,
                "message": f"Successfully connected to Databricks (Spark v{version}, Catalog: {cat}, Schema: {sch})."
            }
        except Exception as e:
            return {"success": False, "message": f"Databricks connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        catalog = (config.get("catalog") or "").strip()
        schema = (config.get("schema") or "default").strip()

        conn = self._get_connection(config)
        tables: List[str] = []
        try:
            with conn.cursor() as cur:
                if catalog and schema:
                    cur.execute(f"SHOW TABLES IN `{catalog}`.`{schema}`")
                elif schema:
                    cur.execute(f"SHOW TABLES IN `{schema}`")
                else:
                    cur.execute("SHOW TABLES")

                rows = cur.fetchall()
                for r in rows:
                    name = None
                    if hasattr(r, "keys") and "tableName" in r.keys():
                        name = r["tableName"]
                    elif isinstance(r, dict) and "tableName" in r:
                        name = r["tableName"]
                    elif len(r) >= 2:
                        name = r[1]
                    elif len(r) == 1:
                        name = r[0]

                    if name and not str(name).startswith("#"):
                        tables.append(str(name))
        finally:
            conn.close()
        return sorted(list(set(tables)))

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        catalog = (config.get("catalog") or "").strip()
        schema = (config.get("schema") or "default").strip()
        clean_table = table_name.replace("`", "").strip()

        target = f"`{catalog}`.`{schema}`.`{clean_table}`" if catalog else f"`{schema}`.`{clean_table}`"

        conn = self._get_connection(config)
        columns: List[Dict[str, str]] = []
        try:
            with conn.cursor() as cur:
                cur.execute(f"DESCRIBE TABLE {target}")
                rows = cur.fetchall()
                for r in rows:
                    col_name = r[0] if len(r) > 0 else None
                    data_type = r[1] if len(r) > 1 else "string"
                    if col_name and not str(col_name).strip().startswith("#") and str(col_name).strip():
                        columns.append({
                            "column_name": str(col_name).strip(),
                            "data_type": str(data_type).strip() if data_type else "string"
                        })
        finally:
            conn.close()
        return columns

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        catalog = (config.get("catalog") or "").strip()
        schema = (config.get("schema") or "default").strip()
        clean_table = table_name.replace("`", "").strip()
        clean_limit = max(1, min(int(limit), 100000))

        target = f"`{catalog}`.`{schema}`.`{clean_table}`" if catalog else f"`{schema}`.`{clean_table}`"

        conn = self._get_connection(config)
        rows: List[Dict[str, Any]] = []
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM {target} LIMIT {clean_limit}")
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
