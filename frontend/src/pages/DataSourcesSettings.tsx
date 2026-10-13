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
  MessageSquare
} from "lucide-react";

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
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
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
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
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
                    <div key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs uppercase shrink-0">
                          {s.source_type}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.name}</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono truncate">
                            Path: {s.connection_config?.database_path}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(s.id)}
                        className="self-end sm:self-auto p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors"
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

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    {testing ? "Testing..." : "Test Connection"}
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
