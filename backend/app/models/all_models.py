import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text, ForeignKey, JSON, DateTime, Index
)
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel, generate_uuid
from app.core.database import Base

class User(TimeStampedModel):
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    workspaces_owned = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    ai_configs = relationship("AIProviderConfig", back_populates="user", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="user")
    dashboards = relationship("Dashboard", back_populates="user")

class Workspace(TimeStampedModel):
    __tablename__ = "workspaces"
    
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="workspaces_owned")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="workspace", cascade="all, delete-orphan")
    dashboards = relationship("Dashboard", back_populates="workspace", cascade="all, delete-orphan")
    ai_configs = relationship("AIProviderConfig", back_populates="workspace", cascade="all, delete-orphan")
    data_sources = relationship("DataSource", back_populates="workspace", cascade="all, delete-orphan")
    integrations = relationship("WorkspaceIntegration", back_populates="workspace", cascade="all, delete-orphan")

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="editor", nullable=False)  # owner, admin, editor, viewer
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="memberships")
    
    __table_args__ = (
        Index("ix_workspace_user_unique", "workspace_id", "user_id", unique=True),
    )

class AIProviderConfig(TimeStampedModel):
    __tablename__ = "ai_provider_configs"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # gemini, openai, anthropic
    model_name = Column(String(100), nullable=False)
    encrypted_api_key = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    connection_status = Column(String(50), default="untested", nullable=False)  # connected, failed, untested
    last_tested_at = Column(DateTime, nullable=True)
    custom_endpoint = Column(String(255), nullable=True)
    
    workspace = relationship("Workspace", back_populates="ai_configs")
    user = relationship("User", back_populates="ai_configs")

class Dataset(TimeStampedModel):
    __tablename__ = "datasets"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # csv, xlsx, xls, demo
    file_path = Column(String(500), nullable=False)
    duckdb_table_name = Column(String(100), nullable=False, index=True)
    row_count = Column(Integer, default=0, nullable=False)
    column_count = Column(Integer, default=0, nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    sheet_name = Column(String(100), nullable=True)
    status = Column(String(50), default="ready", nullable=False)  # processing, ready, failed
    error_message = Column(Text, nullable=True)
    profile_summary = Column(JSON, nullable=True)
    
    workspace = relationship("Workspace", back_populates="datasets")
    user = relationship("User", back_populates="datasets")
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="dataset", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="dataset", cascade="all, delete-orphan")

class DatasetColumn(Base):
    __tablename__ = "dataset_columns"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False)  # numeric, categorical, datetime, boolean
    duckdb_type = Column(String(50), nullable=False)
    null_count = Column(Integer, default=0, nullable=False)
    unique_count = Column(Integer, default=0, nullable=False)
    sample_values = Column(JSON, nullable=True)
    stats = Column(JSON, nullable=True)  # min, max, mean, median, std, percentiles
    
    dataset = relationship("Dataset", back_populates="columns")

class Conversation(TimeStampedModel):
    __tablename__ = "conversations"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), default="New Analysis", nullable=False)
    
    dataset = relationship("Dataset", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
    analyses = relationship("Analysis", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    clarification_options = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    conversation = relationship("Conversation", back_populates="messages")
    analysis = relationship("Analysis", foreign_keys=[analysis_id])

class Analysis(TimeStampedModel):
    __tablename__ = "analyses"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    question = Column(Text, nullable=False)
    intent = Column(String(100), nullable=True)
    structured_plan = Column(JSON, nullable=True)
    generated_sql = Column(Text, nullable=True)
    query_status = Column(String(50), default="success", nullable=False)  # success, error, clarification
    execution_time_ms = Column(Float, default=0.0, nullable=False)
    row_count = Column(Integer, default=0, nullable=False)
    result_data = Column(JSON, nullable=True)  # rows, columns
    chart_spec = Column(JSON, nullable=True)
    insights = Column(JSON, nullable=True)  # list of bullet points / findings
    error_details = Column(Text, nullable=True)
    
    dataset = relationship("Dataset", back_populates="analyses")
    conversation = relationship("Conversation", back_populates="analyses")

class Dashboard(TimeStampedModel):
    __tablename__ = "dashboards"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    share_token = Column(String(64), unique=True, index=True, nullable=True)
    share_expires_at = Column(DateTime, nullable=True)
    layout = Column(JSON, nullable=True)  # Grid widget layout configs
    filters = Column(JSON, nullable=True)  # Active global filters
    
    workspace = relationship("Workspace", back_populates="dashboards")
    user = relationship("User", back_populates="dashboards")
    items = relationship("DashboardItem", back_populates="dashboard", cascade="all, delete-orphan", order_by="DashboardItem.created_at")

class DashboardItem(Base):
    __tablename__ = "dashboard_items"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    widget_type = Column(String(50), nullable=False)  # kpi, chart, table, text
    grid_pos = Column(JSON, nullable=False)  # { "x": 0, "y": 0, "w": 6, "h": 4 }
    chart_spec = Column(JSON, nullable=True)
    cached_data = Column(JSON, nullable=True)
    config = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    dashboard = relationship("Dashboard", back_populates="items")
    analysis = relationship("Analysis")

class DataSource(TimeStampedModel):
    __tablename__ = "data_sources"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # sqlite, postgresql, rest
    connection_config = Column(JSON, nullable=False)
    status = Column(String(50), default="active", nullable=False)
    last_sync_at = Column(DateTime, nullable=True)
    
    workspace = relationship("Workspace", back_populates="data_sources")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), nullable=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class WorkspaceIntegration(TimeStampedModel):
    __tablename__ = "workspace_integrations"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # google_workspace
    account_email = Column(String(255), nullable=True)
    encrypted_credentials = Column(Text, nullable=False)
    status = Column(String(50), default="connected", nullable=False)  # connected, expired, revoked
    metadata_info = Column(JSON, nullable=True)  # Scopes, user profile, etc.
    last_synced_at = Column(DateTime, nullable=True)
    
    workspace = relationship("Workspace", back_populates="integrations")

