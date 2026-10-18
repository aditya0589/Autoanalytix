import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  BarChart2,
  Plus,
  Sparkles,
  Trash2,
  ArrowRight,
  Eye,
  Edit,
  Search,
  X,
  Database,
  TrendingUp,
  Globe,
  Lock,
  Zap,
  Upload,
} from "lucide-react";

const DashSkeleton: React.FC = () => (
  <div className="card p-5 space-y-4">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-2xl" />
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-36" />
          <div className="skeleton h-2.5 w-20" />
        </div>
      </div>
      <div className="skeleton w-7 h-7 rounded-lg" />
    </div>
    <div className="skeleton h-3 w-full" />
    <div className="skeleton h-3 w-2/3" />
    <div className="skeleton h-px w-full" />
    <div className="flex items-center justify-between">
      <div className="skeleton h-7 w-20 rounded-lg" />
      <div className="skeleton h-7 w-24 rounded-lg" />
    </div>
  </div>
);

export const DashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [aiPrompt, setAiPrompt] = useState(
    "Create an executive management dashboard with high-level KPI cards, revenue trends, and regional breakdowns."
  );
  const [generatingAI, setGeneratingAI] = useState(false);

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const [dbList, dsList] = await Promise.all([
        api.dashboards.list(currentWorkspace.id),
        api.datasets.list(currentWorkspace.id),
      ]);
      setDashboards(dbList);
      setDatasets(dsList);
      if (dsList.length > 0) {
        setSelectedDatasetId(dsList[0].id);
      } else {
        setSelectedDatasetId("demo");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentWorkspace]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !currentWorkspace) return;
    try {
      const db = await api.dashboards.create({
        workspace_id: currentWorkspace.id,
        title: newTitle,
        description: newDescription || undefined,
      });
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      navigate(`/dashboards/${db.id}/edit`);
    } catch (err: any) {
      alert("Failed to create dashboard: " + err.message);
    }
  };

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setGeneratingAI(true);
    try {
      let targetDatasetId = selectedDatasetId;

      // Automatically load demo dataset if selected or if user has no datasets yet
      if (!targetDatasetId || targetDatasetId === "demo" || datasets.length === 0) {
        const demoDs = await api.datasets.loadDemo(currentWorkspace.id);
        targetDatasetId = demoDs.id;
        setSelectedDatasetId(demoDs.id);
        setDatasets((prev) => {
          const exists = prev.some((d) => d.id === demoDs.id);
          return exists ? prev : [demoDs, ...prev];
        });
      }

      const db = await api.dashboards.generateAI({
        workspace_id: currentWorkspace.id,
        dataset_id: targetDatasetId,
        prompt: aiPrompt,
      });
      setShowAIModal(false);
      navigate(`/dashboards/${db.id}`);
    } catch (err: any) {
      alert("AI Dashboard generation failed: " + err.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dashboard?")) return;
    try {
      await api.dashboards.delete(id);
      await loadData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filtered = dashboards.filter((db) =>
    db.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (db.description && db.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ModalOverlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">{children}</div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Dashboards</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Interactive multi-chart reporting grids and KPI monitors
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="btn-primary text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate with AI
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-secondary text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Dashboard
            </button>
          </div>
        </div>

        {/* Search */}
        {!loading && dashboards.length > 0 && (
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dashboards…"
              className="input pl-9 text-sm py-2"
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <DashSkeleton key={i} />)}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="card p-16 text-center space-y-5 border-dashed">
            <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-950/50 text-purple-500 flex items-center justify-center mx-auto border border-purple-100 dark:border-purple-900/50">
              <BarChart2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No dashboards yet</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Create a custom dashboard or let AI automatically design an executive overview from your data.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => setShowAIModal(true)}
                className="btn-primary text-sm gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-secondary text-sm gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Manually
              </button>
            </div>
            {datasets.length === 0 && (
              <p className="text-xs text-slate-400">
                Clicking <span className="font-semibold text-slate-600 dark:text-slate-300">Generate with AI</span> will automatically analyze our B2B Sales demo dataset, or you can{" "}
                <Link to="/datasets" className="text-indigo-600 dark:text-indigo-400 underline">upload your own</Link>.
              </p>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Search className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No dashboards match "{searchTerm}"</p>
            <button onClick={() => setSearchTerm("")} className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {filtered.map((db) => (
              <div key={db.id} className="card-hover p-5 flex flex-col justify-between gap-4">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-bold text-slate-900 dark:text-white truncate" title={db.title}>
                          {db.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{db.items?.length || 0} widgets</span>
                          <span>·</span>
                          {db.is_public ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <Globe className="w-3 h-3" /> Public
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Private
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(db.id)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {db.description && (
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {db.description}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                  <Link
                    to={`/dashboards/${db.id}`}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Grid
                  </Link>
                  <Link
                    to={`/dashboards/${db.id}/edit`}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    Customize
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Dashboard Modal */}
        {showCreateModal && (
          <ModalOverlay onClose={() => setShowCreateModal(false)}>
            <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Create New Dashboard</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Set a title and customize later</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="btn-ghost p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Executive Sales Overview"
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of the metrics tracked…"
                    className="input text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary text-sm">Cancel</button>
                  <button type="submit" className="btn-primary text-sm gap-2">
                    Create & Open Editor
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}

        {/* AI Generation Modal */}
        {showAIModal && (
          <ModalOverlay onClose={() => !generatingAI && setShowAIModal(false)}>
            <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">AI Dashboard Generator</h3>
                    <p className="text-[11px] text-slate-400">Auto-builds from your dataset</p>
                  </div>
                </div>
                <button onClick={() => !generatingAI && setShowAIModal(false)} className="btn-ghost p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

                <form onSubmit={handleGenerateAI} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">Target Dataset</label>
                      {datasets.length === 0 && (
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                          Demo Mode Active
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="input text-sm"
                    >
                      {datasets.length === 0 ? (
                        <option value="demo" className="dark:bg-zinc-900 font-medium">
                          ✨ B2B SaaS Sales & Revenue (Demo Dataset — 1,000 rows)
                        </option>
                      ) : (
                        <>
                          {datasets.map((d) => (
                            <option key={d.id} value={d.id} className="dark:bg-zinc-900">
                              {d.name} ({d.row_count?.toLocaleString()} rows)
                            </option>
                          ))}
                          <option value="demo" className="dark:bg-zinc-900 font-medium text-indigo-600 dark:text-indigo-400">
                            ✨ B2B SaaS Sales & Revenue (Demo Dataset)
                          </option>
                        </>
                      )}
                    </select>
                    {datasets.length === 0 && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3" />
                        No datasets uploaded yet. We'll automatically load the demo B2B sales data.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Objective / Prompt</label>
                    <textarea
                      rows={3}
                      required
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Executive sales dashboard showing revenue, profit, monthly growth, regional performance, and top products."
                      className="input text-sm resize-none leading-relaxed"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      AI will analyze columns, generate 4–6 verified SQL queries, execute them in DuckDB, and assemble the live dashboard.
                    </p>
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3 flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-indigo-700 dark:text-indigo-300">
                      This takes ~20–40 seconds. AI will reason over your dataset metrics and assemble KPI cards and charts.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowAIModal(false)} disabled={generatingAI} className="btn-secondary text-sm">Cancel</button>
                    <button type="submit" disabled={generatingAI} className="btn-primary text-sm gap-2">
                      {generatingAI ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating with AI…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate with AI
                        </>
                      )}
                    </button>
                  </div>
                </form>
            </div>
          </ModalOverlay>
        )}
      </div>
    </Layout>
  );
};
