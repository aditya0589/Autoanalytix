import os
import re
import tempfile
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, time
from decimal import Decimal
import uuid
import json

import boto3
from botocore.exceptions import ClientError, BotoCoreError, NoCredentialsError, EndpointConnectionError
import duckdb

from app.data_sources.base import BaseDataConnector

SUPPORTED_EXTENSIONS = (
    ".csv",
    ".tsv",
    ".parquet",
    ".pq",
    ".json",
    ".jsonl",
    ".ndjson",
    ".xlsx",
    ".xls",
)


class S3DataConnector(BaseDataConnector):
    connector_type = "s3"
    display_name = "Amazon S3"

    @classmethod
    def parse_s3_path(cls, s3_path: str) -> Tuple[str, str]:
        """
        Parses an S3 URI or bucket/path into (bucket, prefix_or_key).
        Accepts:
          - s3://my-bucket/path/to/data.csv -> ("my-bucket", "path/to/data.csv")
          - s3://my-bucket/folder/ -> ("my-bucket", "folder/")
          - s3://my-bucket -> ("my-bucket", "")
          - my-bucket/folder/data.parquet -> ("my-bucket", "folder/data.parquet")
          - my-bucket -> ("my-bucket", "")
        """
        if not s3_path:
            return "", ""
        val = str(s3_path).strip()
        if val.startswith("s3://"):
            val = val[5:]
        elif val.startswith("s3:/"):
            val = val[4:]
        val = val.lstrip("/")
        if "/" in val:
            bucket, key = val.split("/", 1)
            return bucket.strip(), key.strip()
        return val.strip(), ""

    def _get_client_and_params(self, config: Dict[str, Any]):
        aws_access_key = (
            config.get("aws_access_key_id")
            or config.get("access_key_id")
            or config.get("access_key")
            or ""
        ).strip()
        aws_secret_key = (
            config.get("aws_secret_access_key")
            or config.get("secret_access_key")
            or config.get("secret_key")
            or ""
        ).strip()
        region = (
            config.get("region_name")
            or config.get("region")
            or config.get("aws_region")
            or "us-east-1"
        ).strip()

        raw_path = config.get("s3_path") or config.get("path") or config.get("bucket", "")
        bucket, key_prefix = self.parse_s3_path(raw_path)

        # Build boto3 client kwargs
        client_kwargs: Dict[str, Any] = {"region_name": region}
        if aws_access_key and aws_secret_key:
            client_kwargs["aws_access_key_id"] = aws_access_key
            client_kwargs["aws_secret_access_key"] = aws_secret_key

        client = boto3.client("s3", **client_kwargs)
        return client, bucket, key_prefix, region

    def _serialize_value(self, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, (datetime, date, time)):
            return val.isoformat()
        if isinstance(val, Decimal):
            return float(val) if (val % 1 != 0) else int(val)
        if isinstance(val, (bytes, memoryview, bytearray)):
            return bytes(val).hex()
        if isinstance(val, uuid.UUID):
            return str(val)
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return val

    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Tests connectivity to Amazon S3 and verifies IAM permissions."""
        try:
            client, bucket, key_prefix, region = self._get_client_and_params(config)

            if not bucket:
                return {
                    "success": False,
                    "message": "S3 bucket name or path is required (e.g. 's3://my-bucket/data/').",
                }

            # If user provided a specific file path
            if key_prefix and any(key_prefix.lower().endswith(ext) for ext in SUPPORTED_EXTENSIONS):
                try:
                    head = client.head_object(Bucket=bucket, Key=key_prefix)
                    size_mb = round(head.get("ContentLength", 0) / (1024 * 1024), 2)
                    return {
                        "success": True,
                        "message": (
                            f"Successfully connected to Amazon S3. File 's3://{bucket}/{key_prefix}' "
                            f"is verified ({size_mb} MB) with valid IAM read permissions."
                        ),
                    }
                except ClientError as ce:
                    code = ce.response.get("Error", {}).get("Code", "")
                    if code not in ("404", "NoSuchKey"):
                        raise ce

            # Otherwise test bucket access & list objects under prefix
            res = client.list_objects_v2(Bucket=bucket, Prefix=key_prefix, MaxKeys=5)
            contents = res.get("Contents", [])
            object_count = len(contents)

            return {
                "success": True,
                "message": (
                    f"Successfully connected to Amazon S3 (Bucket: '{bucket}', Region: '{region}'). "
                    f"Verified IAM permissions with {object_count} sample object(s) accessible."
                ),
            }

        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "ClientError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            if code in ("AccessDenied", "403"):
                return {
                    "success": False,
                    "message": (
                        f"S3 Access Denied (403): Ensure your IAM user policy grants 's3:GetObject' "
                        f"and 's3:ListBucket' on 'arn:aws:s3:::{bucket}'. Details: {msg}"
                    ),
                }
            if code in ("NoSuchBucket", "404"):
                return {
                    "success": False,
                    "message": f"S3 Bucket '{bucket}' was not found. Please check bucket name and AWS region.",
                }
            if code in ("InvalidAccessKeyId", "SignatureDoesNotMatch"):
                return {
                    "success": False,
                    "message": f"Invalid AWS IAM credentials ({code}): Verify your AWS Access Key ID and Secret Access Key.",
                }
            return {"success": False, "message": f"S3 connection error ({code}): {msg}"}
        except Exception as e:
            return {"success": False, "message": f"S3 connection failed: {str(e)}"}

    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        """Lists accessible data files (CSV, Parquet, JSON, Excel) in the S3 bucket/prefix."""
        client, bucket, key_prefix, _ = self._get_client_and_params(config)
        if not bucket:
            return []

        # If s3_path directly pointed to a specific supported file
        if key_prefix and any(key_prefix.lower().endswith(ext) for ext in SUPPORTED_EXTENSIONS):
            return [key_prefix]

        tables: List[str] = []
        paginator = client.get_paginator("list_objects_v2")
        page_iterator = paginator.paginate(
            Bucket=bucket,
            Prefix=key_prefix,
            PaginationConfig={"MaxItems": 250, "PageSize": 100},
        )

        for page in page_iterator:
            for item in page.get("Contents", []):
                key = item.get("Key", "")
                if any(key.lower().endswith(ext) for ext in SUPPORTED_EXTENSIONS):
                    tables.append(key)

        return sorted(list(set(tables)))

    def _resolve_object_key(self, config_prefix: str, table_name: str) -> str:
        """Determines the exact S3 key from table_name and configured prefix."""
        clean_tbl = table_name.strip()
        if clean_tbl.startswith("s3://"):
            _, key = self.parse_s3_path(clean_tbl)
            return key
        return clean_tbl

    def _download_s3_object_to_temp(
        self, client, bucket: str, key: str, max_bytes: Optional[int] = None
    ) -> str:
        """Downloads an S3 object (or up to max_bytes) to a local temp file."""
        suffix = os.path.splitext(key)[1].lower() or ".tmp"
        temp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
        os.close(temp_fd)

        try:
            if max_bytes:
                range_header = f"bytes=0-{max_bytes - 1}"
                try:
                    resp = client.get_object(Bucket=bucket, Key=key, Range=range_header)
                    with open(temp_path, "wb") as f:
                        f.write(resp["Body"].read())
                    return temp_path
                except ClientError:
                    # Some sources or formats (like Parquet requiring footer) need full download
                    pass

            client.download_file(bucket, key, temp_path)
            return temp_path
        except Exception:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            raise

    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        """Infers columns and types from the S3 file using DuckDB."""
        client, bucket, key_prefix, _ = self._get_client_and_params(config)
        key = self._resolve_object_key(key_prefix, table_name)

        ext = os.path.splitext(key)[1].lower()
        temp_file = None

        try:
            # Download file
            temp_file = self._download_s3_object_to_temp(client, bucket, key)
            norm_path = os.path.abspath(temp_file).replace("\\", "/")

            conn = duckdb.connect(":memory:")
            if ext in (".parquet", ".pq"):
                desc_query = f"DESCRIBE SELECT * FROM read_parquet('{norm_path}') LIMIT 1"
            elif ext in (".csv", ".tsv"):
                desc_query = f"DESCRIBE SELECT * FROM read_csv_auto('{norm_path}', header=true, ignore_errors=true) LIMIT 1"
            elif ext in (".json", ".jsonl", ".ndjson"):
                desc_query = f"DESCRIBE SELECT * FROM read_json_auto('{norm_path}', ignore_errors=true) LIMIT 1"
            elif ext in (".xlsx", ".xls"):
                from app.ingestion.parser import DataParser
                df, _, _ = DataParser.parse_file(temp_file, ext.lstrip("."))
                return [
                    {"column_name": col, "data_type": df.duckdb_types.get(col, "VARCHAR")}
                    for col in df.columns
                ]
            else:
                desc_query = f"DESCRIBE SELECT * FROM read_csv_auto('{norm_path}', header=true, ignore_errors=true) LIMIT 1"

            rows = conn.execute(desc_query).fetchall()
            columns = []
            for r in rows:
                col_name = str(r[0])
                col_type = str(r[1]) if len(r) > 1 else "VARCHAR"
                columns.append({"column_name": col_name, "data_type": col_type})
            return columns

        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> List[Dict[str, Any]]:
        """Extracts records from the S3 file into serializable dictionaries."""
        client, bucket, key_prefix, _ = self._get_client_and_params(config)
        key = self._resolve_object_key(key_prefix, table_name)
        clean_limit = max(1, min(int(limit), 100000))

        ext = os.path.splitext(key)[1].lower()
        temp_file = None

        try:
            temp_file = self._download_s3_object_to_temp(client, bucket, key)
            norm_path = os.path.abspath(temp_file).replace("\\", "/")

            conn = duckdb.connect(":memory:")
            if ext in (".parquet", ".pq"):
                query = f"SELECT * FROM read_parquet('{norm_path}') LIMIT {clean_limit}"
            elif ext in (".csv", ".tsv"):
                query = f"SELECT * FROM read_csv_auto('{norm_path}', header=true, ignore_errors=true) LIMIT {clean_limit}"
            elif ext in (".json", ".jsonl", ".ndjson"):
                query = f"SELECT * FROM read_json_auto('{norm_path}', ignore_errors=true) LIMIT {clean_limit}"
            elif ext in (".xlsx", ".xls"):
                from app.ingestion.parser import DataParser
                df, _, _ = DataParser.parse_file(temp_file, ext.lstrip("."))
                raw_df_rows = df.conn.execute(f"SELECT * FROM {df.table_name} LIMIT {clean_limit}").fetchall()
                col_names = df.columns
                res = []
                for r in raw_df_rows:
                    res.append({c: self._serialize_value(v) for c, v in zip(col_names, r)})
                return res
            else:
                query = f"SELECT * FROM read_csv_auto('{norm_path}', header=true, ignore_errors=true) LIMIT {clean_limit}"

            rel = conn.execute(query)
            col_names = [desc[0] for desc in rel.description]
            raw_rows = rel.fetchall()

            rows: List[Dict[str, Any]] = []
            for r in raw_rows:
                row_dict = {}
                for col, val in zip(col_names, r):
                    row_dict[col] = self._serialize_value(val)
                rows.append(row_dict)
            return rows

        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass
