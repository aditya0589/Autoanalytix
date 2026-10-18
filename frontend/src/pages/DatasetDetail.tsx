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
  FileSpreadsheet,
  AlertTriangle,
  MessageSquare,
  Zap,
} from "lucide-react";

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

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
      .catch((err) => setError(err.message || "Dataset not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
          <div className="card p-6 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3 w-80" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-24" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="card p-6 space-y-3">
            <Skeleton className="h-4 w-64" />
            <div className="flex flex-wrap gap-2 pt-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-40 rounded-xl" />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !dataset) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-20 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{error || "Dataset Not Found"}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This dataset may not exist, was deleted, or failed during processing.
          </p>
          <Link to="/datasets" className="btn-primary text-sm gap-2 inline-flex mx-auto">
            Back to Datasets
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Layout>
    );
  }

  const columns = profile?.columns || [];
  const tabs = [
    { key: "overview", label: "Overview", icon: Database },
    { key: "data", label: "Data Preview", icon: TableIcon },
    { key: "columns", label: "Columns & Types", icon: Columns },
    { key: "quality", label: "Data Quality", icon: CheckCircle },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs uppercase shrink-0">
              {dataset.file_type === "google_sheet" ? (
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                dataset.file_type?.slice(0, 4)
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {dataset.name}
              </h1>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
                {dataset.original_filename} · Table:{" "}
                <code className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-[11px]">
                  {dataset.duckdb_table_name}
                </code>
              </p>
            </div>
          </div>

          <Link
            to={`/analytics/${dataset.id}`}
            className="btn-primary text-sm gap-2 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            Ask AI
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-slate-200 dark:border-white/[0.06] gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold border-b-2 whitespace-nowrap transition-all ${
                  active
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-5 animate-fade-in">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Records", value: dataset.row_count?.toLocaleString() },
                { label: "Total Columns", value: dataset.column_count },
                { label: "File Size", value: `${(dataset.size_bytes / 1024).toFixed(1)} KB` },
                { label: "Query Engine", value: "DuckDB" },
              ].map((s) => (
                <div key={s.label} className="card p-5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">{s.label}</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Suggested Questions */}
            {profile?.suggested_questions?.length > 0 && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Suggested Questions</h3>
                    <p className="text-[11px] text-slate-400">Auto-inferred from column types and statistics</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.suggested_questions.map((q: string, idx: number) => (
                    <Link
                      key={idx}
                      to={`/analytics/${dataset.id}?q=${encodeURIComponent(q)}`}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 border border-indigo-100 dark:border-indigo-900/50 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      {q}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Chats */}
            {conversations.length > 0 && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Previous Chat Sessions</h3>
                      <p className="text-[11px] text-slate-400">Continue where you left off</p>
                    </div>
                  </div>
                  <Link to={`/analytics/${dataset.id}`} className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                    Open workspace <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {conversations.slice(0, 4).map((c) => (
                    <Link
                      key={c.id}
                      to={`/analytics/${dataset.id}?c=${c.id}`}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] hover:border-indigo-200 dark:hover:border-indigo-800/50 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all group"
                    >
                      <div className="truncate mr-3">
                        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate transition-colors">{c.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{new Date(c.updated_at || c.created_at).toLocaleDateString()}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Insights */}
            {profile?.summary_insights?.length > 0 && (
              <div className="card p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Statistical Insights</h3>
                </div>
                <ul className="space-y-2">
                  {profile.summary_insights.map((insight: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab: Data Preview */}
        {activeTab === "data" && (
          <div className="card overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.05]">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                Showing first 50 rows of {dataset.row_count?.toLocaleString()} total
              </span>
              <span className="badge-blue">{preview?.columns?.length} columns</span>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 font-semibold sticky top-0 border-b border-slate-200 dark:border-white/[0.06]">
                  <tr>
                    {preview?.columns?.map((c: any) => (
                      <th key={c.name} className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 font-mono capitalize">{c.data_type}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
                  {preview?.rows?.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      {preview?.columns?.map((col: any) => (
                        <td key={col.name} className="py-2.5 px-4 whitespace-nowrap font-mono text-[12px]">
                          {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Columns & Types */}
        {activeTab === "columns" && (
          <div className="card overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left divide-y divide-slate-100 dark:divide-white/[0.04]">
                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 font-semibold text-[12px]">
                  <tr>
                    {["Column Name", "Semantic Type", "DuckDB Type", "Nulls (%)", "Unique Values", "Key Metrics"].map((h) => (
                      <th key={h} className="py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
                  {columns.map((c: any) => (
                    <tr key={c.name} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white text-[12px] whitespace-nowrap">{c.name}</td>
                      <td className="py-3 px-4">
                        <span className="badge bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 capitalize">{c.data_type}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">{c.duckdb_type}</td>
                      <td className="py-3 px-4 text-[12px]">
                        <span className={`font-semibold ${c.null_percentage > 10 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}>
                          {c.null_percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-slate-600 dark:text-slate-400">{c.unique_count?.toLocaleString()}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                        {c.data_type === "numeric" && c.stats ? (
                          <span>Min: <strong>{c.stats.min}</strong> · Max: <strong>{c.stats.max}</strong> · Mean: <strong>{c.stats.mean}</strong></span>
                        ) : c.data_type === "datetime" && c.stats ? (
                          <span>Range: {c.stats.min_date} → {c.stats.max_date}</span>
                        ) : (
                          <span className="text-slate-400">{c.sample_values?.slice(0, 3).join(", ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Data Quality */}
        {activeTab === "quality" && profile && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  label: "Duplicate Rows",
                  value: profile.duplicate_rows_count?.toLocaleString() ?? "0",
                  note: profile.duplicate_rows_count === 0 ? "✓ Zero duplicates found" : "Duplicate rows detected",
                  ok: profile.duplicate_rows_count === 0,
                },
                {
                  label: "Missing Cells",
                  value: `${profile.missing_cells_percentage}%`,
                  note: `${profile.missing_cells_count} cells out of ${profile.total_cells} total`,
                  ok: profile.missing_cells_percentage < 5,
                },
                {
                  label: "Quality Status",
                  value: "Analytics Ready",
                  note: "Validated for DuckDB execution",
                  ok: true,
                },
              ].map((s) => (
                <div key={s.label} className={`card p-6 border ${s.ok ? "border-emerald-100 dark:border-emerald-900/40" : "border-amber-100 dark:border-amber-900/40"}`}>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{s.label}</div>
                  <div className={`text-xl font-black mt-1 ${s.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{s.value}</div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
