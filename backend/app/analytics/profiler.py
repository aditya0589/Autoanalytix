import math
from typing import Dict, Any, List
import polars as pl

class DatasetProfiler:
    @staticmethod
    def profile_dataframe(df: pl.DataFrame, type_map: Dict[str, str], original_columns: List[str]) -> Dict[str, Any]:
        row_count = df.height
        column_count = df.width
        
        # Calculate duplicates
        try:
            duplicate_count = row_count - df.unique().height
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
            
            null_count = df[col].null_count()
            total_missing += null_count
            null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
            
            try:
                unique_count = df[col].n_unique()
            except Exception:
                unique_count = 0

            # Sample values
            sample_vals = [
                str(v) if v is not None else None 
                for v in df[col].drop_nulls().head(5).to_list()
            ]

            stats: Dict[str, Any] = {}
            if inferred_type == "numeric":
                numeric_cols.append(col)
                s = df[col].drop_nulls()
                if s.len() > 0:
                    try:
                        stats["min"] = round(float(s.min()), 2)
                        stats["max"] = round(float(s.max()), 2)
                        stats["mean"] = round(float(s.mean()), 2)
                        stats["median"] = round(float(s.median()), 2)
                        stats["std"] = round(float(s.std()), 2) if s.std() is not None else 0.0
                    except Exception:
                        pass
            elif inferred_type == "categorical":
                categorical_cols.append(col)
                try:
                    top_vals = (
                        df[col]
                        .drop_nulls()
                        .value_counts(sort=True)
                        .head(5)
                        .to_dicts()
                    )
                    stats["top_values"] = top_vals
                except Exception:
                    pass
            elif inferred_type == "datetime":
                datetime_cols.append(col)
                s = df[col].drop_nulls()
                if s.len() > 0:
                    try:
                        stats["min_date"] = str(s.min())
                        stats["max_date"] = str(s.max())
                    except Exception:
                        pass

            col_stat = {
                "name": col,
                "original_name": orig_col,
                "data_type": inferred_type,
                "duckdb_type": str(df[col].dtype),
                "null_count": null_count,
                "null_percentage": null_pct,
                "unique_count": unique_count,
                "sample_values": sample_vals,
                "stats": stats
            }
            columns_stats.append(col_stat)

        total_cells = row_count * column_count
        missing_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0

        # Generate summary insights
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

        # Suggest contextual questions grounded in actual columns
        suggested_questions: List[str] = []
        
        # 1. Time-series question if datetime and numeric exist
        if datetime_cols and numeric_cols:
            date_c = datetime_cols[0].replace("_", " ")
            num_c = numeric_cols[0].replace("_", " ")
            suggested_questions.append(f"Show monthly {num_c} trend over time.")
            if len(numeric_cols) > 1:
                num_c2 = numeric_cols[1].replace("_", " ")
                suggested_questions.append(f"Compare {num_c} and {num_c2} by month.")

        # 2. Categorical breakdown question
        if categorical_cols and numeric_cols:
            cat_c = categorical_cols[0].replace("_", " ")
            num_c = numeric_cols[0].replace("_", " ")
            suggested_questions.append(f"Which {cat_c} has the highest total {num_c}?")
            suggested_questions.append(f"Show top 5 {cat_c} by {num_c}.")
            
            if len(categorical_cols) > 1:
                cat_c2 = categorical_cols[1].replace("_", " ")
                suggested_questions.append(f"Break down {num_c} by {cat_c} and {cat_c2}.")

        # 3. Aggregation & executive summary
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
