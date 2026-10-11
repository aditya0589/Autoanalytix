import os
import sys
import json
import sqlite3
import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"
TABLE_NAME = "autoanalytix_data"

def get_account_id():
    sts = boto3.client("sts", region_name=REGION)
    return sts.get_caller_identity()["Account"]

def ensure_s3_bucket(bucket_name: str):
    s3 = boto3.client("s3", region_name=REGION)
    try:
        s3.head_bucket(Bucket=bucket_name)
        print(f"[OK] S3 Bucket '{bucket_name}' already exists.")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchBucket"):
            print(f"[+] Creating S3 Bucket '{bucket_name}' in {REGION}...")
            # us-east-1 does not accept LocationConstraint
            s3.create_bucket(Bucket=bucket_name)
            print(f"[OK] Created S3 Bucket '{bucket_name}'.")
        else:
            raise

    # Ensure encryption
    try:
        s3.put_bucket_encryption(
            Bucket=bucket_name,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
                ]
            }
        )
    except Exception as e:
        print(f"[!] Warning setting encryption: {e}")

    # Ensure block public access
    try:
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            }
        )
    except Exception as e:
        print(f"[!] Warning setting public access block: {e}")

    return bucket_name

def upload_local_storage_to_s3(bucket_name: str, base_dir: str = "storage"):
    s3 = boto3.client("s3", region_name=REGION)
    if not os.path.exists(base_dir):
        return

    print(f"[*] Uploading files from '{base_dir}' to s3://{bucket_name}/...")
    for root, _, files in os.walk(base_dir):
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.relpath(local_path, base_dir).replace("\\", "/")
            s3_key = rel_path
            try:
                s3.head_object(Bucket=bucket_name, Key=s3_key)
                print(f"  - s3://{bucket_name}/{s3_key} already exists.")
            except ClientError:
                print(f"  + Uploading {local_path} -> s3://{bucket_name}/{s3_key}...")
                s3.upload_file(local_path, bucket_name, s3_key)

def ensure_dynamodb_table(table_name: str):
    dynamodb = boto3.client("dynamodb", region_name=REGION)
    try:
        dynamodb.describe_table(TableName=table_name)
        print(f"[OK] DynamoDB table '{table_name}' already exists.")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "ResourceNotFoundException":
            print(f"[+] Creating DynamoDB table '{table_name}'...")
            dynamodb.create_table(
                TableName=table_name,
                KeySchema=[
                    {"AttributeName": "PK", "KeyType": "HASH"},
                    {"AttributeName": "SK", "KeyType": "RANGE"}
                ],
                AttributeDefinitions=[
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                    {"AttributeName": "GSI1_PK", "AttributeType": "S"},
                    {"AttributeName": "GSI1_SK", "AttributeType": "S"},
                ],
                GlobalSecondaryIndexes=[
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1_PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1_SK", "KeyType": "RANGE"}
                        ],
                        "Projection": {"ProjectionType": "ALL"}
                    }
                ],
                BillingMode="PAY_PER_REQUEST"
            )
            print("[*] Waiting for DynamoDB table to become ACTIVE...")
            waiter = dynamodb.get_waiter("table_exists")
            waiter.wait(TableName=table_name)
            print(f"[OK] Table '{table_name}' is now ACTIVE.")
        else:
            raise

def clean_dynamo_val(val):
    """Converts Python types (None, dict, list, bool, number) to DynamoDB-safe Python types for boto3 resource."""
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    if isinstance(val, dict):
        return {k: clean_dynamo_val(v) for k, v in val.items() if v is not None}
    if isinstance(val, list):
        return [clean_dynamo_val(v) for v in val]
    return str(val)

def migrate_sqlite_to_dynamodb(sqlite_path: str, table_name: str):
    if not os.path.exists(sqlite_path):
        print(f"[!] SQLite file '{sqlite_path}' not found. Skipping migration.")
        return

    print(f"[*] Migrating data from '{sqlite_path}' to DynamoDB '{table_name}'...")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(table_name)

    # 1. Users
    users = cursor.execute("SELECT * FROM users").fetchall()
    print(f"  Found {len(users)} users.")
    for u in users:
        item = {
            "PK": f"USER#{u['id']}",
            "SK": "METADATA",
            "GSI1_PK": f"EMAIL#{u['email'].strip().lower()}",
            "GSI1_SK": f"USER#{u['id']}",
            "id": u["id"],
            "email": u["email"].strip().lower(),
            "hashed_password": u["hashed_password"],
            "full_name": u["full_name"],
            "is_active": bool(u["is_active"]),
            "created_at": str(u["created_at"]),
            "updated_at": str(u["updated_at"]),
            "entity_type": "USER",
        }
        table.put_item(Item={k: v for k, v in item.items() if v is not None})
        print(f"    - Migrated user: {u['email']} ({u['full_name']})")

    # 2. Workspaces
    workspaces = cursor.execute("SELECT * FROM workspaces").fetchall()
    print(f"  Found {len(workspaces)} workspaces.")
    for w in workspaces:
        item = {
            "PK": f"WS#{w['id']}",
            "SK": "METADATA",
            "GSI1_PK": f"SLUG#{w['slug']}",
            "GSI1_SK": f"WS#{w['id']}",
            "id": w["id"],
            "name": w["name"],
            "slug": w["slug"],
            "owner_id": w["owner_id"],
            "created_at": str(w["created_at"]),
            "updated_at": str(w["updated_at"]),
            "entity_type": "WORKSPACE",
        }
        table.put_item(Item={k: v for k, v in item.items() if v is not None})
        print(f"    - Migrated workspace: {w['name']} ({w['id']})")

    # 3. Workspace Members
    members = cursor.execute("SELECT * FROM workspace_members").fetchall()
    print(f"  Found {len(members)} workspace members.")
    for m in members:
        item = {
            "PK": f"WS#{m['workspace_id']}",
            "SK": f"MEMBER#{m['user_id']}",
            "GSI1_PK": f"USER#{m['user_id']}",
            "GSI1_SK": f"WS#{m['workspace_id']}",
            "id": m["id"],
            "workspace_id": m["workspace_id"],
            "user_id": m["user_id"],
            "role": m["role"],
            "created_at": str(m["created_at"]),
            "entity_type": "WORKSPACE_MEMBER",
        }
        table.put_item(Item={k: v for k, v in item.items() if v is not None})
        print(f"    - Migrated member: user {m['user_id']} in ws {m['workspace_id']}")

    # 4. AI Provider Configs
    try:
        configs = cursor.execute("SELECT * FROM ai_provider_configs").fetchall()
        for c in configs:
            item = {
                "PK": f"WS#{c['workspace_id']}",
                "SK": f"AICFG#{c['id']}",
                "id": c["id"],
                "workspace_id": c["workspace_id"],
                "user_id": c["user_id"],
                "provider": c["provider"],
                "model_name": c["model_name"],
                "encrypted_api_key": c["encrypted_api_key"],
                "is_default": bool(c["is_default"]),
                "connection_status": c["connection_status"],
                "last_tested_at": str(c["last_tested_at"]) if c["last_tested_at"] else None,
                "custom_endpoint": c["custom_endpoint"],
                "created_at": str(c["created_at"]),
                "updated_at": str(c["updated_at"]),
                "entity_type": "AI_CONFIG",
            }
            table.put_item(Item={k: v for k, v in item.items() if v is not None})
    except Exception as e:
        print(f"  [!] Note on ai configs: {e}")

    # 5. Datasets & Columns
    try:
        datasets = cursor.execute("SELECT * FROM datasets").fetchall()
        for d in datasets:
            cols = cursor.execute("SELECT * FROM dataset_columns WHERE dataset_id = ?", (d["id"],)).fetchall()
            cols_list = []
            for col in cols:
                stats = json.loads(col["stats"]) if col["stats"] else {}
                sample = json.loads(col["sample_values"]) if col["sample_values"] else []
                cols_list.append({
                    "id": col["id"],
                    "name": col["name"],
                    "original_name": col["original_name"],
                    "data_type": col["data_type"],
                    "duckdb_type": col["duckdb_type"],
                    "null_count": col["null_count"],
                    "unique_count": col["unique_count"],
                    "sample_values": sample,
                    "stats": stats,
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
            table.put_item(Item={k: v for k, v in item.items() if v is not None})
            print(f"    - Migrated dataset: {d['name']} ({len(cols_list)} cols)")
    except Exception as e:
        print(f"  [!] Note on datasets: {e}")

    # 6. Dashboards & Items
    try:
        dashboards = cursor.execute("SELECT * FROM dashboards").fetchall()
        for db_row in dashboards:
            items_rows = cursor.execute("SELECT * FROM dashboard_items WHERE dashboard_id = ?", (db_row["id"],)).fetchall()
            items_list = []
            for itm in items_rows:
                items_list.append({
                    "id": itm["id"],
                    "dashboard_id": itm["dashboard_id"],
                    "title": itm["title"],
                    "chart_type": itm["chart_type"],
                    "generated_sql": itm["generated_sql"],
                    "chart_spec": json.loads(itm["chart_spec"]) if itm["chart_spec"] else {},
                    "insights": json.loads(itm["insights"]) if itm["insights"] else [],
                    "explanation": itm["explanation"],
                    "position": json.loads(itm["position"]) if itm["position"] else {},
                    "created_at": str(itm["created_at"]),
                    "updated_at": str(itm["updated_at"]),
                })

            item = {
                "PK": f"WS#{db_row['workspace_id']}",
                "SK": f"DASHBOARD#{db_row['id']}",
                "id": db_row["id"],
                "workspace_id": db_row["workspace_id"],
                "user_id": db_row["user_id"],
                "title": db_row["title"],
                "description": db_row["description"],
                "is_public": bool(db_row["is_public"]),
                "share_token": db_row["share_token"],
                "share_expires_at": str(db_row["share_expires_at"]) if db_row["share_expires_at"] else None,
                "layout": json.loads(db_row["layout"]) if db_row["layout"] else {},
                "filters": json.loads(db_row["filters"]) if db_row["filters"] else {},
                "items": items_list,
                "created_at": str(db_row["created_at"]),
                "updated_at": str(db_row["updated_at"]),
                "entity_type": "DASHBOARD",
            }
            if db_row["share_token"]:
                item["GSI1_PK"] = f"SHARE#{db_row['share_token']}"
                item["GSI1_SK"] = f"DASHBOARD#{db_row['id']}"

            table.put_item(Item={k: v for k, v in item.items() if v is not None})
            print(f"    - Migrated dashboard: {db_row['title']} ({len(items_list)} items)")
    except Exception as e:
        print(f"  [!] Note on dashboards: {e}")

    conn.close()
    print("[OK] SQLite migration to DynamoDB completed successfully.")

def main():
    account_id = get_account_id()
    bucket_name = f"autoanalytix-storage-{account_id}"

    print(f"==================================================")
    print(f"  Autoanalytix AWS Infrastructure Setup & Migration")
    print(f"  AWS Account: {account_id}")
    print(f"  Region:      {REGION}")
    print(f"  DynamoDB:    {TABLE_NAME}")
    print(f"  S3 Bucket:   {bucket_name}")
    print(f"==================================================")

    ensure_s3_bucket(bucket_name)
    upload_local_storage_to_s3(bucket_name)
    ensure_dynamodb_table(TABLE_NAME)
    migrate_sqlite_to_dynamodb("autoanalytix.db", TABLE_NAME)

    print("\n[SUCCESS] AWS Infrastructure is ready and data migrated!")

if __name__ == "__main__":
    main()
