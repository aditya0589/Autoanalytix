import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, date, time
from decimal import Decimal

from app.data_sources.base import BaseDataConnector

try:
    from google.cloud import bigquery
    from google.oauth2 import service_account
    import google.auth
    BIGQUERY_AVAILABLE = True
except ImportError:
    BIGQUERY_AVAILABLE = False


class BigQueryDataConnector(BaseDataConnector):
    connector_type = "bigquery"
    display_name = "Google Cloud BigQuery"

    def _get_client(self, config: Dict[str, Any]):
        if not BIGQUERY_AVAILABLE:
            raise RuntimeError("google-cloud-bigquery is not installed in the python environment.")

        project_id = config.get("project_id", "").strip()
        location = config.get("location")
        sa_json_or_dict = config.get("service_account_json") or config.get("credentials_json")

        credentials = None
        if sa_json_or_dict:
            if isinstance(sa_json_or_dict, str):
                try:
                    sa_info = json.loads(sa_json_or_dict)
                except Exception:
                    # Might be a file path
                    if os.path.exists(sa_json_or_dict):
                        with open(sa_json_or_dict, "r", encoding="utf-8") as f:
                            sa_info = json.load(f)
                    else:
                        raise ValueError("Invalid Service Account JSON format or file path.")
            elif isinstance(sa_json_or_dict, dict):
                sa_info = sa_json_or_dict
            else:
                raise ValueError("Service Account JSON must be a valid JSON string or object.")

            credentials = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://www.googleapis.com/auth/bigquery"]
            )
            if not project_id and "project_id" in sa_info:
                project_id = sa_info["project_id"]
        else:
            # Fallback to Application Default Credentials (ADC)
            try:
                credentials, detected_project = google.auth.default(
                    scopes=["https://www.googleapis.com/auth/bigquery"]
                )
                if not project_id and detected_project:
                    project_id = detected_project
            except Exception as e:
                raise ValueError(f"Could not load Google credentials: {str(e)}")

        if not project_id:
            raise ValueError("BigQuery 'project_id' is required.")

        return bigquery.Client(
            project=project_id,
            credentials=credentials,
            location=location
        )

    def _serialize_value(self, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, (datetime, date, time)):
            return val.isoformat()
        if isinstance(val, Decimal):
            return float(val) if (val % 1 != 0) else int(val)
        if isinstance(val, (bytes, memoryview)):
            return bytes(val).hex()
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        if not BIGQUERY_AVAILABLE:
            return {"success": False, "message": "Google Cloud BigQuery SDK is not installed."}
        try:
            client = self._get_client(config)
            dataset_id = config.get("dataset_id", "").strip()
            project_id = client.project

            if dataset_id:
                dataset_ref = f"{project_id}.{dataset_id}"
                dataset = client.get_dataset(dataset_ref)
                return {
                    "success": True,
                    "message": f"Successfully connected to BigQuery dataset '{dataset.dataset_id}' in project '{project_id}'."
                }
            else:
                # Test query if dataset is not specified
                query_job = client.query("SELECT 1 as test;")
                query_job.result()
                return {
                    "success": True,
                    "message": f"Successfully authenticated with BigQuery project '{project_id}'."
                }
        except Exception as e:
            return {"success": False, "message": f"BigQuery connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        client = self._get_client(config)
        dataset_id = config.get("dataset_id", "").strip()
        if not dataset_id:
            raise ValueError("BigQuery 'dataset_id' is required to list tables.")

        dataset_ref = f"{client.project}.{dataset_id}"
        tables_iter = client.list_tables(dataset_ref)
        return [t.table_id for t in tables_iter]

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        client = self._get_client(config)
        dataset_id = config.get("dataset_id", "").strip()
        if not dataset_id:
            raise ValueError("BigQuery 'dataset_id' is required to get table schema.")

        table_ref = f"{client.project}.{dataset_id}.{table_name}"
        table = client.get_table(table_ref)
        return [{"column_name": field.name, "data_type": field.field_type} for field in table.schema]

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        client = self._get_client(config)
        dataset_id = config.get("dataset_id", "").strip()
        if not dataset_id:
            raise ValueError("BigQuery 'dataset_id' is required to extract table data.")

        # Construct clean quoted query
        project_id = client.project
        clean_limit = max(1, min(int(limit), 100000))
        query = f"SELECT * FROM `{project_id}.{dataset_id}.{table_name}` LIMIT {clean_limit}"

        query_job = client.query(query)
        result = query_job.result()

        rows: List[Dict[str, Any]] = []
        for row in result:
            row_dict = {}
            for key, val in row.items():
                row_dict[key] = self._serialize_value(val)
            rows.append(row_dict)

        return rows
