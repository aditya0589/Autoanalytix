import sqlite3
import boto3
import json
from decimal import Decimal

def main():
    conn = sqlite3.connect("autoanalytix.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    table = boto3.resource("dynamodb", region_name="us-east-1").Table("autoanalytix_data")

    datasets = cursor.execute("SELECT * FROM datasets").fetchall()
    for d in datasets:
        cols = cursor.execute("SELECT * FROM dataset_columns WHERE dataset_id = ?", (d["id"],)).fetchall()
        cols_list = []
        for c in cols:
            cols_list.append({
                "id": c["id"],
                "name": c["name"],
                "original_name": c["original_name"],
                "data_type": c["data_type"],
                "duckdb_type": c["duckdb_type"],
                "null_count": c["null_count"],
                "unique_count": c["unique_count"],
            })

        prof = json.loads(d["profile_summary"]) if d["profile_summary"] else {}
        item = {
            "PK": f"WS#{d['workspace_id']}",
            "SK": f"DATASET#{d['id']}",
            "id": d["id"],
            "workspace_id": d["workspace_id"],
            "user_id": d["user_id"],
            "name": d["name"],
            "description": d["description"],
            "original_filename": d["original_filename"],
            "file_type": d["file_type"],
            "file_path": d["file_path"],
            "duckdb_table_name": d["duckdb_table_name"],
            "row_count": d["row_count"],
            "column_count": d["column_count"],
            "size_bytes": d["size_bytes"],
            "sheet_name": d["sheet_name"],
            "status": d["status"],
            "error_message": d["error_message"],
            "profile_summary": prof,
            "columns": cols_list,
            "created_at": str(d["created_at"]),
            "updated_at": str(d["updated_at"]),
            "entity_type": "DATASET",
        }
        item_dynamo = json.loads(json.dumps(item), parse_float=Decimal)
        cleaned = {k: v for k, v in item_dynamo.items() if v is not None}
        table.put_item(Item=cleaned)
        print(f"[OK] Migrated dataset: {d['name']}")

    print(f"Migrated {len(datasets)} datasets.")

if __name__ == "__main__":
    main()
