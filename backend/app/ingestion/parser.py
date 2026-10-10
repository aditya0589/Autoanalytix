import os
import re
from typing import Tuple, List, Dict, Any, Optional
import polars as pl
import openpyxl

def sanitize_column_name(col: str) -> str:
    """Transforms raw column names into clean, SQL-friendly identifiers."""
    cleaned = re.sub(r"[^\w\s]", "", str(col).strip())
    cleaned = re.sub(r"\s+", "_", cleaned).lower()
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"col_{cleaned}"
    return cleaned

class DataParser:
    @staticmethod
    def parse_file(
        file_path: str,
        file_type: str,
        sheet_name: Optional[str] = None
    ) -> Tuple[pl.DataFrame, Dict[str, str], List[str]]:
        """
        Parses a file into a Polars DataFrame, sanitizes columns, and returns:
        (df, column_type_map, original_columns)
        Uses Polars and openpyxl without external C-extensions.
        """
        file_ext = file_type.lower()
        if file_ext == "csv":
            df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=10000)
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

            if not data_rows:
                df = pl.DataFrame({h: [] for h in headers})
            else:
                col_data = {h: [r[i] if i < len(r) else None for r in data_rows] for i, h in enumerate(headers)}
                df = pl.DataFrame(col_data)
        elif file_ext in ("parquet", "pq"):
            df = pl.read_parquet(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_type}")

        original_columns = df.columns
        new_columns = [sanitize_column_name(c) for c in original_columns]
        
        # Ensure column names are unique
        seen: Dict[str, int] = {}
        unique_columns = []
        for col in new_columns:
            if col in seen:
                seen[col] += 1
                unique_columns.append(f"{col}_{seen[col]}")
            else:
                seen[col] = 1
                unique_columns.append(col)

        df = df.rename(dict(zip(original_columns, unique_columns)))

        # Infer simplified data types: numeric, categorical, datetime, boolean
        type_map: Dict[str, str] = {}
        for col in df.columns:
            dtype = df[col].dtype
            if dtype.is_numeric():
                type_map[col] = "numeric"
            elif dtype.is_temporal():
                type_map[col] = "datetime"
            elif dtype == pl.Boolean:
                type_map[col] = "boolean"
            else:
                # Check if sample strings look like ISO dates (YYYY-MM-DD)
                sample = df[col].drop_nulls().head(20).to_list()
                is_date = False
                if sample and all(isinstance(s, str) and re.match(r"^\d{4}-\d{2}-\d{2}", s.strip()) for s in sample):
                    is_date = True
                type_map[col] = "datetime" if is_date else "categorical"

        return df, type_map, original_columns

    @staticmethod
    def get_excel_sheets(file_path: str) -> List[str]:
        wb = openpyxl.load_workbook(file_path, read_only=True)
        sheets = wb.sheetnames
        wb.close()
        return sheets
