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
  FileSpreadsheet,
  KeyRound,
  Zap,
  Search,
  TrendingUp,
  Clock,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

// Skeleton component
const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

// Metric card skeleton
const MetricSkeleton: React.FC = () => (
  <div className="card p-3.5 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <div className="space-y-2 min-w-0 flex-1">
        <Skeleton className="h-3 w-16 sm:w-20" />
        <Skeleton className="h-6 sm:h-7 w-10 sm:w-12" />
        <Skeleton className="h-3 w-20 sm:w-28" />
      </div>
      <Skeleton className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-2xl shrink-0" />
    </div>
  </div>
);

// Dataset row skeleton
const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 rounded-xl">
    <Skeleton className="w-10 h-10 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-2.5 w-24" />
    </div>
    <Skeleton className="h-3 w-10" />
  </div>
);

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: "indigo" | "purple" | "emerald" | "amber";
  href?: string;
}

const colorConfig = {
  indigo: {
    icon: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60",
    glow: "group-hover:shadow-indigo-500/10",
    border: "group-hover:border-indigo-300/50 dark:group-hover:border-indigo-700/50",
  },
  purple: {
    icon: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/60",
    glow: "group-hover:shadow-purple-500/10",
    border: "group-hover:border-purple-300/50 dark:group-hover:border-purple-700/50",
  },
  emerald: {
    icon: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60",
    glow: "group-hover:shadow-emerald-500/10",
    border: "group-hover:border-emerald-300/50 dark:group-hover:border-emerald-700/50",
  },
  amber: {
    icon: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/60",
    glow: "group-hover:shadow-amber-500/10",
    border: "group-hover:border-amber-300/50 dark:group-hover:border-amber-700/50",
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon: Icon, color, href }) => {
  const cfg = colorConfig[color];
  const inner = (
    <div
      className={`card p-3.5 sm:p-5 group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cfg.glow} ${cfg.border} ${href ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
            {label}
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            {value}
          </div>
          <div className="text-[11px] sm:text-[12px] text-slate-500 dark:text-slate-400 leading-tight">
            {sub}
          </div>
        </div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border ${cfg.icon} transition-transform group-hover:scale-110 shrink-0`}>
          <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
};

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
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const sampleQueries = [
    "Describe my data",
    "Show top 5 trends",
    "Revenue by category",
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">

        {/* ── Hero Section ── */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-4 sm:p-8 md:p-10 text-white shadow-2xl shadow-indigo-950/40 border border-white/[0.07]">
          {/* Glow blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 left-1/3 w-64 h-64 bg-purple-600/15 rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-48 bg-blue-600/10 rounded-full blur-3xl" />
          </div>
          {/* Dot grid */}
          <div className="absolute inset-0 bg-dot-grid opacity-20" />

          <div className="relative z-10 max-w-3xl">
            {/* Status chip */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 mb-4 sm:mb-5 text-[11px] font-semibold bg-white/[0.08] border border-white/[0.12] px-2.5 sm:px-3 py-1.5 rounded-full text-blue-200 backdrop-blur-sm max-w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Sparkles className="w-3 h-3 text-indigo-300 shrink-0" />
              <span className="truncate">
                AI-Native Analytics<span className="hidden sm:inline"> · DuckDB Vectorized Engine</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-2 sm:mb-3">
              {greeting()},{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                {user?.full_name?.split(" ")[0] || "Analyst"}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5 sm:mb-6 max-w-xl">
              Ask questions in plain English. AutoAnalytix generates verified SQL, executes it in DuckDB, and delivers narrative insights with interactive charts.
            </p>

            {/* Search bar */}
            <form onSubmit={handleQuickSubmit} className="w-full">
              <div className="relative flex items-center w-full max-w-2xl bg-white/[0.08] hover:bg-white/[0.12] focus-within:bg-white/[0.14] border border-white/[0.12] focus-within:border-indigo-400/60 rounded-xl sm:rounded-2xl p-1 sm:p-1.5 backdrop-blur-sm transition-all group">
                <Search className="w-4 h-4 text-indigo-300 ml-2.5 sm:ml-3 shrink-0" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder={
                    datasets.length > 0
                      ? `Ask anything about ${datasets[0].name}…`
                      : "Ask questions in plain English…"
                  }
                  className="flex-1 min-w-0 bg-transparent px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 sm:py-2.5 px-3 sm:px-5 rounded-lg sm:rounded-xl shadow-sm transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>Analyze</span>
                </button>
              </div>

              {/* Sample prompts */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 text-[11px]">
                <span className="text-slate-400">Try:</span>
                {sampleQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setQuickQuery(q);
                      if (datasets.length > 0) {
                        navigate(`/analytics/${datasets[0].id}?q=${encodeURIComponent(q)}`);
                      } else {
                        handleLoadDemo();
                      }
                    }}
                    className="bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] rounded-full px-2.5 py-1 text-slate-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </form>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-5 sm:mt-6">
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm py-2.5 px-4 sm:px-5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-60 active:scale-[0.98] w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{loadingDemo ? "Loading demo…" : "Explore Demo Dataset"}</span>
              </button>
              <Link
                to="/datasets"
                className="flex items-center justify-center gap-2 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white font-semibold text-xs sm:text-sm py-2.5 px-4 sm:px-5 rounded-xl backdrop-blur-sm transition-all active:scale-[0.98] w-full sm:w-auto"
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span>Upload Your Data</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
          {loading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Datasets"
                value={datasets.length}
                sub={`${totalRows.toLocaleString()} total rows`}
                icon={Database}
                color="indigo"
                href="/datasets"
              />
              <StatCard
                label="Dashboards"
                value={dashboards.length}
                sub="Interactive grids"
                icon={BarChart2}
                color="purple"
                href="/dashboards"
              />
              <StatCard
                label="AI Engine"
                value={activeAi ? activeAi.provider?.toUpperCase() : "—"}
                sub={activeAi ? (activeAi.model_name?.split("/").pop() || "Active") : "Click to setup"}
                icon={KeyRound}
                color="emerald"
                href="/settings/ai-providers"
              />
              <StatCard
                label="Query Speed"
                value="<15ms"
                sub="In-memory DuckDB"
                icon={Zap}
                color="amber"
              />
            </>
          )}
        </div>

        {/* ── Recent Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Datasets card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Datasets</h3>
                  <p className="text-[11px] text-slate-400">Indexed in DuckDB</p>
                </div>
              </div>
              <Link
                to="/datasets"
                className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="border-t border-slate-100 dark:border-white/[0.05] -mx-4 sm:-mx-6" />

            {loading ? (
              <div className="space-y-2">
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </div>
            ) : datasets.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No datasets yet
                </p>
                <p className="text-xs text-slate-400 max-w-[220px] mx-auto">
                  Upload a CSV / Excel file or load the demo dataset to get started.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    onClick={handleLoadDemo}
                    className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    Demo
                  </button>
                  <Link to="/datasets" className="btn-primary text-xs py-1.5 px-3 gap-1.5">
                    Upload File
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {datasets.slice(0, 5).map((d) => (
                  <Link
                    key={d.id}
                    to={`/datasets/${d.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                      {d.file_type === "google_sheet" ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        d.file_type?.slice(0, 3)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {d.name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {d.row_count?.toLocaleString()} rows · {d.column_count} cols
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Dashboards card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/50">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Dashboards</h3>
                  <p className="text-[11px] text-slate-400">Live reporting grids</p>
                </div>
              </div>
              <Link
                to="/dashboards"
                className="text-[12px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="border-t border-slate-100 dark:border-white/[0.05] -mx-4 sm:-mx-6" />

            {loading ? (
              <div className="space-y-2">
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </div>
            ) : dashboards.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto">
                  <BarChart2 className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No dashboards yet
                </p>
                <p className="text-xs text-slate-400 max-w-[220px] mx-auto">
                  Analyze a dataset and save charts as a multi-widget dashboard.
                </p>
                <Link to="/dashboards" className="btn-primary text-xs py-1.5 px-3 gap-1.5 inline-flex">
                  Create Dashboard
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {dashboards.slice(0, 5).map((db) => (
                  <Link
                    key={db.id}
                    to={`/dashboards/${db.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {db.title}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                        <span>{db.items?.length || 0} widgets</span>
                        {db.is_public && (
                          <span className="badge-green">Public</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick start if no data ── */}
        {!loading && datasets.length === 0 && (
          <div className="card p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900/40 animate-slide-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/25">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
                    Ready to analyze your data?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload a CSV or try our demo B2B sales dataset in seconds.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleLoadDemo}
                  disabled={loadingDemo}
                  className="btn-secondary text-xs gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  {loadingDemo ? "Loading…" : "Load Demo"}
                </button>
                <Link to="/datasets" className="btn-primary text-xs gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload Data
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
