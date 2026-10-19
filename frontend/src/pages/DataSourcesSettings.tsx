import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Link2,
  Unlink,
  AlertTriangle,
  MessageSquare,
  Server,
  Cloud,
  ChevronRight,
  ChevronDown,
  Table,
  Search,
  Lock,
} from "lucide-react";
import {
  PostgresLogo,
  BigQueryLogo,
  SnowflakeLogo,
  DatabricksLogo,
  SQLiteLogo,
  GoogleSheetsLogo,
  DatabaseSourceLogo,
} from "../components/icons/DatabaseLogos";

export const DataSourcesSettings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useAuthStore();
  const initialTab = searchParams.get("tab") === "google" ? "google" : "databases";
  const [activeTab, setActiveTab] = useState<"google" | "databases">(initialTab);

  // Ingestion success popup modal state
  const [ingestSuccess, setIngestSuccess] = useState<{
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
    type: string;
    message?: string;
  } | null>(null);

  // --- SQL & Warehouse Connectors state ---
  const [sources, setSources] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<"sqlite" | "postgresql" | "bigquery" | "snowflake" | "databricks">("postgresql");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SQLite fields
  const [dbPath, setDbPath] = useState("./storage/demo.sqlite");

  // PostgreSQL fields
  const [pgHost, setPgHost] = useState("localhost");
  const [pgPort, setPgPort] = useState("5432");
  const [pgDatabase, setPgDatabase] = useState("");
  const [pgUser, setPgUser] = useState("postgres");
  const [pgPassword, setPgPassword] = useState("");
  const [pgSchema, setPgSchema] = useState("public");
  const [pgSslMode, setPgSslMode] = useState("prefer");

  // BigQuery fields
  const [bqProjectId, setBqProjectId] = useState("");
  const [bqDatasetId, setBqDatasetId] = useState("");
  const [bqLocation, setBqLocation] = useState("US");
  const [bqServiceAccount, setBqServiceAccount] = useState("");

  // Snowflake fields
  const [sfAccount, setSfAccount] = useState("");
  const [sfWarehouse, setSfWarehouse] = useState("COMPUTE_WH");
  const [sfDatabase, setSfDatabase] = useState("");
  const [sfSchema, setSfSchema] = useState("PUBLIC");
  const [sfUser, setSfUser] = useState("");
  const [sfPassword, setSfPassword] = useState("");
  const [sfRole, setSfRole] = useState("");

  // Databricks fields
  const [dbxServerHostname, setDbxServerHostname] = useState("");
  const [dbxHttpPath, setDbxHttpPath] = useState("");
  const [dbxToken, setDbxToken] = useState("");
  const [dbxCatalog, setDbxCatalog] = useState("");
  const [dbxSchema, setDbxSchema] = useState("default");

  // Table browser modal & Ingestion state
  const [activeBrowseSource, setActiveBrowseSource] = useState<any>(null);
  const [browseTables, setBrowseTables] = useState<string[]>([]);
  const [tableFilter, setTableFilter] = useState("");
  const [loadingBrowseTables, setLoadingBrowseTables] = useState(false);
  const [tableSchemas, setTableSchemas] = useState<Record<string, any[]>>({});
  const [expandedTableSchema, setExpandedTableSchema] = useState<string | null>(null);
  const [loadingTableSchema, setLoadingTableSchema] = useState(false);
  const [ingestingTableName, setIngestingTableName] = useState<string | null>(null);
  const [ingestLimit, setIngestLimit] = useState(10000);

  // Card-level test status
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [sourceTestStatus, setSourceTestStatus] = useState<Record<string, { success: boolean; message: string }>>({});

  // --- Google Workspace state ---
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<any>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [importingSheetId, setImportingSheetId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // --- Direct Link / MCP state ---
  const [directLinkInput, setDirectLinkInput] = useState("");
  const [directLinkDatasetName, setDirectLinkDatasetName] = useState("");
  const [directLinkPublicAck, setDirectLinkPublicAck] = useState(false);
  const [importingDirectLink, setImportingDirectLink] = useState(false);

  const loadSources = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingSources(true);
      const list = await api.dataSources.list(currentWorkspace.id);
      setSources(list);
    } finally {
      setLoadingSources(false);
    }
  };

  const loadGoogleStatus = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingGoogle(true);
      const status = await api.googleWorkspace.getStatus(currentWorkspace.id);
      setGoogleStatus(status);
      if (status.connected) {
        loadDriveFiles();
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const loadDriveFiles = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingFiles(true);
      const files = await api.googleWorkspace.listDriveFiles(currentWorkspace.id);
      setDriveFiles(files);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadSources();
    loadGoogleStatus();
  }, [currentWorkspace]);

  const handleConnectGoogle = async () => {
    if (!currentWorkspace) return;
    try {
      setConnectingGoogle(true);
      const res = await api.googleWorkspace.getAuthUrl(currentWorkspace.id);
      if (res.auth_url) {
        window.location.href = res.auth_url;
      }
    } catch (err: any) {
      alert("Failed to initialize Google OAuth: " + err.message);
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!currentWorkspace) return;
    if (!confirm("Are you sure you want to disconnect Google Workspace? AI report exports and sheet sync will be unlinked.")) return;
    try {
      await api.googleWorkspace.disconnect(currentWorkspace.id);
      await loadGoogleStatus();
      setDriveFiles([]);
      setSelectedFileForPreview(null);
    } catch (err: any) {
      alert("Disconnect failed: " + err.message);
    }
  };

  const handlePreviewDoc = async (file: any) => {
    if (!currentWorkspace) return;
    setSelectedFileForPreview(file);
    try {
      const doc = await api.googleWorkspace.getDoc(currentWorkspace.id, file.id);
      setPreviewContent(doc);
    } catch (err: any) {
      setPreviewContent({ content_markdown: `Error reading document: ${err.message}` });
    }
  };

  const handleImportSheet = async (file: any) => {
    if (!currentWorkspace) return;
    try {
      setImportingSheetId(file.id);
      setImportMessage(null);
      const res = await api.googleWorkspace.importSheet({
        workspace_id: currentWorkspace.id,
        spreadsheet_id: file.id,
        dataset_name: file.name.replace(/\.[^/.]+$/, ""),
      });
      setImportMessage(res.message || "Spreadsheet ingested into DuckDB!");
      setIngestSuccess({
        id: res.dataset_id,
        name: res.dataset_name || file.name,
        rowCount: res.row_count || 0,
        columnCount: res.column_count || 0,
        type: "Google Sheet",
        message: res.message || "Spreadsheet ingested into DuckDB analytical engine successfully.",
      });
    } catch (err: any) {
      alert("Import failed: " + err.message);
    } finally {
      setImportingSheetId(null);
    }
  };

  const handleImportDirectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLinkInput.trim() || !currentWorkspace) return;
    if (!directLinkPublicAck) {
      alert("Please confirm that the Google Sheet or Drive resource is shared with 'Anyone with the link can view'.");
      return;
    }
    setImportingDirectLink(true);
    setImportMessage(null);
    try {
      const res = await api.googleWorkspace.importSheet({
        workspace_id: currentWorkspace.id,
        spreadsheet_id: directLinkInput.trim(),
        dataset_name: directLinkDatasetName.trim() || undefined,
      });
      setImportMessage(res.message || "Google resource ingested into DuckDB!");
      setDirectLinkInput("");
      setDirectLinkDatasetName("");
      setDirectLinkPublicAck(false);
      setIngestSuccess({
        id: res.dataset_id,
        name: res.dataset_name || "Google Sheet Dataset",
        rowCount: res.row_count || 0,
        columnCount: res.column_count || 0,
        type: "Google Sheet",
        message: res.message || "Google resource ingested into DuckDB analytical engine successfully.",
      });
    } catch (err: any) {
      alert("Import failed: " + err.message);
    } finally {
      setImportingDirectLink(false);
    }
  };

  // --- Warehouse & SQL Config Builder ---
  const normalizeSnowflakeAccount = (raw: string): string => {
    let val = (raw || "").trim();
    if (val.startsWith("http://") || val.startsWith("https://")) {
      try {
        const url = new URL(val);
        if (url.hostname.includes("app.snowflake.com")) {
          const parts = url.pathname.split("/").filter((p) => p && p !== "#");
          if (parts.length >= 2) return `${parts[0]}-${parts[1]}`.toLowerCase();
        }
        val = url.hostname;
      } catch {}
    }
    if (val.includes(":")) {
      val = val.split(":")[0];
    }
    val = val.replace(/\.snowflakecomputing\.com$/i, "");
    if (val.includes("/") && !val.includes(".")) {
      const parts = val.split("/").filter(Boolean);
      if (parts.length === 2) return `${parts[0]}-${parts[1]}`.toLowerCase();
    }
    if (val.includes(".")) {
      const parts = val.split(".");
      if (
        parts.length === 2 &&
        !/^(us|eu|ap|ca|sa|me|af)-/i.test(parts[1]) &&
        !/\.(aws|gcp|azure)$/i.test(parts[1])
      ) {
        val = `${parts[0]}-${parts[1]}`;
      }
    }
    return val.toLowerCase();
  };

  const buildCurrentConfig = () => {
    switch (sourceType) {
      case "postgresql":
        return {
          host: pgHost,
          port: parseInt(pgPort) || 5432,
          database: pgDatabase,
          user: pgUser,
          password: pgPassword,
          schema: pgSchema || "public",
          sslmode: pgSslMode,
        };
      case "bigquery":
        return {
          project_id: bqProjectId,
          dataset_id: bqDatasetId,
          location: bqLocation,
          service_account_json: bqServiceAccount.trim() || undefined,
        };
      case "snowflake":
        return {
          account: normalizeSnowflakeAccount(sfAccount),
          warehouse: sfWarehouse.trim(),
          database: sfDatabase.trim(),
          schema: sfSchema.trim() || "PUBLIC",
          user: sfUser.trim(),
          password: sfPassword,
          role: sfRole.trim() || undefined,
        };
      case "databricks":
        return {
          server_hostname: dbxServerHostname.trim(),
          http_path: dbxHttpPath.trim(),
          access_token: dbxToken.trim(),
          catalog: dbxCatalog.trim() || undefined,
          schema: dbxSchema.trim() || "default",
        };
      case "sqlite":
      default:
        return { database_path: dbPath };
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const cfg = buildCurrentConfig();
      const res = await api.dataSources.test(sourceType, cfg);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !sourceName) return;
    try {
      const cfg = buildCurrentConfig();
      await api.dataSources.create({
        workspace_id: currentWorkspace.id,
        name: sourceName,
        source_type: sourceType,
        connection_config: cfg,
      });
      setSourceName("");
      setTestResult(null);
      await loadSources();
    } catch (err: any) {
      alert("Failed to add connector: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this data source?")) return;
    try {
      await api.dataSources.delete(id);
      await loadSources();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  // Table Browser & Ingestion Handlers
  const handleOpenTableBrowser = async (source: any) => {
    setActiveBrowseSource(source);
    setBrowseTables([]);
    setTableSchemas({});
    setExpandedTableSchema(null);
    setTableFilter("");
    setLoadingBrowseTables(true);
    try {
      const res = await api.dataSources.listTables(source.id);
      setBrowseTables(res.tables || []);
    } catch (err: any) {
      alert(`Failed to list tables: ${err.message}`);
    } finally {
      setLoadingBrowseTables(false);
    }
  };

  const handleToggleTableSchema = async (tableName: string) => {
    if (!activeBrowseSource) return;
    if (expandedTableSchema === tableName) {
      setExpandedTableSchema(null);
      return;
    }
    setExpandedTableSchema(tableName);
    if (!tableSchemas[tableName]) {
      setLoadingTableSchema(true);
      try {
        const res = await api.dataSources.getTableSchema(activeBrowseSource.id, tableName);
        setTableSchemas((prev) => ({ ...prev, [tableName]: res.columns || [] }));
      } catch (err: any) {
        alert(`Failed to fetch schema for ${tableName}: ${err.message}`);
      } finally {
        setLoadingTableSchema(false);
      }
    }
  };

  const handleIngestTable = async (tableName: string) => {
    if (!activeBrowseSource) return;
    try {
      setIngestingTableName(tableName);
      const res = await api.dataSources.ingestTable(activeBrowseSource.id, tableName, {
        limit: ingestLimit,
        dataset_name: `${activeBrowseSource.name} - ${tableName}`,
      });
      setIngestSuccess({
        id: res.id,
        name: res.name || tableName,
        rowCount: res.row_count || 0,
        columnCount: res.column_count || 0,
        type: activeBrowseSource.source_type,
        message: `Extracted ${res.row_count?.toLocaleString()} rows from '${tableName}' and ingested into DuckDB analytical engine.`,
      });
      await loadSources();
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngestingTableName(null);
    }
  };

  const handleTestSavedSource = async (source: any) => {
    setTestingSourceId(source.id);
    try {
      const res = await api.dataSources.test(source.source_type, source.connection_config, source.id);
      setSourceTestStatus((prev) => ({ ...prev, [source.id]: res }));
    } catch (err: any) {
      setSourceTestStatus((prev) => ({ ...prev, [source.id]: { success: false, message: err.message } }));
    } finally {
      setTestingSourceId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Integrations & External Connectors
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect Google Workspace (Docs, Sheets, Drive) and external databases directly to your analytics workspace
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-bold overflow-x-auto whitespace-nowrap no-scrollbar">
          <button
            onClick={() => {
              setActiveTab("google");
              setSearchParams({ tab: "google" });
            }}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === "google"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Google Workspace (Docs, Sheets, Drive)</span>
            {googleStatus?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1 inline-block" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("databases");
              setSearchParams({ tab: "databases" });
            }}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === "databases"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>SQL Databases & Warehouses</span>
            {sources.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {sources.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Google Workspace */}
        {activeTab === "google" && (
          <div className="space-y-6">
            {/* MCP & Shared Link Connector (Active & Zero-Auth) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 via-emerald-500 to-amber-500 p-0.5 shrink-0 shadow-sm">
                    <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                      <GoogleSheetsLogo className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-black text-slate-900 dark:text-white">Google Workspace & MCP Connector</h2>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        MCP Ready (No OAuth Needed)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Connect Google Sheets, Docs, and Drive files directly using shared links. The LangGraph AI agent discovers and reads them via Model Context Protocol (MCP) tools.
                    </p>
                  </div>
                </div>
              </div>

              {/* Prominent Public Data Warning Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Important: Data Must Be Publicly Shared</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  To import spreadsheets and read documents without Google Cloud OAuth credentials, your file must have link sharing set to <strong>"Anyone with the link can view"</strong>.
                </p>
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-[10.5px] text-amber-800 dark:text-amber-300 font-medium">
                  ⚠️ <strong>Privacy Warning:</strong> Because anyone with the URL can view the data, <em>never</em> import confidential credentials, secret financial statements, or sensitive personal data using this public link method.
                </div>
              </div>

              {/* Direct Link Ingestion Form */}
              <form onSubmit={handleImportDirectLink} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <GoogleSheetsLogo className="w-4 h-4" />
                    <span>Import Shared Google Sheet into DuckDB</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Format: https://docs.google.com/spreadsheets/d/...</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Google Sheet URL or Document Link
                    </label>
                    <input
                      type="text"
                      required
                      value={directLinkInput}
                      onChange={(e) => setDirectLinkInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                      className="w-full text-xs px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Dataset Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={directLinkDatasetName}
                      onChange={(e) => setDirectLinkDatasetName(e.target.value)}
                      placeholder="e.g. Q4 Sales Forecast"
                      className="w-full text-xs px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Acknowledgment checkbox */}
                <label className="flex items-start space-x-2.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={directLinkPublicAck}
                    onChange={(e) => setDirectLinkPublicAck(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I confirm this link is shared with <strong>"Anyone with the link can view"</strong> and does not expose confidential secrets.
                  </span>
                </label>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={importingDirectLink || !directLinkInput.trim() || !directLinkPublicAck}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {importingDirectLink ? (
                      <span>Extracting & Ingesting...</span>
                    ) : (
                      <>
                        <span>Ingest into DuckDB</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* MCP AI Agent Tools Card */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Available MCP Tools for LangGraph AI Agent</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                      read_google_sheet_from_link
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Extracts columns and sample records from any shared spreadsheet link pasted into chat.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold">
                      read_google_doc_from_link
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Extracts document strategy, PRDs, and KPI definitions to ground AI reasoning.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-amber-600 dark:text-amber-400 font-mono text-[11px] font-bold">
                      read_google_drive_file_from_link
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Reads CSV, text, or data files from public Google Drive file sharing links.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  💡 In the <strong>Analytics Workspace</strong> chat, simply paste any shared Google Sheet or Doc link and ask questions — the agent will invoke these tools dynamically.
                </p>
              </div>

              {/* Optional OAuth Section (Secondary) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Need private organization-wide Drive browsing? Connect with OAuth:</span>
                </div>
                {googleStatus?.connected ? (
                  <button
                    onClick={handleDisconnectGoogle}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Disconnect OAuth
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={connectingGoogle}
                    className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {connectingGoogle ? "Authorizing..." : "Connect Google Account (Optional)"}
                  </button>
                )}
              </div>
            </div>

            {/* Ingestion notice */}
            {importMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{importMessage}</span>
                </div>
                <a
                  href="/datasets"
                  className="font-bold underline ml-2 text-emerald-700 dark:text-emerald-200 hover:opacity-80"
                >
                  View in Datasets Explorer &rarr;
                </a>
              </div>
            )}

            {/* Google Drive Files Browser */}
            {googleStatus?.connected && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accessible Drive Documents</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Recent Google Docs and Google Sheets available in your connected account
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {driveFiles.length} files found
                  </span>
                </div>

                {loadingFiles ? (
                  <div className="text-xs text-slate-400 dark:text-slate-500 py-10 text-center">
                    Fetching documents from Google Drive...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No documents found in Drive</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Ensure your Google account has accessible Google Docs or Spreadsheets.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {driveFiles.map((f) => {
                      const isSheet = f.mime_type?.includes("spreadsheet");
                      return (
                        <div key={f.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSheet
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40"
                            }`}>
                              {isSheet ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                                <span>{f.name}</span>
                                {f.web_view_link && (
                                  <a
                                    href={f.web_view_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {isSheet ? "Google Sheet" : "Google Doc"} • Modified: {f.modified_time ? new Date(f.modified_time).toLocaleDateString() : "Recently"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {isSheet ? (
                              <button
                                onClick={() => handleImportSheet(f)}
                                disabled={importingSheetId === f.id}
                                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center space-x-1"
                              >
                                {importingSheetId === f.id ? (
                                  <span>Importing...</span>
                                ) : (
                                  <>
                                    <span>Import as Dataset</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePreviewDoc(f)}
                                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                              >
                                Read Context
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Document Context Modal */}
            {selectedFileForPreview && (
              <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{selectedFileForPreview.name}</h4>
                      <p className="text-[11px] text-slate-400">Extracted Markdown for Agent Reasoning Context</p>
                    </div>
                    <button
                      onClick={() => setSelectedFileForPreview(null)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
                    >
                      Close
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-mono text-xs whitespace-pre-wrap text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                    {previewContent ? previewContent.content_markdown : "Loading document content..."}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Databases & Warehouses */}
        {activeTab === "databases" && (
          <div className="space-y-6">
            {/* Existing sources */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connected Warehouses & Databases</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Query, browse tables, and ingest datasets directly into DuckDB from your external databases
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {sources.length} {sources.length === 1 ? "source" : "sources"}
                </span>
              </div>

              {loadingSources ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading sources...</div>
              ) : sources.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Database className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No external databases configured</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Add PostgreSQL, Google BigQuery, Snowflake, or SQLite using the configuration panel below.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sources.map((s) => {
                    const st = (s.source_type || "").toLowerCase();
                    const isPg = st === "postgresql";
                    const isBq = st === "bigquery";
                    const isSf = st === "snowflake";
                    const isDbx = st === "databricks";
                    const isSqlite = st === "sqlite";

                    let iconBadge = <SQLiteLogo className="w-5 h-5" />;
                    let badgeColor = "bg-[#0f80cc]/10 border-[#0f80cc]/30 text-[#0f80cc]";
                    let displayHost = s.connection_config?.database_path || "Configured";

                    if (isPg) {
                      iconBadge = <PostgresLogo className="w-5 h-5" />;
                      badgeColor = "bg-[#336791]/10 border-[#336791]/30 text-[#336791]";
                      displayHost = `${s.connection_config?.host || "localhost"}:${s.connection_config?.port || 5432} / ${s.connection_config?.database || "db"}`;
                    } else if (isBq) {
                      iconBadge = <BigQueryLogo className="w-5 h-5" />;
                      badgeColor = "bg-[#4386fa]/10 border-[#4386fa]/30 text-[#4386fa]";
                      displayHost = `${s.connection_config?.project_id || "gcp"}.${s.connection_config?.dataset_id || "dataset"}`;
                    } else if (isSf) {
                      iconBadge = <SnowflakeLogo className="w-5 h-5" />;
                      badgeColor = "bg-[#29b5e8]/10 border-[#29b5e8]/30 text-[#29b5e8]";
                      displayHost = `${s.connection_config?.account || "account"} / ${s.connection_config?.database || "db"}`;
                    } else if (isDbx) {
                      iconBadge = <DatabricksLogo className="w-5 h-5" />;
                      badgeColor = "bg-[#FF3621]/10 border-[#FF3621]/30 text-[#FF3621]";
                      displayHost = `${s.connection_config?.server_hostname || "databricks"} / ${s.connection_config?.catalog || "default"}.${s.connection_config?.schema || "default"}`;
                    }

                    const testStatus = sourceTestStatus[s.id];

                    return (
                      <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${badgeColor}`}>
                            {iconBadge}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {s.source_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono truncate">
                              {displayHost}
                              {s.last_sync_at && (
                                <span className="ml-2 text-slate-400 font-sans">
                                  • Synced {new Date(s.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {testStatus && (
                              <div className={`text-[10.5px] mt-1 flex items-center space-x-1 ${
                                testStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}>
                                {testStatus.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                <span>{testStatus.message}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleTestSavedSource(s)}
                            disabled={testingSourceId === s.id}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {testingSourceId === s.id ? "Pinging..." : "Test"}
                          </button>

                          <button
                            onClick={() => handleOpenTableBrowser(s)}
                            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors flex items-center space-x-1"
                          >
                            <Table className="w-3.5 h-3.5" />
                            <span>Browse Tables</span>
                          </button>

                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                            title="Remove connector"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Connector Form */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 transition-colors">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Cloud Warehouse or Database</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Connect PostgreSQL, BigQuery, Snowflake, or local SQLite for automated schema inference and analytical ingestion.
                </p>
              </div>

              {/* Source Type Selector Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  {
                    type: "postgresql",
                    name: "PostgreSQL",
                    desc: "Relational DB & Supabase",
                    icon: <PostgresLogo className="w-5 h-5" />,
                    activeBorder: "border-[#336791] bg-sky-50/30 dark:bg-[#336791]/15 ring-1 ring-[#336791]/40",
                  },
                  {
                    type: "bigquery",
                    name: "Google BigQuery",
                    desc: "Serverless Cloud DW",
                    icon: <BigQueryLogo className="w-5 h-5" />,
                    activeBorder: "border-[#4386fa] bg-blue-50/30 dark:bg-[#4386fa]/15 ring-1 ring-[#4386fa]/40",
                  },
                  {
                    type: "snowflake",
                    name: "Snowflake",
                    desc: "Data Cloud Platform",
                    icon: <SnowflakeLogo className="w-5 h-5" />,
                    activeBorder: "border-[#29b5e8] bg-cyan-50/30 dark:bg-[#29b5e8]/15 ring-1 ring-[#29b5e8]/40",
                  },
                  {
                    type: "databricks",
                    name: "Databricks",
                    desc: "Lakehouse & Unity Catalog",
                    icon: <DatabricksLogo className="w-5 h-5" />,
                    activeBorder: "border-[#FF3621] bg-red-50/30 dark:bg-[#FF3621]/15 ring-1 ring-[#FF3621]/40",
                  },
                  {
                    type: "sqlite",
                    name: "SQLite File",
                    desc: "Local / Embedded SQL",
                    icon: <SQLiteLogo className="w-5 h-5" />,
                    activeBorder: "border-[#0f80cc] bg-sky-50/30 dark:bg-[#0f80cc]/15 ring-1 ring-[#0f80cc]/40",
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setSourceType(item.type as any);
                      setTestResult(null);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      sourceType === item.type
                        ? `${item.activeBorder} shadow-sm`
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Connector Name / Display Label
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Production Analytics Replica"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* --- PostgreSQL Form Fields --- */}
                {sourceType === "postgresql" && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Host / Server Endpoint
                        </label>
                        <input
                          type="text"
                          required
                          value={pgHost}
                          onChange={(e) => setPgHost(e.target.value)}
                          placeholder="localhost or db.xyz.supabase.co"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Port
                        </label>
                        <input
                          type="number"
                          required
                          value={pgPort}
                          onChange={(e) => setPgPort(e.target.value)}
                          placeholder="5432"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Database Name
                        </label>
                        <input
                          type="text"
                          required
                          value={pgDatabase}
                          onChange={(e) => setPgDatabase(e.target.value)}
                          placeholder="e.g. postgres or analytics_dw"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Schema (Default: public)
                        </label>
                        <input
                          type="text"
                          value={pgSchema}
                          onChange={(e) => setPgSchema(e.target.value)}
                          placeholder="public"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={pgUser}
                          onChange={(e) => setPgUser(e.target.value)}
                          placeholder="postgres"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={pgPassword}
                          onChange={(e) => setPgPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          SSL Mode
                        </label>
                        <select
                          value={pgSslMode}
                          onChange={(e) => setPgSslMode(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="prefer">prefer</option>
                          <option value="require">require</option>
                          <option value="disable">disable</option>
                          <option value="verify-ca">verify-ca</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Google BigQuery Form Fields --- */}
                {sourceType === "bigquery" && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          GCP Project ID
                        </label>
                        <input
                          type="text"
                          required
                          value={bqProjectId}
                          onChange={(e) => setBqProjectId(e.target.value)}
                          placeholder="e.g. acme-analytics-production"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Dataset ID
                        </label>
                        <input
                          type="text"
                          required
                          value={bqDatasetId}
                          onChange={(e) => setBqDatasetId(e.target.value)}
                          placeholder="e.g. sales_mart"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Service Account JSON Key (Optional if GCP Application Default Credentials are set)
                      </label>
                      <textarea
                        rows={3}
                        value={bqServiceAccount}
                        onChange={(e) => setBqServiceAccount(e.target.value)}
                        placeholder='{"type": "service_account", "project_id": "...", "private_key": "..."}'
                        className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <p className="text-[10.5px] text-slate-400 mt-1">
                        Key is securely encrypted with AES-256-GCM and never exposed. Leave empty if your backend runs with GCP service account identity.
                      </p>
                    </div>
                  </div>
                )}

                {/* --- Snowflake Form Fields --- */}
                {sourceType === "snowflake" && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Snowflake Account Identifier
                        </label>
                        <input
                          type="text"
                          required
                          value={sfAccount}
                          onChange={(e) => setSfAccount(e.target.value)}
                          onBlur={() => setSfAccount(normalizeSnowflakeAccount(sfAccount))}
                          placeholder="e.g. org-account (or xy12345.us-east-1)"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                        <p className="text-[10.5px] text-slate-400 mt-1">
                          Use <code className="text-blue-500 dark:text-blue-400 font-mono">org-account</code> with a hyphen (e.g. <span className="font-mono">siayxsi-yv85842</span>). Snowsight's copied dot format (<span className="font-mono">org.account</span>) is automatically converted to prevent SSL certificate errors.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Warehouse
                        </label>
                        <input
                          type="text"
                          value={sfWarehouse}
                          onChange={(e) => setSfWarehouse(e.target.value)}
                          placeholder="COMPUTE_WH"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Database Name
                        </label>
                        <input
                          type="text"
                          required
                          value={sfDatabase}
                          onChange={(e) => setSfDatabase(e.target.value)}
                          placeholder="e.g. ANALYTICS_DB"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Schema (Default: PUBLIC)
                        </label>
                        <input
                          type="text"
                          value={sfSchema}
                          onChange={(e) => setSfSchema(e.target.value)}
                          placeholder="PUBLIC"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={sfUser}
                          onChange={(e) => setSfUser(e.target.value)}
                          placeholder="analyst_user"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          value={sfPassword}
                          onChange={(e) => setSfPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Role (Optional)
                        </label>
                        <input
                          type="text"
                          value={sfRole}
                          onChange={(e) => setSfRole(e.target.value)}
                          placeholder="e.g. ACCOUNTADMIN"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- Databricks Form Fields --- */}
                {sourceType === "databricks" && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Server Hostname
                        </label>
                        <input
                          type="text"
                          required
                          value={dbxServerHostname}
                          onChange={(e) => setDbxServerHostname(e.target.value)}
                          placeholder="e.g. adb-123456789.12.azuredatabricks.net or dbc-xxx.cloud.databricks.com"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          HTTP Path
                        </label>
                        <input
                          type="text"
                          required
                          value={dbxHttpPath}
                          onChange={(e) => setDbxHttpPath(e.target.value)}
                          placeholder="/sql/1.0/warehouses/a1b2c3d4e5f6g7h8"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Personal Access Token (PAT)
                      </label>
                      <input
                        type="password"
                        required
                        value={dbxToken}
                        onChange={(e) => setDbxToken(e.target.value)}
                        placeholder="dapi••••••••••••••••••••••••"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <p className="text-[10.5px] text-slate-400 mt-1">
                        Generated in Databricks Workspace &gt; User Settings &gt; Developer &gt; Access Tokens. Encrypted with AES-256-GCM.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Catalog (Unity Catalog / Optional)
                        </label>
                        <input
                          type="text"
                          value={dbxCatalog}
                          onChange={(e) => setDbxCatalog(e.target.value)}
                          placeholder="e.g. main or samples"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Schema / Database (Default: default)
                        </label>
                        <input
                          type="text"
                          value={dbxSchema}
                          onChange={(e) => setDbxSchema(e.target.value)}
                          placeholder="default"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- SQLite Form Fields --- */}
                {sourceType === "sqlite" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Database File Path / URI
                    </label>
                    <input
                      type="text"
                      required
                      value={dbPath}
                      onChange={(e) => setDbPath(e.target.value)}
                      placeholder="./storage/demo.sqlite"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                )}

                {/* Security reassurance banner */}
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>All database passwords and private keys are encrypted with authenticated <strong>AES-256-GCM</strong> before storage.</span>
                </div>

                {testResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-center space-x-2.5 ${
                      testResult.success
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {testing ? "Testing Connection..." : "Test Connection"}
                  </button>

                  <button
                    type="submit"
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors"
                  >
                    Save Connector
                  </button>
                </div>
              </form>
            </div>

            {/* Interactive Table Browser & Ingestion Modal */}
            {activeBrowseSource && (
              <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <DatabaseSourceLogo type={activeBrowseSource.source_type} className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{activeBrowseSource.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-500">
                            {activeBrowseSource.source_type}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Browse available tables, inspect schema columns, and ingest directly into DuckDB
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveBrowseSource(null)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium"
                    >
                      Close
                    </button>
                  </div>

                  {/* Search and Limit bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={tableFilter}
                        onChange={(e) => setTableFilter(e.target.value)}
                        placeholder="Search tables..."
                        className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs text-slate-500">
                      <span>Row limit:</span>
                      <select
                        value={ingestLimit}
                        onChange={(e) => setIngestLimit(Number(e.target.value))}
                        className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value={1000}>1,000 rows</option>
                        <option value={5000}>5,000 rows</option>
                        <option value={10000}>10,000 rows</option>
                        <option value={50000}>50,000 rows</option>
                      </select>
                    </div>
                  </div>

                  {/* Table listing */}
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 pr-1">
                    {loadingBrowseTables ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Querying remote warehouse information schema...
                      </div>
                    ) : browseTables.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No tables discovered in this database or schema.
                      </div>
                    ) : (
                      browseTables
                        .filter((t) => !tableFilter || t.toLowerCase().includes(tableFilter.toLowerCase()))
                        .map((tbl) => {
                          const isExpanded = expandedTableSchema === tbl;
                          const isIngesting = ingestingTableName === tbl;
                          const cols = tableSchemas[tbl];

                          return (
                            <div key={tbl} className="py-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div
                                  onClick={() => handleToggleTableSchema(tbl)}
                                  className="flex items-center space-x-2.5 cursor-pointer group select-none"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                                  )}
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-mono">
                                    {tbl}
                                  </span>
                                  {cols && (
                                    <span className="text-[10px] text-slate-400">
                                      ({cols.length} columns)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleToggleTableSchema(tbl)}
                                    className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    {isExpanded ? "Hide Schema" : "Inspect Schema"}
                                  </button>

                                  <button
                                    onClick={() => handleIngestTable(tbl)}
                                    disabled={isIngesting}
                                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                                  >
                                    {isIngesting ? (
                                      <span>Ingesting...</span>
                                    ) : (
                                      <>
                                        <span>Ingest into DuckDB</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Schema preview dropdown */}
                              {isExpanded && (
                                <div className="ml-6 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                  {loadingTableSchema && !cols ? (
                                    <div className="py-2 text-slate-400 text-[11px]">Inspecting columns...</div>
                                  ) : !cols || cols.length === 0 ? (
                                    <div className="py-2 text-slate-400 text-[11px]">No columns discovered.</div>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      {cols.map((c: any, idx: number) => (
                                        <div
                                          key={idx}
                                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                                        >
                                          <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate" title={c.column_name}>
                                            {c.column_name}
                                          </span>
                                          <span className="text-[9.5px] uppercase font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                                            {c.data_type}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ingestion Success Modal Popup */}
        {ingestSuccess && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-5 text-center transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data Ingested Successfully!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {ingestSuccess.message}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dataset</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={ingestSuccess.name}>
                    {ingestSuccess.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Rows</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">{ingestSuccess.rowCount?.toLocaleString() ?? 0}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Columns</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">{ingestSuccess.columnCount ?? 0}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Engine</div>
                    <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">DuckDB</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  onClick={() => navigate(`/analytics/${ingestSuccess.id}`)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask AI Analytics</span>
                </button>
                <button
                  onClick={() => navigate(`/datasets/${ingestSuccess.id}`)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
                >
                  <span>Inspect Schema</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <button
                  onClick={() => setIngestSuccess(null)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Close & Stay on Integrations
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
