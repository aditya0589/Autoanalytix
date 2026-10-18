import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  MessageSquare,
  Search,
  Database,
  ArrowRight,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  Sparkles,
  Clock,
} from "lucide-react";

interface ConversationItem {
  id: string;
  workspace_id: string;
  dataset_id: string;
  dataset_name?: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

const ChatSkeleton: React.FC = () => (
  <div className="card p-5 space-y-4">
    <div className="flex items-center justify-between">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton h-3 w-14" />
    </div>
    <div className="space-y-2">
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3.5 w-1/2" />
    </div>
    <div className="skeleton h-px w-full" />
    <div className="flex items-center justify-between">
      <div className="skeleton h-6 w-20 rounded-full" />
      <div className="skeleton h-8 w-20 rounded-xl" />
    </div>
  </div>
);

export const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDatasetFilter, setSelectedDatasetFilter] = useState<string>("all");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedDatasetForNewChat, setSelectedDatasetForNewChat] = useState("");

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const [convs, dsList] = await Promise.all([
        api.conversations.list(currentWorkspace.id),
        api.datasets.list(currentWorkspace.id),
      ]);
      setConversations(convs);
      setDatasets(dsList);
      if (dsList.length > 0) setSelectedDatasetForNewChat(dsList[0].id);
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentWorkspace]);

  const handleStartRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTitle.trim()) { setEditingConvId(null); return; }
    try {
      await api.conversations.rename(id, editingTitle.trim());
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: editingTitle.trim() } : c));
      setEditingConvId(null);
    } catch (err: any) {
      alert("Failed to rename: " + err.message);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    try {
      await api.conversations.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch { return ""; }
  };

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.dataset_name && c.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDataset = selectedDatasetFilter === "all" || c.dataset_id === selectedDatasetFilter;
    return matchesSearch && matchesDataset;
  });

  const totalMessages = conversations.reduce((acc, c) => acc + (c.message_count || 0), 0);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Chat Sessions</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Continue AI-powered data conversations
            </p>
          </div>
          <button
            onClick={() => {
              if (datasets.length === 1) {
                navigate(`/analytics/${datasets[0].id}`);
              } else {
                setShowNewChatModal(true);
              }
            }}
            className="btn-primary text-sm gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Chats", value: conversations.length },
            { label: "Total Messages", value: totalMessages },
            { label: "Active Datasets", value: datasets.length },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or datasets…"
              className="input pl-9 text-sm py-2 w-full"
            />
          </div>
          <select
            value={selectedDatasetFilter}
            onChange={(e) => setSelectedDatasetFilter(e.target.value)}
            className="input text-sm py-2 w-full sm:w-auto sm:min-w-[180px]"
          >
            <option value="all">All datasets ({conversations.length})</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <ChatSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/50">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery || selectedDatasetFilter !== "all" ? "No matching chats" : "No chat history yet"}
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || selectedDatasetFilter !== "all"
                  ? "Try clearing the search or changing the dataset filter."
                  : "Start asking natural-language questions to analyze your datasets."}
              </p>
            </div>
            {datasets.length > 0 ? (
              <button
                onClick={() => datasets.length === 1 ? navigate(`/analytics/${datasets[0].id}`) : setShowNewChatModal(true)}
                className="btn-primary text-sm gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                Start Your First Chat
              </button>
            ) : (
              <Link to="/datasets" className="btn-primary text-sm gap-2 inline-flex mx-auto">
                <Database className="w-4 h-4" />
                Upload a Dataset First
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filtered.map((conv) => {
              const isEditing = editingConvId === conv.id;
              const dsName = conv.dataset_name || datasets.find((d) => d.id === conv.dataset_id)?.name || "Dataset";

              return (
                <div
                  key={conv.id}
                  className="card-hover p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Dataset & timestamp */}
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/datasets/${conv.dataset_id}`}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[180px]"
                        title={dsName}
                      >
                        <Database className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dsName}</span>
                      </Link>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(conv.updated_at || conv.created_at)}
                      </span>
                    </div>

                    {/* Title / rename */}
                    {isEditing ? (
                      <form onSubmit={(e) => handleSaveRename(conv.id, e)} className="flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="input text-sm flex-1 py-1.5"
                        />
                        <button type="submit" className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setEditingConvId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-2 group/title">
                        <h3 className="text-[14px] font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug flex-1">
                          {conv.title}
                        </h3>
                        <button
                          onClick={(e) => handleStartRename(conv, e)}
                          className="opacity-0 group-hover/title:opacity-100 p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-all shrink-0"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-full">
                      {conv.message_count ? `${conv.message_count} msgs` : "Active"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        to={`/analytics/${conv.dataset_id}?c=${conv.id}`}
                        className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-[12px] py-1.5 px-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition-colors"
                      >
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={() => setShowNewChatModal(false)}
          >
            <div
              className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Start New Chat</h3>
                    <p className="text-[11px] text-slate-400">Choose a dataset to query</p>
                  </div>
                </div>
                <button onClick={() => setShowNewChatModal(false)} className="btn-ghost p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {datasets.map((d) => {
                  const isSelected = selectedDatasetForNewChat === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDatasetForNewChat(d.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600"
                          : "border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Database className={`w-4 h-4 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-indigo-800 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"}`}>
                          {d.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{d.row_count?.toLocaleString()} rows</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNewChatModal(false)} className="btn-secondary text-sm">Cancel</button>
                <button
                  disabled={!selectedDatasetForNewChat}
                  onClick={() => { setShowNewChatModal(false); navigate(`/analytics/${selectedDatasetForNewChat}`); }}
                  className="btn-primary text-sm gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
