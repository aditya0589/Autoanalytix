import os
import time
import math
import duckdb
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.analytics.sql_validator import SQLValidator, SQLSecurityValidationError

class DuckDBAnalyticsEngine:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.path.join(settings.STORAGE_DIR, "duckdb", "analytics.duckdb")
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self.conn = duckdb.connect(self.db_path)
        except (duckdb.IOException, Exception):
            # File might be locked by another process or filesystem constraints. Fallback safely
            try:
                self.conn = duckdb.connect(self.db_path, read_only=True)
            except Exception:
                self.conn = duckdb.connect(":memory:")
        # Apply safety configurations
        try:
            self.conn.execute(f"SET max_memory = '{settings.DUCKDB_MEMORY_LIMIT}';")
            self.conn.execute("SET preserve_insertion_order = false;")
        except Exception:
            pass

    def register_dataset(self, table_name: str, file_path: str, file_type: str):
        """Creates or replaces a persistent DuckDB table from a CSV or Parquet file."""
        clean_table = table_name.lower().replace("-", "_")
        abs_path = os.path.abspath(file_path).replace("\\", "/")
        
        if file_type.lower() == "csv":
            query = f"""
            CREATE OR REPLACE TABLE {clean_table} AS 
            SELECT * FROM read_csv_auto('{abs_path}', header=true, sample_size=20000);
            """
        elif file_type.lower() in ("parquet", "pq"):
            query = f"""
            CREATE OR REPLACE TABLE {clean_table} AS 
            SELECT * FROM read_parquet('{abs_path}');
            """
        else:
            raise ValueError(f"Unsupported file type for direct DuckDB registration: {file_type}")
            
        try:
            self.conn.execute(query)
        except Exception as e:
            if "read-only" in str(e).lower() or "readonly" in str(e).lower():
                self.conn = duckdb.connect(":memory:")
                self.conn.execute(query)
            else:
                raise

    def execute_query(
        self,
        sql: str,
        allowed_table_name: str,
        max_rows: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Validates SQL against security rules, then executes it in DuckDB.
        Returns execution metrics, columns, and JSON-safe rows.
        """
        limit = max_rows or settings.DUCKDB_MAX_RESULT_ROWS
        clean_table = allowed_table_name.lower().replace("-", "_")
        
        # 1. Security validation and AST sanitization
        sanitized_sql = SQLValidator.validate_and_sanitize(sql, clean_table)

        # 2. Append safety limit if not already limited
        wrapped_sql = f"SELECT * FROM ({sanitized_sql}) AS __safe_subquery LIMIT {limit}"

        start_time = time.time()
        try:
            rel = self.conn.query(wrapped_sql)
            columns = rel.columns
            raw_rows = rel.fetchall()
            execution_time_ms = round((time.time() - start_time) * 1000, 2)
        except Exception as e:
            raise RuntimeError(f"DuckDB Query execution failed: {str(e)}")

        # 3. Clean rows for JSON serialization (handle NaN, Inf, None, date objects)
        clean_rows: List[Dict[str, Any]] = []
        for row in raw_rows:
            row_dict = {}
            for col_name, val in zip(columns, row):
                if val is None:
                    row_dict[col_name] = None
                elif isinstance(val, float):
                    if math.isnan(val) or math.isinf(val):
                        row_dict[col_name] = None
                    else:
                        row_dict[col_name] = val
                elif hasattr(val, "isoformat"):
                    row_dict[col_name] = val.isoformat()
                else:
                    row_dict[col_name] = val
            clean_rows.append(row_dict)

        return {
            "columns": columns,
            "rows": clean_rows,
            "row_count": len(clean_rows),
            "execution_time_ms": execution_time_ms,
            "executed_sql": sanitized_sql
        }

    def get_table_schema(self, table_name: str) -> List[Dict[str, str]]:
        clean_table = table_name.lower().replace("-", "_")
        res = self.conn.execute(f"DESCRIBE {clean_table}").fetchall()
        return [{"column_name": r[0], "data_type": r[1]} for r in res]

analytics_engine = DuckDBAnalyticsEngine()
