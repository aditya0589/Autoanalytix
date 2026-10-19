import os
from typing import Dict, Any, List, Optional
from datetime import datetime, date, time
from decimal import Decimal
import json

from app.data_sources.base import BaseDataConnector

try:
    import snowflake.connector
    SNOWFLAKE_AVAILABLE = True
except ImportError:
    SNOWFLAKE_AVAILABLE = False


class SnowflakeDataConnector(BaseDataConnector):
    connector_type = "snowflake"
    display_name = "Snowflake Data Cloud"

    @classmethod
    def clean_account(cls, account: str) -> str:
        """
        Normalizes Snowflake account identifier into driver-compatible format.

        Handles:
        1. Full URLs (e.g. 'https://app.snowflake.com/orgname/account_name' or
           'https://orgname-account_name.snowflakecomputing.com')
        2. Domain suffix stripping ('.snowflakecomputing.com')
        3. Port stripping (':443')
        4. Snowsight UI copied identifiers with a dot instead of a hyphen
           (e.g., 'siayxsi.yv85842' -> 'siayxsi-yv85842'). In Snowflake, the Python
           connector targets '<account>.snowflakecomputing.com'. Using a dot causes
           DNS resolution to fall back to a default regional load balancer, throwing
           SSLError(CertificateError).
        5. Preserves legitimate legacy locators with cloud regions (e.g., 'xy12345.us-east-1'
           or 'xy12345.us-central1.gcp').
        """
        if not account:
            return ""
        val = str(account).strip()
        if val.startswith(("http://", "https://")):
            from urllib.parse import urlparse
            try:
                parsed = urlparse(val)
                host = parsed.netloc or parsed.path.split("/")[0]
                if "app.snowflake.com" in host:
                    path_parts = [p for p in parsed.path.strip("/").split("/") if p and p != "#"]
                    if len(path_parts) >= 2:
                        return f"{path_parts[0]}-{path_parts[1]}".lower()
                val = host
            except Exception:
                pass

        if ":" in val:
            val = val.split(":")[0]

        if val.lower().endswith(".snowflakecomputing.com"):
            val = val[:-len(".snowflakecomputing.com")]

        if "/" in val and "." not in val:
            parts = [p for p in val.split("/") if p]
            if len(parts) == 2:
                return f"{parts[0]}-{parts[1]}".lower()

        known_region_prefixes = ("us-", "eu-", "ap-", "ca-", "sa-", "me-", "af-")
        cloud_suffixes = (".aws", ".gcp", ".azure")
        if "." in val:
            parts = val.split(".")
            if len(parts) == 2:
                part1, part2 = parts[0], parts[1]
                is_region = (
                    part2.lower().startswith(known_region_prefixes) or
                    any(part2.lower().endswith(cs) for cs in cloud_suffixes)
                )
                if not is_region:
                    val = f"{part1}-{part2}"

        return val.lower()

    def _get_connection(self, config: Dict[str, Any]):
        if not SNOWFLAKE_AVAILABLE:
            raise RuntimeError("snowflake-connector-python is not installed in the python environment.")

        raw_account = config.get("account", "")
        account = self.clean_account(raw_account)
        user = (config.get("user") or config.get("username", "")).strip()
        password = config.get("password", "")
        database = config.get("database", "").strip()
        schema = config.get("schema", "PUBLIC").strip().upper()
        warehouse = config.get("warehouse", "").strip()
        role = config.get("role", "").strip()

        if not account or not user or not database:
            raise ValueError("Snowflake 'account', 'user', and 'database' are required.")

        conn_params: Dict[str, Any] = {
            "account": account,
            "user": user,
            "password": password,
            "database": database,
            "schema": schema,
            "login_timeout": 10,
            "network_timeout": 15,
        }
        if warehouse:
            conn_params["warehouse"] = warehouse
        if role:
            conn_params["role"] = role

        return snowflake.connector.connect(**conn_params)

    def _serialize_value(self, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, (datetime, date, time)):
            return val.isoformat()
        if isinstance(val, Decimal):
            return float(val) if (val % 1 != 0) else int(val)
        if isinstance(val, (bytes, memoryview, bytearray)):
            return bytes(val).hex()
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        if not SNOWFLAKE_AVAILABLE:
            return {"success": False, "message": "Snowflake driver is not installed."}
        try:
            conn = self._get_connection(config)
            with conn.cursor() as cur:
                cur.execute("SELECT CURRENT_VERSION(), CURRENT_DATABASE(), CURRENT_SCHEMA();")
                row = cur.fetchone()
                version, db, sch = (row[0], row[1], row[2]) if row else ("unknown", "", "")
            conn.close()
            return {
                "success": True,
                "message": f"Successfully connected to Snowflake (v{version}, Database: {db}, Schema: {sch})."
            }
        except Exception as e:
            err_msg = str(e)
            if "CertificateError" in err_msg or "SSL" in err_msg or "250003" in err_msg:
                err_msg += " (Hint: Snowflake account identifiers must use a hyphen, e.g. 'orgname-account_name'. Snowsight's copied 'org.account' format causes SSL certificate mismatches.)"
            return {"success": False, "message": f"Snowflake connection failed: {err_msg}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        database = config.get("database", "").strip().upper()
        schema = config.get("schema", "PUBLIC").strip().upper()

        conn = self._get_connection(config)
        tables: List[str] = []
        try:
            with conn.cursor() as cur:
                query = """
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME;
                """
                cur.execute(query, (schema,))
                tables = [r[0] for r in cur.fetchall()]
        finally:
            conn.close()
        return tables

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        schema = config.get("schema", "PUBLIC").strip().upper()
        raw_table = table_name.upper()

        conn = self._get_connection(config)
        columns: List[Dict[str, str]] = []
        try:
            with conn.cursor() as cur:
                query = """
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                ORDER BY ORDINAL_POSITION;
                """
                cur.execute(query, (schema, raw_table))
                columns = [{"column_name": r[0], "data_type": r[1]} for r in cur.fetchall()]
        finally:
            conn.close()
        return columns

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        database = config.get("database", "").strip().replace('"', '')
        schema = config.get("schema", "PUBLIC").strip().replace('"', '')
        clean_table = table_name.replace('"', '')
        clean_limit = max(1, min(int(limit), 100000))

        conn = self._get_connection(config)
        rows: List[Dict[str, Any]] = []
        try:
            with conn.cursor() as cur:
                # Quoted identifiers prevent SQL injection for table/db/schema names
                query = f'SELECT * FROM "{database}"."{schema}"."{clean_table}" LIMIT {clean_limit}'
                cur.execute(query)
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
