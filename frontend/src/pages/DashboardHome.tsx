import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  Database,
  BarChart2,
  Sparkles,
  UploadCloud,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  KeyRound,
  Zap,
  Activity,
  Layers,
  Search,
  ExternalLink
} from "lucide-react";

export const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentWorkspace } = useAuthStore();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([
      api.datasets.list(currentWorkspace.id),
      api.dashboards.list(currentWorkspace.id),
      api.ai.getConfigurations(currentWorkspace.id),
    ])
      .then(([dsList, dbList, aiList]) => {
        setDatasets(dsList);
        setDashboards(dbList);
        setAiConfigs(aiList);
      })
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

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

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    if (datasets.length > 0) {
      navigate(`/analytics/${datasets[0].id}?q=${encodeURIComponent(quickQuery.trim())}`);
    } else {
      handleLoadDemo();
    }
  };

  const activeAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];
  const totalRows = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0);

  const getModelDisplay = () => {
    if (!activeAi) return { provider: "NO AI CONFIGURED", model: "Click to set up BYOK", ok: false };
    const p = activeAi.provider?.toUpperCase() || "AI";
    const m = activeAi.model_name?.split("/").pop() || activeAi.model_name || "Active";
    return { provider: p, model: m, ok: true };
  };

  const aiInfo = getModelDisplay();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Command Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-5 sm:p-8 md:p-10 text-white shadow-xl">
          {/* Ambient decorative glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold bg-white/10 dark:bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-blue-200 backdrop-blur-md shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>AI-Native Business Intelligence • DuckDB Vectorized Engine</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
                {user?.full_name?.split(" ")[0] || "Analyst"}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Ask questions across your business datasets in plain English. Autoanalytix generates verified SQL queries, executes them in DuckDB, and delivers plain-language narrative insights with interactive charts.
            </p>

            {/* Quick Natural Language Query Bar */}
            <form onSubmit={handleQuickSubmit} className="pt-2">
              <div className="relative flex items-center max-w-2xl bg-white/10 hover:bg-white/15 focus-within:bg-white/20 border border-white/15 focus-within:border-blue-400/80 rounded-2xl p-1.5 backdrop-blur-md transition-all shadow-inner">
                <Search className="w-5 h-5 text-blue-300 ml-3 shrink-0" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder={
                    datasets.length > 0
                      ? `Ask anything about ${datasets[0].name}... (e.g. Describe my dataset and show top drivers)`
                      : "Load demo sales dataset to ask questions in plain English..."
                  }
                  className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-md transition-all flex items-center space-x-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze</span>
                </button>
              </div>

              {/* Sample Prompts Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-3 text-[11px] text-slate-400">
                <span className="text-slate-400 font-medium">Try asking:</span>
                {[
                  "Describe my data in plain English",
                  "What is total revenue by product line?",
                  "Show top 5 sales regions with growth",
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQuickQuery(sample);
                      if (datasets.length > 0) {
                        navigate(`/analytics/${datasets[0].id}?q=${encodeURIComponent(sample)}`);
                      } else {
                        handleLoadDemo();
                      }
                    }}
                    className="bg-white/5 hover:bg-white/15 border border-white/10 rounded-full px-2.5 py-1 text-slate-300 hover:text-white transition-colors"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </form>

            <div className="flex flex-wrap gap-2.5 pt-3">
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loadingDemo ? "Spinning up Demo..." : "Explore Demo Sales Dataset"}</span>
              </button>
              <Link
                to="/datasets"
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold text-xs py-2.5 px-4 rounded-xl backdrop-blur-md transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload New Data</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Top 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Datasets Loaded */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-all hover:border-blue-500/30 group">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Datasets Loaded
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {datasets.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {totalRows.toLocaleString()} total rows cached
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <Database className="w-5 h-5" />
            </div>
          </div>

          {/* Dashboards Created */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-all hover:border-indigo-500/30 group">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Dashboards Created
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {dashboards.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Interactive executive grids
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>

          {/* AI Inference Engine */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-all hover:border-emerald-500/30 group">
            <div className="truncate pr-2">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <span>AI Inference</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center space-x-1.5 mt-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 uppercase">
                  {aiInfo.provider}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={aiInfo.model}>
                {aiInfo.model}
              </div>
            </div>
            <Link
              to="/settings/ai-providers"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shrink-0 ${
                aiInfo.ok
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-950/60 border border-amber-200/50 dark:border-amber-800/40 text-amber-600 dark:text-amber-400"
              }`}
              title="Configure BYOK AI Provider"
            >
              <KeyRound className="w-5 h-5" />
            </Link>
          </div>

          {/* DuckDB Vectorized Engine */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-all hover:border-amber-500/30 group">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                DuckDB Speed
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                &lt;15ms
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                In-memory column execution
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/50 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Recent Datasets & Recent Dashboards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Datasets */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Datasets</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Structured tables indexed in DuckDB</p>
                </div>
              </div>
              <Link
                to="/datasets"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center space-x-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading datasets...</div>
            ) : datasets.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No datasets uploaded yet</p>
                <button
                  onClick={handleLoadDemo}
                  className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Load sample B2B Sales dataset
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {datasets.slice(0, 4).map((d) => (
                  <Link
                    key={d.id}
                    to={`/datasets/${d.id}`}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/30 dark:hover:bg-slate-800/80 transition-all group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {d.file_type}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {d.row_count.toLocaleString()} rows • {d.column_count} columns
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Analyze →
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Dashboards */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Dashboards</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Live multi-widget reporting views</p>
                </div>
              </div>
              <Link
                to="/dashboards"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center space-x-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading dashboards...</div>
            ) : dashboards.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <BarChart2 className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No dashboards created yet</p>
                <Link
                  to="/dashboards"
                  className="mt-2 inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Create your first dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboards.slice(0, 4).map((db) => (
                  <Link
                    key={db.id}
                    to={`/dashboards/${db.id}`}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-indigo-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-slate-800/80 transition-all group"
                  >
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {db.title}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span>{db.items?.length || 0} widgets</span>
                        <span>•</span>
                        <span className={db.is_public ? "text-emerald-500 font-medium" : ""}>
                          {db.is_public ? "Public Link Active" : "Private"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Grid →
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
