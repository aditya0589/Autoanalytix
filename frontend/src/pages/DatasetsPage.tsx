import React, { useEffect, useState } from "react";
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
  MessageSquare
} from "lucide-react";

export const DatasetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Google Sheet import modal state
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
  const [sheetInput, setSheetInput] = useState("");
  const [sheetDatasetName, setSheetDatasetName] = useState("");
  const [importingSheet, setImportingSheet] = useState(false);

  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput || !currentWorkspace) return;
    setImportingSheet(true);
    try {
      // Extract spreadsheet ID from URL if full URL is pasted
      // Format: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit...
      let spreadsheetId = sheetInput.trim();
      const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        spreadsheetId = match[1];
      }

      const res = await api.googleWorkspace.importSheet({
        workspace_id: currentWorkspace.id,
        spreadsheet_id: spreadsheetId,
        dataset_name: sheetDatasetName || undefined,
      });

      setShowGoogleSheetModal(false);
      setSheetInput("");
      setSheetDatasetName("");
      if (res.dataset_id) {
        navigate(`/datasets/${res.dataset_id}`);
      } else {
        await loadDatasets();
      }
    } catch (err: any) {
      alert("Failed to import Google Sheet: " + err.message);
    } finally {
      setImportingSheet(false);
    }
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

  useEffect(() => {
    loadDatasets();
  }, [currentWorkspace]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !currentWorkspace) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("workspace_id", currentWorkspace.id);
      if (datasetName) formData.append("name", datasetName);
      formData.append("file", selectedFile);

      const newDs = await api.datasets.upload(formData);
      setShowUploadModal(false);
      setSelectedFile(null);
      setDatasetName("");
      navigate(`/datasets/${newDs.id}`);
    } catch (err: any) {
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
      navigate(`/datasets/${dataset.id}`);
    } catch (err: any) {
      alert("Failed to load demo dataset: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dataset? All DuckDB tables and analyses will be removed.")) return;
    try {
      await api.datasets.delete(id);
      await loadDatasets();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Datasets Explorer</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage and explore uploaded CSV and Excel data files</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{loadingDemo ? "Loading Demo..." : "Load Demo Dataset"}</span>
            </button>

            <button
              onClick={() => setShowGoogleSheetModal(true)}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Google Sheet</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload CSV / Excel</span>
            </button>
          </div>
        </div>

        {/* Datasets Grid */}
        {loading ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 py-12 text-center">Loading datasets...</div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
            <FileSpreadsheet className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No datasets found</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              Upload your business data in CSV or Excel format, or load the pre-built sales demo to explore right away.
            </p>
            <div className="pt-2 flex justify-center space-x-3">
              <button
                onClick={handleLoadDemo}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg"
              >
                Try Demo Dataset
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Upload File
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                        {ds.file_type}
                      </div>
                      <div className="truncate max-w-[180px]">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={ds.name}>{ds.name}</h4>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{ds.original_filename}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="p-1 text-slate-300 dark:text-slate-600 hover:text-rose-600 rounded transition-colors"
                      title="Delete Dataset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-semibold">Rows</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{ds.row_count.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-semibold">Columns</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{ds.column_count}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Link
                    to={`/datasets/${ds.id}`}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center space-x-1"
                  >
                    <span>Inspect Schema</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    to={`/analytics/${ds.id}`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center space-x-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Ask AI</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Dataset</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dataset Name (Optional)</label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g. Q3 Regional Sales"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select File (CSV, XLSX, XLS)</label>
                  <input
                    type="file"
                    required
                    accept=".csv,.xlsx,.xls,.parquet"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/60 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {uploading ? "Parsing & Profiling..." : "Upload & Analyze"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Google Sheet Import Modal */}
        {showGoogleSheetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/40">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Import from Google Sheets</h3>
                    <p className="text-[11px] text-slate-400">Ingest live spreadsheet tabs into DuckDB</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGoogleSheetModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGoogleSheetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Sheet URL or Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    required
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... or ID"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/40 dark:border-emerald-800/30 p-2 rounded-lg text-emerald-800 dark:text-emerald-300">
                    <span>💡</span>
                    <span>Set link sharing to <strong>"Anyone with the link can view"</strong>. Ingests directly into DuckDB without requiring Google Cloud OAuth setup.</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dataset Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={sheetDatasetName}
                    onChange={(e) => setSheetDatasetName(e.target.value)}
                    placeholder="e.g. 2026 Enterprise Pipeline"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowGoogleSheetModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importingSheet || !sheetInput.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-colors disabled:opacity-50"
                  >
                    {importingSheet ? "Extracting & Ingesting..." : "Import into DuckDB"}
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
