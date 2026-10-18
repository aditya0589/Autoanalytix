import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  Database,
  UploadCloud,
  Sparkles,
  FileSpreadsheet,
  Trash2,
  ArrowRight,
  Plus,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Layers,
  Search,
  GridIcon,
  List,
} from "lucide-react";

// Dataset card skeleton
const CardSkeleton: React.FC = () => (
  <div className="card p-5 space-y-4">
    <div className="flex items-start gap-3">
      <div className="skeleton w-9 h-9 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-40" />
        <div className="skeleton h-2.5 w-28" />
      </div>
    </div>
    <div className="skeleton h-px w-full" />
    <div className="grid grid-cols-2 gap-3">
      <div className="skeleton h-8 rounded-xl" />
      <div className="skeleton h-8 rounded-xl" />
    </div>
    <div className="skeleton h-px w-full" />
    <div className="flex justify-between">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-3 w-16" />
    </div>
  </div>
);

export const DatasetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const dropRef = useRef<HTMLLabelElement>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<{
    id: string; name: string; rowCount: number; columnCount: number; type: string; message?: string;
  } | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Google Sheet state
  const [sheetInput, setSheetInput] = useState("");
  const [sheetDatasetName, setSheetDatasetName] = useState("");
  const [importingSheet, setImportingSheet] = useState(false);
  const [isPublicAcknowledged, setIsPublicAcknowledged] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getDisplayFilename = (ds: any) => {
    if (ds.file_type === "google_sheet" || ds.original_filename?.startsWith("gsheet_")) {
      return `Google Sheet · ${ds.sheet_name || "Tab"}`;
    }
    return ds.original_filename || "Unknown file";
  };

  const loadDatasets = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const data = await api.datasets.list(currentWorkspace.id);
      setDatasets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDatasets(); }, [currentWorkspace]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !currentWorkspace) return;
    setUploading(true);
    setUploadProgress(0);
    // Simulate progress
    const tick = setInterval(() => setUploadProgress((p) => Math.min(p + 12, 85)), 250);
    try {
      const formData = new FormData();
      formData.append("workspace_id", currentWorkspace.id);
      if (datasetName) formData.append("name", datasetName);
      formData.append("file", selectedFile);
      const newDs = await api.datasets.upload(formData);
      clearInterval(tick);
      setUploadProgress(100);
      setTimeout(() => {
        setShowUploadModal(false);
        setSelectedFile(null);
        setDatasetName("");
        setUploadProgress(0);
        loadDatasets();
        setIngestSuccess({
          id: newDs.id,
          name: newDs.name,
          rowCount: newDs.row_count || 0,
          columnCount: newDs.column_count || 0,
          type: newDs.file_type?.toUpperCase() || "CSV",
          message: "Dataset uploaded and indexed into DuckDB analytical engine successfully.",
        });
      }, 400);
    } catch (err: any) {
      clearInterval(tick);
      setUploadProgress(0);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadDemo = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingDemo(true);
      const dataset = await api.datasets.loadDemo(currentWorkspace.id);
      await loadDatasets();
      setIngestSuccess({
        id: dataset.id,
        name: dataset.name,
        rowCount: dataset.row_count || 0,
        columnCount: dataset.column_count || 0,
        type: "Demo Dataset",
        message: "B2B Sales demo dataset indexed into DuckDB analytical engine.",
      });
    } catch (err: any) {
      alert("Failed to load demo: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput || !currentWorkspace) return;
    if (!isPublicAcknowledged) {
      alert("Please confirm the Google Sheet is publicly shared.");
      return;
    }
    setImportingSheet(true);
    try {
      const res = await api.googleWorkspace.importSheet({
        workspace_id: currentWorkspace.id,
        spreadsheet_id: sheetInput.trim(),
        dataset_name: sheetDatasetName || undefined,
      });
      setShowGoogleSheetModal(false);
      setSheetInput("");
      setSheetDatasetName("");
      setIsPublicAcknowledged(false);
      await loadDatasets();
      setIngestSuccess({
        id: res.dataset_id,
        name: res.dataset_name || "Google Sheet Dataset",
        rowCount: res.row_count || 0,
        columnCount: res.column_count || 0,
        type: "Google Sheet",
        message: res.message || "Spreadsheet ingested into DuckDB analytical engine successfully.",
      });
    } catch (err: any) {
      alert("Failed to import Google Sheet: " + err.message);
    } finally {
      setImportingSheet(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset? All DuckDB tables and analyses will be removed.")) return;
    try {
      await api.datasets.delete(id);
      await loadDatasets();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filtered = datasets.filter((d) =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.original_filename?.toLowerCase().includes(search.toLowerCase())
  );

  const fileTypeIcon = (ds: any) => {
    if (ds.file_type === "google_sheet") return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    if (ds.file_type === "xlsx" || ds.file_type === "xls") return <FileText className="w-4 h-4 text-blue-500" />;
    return <Database className="w-4 h-4 text-indigo-500" />;
  };

  const ModalOverlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">
        {children}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Datasets</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {loading ? "Loading…" : `${datasets.length} dataset${datasets.length !== 1 ? "s" : ""} indexed in DuckDB`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="btn-secondary text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              {loadingDemo ? "Loading…" : "Demo Dataset"}
            </button>
            <button
              onClick={() => setShowGoogleSheetModal(true)}
              className="btn-secondary text-xs gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              Import Sheet
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload CSV / Excel
            </button>
          </div>
        </div>

        {/* Search + view toggle */}
        {!loading && datasets.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search datasets…"
                className="input pl-9 text-sm py-2"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white dark:bg-white/[0.1] shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <GridIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-white/[0.1] shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : datasets.length === 0 ? (
          /* Empty state with drop zone */
          <label
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) { setSelectedFile(file); setShowUploadModal(true); }
            }}
            className={`block border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-200 dark:border-white/[0.08] hover:border-indigo-300 dark:hover:border-indigo-700/50 bg-white dark:bg-[#111118]"
            }`}
          >
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/50">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Drop a file here, or browse
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  Supports CSV, Excel (.xlsx, .xls) and Parquet files up to 100 MB
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleLoadDemo(); }}
                  className="btn-secondary text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Load Demo Data
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowUploadModal(true); }}
                  className="btn-primary text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload File
                </button>
              </div>
            </div>
          </label>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No datasets match "{search}"</p>
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Clear search
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {filtered.map((ds) => (
              <div key={ds.id} className="card-hover p-5 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                    ds.file_type === "google_sheet"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50"
                      : "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50"
                  }`}>
                    {fileTypeIcon(ds)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white truncate" title={ds.name}>
                      {ds.name}
                    </h4>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5" title={getDisplayFilename(ds)}>
                      {getDisplayFilename(ds)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                    title="Delete Dataset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center border border-slate-100 dark:border-white/[0.05]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rows</div>
                    <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {ds.row_count?.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center border border-slate-100 dark:border-white/[0.05]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Columns</div>
                    <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {ds.column_count}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.05]">
                  <Link
                    to={`/datasets/${ds.id}`}
                    className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    Inspect Schema
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    to={`/analytics/${ds.id}`}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/50"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Ask AI
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="card divide-y divide-slate-100 dark:divide-white/[0.05] overflow-hidden">
            {filtered.map((ds) => (
              <div key={ds.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                  ds.file_type === "google_sheet"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50"
                    : "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50"
                }`}>
                  {fileTypeIcon(ds)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{ds.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {ds.row_count?.toLocaleString()} rows · {ds.column_count} cols · {getDisplayFilename(ds)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/datasets/${ds.id}`} className="btn-ghost text-xs gap-1">
                    Schema <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link to={`/analytics/${ds.id}`} className="btn-primary text-xs gap-1.5 py-1.5 px-3">
                    <MessageSquare className="w-3 h-3" />
                    Ask AI
                  </Link>
                  <button onClick={() => handleDelete(ds.id)} className="btn-ghost p-1.5 text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Upload Modal ── */}
        {showUploadModal && (
          <ModalOverlay onClose={() => !uploading && setShowUploadModal(false)}>
            <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Upload Dataset</h3>
                    <p className="text-[11px] text-slate-400">CSV, Excel, or Parquet</p>
                  </div>
                </div>
                <button onClick={() => !uploading && setShowUploadModal(false)} className="btn-ghost p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                {/* Drop zone */}
                <label
                  className={`block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                    selectedFile
                      ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                      : "border-slate-200 dark:border-white/[0.08] hover:border-indigo-300 dark:hover:border-indigo-700/50"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) setSelectedFile(file);
                  }}
                >
                  <input
                    type="file"
                    required
                    accept=".csv,.xlsx,.xls,.parquet"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                        className="ml-2 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <UploadCloud className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Click to browse or drop your file
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">CSV · XLSX · Parquet · max 100 MB</p>
                    </div>
                  )}
                </label>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Dataset name <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g. Q3 Regional Sales"
                    className="input text-sm"
                  />
                </div>

                {/* Progress bar */}
                {uploading && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 text-center">
                      {uploadProgress < 50 ? "Parsing file…" : uploadProgress < 85 ? "Profiling schema…" : "Indexing in DuckDB…"}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => !uploading && setShowUploadModal(false)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={uploading || !selectedFile} className="btn-primary text-sm">
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : "Upload & Analyze"}
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}

        {/* ── Google Sheet Modal ── */}
        {showGoogleSheetModal && (
          <ModalOverlay onClose={() => !importingSheet && setShowGoogleSheetModal(false)}>
            <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Import Google Sheet</h3>
                    <p className="text-[11px] text-slate-400">Ingest live spreadsheet tabs</p>
                  </div>
                </div>
                <button onClick={() => !importingSheet && setShowGoogleSheetModal(false)} className="btn-ghost p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleGoogleSheetSubmit} className="space-y-4">
                {/* Warning */}
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-[12px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Public Link Required (No OAuth)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Set sharing to <strong>"Anyone with the link can view"</strong> before importing.
                    Do not import confidential data.
                  </p>
                </div>

                {/* Steps */}
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] rounded-xl p-3.5 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">How to share:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[10.5px]">
                    <li>Open spreadsheet in Google Sheets</li>
                    <li>Click <strong>Share</strong> → Change to <strong>"Anyone with the link"</strong></li>
                    <li>Copy link and paste below</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Google Sheet URL or ID
                  </label>
                  <input
                    type="text"
                    required
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="input text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Dataset name <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={sheetDatasetName}
                    onChange={(e) => setSheetDatasetName(e.target.value)}
                    placeholder="e.g. 2026 Enterprise Pipeline"
                    className="input text-sm"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-[12px] text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublicAcknowledged}
                    onChange={(e) => setIsPublicAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I confirm this sheet is shared as <strong>"Anyone with the link can view"</strong> and contains no confidential secrets.
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setShowGoogleSheetModal(false); setIsPublicAcknowledged(false); }} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importingSheet || !sheetInput.trim() || !isPublicAcknowledged}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {importingSheet ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</>
                    ) : "Import into DuckDB"}
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}

        {/* ── Success Modal ── */}
        {ingestSuccess && (
          <ModalOverlay onClose={() => setIngestSuccess(null)}>
            <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-7 shadow-2xl text-center space-y-5">
              {/* Icon */}
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center ring-8 ring-emerald-50 dark:ring-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Data Ingested!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{ingestSuccess.message}</p>
              </div>

              {/* Stats */}
              <div className="bg-slate-50 dark:bg-white/[0.04] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.05] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Dataset</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{ingestSuccess.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                  {[
                    { label: "Rows", value: ingestSuccess.rowCount?.toLocaleString() },
                    { label: "Columns", value: ingestSuccess.columnCount },
                    { label: "Engine", value: "DuckDB", green: true },
                  ].map((s) => (
                    <div key={s.label} className="bg-white dark:bg-white/[0.04] rounded-xl p-2.5 border border-slate-100 dark:border-white/[0.05] text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
                      <div className={`text-[13px] font-black mt-0.5 ${s.green ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => navigate(`/analytics/${ingestSuccess.id}`)}
                  className="btn-primary text-sm gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask AI
                </button>
                <button
                  onClick={() => navigate(`/datasets/${ingestSuccess.id}`)}
                  className="btn-secondary text-sm gap-2"
                >
                  Inspect Schema
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button onClick={() => setIngestSuccess(null)} className="text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Close
              </button>
            </div>
          </ModalOverlay>
        )}
      </div>
    </Layout>
  );
};
