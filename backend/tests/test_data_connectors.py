import os
import sys
import sqlite3
import tempfile
import uuid
from decimal import Decimal
from datetime import datetime, date

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.data_sources.sqlite_connector import SQLiteDataConnector
from app.data_sources.postgres_connector import PostgreSQLDataConnector
from app.data_sources.bigquery_connector import BigQueryDataConnector
from app.data_sources.snowflake_connector import SnowflakeDataConnector
from app.data_sources.databricks_connector import DatabricksDataConnector
from app.data_sources.google_sheets_connector import GoogleSheetsDataConnector
from app.data_sources.s3_connector import S3DataConnector
from app.api.data_sources import (
    _encrypt_connection_config,
    _decrypt_connection_config,
    _mask_connection_config,
    CONNECTORS
)

client = TestClient(app)


def test_sqlite_connector_lifecycle():
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        temp_db = f.name

    try:
        conn = sqlite3.connect(temp_db)
        cur = conn.cursor()
        cur.execute("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, balance REAL);")
        cur.execute("INSERT INTO customers (name, balance) VALUES ('Acme Corp', 1540.50), ('Globex', 820.00);")
        conn.commit()
        conn.close()

        connector = SQLiteDataConnector()
        config = {"database_path": temp_db}

        # 1. Test connection
        res = connector.test_connection(config)
        assert res["success"] is True

        # 2. List tables
        tables = connector.list_tables(config)
        assert "customers" in tables

        # 3. Get table schema
        schema = connector.get_table_schema(config, "customers")
        col_names = [c["column_name"] for c in schema]
        assert "id" in col_names
        assert "name" in col_names
        assert "balance" in col_names

        # 4. Extract data
        rows = connector.extract_data(config, "customers", limit=10)
        assert len(rows) == 2
        assert rows[0]["name"] == "Acme Corp"
        assert rows[0]["balance"] == 1540.50
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)


def test_postgres_connector_serialization_and_validation():
    connector = PostgreSQLDataConnector()

    # Serialization checks
    assert connector._serialize_value(Decimal("49.99")) == 49.99
    assert connector._serialize_value(Decimal("100")) == 100
    u = uuid.uuid4()
    assert connector._serialize_value(u) == str(u)
    now = datetime(2026, 10, 18, 12, 0, 0)
    assert connector._serialize_value(now) == "2026-10-18T12:00:00"

    # Connection params parsing
    parsed = connector._parse_config({
        "host": "db.acme.internal",
        "port": 5433,
        "database": "analytics_prod",
        "user": "analyst",
        "password": "secret_password",
        "sslmode": "require"
    })
    assert parsed["host"] == "db.acme.internal"
    assert parsed["port"] == 5433
    assert parsed["dbname"] == "analytics_prod"
    assert parsed["user"] == "analyst"
    assert parsed["password"] == "secret_password"
    assert parsed["sslmode"] == "require"

    # Unreachable host test should fail gracefully
    bad_res = connector.test_connection({
        "host": "127.0.0.1",
        "port": 59999,
        "database": "nonexistent_db",
        "user": "fake_user"
    })
    assert bad_res["success"] is False
    assert "failed" in bad_res["message"].lower()


def test_bigquery_connector_serialization_and_validation():
    connector = BigQueryDataConnector()

    assert connector._serialize_value(date(2026, 10, 18)) == "2026-10-18"
    assert connector._serialize_value({"kpi": "arr"}) == '{"kpi": "arr"}'

    # Missing project id should raise validation error gracefully
    res = connector.test_connection({"project_id": "", "dataset_id": "test_ds"})
    assert res["success"] is False
    assert "required" in res["message"].lower() or "failed" in res["message"].lower()


def test_snowflake_connector_serialization_and_validation():
    connector = SnowflakeDataConnector()

    assert connector._serialize_value(Decimal("123.456")) == 123.456

    # Test account normalization (dot to hyphen, URL stripping, domain stripping)
    assert SnowflakeDataConnector.clean_account("siayxsi.yv85842") == "siayxsi-yv85842"
    assert SnowflakeDataConnector.clean_account("SIAYXSI.YV85842") == "siayxsi-yv85842"
    assert SnowflakeDataConnector.clean_account("https://siayxsi-yv85842.snowflakecomputing.com") == "siayxsi-yv85842"
    assert SnowflakeDataConnector.clean_account("https://app.snowflake.com/siayxsi/yv85842") == "siayxsi-yv85842"
    assert SnowflakeDataConnector.clean_account("xy12345.us-east-1") == "xy12345.us-east-1"
    assert SnowflakeDataConnector.clean_account("xy12345.us-central1.gcp") == "xy12345.us-central1.gcp"

    # Missing account/user should raise graceful error
    res = connector.test_connection({"account": "", "user": "", "database": ""})
    assert res["success"] is False
    assert "required" in res["message"].lower() or "failed" in res["message"].lower()


def test_databricks_connector_serialization_and_validation():
    connector = DatabricksDataConnector()

    assert connector._serialize_value(Decimal("456.789")) == 456.789
    u = uuid.uuid4()
    assert connector._serialize_value(u) == str(u)

    # Test cleaning helpers
    assert DatabricksDataConnector.clean_hostname("https://adb-123456789.12.azuredatabricks.net/") == "adb-123456789.12.azuredatabricks.net"
    assert DatabricksDataConnector.clean_hostname("dbc-xxxx.cloud.databricks.com:443") == "dbc-xxxx.cloud.databricks.com"
    assert DatabricksDataConnector.clean_http_path("sql/1.0/warehouses/a1b2c3d4e5") == "/sql/1.0/warehouses/a1b2c3d4e5"
    assert DatabricksDataConnector.clean_http_path("https://adb-123.azuredatabricks.net/sql/1.0/warehouses/a1b2") == "/sql/1.0/warehouses/a1b2"

    # Missing parameters should fail gracefully
    res = connector.test_connection({})
    assert res["success"] is False
    assert "required" in res["message"].lower() or "failed" in res["message"].lower()


def test_google_sheets_connector_validation():
    connector = GoogleSheetsDataConnector()
    res = connector.test_connection({})
    assert res["success"] is False
    assert "required" in res["message"].lower()


def test_data_sources_encryption_and_masking():
    raw_cfg = {
        "host": "pg.example.com",
        "database": "sales_dw",
        "user": "reporter",
        "password": "SuperSecretPassword123!",
        "access_token": "dapi_secret_token_12345",
        "service_account_json": '{"project_id": "my-gcp-project"}'
    }

    # Encrypt
    encrypted = _encrypt_connection_config(raw_cfg)
    assert encrypted["password"].startswith("ENC:")
    assert encrypted["access_token"].startswith("ENC:")
    assert encrypted["service_account_json"].startswith("ENC:")
    assert encrypted["user"] == "reporter"

    # Decrypt
    decrypted = _decrypt_connection_config(encrypted)
    assert decrypted["password"] == "SuperSecretPassword123!"
    assert decrypted["access_token"] == "dapi_secret_token_12345"
    assert decrypted["service_account_json"] == '{"project_id": "my-gcp-project"}'

    # Mask
    masked = _mask_connection_config(raw_cfg)
    assert masked["password"] == "••••••••"
    assert masked["access_token"] == "••••••••"
    assert masked["service_account_json"] == "••••••••"
    assert masked["user"] == "reporter"
    assert masked["host"] == "pg.example.com"


def test_s3_connector_path_parsing():
    assert S3DataConnector.parse_s3_path("s3://my-bucket/path/to/data.csv") == ("my-bucket", "path/to/data.csv")
    assert S3DataConnector.parse_s3_path("s3://analytics-bucket/folder/") == ("analytics-bucket", "folder/")
    assert S3DataConnector.parse_s3_path("s3://warehouse-lake") == ("warehouse-lake", "")
    assert S3DataConnector.parse_s3_path("my-bucket/folder/data.parquet") == ("my-bucket", "folder/data.parquet")
    assert S3DataConnector.parse_s3_path("my-bucket") == ("my-bucket", "")
    assert S3DataConnector.parse_s3_path("") == ("", "")


def test_s3_connector_validation_and_serialization():
    connector = S3DataConnector()
    assert connector._serialize_value(Decimal("99.95")) == 99.95
    u = uuid.uuid4()
    assert connector._serialize_value(u) == str(u)

    # Empty config should fail gracefully
    res = connector.test_connection({})
    assert res["success"] is False
    assert "required" in res["message"].lower() or "bucket" in res["message"].lower()


def test_s3_credential_encryption_and_masking():
    s3_cfg = {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "s3_path": "s3://analytics-prod/warehouse/",
        "region_name": "us-east-1"
    }

    encrypted = _encrypt_connection_config(s3_cfg)
    assert encrypted["aws_secret_access_key"].startswith("ENC:")
    assert encrypted["aws_access_key_id"] == "AKIAIOSFODNN7EXAMPLE"

    decrypted = _decrypt_connection_config(encrypted)
    assert decrypted["aws_secret_access_key"] == "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

    masked = _mask_connection_config(s3_cfg)
    assert masked["aws_secret_access_key"] == "••••••••"
    assert masked["aws_access_key_id"] == "AKIAIOSFODNN7EXAMPLE"


def test_s3_connector_schema_and_extract():
    connector = S3DataConnector()
    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
        f.write("order_id,customer_name,amount\n101,Acme,450.75\n102,Beta,120.00\n")
        temp_csv = f.name

    try:
        from unittest.mock import MagicMock
        mock_client = MagicMock()
        config = {
            "aws_access_key_id": "AKIA...",
            "aws_secret_access_key": "secret...",
            "s3_path": "s3://my-test-bucket/sales/orders.csv",
            "region_name": "us-east-1"
        }

        import shutil

        def mock_download(*args, **kwargs):
            fd, copy_path = tempfile.mkstemp(suffix=".csv")
            os.close(fd)
            shutil.copyfile(temp_csv, copy_path)
            return copy_path

        # Mock client params and download to use our temp csv
        connector._get_client_and_params = MagicMock(return_value=(mock_client, "my-test-bucket", "sales/orders.csv", "us-east-1"))
        connector._download_s3_object_to_temp = MagicMock(side_effect=mock_download)

        # 1. Test listing when path is a single file
        tables = connector.list_tables(config)
        assert tables == ["sales/orders.csv"]

        # 2. Test schema inspection
        cols = connector.get_table_schema(config, "sales/orders.csv")
        col_names = [c["column_name"] for c in cols]
        assert "order_id" in col_names
        assert "customer_name" in col_names
        assert "amount" in col_names

        # 3. Test data extraction
        rows = connector.extract_data(config, "sales/orders.csv", limit=10)
        assert len(rows) == 2
        assert rows[0]["customer_name"] == "Acme"
        assert rows[0]["amount"] == 450.75
    finally:
        if os.path.exists(temp_csv):
            os.remove(temp_csv)


def test_registered_connectors():
    expected_types = {"sqlite", "postgresql", "bigquery", "snowflake", "databricks", "google_sheets", "s3"}
    assert expected_types.issubset(set(CONNECTORS.keys()))


