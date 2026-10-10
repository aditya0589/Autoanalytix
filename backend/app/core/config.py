import os
import secrets
import base64
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

IS_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or os.environ.get("LAMBDA_TASK_ROOT"))

default_storage = "/tmp/storage" if IS_LAMBDA else "./storage"
default_db = "sqlite:////tmp/autoanalytix.db" if IS_LAMBDA else "sqlite:///./autoanalytix.db"

class Settings(BaseSettings):
    APP_ENV: str = "development"
    PROJECT_NAME: str = "Autoanalytix"
    API_V1_PREFIX: str = "/api"
    IS_LAMBDA: bool = IS_LAMBDA
    
    # Security
    APP_SECRET_KEY: str = Field(default="change-this-in-production-jwt-key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"
    
    # BYOK Credential Encryption (AES-GCM key - 32 bytes base64 encoded)
    CREDENTIAL_ENCRYPTION_KEY: str = Field(
        default_factory=lambda: base64.urlsafe_b64encode(b"autoanalytix-dev-placeholder-key").decode("utf-8")
    )
    
    # Database (Default to local SQLite database with zero external setup, or Postgres in Docker)
    DATABASE_URL: str = Field(default=default_db)
    
    # Storage
    STORAGE_DIR: str = Field(default=default_storage)
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    
    # DuckDB limits
    DUCKDB_MEMORY_LIMIT: str = "2GB"
    DUCKDB_QUERY_TIMEOUT_SECONDS: int = 30
    DUCKDB_MAX_RESULT_ROWS: int = 1000
    
    # CORS
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.environ.get(
                "CORS_ORIGINS",
                "*,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:4173,http://127.0.0.1:4173"
            ).split(",")
            if origin.strip()
        ]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure storage directory exists
try:
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_DIR, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_DIR, "duckdb"), exist_ok=True)
except Exception:
    pass
