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
  Layers,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  KeyRound
} from "lucide-react";

export const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentWorkspace } = useAuthStore();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);

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

  const activeAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Hero */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold bg-white/10 px-3 py-1 rounded-full text-blue-200 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>AI-Native Business Intelligence</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "Analyst"}!
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ask your data anything in natural language. Autoanalytix parses your datasets in DuckDB, computes real verified metrics, and generates live interactive charts and dashboards.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loadingDemo ? "Spinning up Demo..." : "Explore Demo Sales Dataset"}</span>
              </button>
              <Link
                to="/datasets"
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload New Data</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Datasets Loaded</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{datasets.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dashboards Created</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{dashboards.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">AI Inference Engine</div>
              <div className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[170px]">
                {activeAi ? `${activeAi.provider.toUpperCase()} (${activeAi.model_name})` : "None configured"}
              </div>
            </div>
            <Link
              to="/settings/ai-providers"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                activeAi ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Recent Datasets & Recent Dashboards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Datasets */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Your Datasets</h3>
              </div>
              <Link to="/datasets" className="text-xs text-blue-600 hover:underline font-semibold flex items-center space-x-1">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 py-6 text-center">Loading datasets...</div>
            ) : datasets.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No datasets uploaded yet</p>
                <button
                  onClick={handleLoadDemo}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
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
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {d.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {d.row_count.toLocaleString()} rows • {d.column_count} columns • {d.file_type.toUpperCase()}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Dashboards */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Your Dashboards</h3>
              </div>
              <Link to="/dashboards" className="text-xs text-blue-600 hover:underline font-semibold flex items-center space-x-1">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 py-6 text-center">Loading dashboards...</div>
            ) : dashboards.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <BarChart2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No dashboards created yet</p>
                <Link to="/dashboards" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">
                  Create your first dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboards.slice(0, 4).map((db) => (
                  <Link
                    key={db.id}
                    to={`/dashboards/${db.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {db.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {db.items?.length || 0} widgets • {db.is_public ? "Public Link Enabled" : "Private"}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
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
