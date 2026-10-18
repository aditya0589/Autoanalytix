import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.security import encrypt_credential, decrypt_credential, mask_api_key
from app.analytics.sql_validator import SQLValidator, SQLSecurityValidationError
from app.analytics.engine import analytics_engine
from app.ingestion.demo_data import generate_demo_dataset
from app.ingestion.parser import DataParser
from app.analytics.profiler import DatasetProfiler

client = TestClient(app)

def test_healthcheck():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_credential_encryption():
    raw_key = "AIzaSyDummyGoogleGeminiKey1234567890"
    encrypted = encrypt_credential(raw_key)
    assert encrypted != raw_key
    assert len(encrypted) > 20
    
    decrypted = decrypt_credential(encrypted)
    assert decrypted == raw_key
    
    masked = mask_api_key(raw_key)
    assert masked.startswith("AIzaSy")
    assert masked.endswith("7890")
    assert "••••••••" in masked

def test_sql_validator_security():
    table = "dataset_sales_101"

    # 1. Valid Read-Only Queries
    valid_q1 = f"SELECT count(*), sum(revenue) FROM {table} WHERE region = 'North America'"
    sanitized = SQLValidator.validate_and_sanitize(valid_q1, table)
    assert "count" in sanitized.lower()

    valid_q2 = f"WITH monthly AS (SELECT substr(cast(order_date as varchar), 1, 7) as m, sum(profit) as p FROM {table} GROUP BY 1) SELECT * FROM monthly"
    sanitized2 = SQLValidator.validate_and_sanitize(valid_q2, table)
    assert "monthly" in sanitized2

    # 2. Block queries accessing unauthorized tables
    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize("SELECT * FROM users", table)

    # 3. Block destructive commands
    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize(f"DROP TABLE {table}", table)

    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize(f"INSERT INTO {table} VALUES (1, 2)", table)

    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize(f"UPDATE {table} SET revenue = 0", table)

    # 4. Block multiple statements
    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize(f"SELECT * FROM {table}; SELECT * FROM users", table)

    # 5. Block dangerous functions (file reads, shell execution)
    with pytest.raises(SQLSecurityValidationError):
        SQLValidator.validate_and_sanitize(f"SELECT * FROM read_csv('secret.csv')", table)

def test_demo_dataset_and_profiler():
    csv_path = generate_demo_dataset()
    assert os.path.exists(csv_path)

    df, type_map, orig_cols = DataParser.parse_file(csv_path, "csv")
    assert df.height >= 1000
    assert "revenue" in df.columns
    assert "profit" in df.columns

    profile = DatasetProfiler.profile_dataframe(df, type_map, orig_cols)
    assert profile["row_count"] >= 1000
    assert len(profile["columns"]) >= 10
    assert len(profile["suggested_questions"]) > 0

    # Test DuckDB execution on registered table
    test_table = "test_sales_duckdb"
    parquet_path = csv_path.replace(".csv", ".parquet")
    df.write_parquet(parquet_path)
    analytics_engine.register_dataset(test_table, parquet_path, "parquet")

    res = analytics_engine.execute_query(f"SELECT region, sum(revenue) as tot_rev FROM {test_table} GROUP BY 1", test_table)
    assert res["row_count"] > 0
    assert "region" in res["columns"]
    assert "tot_rev" in res["columns"]

def test_user_registration_and_workspace():
    test_email = "analyst_test@autoanalytix.com"
    res = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "Password123!",
        "full_name": "Senior Data Analyst"
    })
    # If already created, login instead
    if res.status_code == 400:
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "Password123!"
        })
    assert res.status_code == 200
    token = res.json()["access_token"]
    assert token

    # Check /me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["user"]["email"] == test_email
    assert len(data["workspaces"]) >= 1
    ws_id = data["workspaces"][0]["id"]

    # Check AI configurations list
    ai_res = client.get(f"/api/ai/configurations?workspace_id={ws_id}", headers={"Authorization": f"Bearer {token}"})
    assert ai_res.status_code == 200

    # Save a test Gemini configuration
    save_res = client.post(
        f"/api/ai/configurations?workspace_id={ws_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "provider": "gemini",
            "model_name": "gemini-2.5-flash",
            "api_key": "AIzaSyFakeKeyForTestVerification999",
            "is_default": True
        }
    )
    assert save_res.status_code == 200
    config_data = save_res.json()
    assert "AIzaSy" in config_data["masked_key"]
    assert "FakeKey" not in config_data["masked_key"]  # Verify key is never echoed back!
    cfg_id = config_data["id"]

    # Delete test config
    del_res = client.delete(f"/api/ai/configurations/{cfg_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 200

def test_groq_and_openrouter_provider_registration():
    from app.ai.providers.factory import list_supported_providers, get_provider_adapter

    providers = list_supported_providers()
    provider_ids = [p["id"] for p in providers]
    assert "groq" in provider_ids
    assert "openrouter" in provider_ids
    assert "gemini" in provider_ids
    assert "openai" in provider_ids
    assert "anthropic" in provider_ids

    groq_adapter = get_provider_adapter("groq")
    assert groq_adapter.display_name == "Groq"
    assert "openai/gpt-oss-120b" in groq_adapter.recommended_models

    openrouter_adapter = get_provider_adapter("openrouter")
    assert openrouter_adapter.display_name == "OpenRouter"
    assert "anthropic/claude-3.5-sonnet" in openrouter_adapter.recommended_models

