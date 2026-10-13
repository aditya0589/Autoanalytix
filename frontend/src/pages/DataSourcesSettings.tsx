import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  Unlink
} from "lucide-react";

export const DataSourcesSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useAuthStore();
  const initialTab = searchParams.get("tab") === "google" ? "google" : "databases";
  const [activeTab, setActiveTab] = useState<"google" | "databases">(initialTab);

  // --- SQL Connectors state ---
  const [sources, setSources] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("sqlite");
  const [dbPath, setDbPath] = useState("./storage/demo.sqlite");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
    } catch (err: any) {
      alert("Import failed: " + err.message);
    } finally {
      setImportingSheetId(null);
    }
  };

  // --- SQL handlers ---
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.dataSources.test(sourceType, { database_path: dbPath });
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
      await api.dataSources.create({
        workspace_id: currentWorkspace.id,
        name: sourceName,
        source_type: sourceType,
        connection_config: { database_path: dbPath },
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-bold">
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
            {/* Connection Banner Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 via-emerald-500 to-amber-500 p-0.5 shrink-0 shadow-sm">
                    <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h2 className="text-base font-black text-slate-900 dark:text-white">Google Workspace Suite</h2>
                      {googleStatus?.connected ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {googleStatus?.connected
                        ? `Authorized as ${googleStatus.account_email}. Tokens encrypted with AES-256-GCM vault.`
                        : "Connect your Google account to export executive reports to Docs, import Sheets, and ground AI with Drive knowledge."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {googleStatus?.connected ? (
                    <>
                      <button
                        onClick={loadDriveFiles}
                        disabled={loadingFiles}
                        className="p-2.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        title="Refresh Drive Files"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingFiles ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={handleDisconnectGoogle}
                        className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 rounded-xl transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Disconnect</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connectingGoogle}
                      className="flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md rounded-xl transition-all"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>{connectingGoogle ? "Authorizing..." : "Connect Google Workspace"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Features overview pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <FileText className="w-4 h-4" />
                    <span>Google Docs Reporting</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Export AI executive summaries, DuckDB queries, and KPI tables into clean Google Docs with one click.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Google Sheets Ingestion</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Import live cloud spreadsheets straight into DuckDB datasets for instant multi-dimensional querying.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Autonomous AI Context</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    The LangGraph AI agent searches strategy documents and PRDs to ground metrics in real business logic.
                  </p>
                </div>
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
                        <div key={f.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                          <div className="flex items-center space-x-3.5">
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connected Sources</h3>
              {loadingSources ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading sources...</div>
              ) : sources.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Database className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No external SQL databases configured</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Use the form below to connect an external SQL database.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sources.map((s) => (
                    <div key={s.id} className="py-3.5 flex items-center justify-between">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs uppercase">
                          {s.source_type}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                            Path: {s.connection_config?.database_path}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Connector Form */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5 transition-colors">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add External Database Connector</h3>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Connector Name</label>
                    <input
                      type="text"
                      required
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="e.g. Production Read Replica"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Source Type</label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="sqlite" className="dark:bg-slate-900">SQLite Database / File</option>
                      <option value="postgresql" disabled className="dark:bg-slate-900">PostgreSQL (Phase 5)</option>
                      <option value="bigquery" disabled className="dark:bg-slate-900">Google BigQuery (Phase 5)</option>
                      <option value="snowflake" disabled className="dark:bg-slate-900">Snowflake (Phase 5)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Database File Path / URI</label>
                  <input
                    type="text"
                    required
                    value={dbPath}
                    onChange={(e) => setDbPath(e.target.value)}
                    placeholder="./storage/database.sqlite"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
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

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors"
                  >
                    Save Connector
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
