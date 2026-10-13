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
  Calendar,
  Layers,
  Clock
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

export const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDatasetFilter, setSelectedDatasetFilter] = useState<string>("all");

  // Renaming state
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // New Chat Modal state
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
      if (dsList.length > 0) {
        setSelectedDatasetForNewChat(dsList[0].id);
      }
    } catch (err) {
      console.error("Failed to load chats or datasets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleStartRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    try {
      await api.conversations.rename(id, editingTitle.trim());
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
      );
      setEditingConvId(null);
    } catch (err: any) {
      alert("Failed to rename chat: " + err.message);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat history? This cannot be undone.")) return;
    try {
      await api.conversations.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert("Failed to delete chat: " + err.message);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.dataset_name && c.dataset_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDataset =
      selectedDatasetFilter === "all" || c.dataset_id === selectedDatasetFilter;
    return matchesSearch && matchesDataset;
  });

  const totalMessages = conversations.reduce((acc, c) => acc + (c.message_count || 0), 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Chat Sessions
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pick up your AI-powered data inquiries right where you left off across all datasets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => {
                if (datasets.length === 1) {
                  navigate(`/analytics/${datasets[0].id}`);
                } else {
                  setShowNewChatModal(true);
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total Saved Chats</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {conversations.length}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total Inquiries & Messages</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {totalMessages}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Active Datasets</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {datasets.length}
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat topics or questions..."
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">Filter dataset:</span>
            <select
              value={selectedDatasetFilter}
              onChange={(e) => setSelectedDatasetFilter(e.target.value)}
              className="w-full sm:w-auto text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Datasets ({conversations.length})</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chats Content List */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading chat sessions...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery || selectedDatasetFilter !== "all"
                  ? "No matching chat sessions found"
                  : "No chat history yet"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery || selectedDatasetFilter !== "all"
                  ? "Try clearing your search query or changing the dataset filter."
                  : "Start asking natural-language questions to analyze your data, generate SQL, and visualize trends."}
              </p>
            </div>

            {datasets.length > 0 ? (
              <button
                onClick={() => {
                  if (datasets.length === 1) {
                    navigate(`/analytics/${datasets[0].id}`);
                  } else {
                    setShowNewChatModal(true);
                  }
                }}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-5 rounded-xl shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Your First Chat</span>
              </button>
            ) : (
              <Link
                to="/datasets"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-5 rounded-xl shadow-sm transition-all"
              >
                <Database className="w-4 h-4" />
                <span>Upload a Dataset First</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConversations.map((conv) => {
              const isEditing = editingConvId === conv.id;
              const dsName = conv.dataset_name || datasets.find((d) => d.id === conv.dataset_id)?.name || "Dataset";

              return (
                <div
                  key={conv.id}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800/90 hover:border-blue-300 dark:hover:border-blue-900/60 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Dataset Tag & Timestamp */}
                    <div className="flex items-center justify-between text-[11px]">
                      <Link
                        to={`/datasets/${conv.dataset_id}`}
                        className="flex items-center space-x-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[180px]"
                        title={dsName}
                      >
                        <Database className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{dsName}</span>
                      </Link>

                      <span className="text-slate-400 dark:text-slate-500 flex items-center space-x-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(conv.updated_at || conv.created_at)}</span>
                      </span>
                    </div>

                    {/* Chat Title / Renaming */}
                    <div>
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveRename(conv.id, e)}
                          className="flex items-center space-x-1 pt-1"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingConvId(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between group/title">
                          <h3
                            className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug"
                            title={conv.title}
                          >
                            {conv.title}
                          </h3>
                          <button
                            onClick={(e) => handleStartRename(conv, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition-opacity shrink-0 ml-1"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Message Count & Continue Action */}
                  <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 px-2.5 py-1 rounded-full">
                      {conv.message_count ? `${conv.message_count} messages` : "Active thread"}
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        to={`/analytics/${conv.dataset_id}?c=${conv.id}`}
                        className="flex items-center space-x-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs py-1.5 px-3 rounded-xl border border-blue-200/50 dark:border-blue-800/40 transition-colors"
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Select Dataset for New Chat */}
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start New Chat</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose which dataset to query</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Select Dataset
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {datasets.map((d) => {
                    const isSelected = selectedDatasetForNewChat === d.id;
                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDatasetForNewChat(d.id)}
                        className={`p-3 rounded-2xl border cursor-pointer text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-200 font-bold"
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <Database className={`w-4 h-4 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          {d.row_count?.toLocaleString()} rows
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedDatasetForNewChat}
                  onClick={() => {
                    setShowNewChatModal(false);
                    navigate(`/analytics/${selectedDatasetForNewChat}`);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
                >
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
