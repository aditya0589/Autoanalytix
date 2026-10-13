import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  BarChart2,
  Plus,
  Sparkles,
  Share2,
  Trash2,
  ArrowRight,
  Eye,
  Edit,
  LayoutDashboard,
  Layers,
  Search
} from "lucide-react";

export const DashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("Create an executive management dashboard with high-level KPI cards, revenue trends, and regional breakdowns.");
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
      if (dsList.length > 0) setSelectedDatasetId(dsList[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

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
    if (!selectedDatasetId || !currentWorkspace) return;
    setGeneratingAI(true);
    try {
      const db = await api.dashboards.generateAI({
        workspace_id: currentWorkspace.id,
        dataset_id: selectedDatasetId,
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
    if (!confirm("Are you sure you want to delete this dashboard?")) return;
    try {
      await api.dashboards.delete(id);
      await loadData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filteredDashboards = dashboards.filter((db) =>
    db.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (db.description && db.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboards
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Interactive multi-chart reporting views, executive grids, and real-time KPI monitors
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              disabled={datasets.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate with AI</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Dashboard</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {dashboards.length > 0 && (
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dashboards by title or description..."
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Dashboards Grid */}
        {loading ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 py-16 text-center">Loading dashboards...</div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900/90 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <BarChart2 className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No dashboards created yet</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
              Create a custom dashboard or use the AI Generator to automatically design an executive overview from your uploaded data.
            </p>
            <div className="pt-2 flex justify-center space-x-3">
              <button
                onClick={() => setShowAIModal(true)}
                disabled={datasets.length === 0}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md disabled:opacity-50"
              >
                Generate with AI
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl"
              >
                Create Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDashboards.map((db) => (
              <div
                key={db.id}
                className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-lg hover:border-indigo-500/40 transition-all p-6 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                        <BarChart2 className="w-5 h-5" />
                      </div>
                      <div className="truncate max-w-[170px]">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={db.title}>
                          {db.title}
                        </h4>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-1.5">
                          <span>{db.items?.length || 0} widgets</span>
                          <span>•</span>
                          <span className={db.is_public ? "text-emerald-500 font-semibold" : ""}>
                            {db.is_public ? "Public Link" : "Private"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(db.id)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Dashboard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {db.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 line-clamp-2 leading-relaxed">
                      {db.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <Link
                    to={`/dashboards/${db.id}`}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center space-x-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Grid</span>
                  </Link>

                  <Link
                    to={`/dashboards/${db.id}/edit`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Customize</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Dashboard Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Dashboard</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Executive Sales Overview"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of metrics tracked..."
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md"
                  >
                    Create & Open Editor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AI Dashboard Generation Modal */}
        {showAIModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Dashboard Generator</h3>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGenerateAI} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Dataset</label>
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id} className="dark:bg-slate-900">
                        {d.name} ({d.row_count.toLocaleString()} rows)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Prompt / Business Objective</label>
                  <textarea
                    rows={3}
                    required
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Create an executive sales dashboard showing revenue, profit, monthly growth, regional performance, and top products."
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                    The AI agent will analyze column metrics, generate 4-6 verified SQL queries, execute them in DuckDB, and assemble the live dashboard.
                  </p>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAIModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingAI}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{generatingAI ? "Assembling with AI..." : "Generate Dashboard"}</span>
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
