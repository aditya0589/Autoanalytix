import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api } from "../services/api";
import {
  Database,
  Table as TableIcon,
  Columns,
  CheckCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  MessageSquare
} from "lucide-react";

export const DatasetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"overview" | "data" | "columns" | "quality">("overview");

  const [dataset, setDataset] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.datasets.get(id),
      api.datasets.profile(id),
      api.datasets.preview(id, 50),
    ])
      .then(async ([ds, prof, prev]) => {
        setDataset(ds);
        setProfile(prof);
        setPreview(prev);
        if (ds?.workspace_id) {
          const convs = await api.conversations.list(ds.workspace_id, ds.id).catch(() => []);
          setConversations(convs);
        }
      })
      .catch((err) => {
        console.error("Failed to load dataset details:", err);
        setError(err.message || "Dataset not found or failed to load");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-500">Loading dataset metadata & profile...</div>
      </Layout>
    );
  }

  if (error || !dataset) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-20 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/50 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {error || "Dataset Not Found"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This dataset may not exist, was deleted, or failed during processing.
          </p>
          <div className="pt-2">
            <Link
              to="/datasets"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
            >
              <span>Back to Datasets</span>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const columns = profile?.columns || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Title and "Ask AI" button */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs uppercase shrink-0">
              {dataset.file_type}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{dataset.name}</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                File: {dataset.original_filename} • Table: <code className="text-slate-600 dark:text-slate-400 font-mono">{dataset.duckdb_table_name}</code>
              </p>
            </div>
          </div>

          <Link
            to={`/analytics/${dataset.id}`}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>Ask Questions with AI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-8 text-xs font-semibold">
          {[
            { key: "overview", label: "Overview", icon: Database },
            { key: "data", label: "Data Preview", icon: TableIcon },
            { key: "columns", label: "Columns & Types", icon: Columns },
            { key: "quality", label: "Data Quality & Health", icon: CheckCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3.5 flex items-center space-x-2 border-b-2 transition-all ${
                  active
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total Records</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {dataset.row_count.toLocaleString()}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total Columns</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{dataset.column_count}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">File Size</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {(dataset.size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Engine</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">DuckDB</span>
              </div>
            </div>

            {/* Suggested Questions */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Schema-Suggested Natural Language Questions</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These questions were automatically inferred from your column types and numeric statistics:
              </p>
              <div className="flex flex-wrap gap-2.5 pt-2">
                {profile?.suggested_questions?.map((q: string, idx: number) => (
                  <Link
                    key={idx}
                    to={`/analytics/${dataset.id}?q=${encodeURIComponent(q)}`}
                    className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/60 px-3.5 py-1.5 rounded-xl transition-colors flex items-center space-x-1.5"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Saved Chat Sessions */}
            {conversations.length > 0 && (
              <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Previous Chat Sessions</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Pick up your analysis right where you left off</p>
                    </div>
                  </div>
                  <Link
                    to={`/analytics/${dataset.id}`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Open Analytics Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {conversations.slice(0, 4).map((c) => (
                    <Link
                      key={c.id}
                      to={`/analytics/${dataset.id}?c=${c.id}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/30 dark:hover:bg-slate-800/80 transition-all group"
                    >
                      <div className="truncate mr-3">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                          {c.title}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                          Last active: {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Profiling Summary Insights */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Statistical Summary Insights</h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {profile?.summary_insights?.map((insight: string, idx: number) => (
                  <li key={idx} className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Data Preview */}
        {activeTab === "data" && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Displaying first 50 rows of {dataset.row_count.toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {preview?.columns?.map((c: any) => (
                      <th key={c.name} className="py-2.5 px-3 whitespace-nowrap">
                        {c.name}
                        <span className="block text-[10px] font-normal text-slate-400 capitalize">{c.data_type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {preview?.rows?.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {preview?.columns?.map((col: any) => (
                        <td key={col.name} className="py-2.5 px-3 whitespace-nowrap">
                          {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Columns */}
        {activeTab === "columns" && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <table className="min-w-full text-xs text-left divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-4">Column Name</th>
                  <th className="py-3 px-4">Semantic Type</th>
                  <th className="py-3 px-4">DuckDB Type</th>
                  <th className="py-3 px-4">Nulls (%)</th>
                  <th className="py-3 px-4">Unique Values</th>
                  <th className="py-3 px-4">Key Metrics / Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {columns.map((c: any) => (
                  <tr key={c.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {c.data_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{c.duckdb_type}</td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{c.null_percentage}%</td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{c.unique_count.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {c.data_type === "numeric" && c.stats ? (
                        <span>
                          Min: <b>{c.stats.min}</b> • Max: <b>{c.stats.max}</b> • Mean: <b>{c.stats.mean}</b>
                        </span>
                      ) : c.data_type === "datetime" && c.stats ? (
                        <span>Range: {c.stats.min_date} to {c.stats.max_date}</span>
                      ) : (
                        <span>Sample: {c.sample_values?.slice(0, 3).join(", ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Quality & Health */}
        {activeTab === "quality" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white dark:bg-slate-900/90 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Duplicate Rows</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {profile.duplicate_rows_count.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {profile.duplicate_rows_count === 0 ? "Zero duplicate rows found." : "Identified duplicate rows."}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900/90 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Missing Cells</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {profile.missing_cells_percentage}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {profile.missing_cells_count} missing cells out of {profile.total_cells} total cells.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900/90 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Quality Assessment</span>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1.5">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span>Ready for Analytics</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Validated for DuckDB analytical execution.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
