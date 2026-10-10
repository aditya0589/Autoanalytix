import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api } from "../services/api";
import { ChartRenderer } from "../components/ChartRenderer";
import {
  Save,
  ArrowLeft,
  Trash2,
  Maximize2,
  Sparkles,
  Plus,
  Eye,
  Sliders
} from "lucide-react";

export const DashboardEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // New widget modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetType, setNewWidgetType] = useState("kpi");
  const [newWidgetVal, setNewWidgetVal] = useState("1,420,500");
  const [newWidgetSub, setNewWidgetSub] = useState("Year-to-date total");

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.dashboards.get(id);
      setDashboard(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.dashboards.update(id, {
        title,
        description,
      });
      alert("Dashboard settings saved successfully!");
      navigate(`/dashboards/${id}`);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    try {
      await api.dashboards.deleteItem(id, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err: any) {
      alert("Failed to remove widget: " + err.message);
    }
  };

  const handleUpdateItemSpan = async (itemId: string, newSpan: number) => {
    // Local update of grid span
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            grid_pos: { ...i.grid_pos, w: newSpan },
          };
        }
        return i;
      })
    );
  };

  const handleAddWidget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newWidgetTitle) return;
    try {
      const spec = {
        type: newWidgetType,
        title: newWidgetTitle,
        kpi_value: newWidgetVal,
        kpi_subtext: newWidgetSub,
        data: [],
      };

      const newItem = await api.dashboards.addItem(id, {
        title: newWidgetTitle,
        widget_type: newWidgetType,
        grid_pos: { x: 0, y: 0, w: 6, h: 4 },
        chart_spec: spec,
      });

      setItems((prev) => [...prev, newItem]);
      setShowAddModal(false);
      setNewWidgetTitle("");
    } catch (err: any) {
      alert("Failed to add widget: " + err.message);
    }
  };

  if (loading || !dashboard) {
    return (
      <Layout>
        <div className="text-center py-20 text-xs text-slate-400">Loading editor...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Editor Top Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Link to={`/dashboards/${dashboard.id}`} className="text-xs text-slate-400 hover:text-slate-600 flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dashboard Title"
                className="text-lg font-extrabold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none px-1 py-0.5"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional executive description..."
                className="text-xs text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none px-1 py-0.5"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Widget</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>

        {/* Widgets Grid in Editor */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
          {items.map((item: any) => {
            const span = item.grid_pos?.w || 6;
            const spanClass = `lg:col-span-${Math.min(span, 12)}`;
            const spec = item.chart_spec || {
              type: item.widget_type,
              title: item.title,
              data: item.cached_data?.rows || [],
            };

            return (
              <div key={item.id} className={`${spanClass} col-span-12 relative group`}>
                {/* Widget Controls Overlay */}
                <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-white/95 border border-slate-200 p-1 rounded-lg shadow-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleUpdateItemSpan(item.id, span === 12 ? 6 : span === 6 ? 4 : 12)}
                    className="p-1 text-slate-500 hover:text-blue-600 rounded"
                    title="Change Width (Full / Half / Third)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-600 rounded"
                    title="Remove Widget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ChartRenderer spec={spec} height={250} />
              </div>
            );
          })}
        </div>

        {/* Add Widget Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Add Custom Widget</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddWidget} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Title</label>
                  <input
                    type="text"
                    required
                    value={newWidgetTitle}
                    onChange={(e) => setNewWidgetTitle(e.target.value)}
                    placeholder="e.g. Total Active Accounts"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Type</label>
                  <select
                    value={newWidgetType}
                    onChange={(e) => setNewWidgetType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="kpi">KPI Metric Card</option>
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Trend Chart</option>
                  </select>
                </div>

                {newWidgetType === "kpi" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">KPI Value</label>
                      <input
                        type="text"
                        value={newWidgetVal}
                        onChange={(e) => setNewWidgetVal(e.target.value)}
                        placeholder="$1,250,000"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Subtext</label>
                      <input
                        type="text"
                        value={newWidgetSub}
                        onChange={(e) => setNewWidgetSub(e.target.value)}
                        placeholder="+18% YoY growth"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    Add to Grid
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
