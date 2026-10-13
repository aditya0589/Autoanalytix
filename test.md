# Autoanalytix Integrations Blueprint

The complete architecture specification has been compiled in:
👉 **[INTEGRATIONS_ARCHITECTURE.md](file:///c:/Aditya/websites/Autoanalytix/INTEGRATIONS_ARCHITECTURE.md)**

### Highlights:
- **Hybrid Architecture (MCP + Direct REST)**:
  - **Direct REST API**: Powers user actions in the React UI (Google OAuth 2.0 flow, "Export to Google Doc", "Import Google Sheet" picker).
  - **MCP / LangGraph Agent Tools**: Exposes Google Docs (`google_docs_search`, `google_docs_read`, `google_docs_create_report`) to the AI agent to retrieve business context and draft reports dynamically.
- **Google Workspace Suite**:
  - Google Docs (Bi-directional: Context Ingestion + Rich Executive Report Export)
  - Google Sheets (Direct DuckDB data connector extending `BaseDataConnector`)
  - Google Drive (File explorer & search)
- **Cloud Warehouses**:
  - PostgreSQL connector
  - Google BigQuery connector
  - Snowflake connector
- **Security**:
  - AES-256-GCM token encryption at rest
  - Least-privilege OAuth scopes (`documents`, `spreadsheets.readonly`, `drive.file`)
  - Strict AST SQL safety validation via `sqlglot`
