from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Workspace Schemas ---
class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    owner_id: str
    role: Optional[str] = "owner"
    external_id: Optional[str] = None
    cloud_storage_config: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Cloud Storage (BYOC / BYOS) Schemas ---
class CloudStorageConfigUpdate(BaseModel):
    provider: str = "PLATFORM_DEFAULT"  # PLATFORM_DEFAULT, AWS_S3, GCP_GCS, AZURE_BLOB
    # AWS fields
    bucket_name: Optional[str] = None
    region: Optional[str] = "us-east-1"
    role_arn: Optional[str] = None
    prefix: Optional[str] = "autoanalytix"
    kms_key_arn: Optional[str] = None
    # GCP fields
    gcp_project_id: Optional[str] = None
    gcp_bucket_name: Optional[str] = None
    gcp_credentials_json: Optional[str] = None
    gcp_location: Optional[str] = "us-central1"
    # Azure fields
    azure_account_name: Optional[str] = None
    azure_container_name: Optional[str] = None
    azure_sas_token: Optional[str] = None
    azure_sas_url: Optional[str] = None
    azure_connection_string: Optional[str] = None
    azure_tenant_id: Optional[str] = None
    azure_client_id: Optional[str] = None
    azure_client_secret: Optional[str] = None
    skip_verification: bool = False

class CloudStorageTestRequest(BaseModel):
    provider: str = "AWS_S3"  # AWS_S3, GCP_GCS, AZURE_BLOB
    # AWS fields
    bucket_name: Optional[str] = None
    region: Optional[str] = "us-east-1"
    role_arn: Optional[str] = None
    prefix: Optional[str] = "autoanalytix"
    kms_key_arn: Optional[str] = None
    # GCP fields
    gcp_project_id: Optional[str] = None
    gcp_bucket_name: Optional[str] = None
    gcp_credentials_json: Optional[str] = None
    gcp_location: Optional[str] = "us-central1"
    # Azure fields
    azure_account_name: Optional[str] = None
    azure_container_name: Optional[str] = None
    azure_sas_token: Optional[str] = None
    azure_sas_url: Optional[str] = None
    azure_connection_string: Optional[str] = None
    azure_tenant_id: Optional[str] = None
    azure_client_id: Optional[str] = None
    azure_client_secret: Optional[str] = None

class CloudStorageConfigResponse(BaseModel):
    mode: str
    provider: str
    external_id: str
    bucket_name: Optional[str] = None
    region: Optional[str] = None
    role_arn: Optional[str] = None
    prefix: Optional[str] = "autoanalytix"
    kms_key_arn: Optional[str] = None
    status: str
    verified: bool
    verified_at: Optional[str] = None
    last_error: Optional[str] = None
    platform_account_id: str
    backend_role_arn: str
    cloudformation_quick_link: Optional[str] = None
    # GCP fields
    gcp_project_id: Optional[str] = None
    gcp_bucket_name: Optional[str] = None
    gcp_location: Optional[str] = None
    has_gcp_credentials: bool = False
    # Azure fields
    azure_account_name: Optional[str] = None
    azure_container_name: Optional[str] = None
    azure_sas_token_masked: Optional[str] = None
    azure_connection_string_masked: Optional[str] = None
    azure_auth_type: Optional[str] = None


class CloudStorageProbeResult(BaseModel):
    healthy: bool
    verified: bool
    provider: str
    bucket: str
    region: str
    role_arn: Optional[str] = None
    prefix: Optional[str] = None
    steps: Dict[str, Any]
    latency_ms: float
    message: str
    error: Optional[str] = None

# --- AI Provider Config Schemas ---
class AIProviderConfigCreate(BaseModel):
    provider: str  # gemini, openai, anthropic
    model_name: str
    api_key: str
    is_default: bool = False
    custom_endpoint: Optional[str] = None

class AIProviderConfigUpdate(BaseModel):
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    is_default: Optional[bool] = None
    custom_endpoint: Optional[str] = None

class AIProviderConfigResponse(BaseModel):
    id: str
    workspace_id: str
    provider: str
    model_name: str
    masked_key: str
    is_default: bool
    connection_status: str
    last_tested_at: Optional[datetime] = None
    custom_endpoint: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AIProviderTestRequest(BaseModel):
    provider: str
    model_name: str
    api_key: Optional[str] = None  # If testing new key before saving
    custom_endpoint: Optional[str] = None

class AIProviderTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[float] = None
    model_version: Optional[str] = None

# --- Dataset Schemas ---
class ColumnStat(BaseModel):
    name: str
    original_name: str
    data_type: str  # numeric, categorical, datetime, boolean
    duckdb_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    sample_values: List[Any] = []
    stats: Dict[str, Any] = {}

class DatasetResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    original_filename: str
    file_type: str
    duckdb_table_name: str
    row_count: int
    column_count: int
    size_bytes: int
    sheet_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DatasetPreviewResponse(BaseModel):
    dataset_id: str
    name: str
    row_count: int
    column_count: int
    columns: List[ColumnStat]
    rows: List[Dict[str, Any]]

class DatasetProfileResponse(BaseModel):
    dataset_id: str
    name: str
    row_count: int
    column_count: int
    size_bytes: int
    duplicate_rows_count: int
    total_cells: int
    missing_cells_count: int
    missing_cells_percentage: float
    columns: List[ColumnStat]
    summary_insights: List[str] = []
    suggested_questions: List[str] = []

# --- Analytics & Chart Schemas ---
class MetricDef(BaseModel):
    column: str
    aggregation: str = "sum"  # sum, avg, count, min, max

class FilterDef(BaseModel):
    column: str
    operator: str = "="  # =, !=, >, <, >=, <=, in, like
    value: Any

class StructuredPlan(BaseModel):
    intent: str
    target_table: str
    metrics: List[MetricDef] = []
    dimensions: List[str] = []
    filters: List[FilterDef] = []
    sort_by: Optional[str] = None
    sort_descending: bool = True
    limit: Optional[int] = 50
    chart_type: str = "bar"  # kpi, bar, horizontal_bar, line, area, pie, donut, scatter, table
    explanation: Optional[str] = None

class ChartSpec(BaseModel):
    type: str  # kpi, bar, horizontal_bar, line, area, pie, donut, scatter, table
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: Optional[List[str]] = None
    value_format: Optional[str] = None  # currency, percentage, integer, float
    color_palette: Optional[List[str]] = None
    kpi_value: Optional[Union[str, float, int]] = None
    kpi_subtext: Optional[str] = None
    data: List[Dict[str, Any]] = []

class AnalyticsQueryRequest(BaseModel):
    workspace_id: str
    dataset_id: str
    question: str
    conversation_id: Optional[str] = None
    provider_config_id: Optional[str] = None

class AnalyticsResponse(BaseModel):
    analysis_id: str
    conversation_id: str
    question: str
    intent: Optional[str] = None
    generated_sql: Optional[str] = None
    query_status: str
    execution_time_ms: float
    row_count: int
    chart_spec: Optional[ChartSpec] = None
    insights: List[str] = []
    explanation: Optional[str] = None
    clarification_options: Optional[List[str]] = None
    error_details: Optional[str] = None

# --- Conversation & Message Schemas ---
class ConversationCreate(BaseModel):
    workspace_id: str
    dataset_id: str
    title: Optional[str] = "New Chat"

class ConversationUpdate(BaseModel):
    title: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    analysis: Optional[AnalyticsResponse] = None
    clarification_options: Optional[List[str]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationListItem(BaseModel):
    id: str
    workspace_id: str
    dataset_id: str
    dataset_name: Optional[str] = None
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: str
    workspace_id: str
    dataset_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    model_config = ConfigDict(from_attributes=True)

# --- Dashboard Schemas ---
class DashboardItemCreate(BaseModel):
    analysis_id: Optional[str] = None
    title: str
    widget_type: str = "chart"  # kpi, chart, table, text
    grid_pos: Dict[str, Any] = {"x": 0, "y": 0, "w": 6, "h": 4}
    chart_spec: Optional[ChartSpec] = None
    cached_data: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None

class DashboardItemResponse(BaseModel):
    id: str
    dashboard_id: str
    analysis_id: Optional[str] = None
    title: str
    widget_type: str
    grid_pos: Dict[str, Any]
    chart_spec: Optional[Dict[str, Any]] = None
    cached_data: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DashboardItemUpdate(BaseModel):
    id: Optional[str] = None
    analysis_id: Optional[str] = None
    title: Optional[str] = None
    widget_type: Optional[str] = None
    grid_pos: Optional[Dict[str, Any]] = None
    chart_spec: Optional[Dict[str, Any]] = None
    cached_data: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None

class DashboardCreate(BaseModel):
    workspace_id: str
    title: str
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None

class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    items: Optional[List[DashboardItemUpdate]] = None

class DashboardResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: Optional[str] = None
    is_public: bool
    share_token: Optional[str] = None
    share_expires_at: Optional[datetime] = None
    layout: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    items: List[DashboardItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AIDashboardGenerateRequest(BaseModel):
    workspace_id: str
    dataset_id: str
    prompt: str = "Generate an executive dashboard with high level KPI cards, trend over time, and category breakdowns."
    provider_config_id: Optional[str] = None

class PublicDashboardResponse(BaseModel):
    title: str
    description: Optional[str] = None
    items: List[DashboardItemResponse] = []
    created_at: datetime

# --- Data Source Schemas ---
class DataSourceCreate(BaseModel):
    workspace_id: str
    name: str
    source_type: str  # sqlite, postgresql, rest
    connection_config: Dict[str, Any]

class DataSourceResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    source_type: str
    connection_config: Dict[str, Any]
    status: str
    last_sync_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DataSourceTableIngestRequest(BaseModel):
    dataset_name: Optional[str] = None
    limit: Optional[int] = 10000

# --- Google Workspace Integration Schemas ---
class GoogleAuthUrlResponse(BaseModel):
    auth_url: str
    state: str

class GoogleAuthCallbackRequest(BaseModel):
    workspace_id: str
    code: str
    state: str
    redirect_uri: Optional[str] = None

class GoogleIntegrationStatusResponse(BaseModel):
    connected: bool
    account_email: Optional[str] = None
    status: Optional[str] = None
    scopes: List[str] = []
    last_synced_at: Optional[str] = None
    has_custom_credentials: bool = False

class GoogleDriveFileItem(BaseModel):
    id: str
    name: str
    mime_type: str
    modified_time: Optional[str] = None
    web_view_link: Optional[str] = None
    size: Optional[int] = None

class GoogleDocExportRequest(BaseModel):
    workspace_id: str
    title: str
    analysis_id: Optional[str] = None
    dashboard_id: Optional[str] = None
    executive_summary: Optional[str] = None
    markdown_content: Optional[str] = None
    include_tables: bool = True
    include_sql: bool = True

class GoogleDocExportResponse(BaseModel):
    document_id: str
    title: str
    document_url: str
    message: str

class GoogleDocContentResponse(BaseModel):
    document_id: str
    title: str
    content_markdown: str
    raw_character_count: int

class GoogleSheetImportRequest(BaseModel):
    workspace_id: str
    spreadsheet_id: str
    tab_name: Optional[str] = None
    dataset_name: Optional[str] = None
    limit_rows: int = 50000

class GoogleSheetImportResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    row_count: int
    column_count: int
    duckdb_table_name: str
    message: str

