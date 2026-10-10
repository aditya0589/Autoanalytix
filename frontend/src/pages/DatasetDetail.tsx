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
  AlertTriangle
} from "lucide-react";

export const DatasetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"overview" | "data" | "columns" | "quality">("overview");

  const [dataset, setDataset] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.datasets.get(id),
      api.datasets.profile(id),
      api.datasets.preview(id, 50),
    ])
      .then(([ds, prof, prev]) => {
        setDataset(ds);
        setProfile(prof);
        setPreview(prev);
      })
      .catch((err) => console.error("Failed to load dataset details:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !dataset) {
    return (
      <Layout>
        <div className="text-center py-20 text-xs text-slate-400">Loading dataset metadata & profile...</div>
      </Layout>
    );
  }

  const columns = profile?.columns || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Title and "Ask AI" button */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm uppercase shrink-0">
              {dataset.file_type}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{dataset.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                File: {dataset.original_filename} • Table: <code className="text-slate-600">{dataset.duckdb_table_name}</code>
              </p>
            </div>
          </div>

          <Link
            to={`/analytics/${dataset.id}`}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>Ask Questions with AI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-8 text-xs font-semibold">
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
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-all ${
                  active
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Records</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                  {dataset.row_count.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Columns</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">{dataset.column_count}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">File Size</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                  {(dataset.size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Engine</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1 block">DuckDB</span>
              </div>
            </div>

            {/* Suggested Questions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Schema-Suggested Natural Language Questions</span>
              </h3>
              <p className="text-xs text-slate-500">
                These questions were automatically inferred from your column types and numeric statistics:
              </p>
              <div className="flex flex-wrap gap-2.5 pt-2">
                {profile?.suggested_questions?.map((q: string, idx: number) => (
                  <Link
                    key={idx}
                    to={`/analytics/${dataset.id}?q=${encodeURIComponent(q)}`}
                    className="text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200/60 px-3.5 py-1.5 rounded-full transition-colors flex items-center space-x-1.5"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Profiling Summary Insights */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Statistical Summary Insights</h3>
              <ul className="space-y-2 text-xs text-slate-600">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Displaying first 50 rows of {dataset.row_count.toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    {preview?.columns?.map((c: any) => (
                      <th key={c.name} className="py-2.5 px-3 whitespace-nowrap">
                        {c.name}
                        <span className="block text-[10px] font-normal text-slate-400 capitalize">{c.data_type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {preview?.rows?.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {preview?.columns?.map((col: any) => (
                        <td key={col.name} className="py-2 px-3 whitespace-nowrap">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="min-w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="py-3 px-4">Column Name</th>
                  <th className="py-3 px-4">Semantic Type</th>
                  <th className="py-3 px-4">DuckDB Type</th>
                  <th className="py-3 px-4">Nulls (%)</th>
                  <th className="py-3 px-4">Unique Values</th>
                  <th className="py-3 px-4">Key Metrics / Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {columns.map((c: any) => (
                  <tr key={c.name} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{c.name}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {c.data_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{c.duckdb_type}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{c.null_percentage}%</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{c.unique_count.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-600">
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
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Duplicate Rows</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {profile.duplicate_rows_count.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {profile.duplicate_rows_count === 0 ? "Zero duplicate rows found." : "Identified duplicate rows."}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Missing Cells</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {profile.missing_cells_percentage}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {profile.missing_cells_count} missing cells out of {profile.total_cells} total cells.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Quality Assessment</span>
                <div className="text-lg font-bold text-emerald-600 mt-1 flex items-center space-x-1.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>Ready for Analytics</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Validated for DuckDB analytical execution.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
