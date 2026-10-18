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
from app.data_sources.google_sheets_connector import GoogleSheetsDataConnector
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

    # Missing account/user should raise graceful error
    res = connector.test_connection({"account": "", "user": "", "database": ""})
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
        "service_account_json": '{"project_id": "my-gcp-project"}'
    }

    # Encrypt
    encrypted = _encrypt_connection_config(raw_cfg)
    assert encrypted["password"].startswith("ENC:")
    assert encrypted["service_account_json"].startswith("ENC:")
    assert encrypted["user"] == "reporter"

    # Decrypt
    decrypted = _decrypt_connection_config(encrypted)
    assert decrypted["password"] == "SuperSecretPassword123!"
    assert decrypted["service_account_json"] == '{"project_id": "my-gcp-project"}'

    # Mask
    masked = _mask_connection_config(raw_cfg)
    assert masked["password"] == "••••••••"
    assert masked["service_account_json"] == "••••••••"
    assert masked["user"] == "reporter"
    assert masked["host"] == "pg.example.com"


def test_registered_connectors():
    expected_types = {"sqlite", "postgresql", "bigquery", "snowflake", "google_sheets"}
    assert expected_types.issubset(set(CONNECTORS.keys()))
