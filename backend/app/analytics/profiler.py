import math
from typing import Dict, Any, List

class DatasetProfiler:
    @staticmethod
    def profile_dataframe(df: Any, type_map: Dict[str, str], original_columns: List[str]) -> Dict[str, Any]:
        """
        Profiles a ParsedDataFrame using native DuckDB aggregations.
        Generates column stats, missingness, duplicate counts, and AI-suggested analytical questions.
        """
        row_count = int(df.height)
        column_count = int(df.width)
        
        # Calculate duplicates
        try:
            distinct_count = df.conn.execute(f"SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {df.table_name})").fetchone()[0]
            duplicate_count = max(0, row_count - int(distinct_count))
        except Exception:
            duplicate_count = 0

        columns_stats: List[Dict[str, Any]] = []
        total_missing = 0
        
        numeric_cols = []
        categorical_cols = []
        datetime_cols = []

        for i, col in enumerate(df.columns):
            orig_col = original_columns[i] if i < len(original_columns) else col
            inferred_type = type_map.get(col, "categorical")
            
            # Null count
            null_count = int(df.conn.execute(f'SELECT COUNT(*) FROM {df.table_name} WHERE "{col}" IS NULL').fetchone()[0])
            total_missing += null_count
            null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
            
            # Unique count
            try:
                unique_count = int(df.conn.execute(f'SELECT COUNT(DISTINCT "{col}") FROM {df.table_name}').fetchone()[0])
            except Exception:
                unique_count = 0

            # Sample values
            sample_rows = df.conn.execute(f'SELECT "{col}" FROM {df.table_name} WHERE "{col}" IS NOT NULL LIMIT 5').fetchall()
            sample_vals = [str(r[0]) if r[0] is not None else None for r in sample_rows]

            stats: Dict[str, Any] = {}
            if inferred_type == "numeric":
                numeric_cols.append(col)
                if row_count - null_count > 0:
                    try:
                        row = df.conn.execute(f'''
                            SELECT 
                                MIN("{col}"),
                                MAX("{col}"),
                                AVG("{col}"),
                                MEDIAN("{col}"),
                                STDDEV_SAMP("{col}")
                            FROM {df.table_name}
                            WHERE "{col}" IS NOT NULL
                        ''').fetchone()
                        if row and row[0] is not None:
                            stats["min"] = round(float(row[0]), 2)
                            stats["max"] = round(float(row[1]), 2)
                            stats["mean"] = round(float(row[2]), 2) if row[2] is not None else 0.0
                            stats["median"] = round(float(row[3]), 2) if row[3] is not None else 0.0
                            stats["std"] = round(float(row[4]), 2) if row[4] is not None else 0.0
                    except Exception:
                        pass
            elif inferred_type == "categorical":
                categorical_cols.append(col)
                try:
                    top_rows = df.conn.execute(f'''
                        SELECT "{col}" as value, COUNT(*) as count
                        FROM {df.table_name}
                        WHERE "{col}" IS NOT NULL
                        GROUP BY "{col}"
                        ORDER BY count DESC
                        LIMIT 5
                    ''').fetchall()
                    stats["top_values"] = [{"value": str(r[0]), "count": int(r[1])} for r in top_rows]
                except Exception:
                    pass
            elif inferred_type == "datetime":
                datetime_cols.append(col)
                if row_count - null_count > 0:
                    try:
                        row = df.conn.execute(f'''
                            SELECT MIN("{col}"), MAX("{col}")
                            FROM {df.table_name}
                            WHERE "{col}" IS NOT NULL
                        ''').fetchone()
                        if row and row[0] is not None:
                            stats["min_date"] = str(row[0])
                            stats["max_date"] = str(row[1])
                    except Exception:
                        pass

            duckdb_type_str = df.duckdb_types.get(col, "VARCHAR") if hasattr(df, "duckdb_types") else "VARCHAR"
            col_stat = {
                "name": col,
                "original_name": orig_col,
                "data_type": inferred_type,
                "duckdb_type": duckdb_type_str,
                "null_count": null_count,
                "null_percentage": null_pct,
                "unique_count": unique_count,
                "sample_values": sample_vals,
                "stats": stats
            }
            columns_stats.append(col_stat)

        total_cells = row_count * column_count
        missing_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0

        summary_insights = [
            f"Dataset contains {row_count:,} rows and {column_count} columns.",
            f"Identified {len(numeric_cols)} numeric metrics, {len(categorical_cols)} dimensions, and {len(datetime_cols)} time columns."
        ]
        if duplicate_count > 0:
            summary_insights.append(f"Detected {duplicate_count:,} duplicate rows ({round(duplicate_count/row_count*100, 1)}%).")
        if missing_pct > 0:
            summary_insights.append(f"Missing data accounts for {missing_pct}% of total cells.")
        else:
            summary_insights.append("High data quality: zero missing values detected.")

        suggested_questions: List[str] = []
        if datetime_cols and numeric_cols:
            date_c = datetime_cols[0].replace("_", " ")
            num_c = numeric_cols[0].replace("_", " ")
            suggested_questions.append(f"Show monthly {num_c} trend over time.")
            if len(numeric_cols) > 1:
                num_c2 = numeric_cols[1].replace("_", " ")
                suggested_questions.append(f"Compare {num_c} and {num_c2} by month.")

        if categorical_cols and numeric_cols:
            cat_c = categorical_cols[0].replace("_", " ")
            num_c = numeric_cols[0].replace("_", " ")
            suggested_questions.append(f"Which {cat_c} has the highest total {num_c}?")
            suggested_questions.append(f"Show top 5 {cat_c} by {num_c}.")
            if len(categorical_cols) > 1:
                cat_c2 = categorical_cols[1].replace("_", " ")
                suggested_questions.append(f"Break down {num_c} by {cat_c} and {cat_c2}.")

        if numeric_cols:
            num_c = numeric_cols[0].replace("_", " ")
            suggested_questions.append(f"What is the total and average {num_c}?")
            suggested_questions.append("Create an executive management dashboard.")

        return {
            "row_count": row_count,
            "column_count": column_count,
            "duplicate_rows_count": duplicate_count,
            "total_cells": total_cells,
            "missing_cells_count": total_missing,
            "missing_cells_percentage": missing_pct,
            "columns": columns_stats,
            "summary_insights": summary_insights,
            "suggested_questions": suggested_questions[:6]
        }
