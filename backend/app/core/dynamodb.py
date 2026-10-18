import os
import json
import sqlite3
import threading
from decimal import Decimal
from typing import Dict, Any, List, Optional
import boto3
from boto3.dynamodb.conditions import Key, Attr
from app.core.config import settings

def _to_dynamo(obj: Any) -> Any:
    """Converts Python floats/ints/dicts/lists to DynamoDB Decimal safe format."""
    return json.loads(json.dumps(obj), parse_float=Decimal)

def _from_dynamo(item: Any) -> Any:
    """Converts DynamoDB Decimal objects back to standard int/float for JSON serialization."""
    if isinstance(item, list):
        return [_from_dynamo(v) for v in item]
    elif isinstance(item, dict):
        return {k: _from_dynamo(v) for k, v in item.items()}
    elif isinstance(item, Decimal):
        if item % 1 == 0:
            return int(item)
        else:
            return float(item)
    return item

class LocalDynamoTable:
    """
    Zero-config local SQLite single-table storage that mirrors AWS DynamoDB's single-table API.
    Used automatically whenever AWS credentials are not configured (local dev, standard Docker).
    Persists data cleanly to storage/autoanalytix_store.db.
    """
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            storage_dir = getattr(settings, "STORAGE_DIR", "./storage")
            db_path = os.path.join(storage_dir, "autoanalytix_store.db")
        self.db_path = os.path.abspath(db_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._lock:
            with self._get_conn() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS dynamodb_items (
                        pk TEXT NOT NULL,
                        sk TEXT NOT NULL,
                        gsi1_pk TEXT,
                        gsi1_sk TEXT,
                        entity_type TEXT,
                        item_id TEXT,
                        data TEXT NOT NULL,
                        PRIMARY KEY (pk, sk)
                    );
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_gsi1 ON dynamodb_items(gsi1_pk, gsi1_sk);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_entity ON dynamodb_items(entity_type);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_item_id ON dynamodb_items(item_id);")
                conn.commit()

    def get_item(self, Key: Dict[str, Any]) -> Dict[str, Any]:
        pk = str(Key.get("PK", ""))
        sk = str(Key.get("SK", ""))
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute("SELECT data FROM dynamodb_items WHERE pk = ? AND sk = ?", (pk, sk))
                row = cur.fetchone()
                if row:
                    try:
                        return {"Item": json.loads(row["data"])}
                    except Exception:
                        pass
        return {}

    def put_item(self, Item: Dict[str, Any]) -> Dict[str, Any]:
        pk = str(Item.get("PK", ""))
        sk = str(Item.get("SK", ""))
        gsi1_pk = str(Item.get("GSI1_PK")) if Item.get("GSI1_PK") is not None else None
        gsi1_sk = str(Item.get("GSI1_SK")) if Item.get("GSI1_SK") is not None else None
        entity_type = Item.get("entity_type")
        item_id = str(Item.get("id")) if Item.get("id") is not None else None
        data_clean = _from_dynamo(Item)
        data_json = json.dumps(data_clean)
        with self._lock:
            with self._get_conn() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO dynamodb_items (pk, sk, gsi1_pk, gsi1_sk, entity_type, item_id, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (pk, sk, gsi1_pk, gsi1_sk, entity_type, item_id, data_json))
                conn.commit()
        return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    def delete_item(self, Key: Dict[str, Any]) -> Dict[str, Any]:
        pk = str(Key.get("PK", ""))
        sk = str(Key.get("SK", ""))
        with self._lock:
            with self._get_conn() as conn:
                conn.execute("DELETE FROM dynamodb_items WHERE pk = ? AND sk = ?", (pk, sk))
                conn.commit()
        return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    def _eval_cond(self, cond: Any, item: Dict[str, Any]) -> bool:
        if cond is None:
            return True
        op = None
        values = ()
        if hasattr(cond, "get_expression"):
            try:
                expr_data = cond.get_expression()
                op = expr_data.get("operator")
                values = expr_data.get("values", ())
            except Exception:
                pass
        if not op:
            op = getattr(cond, "expression_operator", None)
            values = getattr(cond, "_values", ())

        if op == "AND":
            return all(self._eval_cond(sub, item) for sub in values)
        elif op == "OR":
            return any(self._eval_cond(sub, item) for sub in values)
        elif op == "=":
            if len(values) >= 2:
                attr = getattr(values[0], "name", str(values[0]))
                expected = values[1]
                actual = item.get(attr)
                if actual is None:
                    return False
                if isinstance(actual, str) and isinstance(expected, str):
                    if "email" in attr.lower():
                        return actual.strip().lower() == expected.strip().lower()
                    return actual == expected
                return actual == expected
            return True
        elif op == "begins_with":
            if len(values) >= 2:
                attr = getattr(values[0], "name", str(values[0]))
                prefix = str(values[1])
                actual = str(item.get(attr, ""))
                return actual.startswith(prefix)
            return True
        return True

    def query(self, IndexName: Optional[str] = None, KeyConditionExpression: Any = None, **kwargs) -> Dict[str, Any]:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute("SELECT data FROM dynamodb_items")
                rows = cur.fetchall()
        items = []
        for r in rows:
            try:
                items.append(json.loads(r["data"]))
            except Exception:
                pass
        matching = [item for item in items if self._eval_cond(KeyConditionExpression, item)]
        return {"Items": matching, "Count": len(matching)}

    def scan(self, FilterExpression: Any = None, **kwargs) -> Dict[str, Any]:
        with self._lock:
            with self._get_conn() as conn:
                cur = conn.execute("SELECT data FROM dynamodb_items")
                rows = cur.fetchall()
        items = []
        for r in rows:
            try:
                items.append(json.loads(r["data"]))
            except Exception:
                pass
        matching = [item for item in items if self._eval_cond(FilterExpression, item)]
        return {"Items": matching, "Count": len(matching)}

class DynamoDBService:
    def __init__(self):
        self.table_name = settings.DYNAMODB_TABLE_NAME
        self.region = settings.AWS_REGION
        self._resource = None
        self._table = None
        self._local_table = None

    @property
    def table(self):
        if self._table is not None:
            return self._table

        # Check if real AWS credentials are available
        has_aws = False
        try:
            session = boto3.Session(region_name=self.region)
            creds = session.get_credentials()
            if creds is not None and getattr(creds, "access_key", None):
                has_aws = True
        except Exception:
            has_aws = False

        if has_aws and getattr(settings, "USE_DYNAMODB", True):
            try:
                self._resource = session.resource("dynamodb")
                tbl = self._resource.Table(self.table_name)
                tbl.load()
                self._table = tbl
                print(f"[DynamoDBService] Connected to AWS DynamoDB: {self.table_name}")
                return self._table
            except Exception as e:
                print(f"[DynamoDBService] AWS DynamoDB connect failed: {e}. Falling back to local storage.")

        if self._local_table is None:
            self._local_table = LocalDynamoTable()
            print(f"[DynamoDBService] Active store: Local SQLite ({self._local_table.db_path})")
        self._table = self._local_table
        return self._table

    # ==================== USERS ====================
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"USER#{user_id}", "SK": "METADATA"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        res = self.table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1_PK").eq(f"EMAIL#{clean_email}")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def create_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        email_clean = user["email"].strip().lower()
        item = {
            **user,
            "email": email_clean,
            "PK": f"USER#{user['id']}",
            "SK": "METADATA",
            "GSI1_PK": f"EMAIL#{email_clean}",
            "GSI1_SK": f"USER#{user['id']}",
            "entity_type": "USER",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    # ==================== WORKSPACES ====================
    def get_workspace_by_id(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": "METADATA"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_workspace_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        res = self.table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1_PK").eq(f"SLUG#{slug}")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def create_workspace(self, ws: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **ws,
            "PK": f"WS#{ws['id']}",
            "SK": "METADATA",
            "GSI1_PK": f"SLUG#{ws['slug']}",
            "GSI1_SK": f"WS#{ws['id']}",
            "entity_type": "WORKSPACE",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def add_workspace_member(self, member: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **member,
            "PK": f"WS#{member['workspace_id']}",
            "SK": f"MEMBER#{member['user_id']}",
            "GSI1_PK": f"USER#{member['user_id']}",
            "GSI1_SK": f"WS#{member['workspace_id']}",
            "entity_type": "WORKSPACE_MEMBER",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_workspace_member(self, workspace_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"MEMBER#{user_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def list_user_workspaces(self, user_id: str) -> List[Dict[str, Any]]:
        # Query GSI1 for all memberships of this user
        res = self.table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1_PK").eq(f"USER#{user_id}")
        )
        memberships = res.get("Items", [])
        workspaces = []
        for m in memberships:
            ws_id = m.get("workspace_id")
            if ws_id:
                ws = self.get_workspace_by_id(ws_id)
                if ws:
                    ws["role"] = m.get("role", "member")
                    workspaces.append(ws)
        return workspaces

    # ==================== DATASETS ====================
    def create_dataset(self, dataset: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **dataset,
            "PK": f"WS#{dataset['workspace_id']}",
            "SK": f"DATASET#{dataset['id']}",
            "entity_type": "DATASET",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_dataset(self, workspace_id: str, dataset_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DATASET#{dataset_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_dataset_by_id(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        # Query scan with filter on dataset id (or SK)
        res = self.table.scan(
            FilterExpression=Attr("id").eq(dataset_id) & Attr("entity_type").eq("DATASET")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def list_datasets(self, workspace_id: str) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("DATASET#")
        )
        return _from_dynamo(res.get("Items", []))

    def delete_dataset(self, workspace_id: str, dataset_id: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DATASET#{dataset_id}"})
        return True

    # ==================== DASHBOARDS ====================
    def create_dashboard(self, dashboard: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **dashboard,
            "PK": f"WS#{dashboard['workspace_id']}",
            "SK": f"DASHBOARD#{dashboard['id']}",
            "entity_type": "DASHBOARD",
        }
        if dashboard.get("share_token"):
            item["GSI1_PK"] = f"SHARE#{dashboard['share_token']}"
            item["GSI1_SK"] = f"DASHBOARD#{dashboard['id']}"

        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def update_dashboard(self, workspace_id: str, dashboard_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_dashboard(workspace_id, dashboard_id) or {}
        merged = {**existing, **updates}
        return self.create_dashboard(merged)

    def get_dashboard(self, workspace_id: str, dashboard_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DASHBOARD#{dashboard_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_dashboard_by_id(self, dashboard_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.scan(
            FilterExpression=Attr("id").eq(dashboard_id) & Attr("entity_type").eq("DASHBOARD")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def get_dashboard_by_share_token(self, share_token: str) -> Optional[Dict[str, Any]]:
        res = self.table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1_PK").eq(f"SHARE#{share_token}")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def list_dashboards(self, workspace_id: str) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("DASHBOARD#")
        )
        return _from_dynamo(res.get("Items", []))

    def delete_dashboard(self, workspace_id: str, dashboard_id: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DASHBOARD#{dashboard_id}"})
        return True

    # ==================== AI PROVIDERS ====================
    def create_ai_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **config,
            "PK": f"WS#{config['workspace_id']}",
            "SK": f"AICFG#{config['id']}",
            "entity_type": "AI_CONFIG",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def update_ai_config(self, workspace_id: str, config_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_ai_config(workspace_id, config_id) or {}
        merged = {**existing, **updates}
        return self.create_ai_config(merged)

    def get_ai_config(self, workspace_id: str, config_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"AICFG#{config_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def list_ai_configs(self, workspace_id: str) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("AICFG#")
        )
        return _from_dynamo(res.get("Items", []))

    def delete_ai_config(self, workspace_id: str, config_id: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"AICFG#{config_id}"})
        return True

    # ==================== WORKSPACE INTEGRATIONS ====================
    def save_workspace_integration(self, integration: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **integration,
            "PK": f"WS#{integration['workspace_id']}",
            "SK": f"INTEG#{integration['provider']}",
            "entity_type": "WORKSPACE_INTEGRATION",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_workspace_integration(self, workspace_id: str, provider: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"INTEG#{provider}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def list_workspace_integrations(self, workspace_id: str) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("INTEG#")
        )
        return _from_dynamo(res.get("Items", []))

    def delete_workspace_integration(self, workspace_id: str, provider: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"INTEG#{provider}"})
        return True

    # ==================== CONVERSATIONS ====================
    def create_conversation(self, conv: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **conv,
            "PK": f"WS#{conv['workspace_id']}",
            "SK": f"CONV#{conv['id']}",
            "entity_type": "CONVERSATION",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_conversation(self, workspace_id: str, conv_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"CONV#{conv_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def list_conversations(self, workspace_id: str, dataset_id: Optional[str] = None) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("CONV#")
        )
        items = _from_dynamo(res.get("Items", []))
        if dataset_id:
            items = [i for i in items if i.get("dataset_id") == dataset_id]
        return items

    def append_message(self, workspace_id: str, conv_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
        conv = self.get_conversation(workspace_id, conv_id)
        if not conv:
            raise ValueError("Conversation not found")
        messages = conv.get("messages", [])
        messages.append(message)
        conv["messages"] = messages
        return self.create_conversation(conv)

    def delete_conversation(self, workspace_id: str, conv_id: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"CONV#{conv_id}"})
        return True

    def get_conversation_by_id(self, conv_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.scan(
            FilterExpression=Attr("id").eq(conv_id) & Attr("entity_type").eq("CONVERSATION")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    # ==================== DATA SOURCES ====================
    def create_data_source(self, ds: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **ds,
            "PK": f"WS#{ds['workspace_id']}",
            "SK": f"DATASOURCE#{ds['id']}",
            "entity_type": "DATA_SOURCE",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_data_source(self, workspace_id: str, source_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DATASOURCE#{source_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_data_source_by_id(self, source_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.scan(
            FilterExpression=Attr("id").eq(source_id) & Attr("entity_type").eq("DATA_SOURCE")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

    def list_data_sources(self, workspace_id: str) -> List[Dict[str, Any]]:
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(f"WS#{workspace_id}") & Key("SK").begins_with("DATASOURCE#")
        )
        return _from_dynamo(res.get("Items", []))

    def update_data_source(self, ds: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **ds,
            "PK": f"WS#{ds['workspace_id']}",
            "SK": f"DATASOURCE#{ds['id']}",
            "entity_type": "DATA_SOURCE",
        }
        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def delete_data_source(self, workspace_id: str, source_id: str) -> bool:
        self.table.delete_item(Key={"PK": f"WS#{workspace_id}", "SK": f"DATASOURCE#{source_id}"})
        return True

    # ==================== ANALYSES ====================
    def create_analysis(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            **analysis,
            "PK": f"WS#{analysis['workspace_id']}",
            "SK": f"ANALYSIS#{analysis['id']}",
            "entity_type": "ANALYSIS",
        }
        if analysis.get("conversation_id"):
            item["GSI1_PK"] = f"CONV#{analysis['conversation_id']}"
            item["GSI1_SK"] = f"ANALYSIS#{analysis['id']}"

        dynamo_item = _to_dynamo({k: v for k, v in item.items() if v is not None})
        self.table.put_item(Item=dynamo_item)
        return _from_dynamo(dynamo_item)

    def get_analysis(self, workspace_id: str, analysis_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.get_item(Key={"PK": f"WS#{workspace_id}", "SK": f"ANALYSIS#{analysis_id}"})
        item = res.get("Item")
        return _from_dynamo(item) if item else None

    def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        res = self.table.scan(
            FilterExpression=Attr("id").eq(analysis_id) & Attr("entity_type").eq("ANALYSIS")
        )
        items = res.get("Items", [])
        return _from_dynamo(items[0]) if items else None

dynamodb_store = DynamoDBService()
