import os
import re
import csv
import tempfile
import duckdb
import openpyxl
from typing import Tuple, List, Dict, Any, Optional

def sanitize_column_name(col: str) -> str:
    """Transforms raw column names into clean, SQL-friendly identifiers."""
    cleaned = re.sub(r"[^\w\s]", "", str(col).strip())
    cleaned = re.sub(r"\s+", "_", cleaned).lower()
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"col_{cleaned}"
    return cleaned

class ParsedDataFrame:
    """Lightweight DataFrame wrapper backed by an in-memory DuckDB table."""
    def __init__(self, conn: duckdb.DuckDBPyConnection, table_name: str, columns: List[str], height: int, duckdb_types: Dict[str, str]):
        self.conn = conn
        self.table_name = table_name
        self.columns = columns
        self.height = height
        self.width = len(columns)
        self.duckdb_types = duckdb_types

    def write_parquet(self, parquet_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(parquet_path)), exist_ok=True)
        norm_path = os.path.abspath(parquet_path).replace("\\", "/")
        self.conn.execute(f"COPY {self.table_name} TO '{norm_path}' (FORMAT PARQUET)")

class DataParser:
    @staticmethod
    def parse_file(
        file_path: str,
        file_type: str,
        sheet_name: Optional[str] = None
    ) -> Tuple[ParsedDataFrame, Dict[str, str], List[str]]:
        """
        Parses a file into a DuckDB-backed DataFrame, sanitizes columns, and returns:
        (df, column_type_map, original_columns)
        Uses native DuckDB and openpyxl with zero external Rust or glibc dependencies.
        """
        file_ext = file_type.lower()
        conn = duckdb.connect(":memory:")
        norm_path = os.path.abspath(file_path).replace("\\", "/")
        temp_csv: Optional[str] = None

        try:
            if file_ext == "csv":
                conn.execute(f"CREATE TABLE raw_import AS SELECT * FROM read_csv_auto('{norm_path}', header=true, ignore_errors=true)")
            elif file_ext in ("xlsx", "xls"):
                wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                active_sheet = sheet_name or wb.sheetnames[0]
                ws = wb[active_sheet]
                rows_iter = ws.iter_rows(values_only=True)
                try:
                    headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(next(rows_iter))]
                except StopIteration:
                    headers = []
                data_rows = []
                for row in rows_iter:
                    if any(v is not None for v in row):
                        data_rows.append(list(row))
                wb.close()

                if not headers and not data_rows:
                    conn.execute("CREATE TABLE raw_import (empty_col VARCHAR)")
                else:
                    temp_fd, temp_csv = tempfile.mkstemp(suffix=".csv")
                    os.close(temp_fd)
                    with open(temp_csv, "w", newline="", encoding="utf-8") as f:
                        writer = csv.writer(f)
                        writer.writerow(headers)
                        writer.writerows(data_rows)
                    temp_norm = os.path.abspath(temp_csv).replace("\\", "/")
                    conn.execute(f"CREATE TABLE raw_import AS SELECT * FROM read_csv_auto('{temp_norm}', header=true, ignore_errors=true)")
            elif file_ext in ("parquet", "pq"):
                conn.execute(f"CREATE TABLE raw_import AS SELECT * FROM read_parquet('{norm_path}')")
            else:
                raise ValueError(f"Unsupported file format: {file_type}")

            rel = conn.table("raw_import")
            original_columns = rel.columns
            new_columns = [sanitize_column_name(c) for c in original_columns]

            seen: Dict[str, int] = {}
            unique_columns = []
            for col in new_columns:
                if col in seen:
                    seen[col] += 1
                    unique_columns.append(f"{col}_{seen[col]}")
                else:
                    seen[col] = 1
                    unique_columns.append(col)

            select_clauses = [f'"{orig}" AS "{clean}"' for orig, clean in zip(original_columns, unique_columns)]
            select_expr = ", ".join(select_clauses)
            conn.execute(f"CREATE TABLE sanitized_data AS SELECT {select_expr} FROM raw_import")
            conn.execute("DROP TABLE raw_import")

            final_rel = conn.table("sanitized_data")
            row_count = final_rel.shape[0]
            final_cols = final_rel.columns
            duck_types = {col: str(dtype) for col, dtype in zip(final_cols, final_rel.types)}

            type_map: Dict[str, str] = {}
            for col in final_cols:
                dtype_str = duck_types[col].upper()
                if any(num_t in dtype_str for num_t in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL", "HUGEINT")):
                    type_map[col] = "numeric"
                elif any(date_t in dtype_str for date_t in ("TIME", "DATE")):
                    type_map[col] = "datetime"
                elif "BOOL" in dtype_str:
                    type_map[col] = "boolean"
                else:
                    sample_rows = conn.execute(f'SELECT "{col}" FROM sanitized_data WHERE "{col}" IS NOT NULL LIMIT 20').fetchall()
                    is_date = False
                    if sample_rows and all(isinstance(r[0], str) and re.match(r"^\d{4}-\d{2}-\d{2}", r[0].strip()) for r in sample_rows):
                        is_date = True
                    type_map[col] = "datetime" if is_date else "categorical"

            df = ParsedDataFrame(conn, "sanitized_data", final_cols, row_count, duck_types)
            return df, type_map, original_columns

        finally:
            if temp_csv and os.path.exists(temp_csv):
                try:
                    os.remove(temp_csv)
                except Exception:
                    pass

    @staticmethod
    def get_excel_sheets(file_path: str) -> List[str]:
        wb = openpyxl.load_workbook(file_path, read_only=True)
        sheets = wb.sheetnames
        wb.close()
        return sheets
