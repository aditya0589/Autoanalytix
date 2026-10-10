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
  Edit
} from "lucide-react";

export const DashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Dashboards</h1>
            <p className="text-xs text-slate-500">Interactive business dashboards, reports, and KPI monitors</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAIModal(true)}
              disabled={datasets.length === 0}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate with AI</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Dashboard</span>
            </button>
          </div>
        </div>

        {/* Dashboards Grid */}
        {loading ? (
          <div className="text-xs text-slate-400 py-12 text-center">Loading dashboards...</div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
            <BarChart2 className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No dashboards created yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a custom dashboard or use the AI Generator to automatically design an executive overview.
            </p>
            <div className="pt-2 flex justify-center space-x-3">
              <button
                onClick={() => setShowAIModal(true)}
                disabled={datasets.length === 0}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                Generate with AI
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
              >
                Create Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {dashboards.map((db) => (
              <div
                key={db.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        <BarChart2 className="w-4 h-4" />
                      </div>
                      <div className="truncate max-w-[180px]">
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={db.title}>{db.title}</h4>
                        <div className="text-[10px] text-slate-400 truncate">
                          {db.items?.length || 0} widgets • {db.is_public ? "Public Link Active" : "Private"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(db.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors"
                      title="Delete Dashboard"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {db.description && (
                    <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                      {db.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/dashboards/${db.id}`}
                    className="text-xs font-semibold text-slate-700 hover:text-blue-600 flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </Link>

                  <Link
                    to={`/dashboards/${db.id}/edit`}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit Grid</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Dashboard Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Create New Dashboard</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Executive Sales Overview"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of metrics tracked..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">AI Dashboard Generator</h3>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGenerateAI} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Dataset</label>
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.row_count.toLocaleString()} rows)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prompt / Business Objective</label>
                  <textarea
                    rows={3}
                    required
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Create an executive sales dashboard showing revenue, profit, monthly growth, regional performance, and top products."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    The AI agent will analyze column metrics, generate 4-6 queries, execute them in DuckDB, and assemble the dashboard.
                  </p>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAIModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingAI}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {generatingAI ? "Assembling with AI..." : "Generate Dashboard"}
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
