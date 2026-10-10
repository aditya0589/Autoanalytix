import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api } from "../services/api";
import { ChartRenderer } from "../components/ChartRenderer";
import {
  Share2,
  Edit,
  Globe,
  Copy,
  Check,
  Calendar,
  Lock,
  ArrowLeft,
  ExternalLink
} from "lucide-react";

export const DashboardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Sharing modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState("All");

  const loadDashboard = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.dashboards.get(id);
      setDashboard(data);
      setIsPublic(data.is_public);
      setShareToken(data.share_token);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [id]);

  const handleToggleShare = async () => {
    if (!id) return;
    setSharingLoading(true);
    try {
      const nextPublic = !isPublic;
      const res = await api.dashboards.share(id, nextPublic);
      setIsPublic(res.is_public);
      setShareToken(res.share_token);
      await loadDashboard();
    } catch (err: any) {
      alert("Failed to update share setting: " + err.message);
    } finally {
      setSharingLoading(false);
    }
  };

  const shareUrl = shareToken ? `${window.location.origin}/shared/${shareToken}` : "";

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !dashboard) {
    return (
      <Layout>
        <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-500">Loading dashboard...</div>
      </Layout>
    );
  }

  const items = dashboard.items || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <Link to="/dashboards" className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center space-x-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboards</span>
              </Link>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{dashboard.title}</h1>
            {dashboard.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">{dashboard.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isPublic ? "Share Settings (Public)" : "Share"}</span>
            </button>

            <Link
              to={`/dashboards/${dashboard.id}/edit`}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Customize Layout</span>
            </Link>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-3.5 shadow-xs flex items-center justify-between text-xs transition-colors">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-700 dark:text-slate-300">Quick Filter:</span>
            {["All", "Enterprise", "Mid-Market", "SMB"].map((seg) => (
              <button
                key={seg}
                onClick={() => setSelectedFilter(seg)}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  selectedFilter === seg
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {seg}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            {items.length} Widgets Assembled
          </div>
        </div>

        {/* Widgets Grid */}
        {items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">This dashboard currently has no widgets.</p>
            <Link
              to={`/dashboards/${dashboard.id}/edit`}
              className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Add widgets in Dashboard Editor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {items.map((item: any) => {
              const spanCol = item.grid_pos?.w ? `lg:col-span-${Math.min(item.grid_pos.w, 12)}` : "lg:col-span-6";
              const spec = item.chart_spec || {
                type: item.widget_type,
                title: item.title,
                data: item.cached_data?.rows || [],
              };

              return (
                <div key={item.id} className={`${spanCol} col-span-12 min-h-[280px]`}>
                  <ChartRenderer spec={spec} height={250} />
                </div>
              );
            })}
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dashboard Sharing & Permissions</h3>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Public Link Access</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Anyone with the unguessable link can view this dashboard without signing in.
                    </div>
                  </div>
                  <button
                    onClick={handleToggleShare}
                    disabled={sharingLoading}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPublic ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isPublic ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {isPublic && shareUrl && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Public Viewer Link</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 select-all"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shrink-0"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="pt-1">
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                      >
                        <span>Preview public link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 rounded-2xl text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                  <strong>Security Guarantee:</strong> Public viewers never have access to your private database credentials, LLM API keys, or raw files. Access can be revoked anytime with one toggle.
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
