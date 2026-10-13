import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import { ChartRenderer } from "../components/ChartRenderer";
import {
  Send,
  Sparkles,
  Database,
  KeyRound,
  ExternalLink,
  Code2,
  Clock,
  PlusSquare,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HelpCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  History,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  FileText
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: any;
  clarification_options?: string[];
}

interface ConversationItem {
  id: string;
  title: string;
  dataset_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export const AnalyticsWorkspace: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useAuthStore();

  const [dataset, setDataset] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);

  // Saved Conversations state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("New Chat");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  // Ref to prevent re-entrant loadConversation calls
  const loadedConvIdRef = useRef<string | null>(null);

  // Renaming state
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSqlId, setExpandedSqlId] = useState<string | null>(null);

  // Add to dashboard modal state
  const [showAddToDashboardModal, setShowAddToDashboardModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [dashboardsList, setDashboardsList] = useState<any[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState("");
  const [newDashboardTitle, setNewDashboardTitle] = useState("");
  const [addingToDashboard, setAddingToDashboard] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);
  const [exportedDocResult, setExportedDocResult] = useState<{ url: string; title: string } | null>(null);

  const handleExportToGoogleDoc = async (analysis: any) => {
    if (!currentWorkspace) return;
    try {
      setExportingDoc(true);
      const title = analysis?.chart_spec?.title || (dataset?.name ? `${dataset.name} Analysis Briefing` : "Autoanalytix Executive Report");
      const res = await api.googleWorkspace.exportDoc({
        workspace_id: currentWorkspace.id,
        title,
        analysis_id: analysis.id,
        executive_summary: analysis.explanation,
        include_tables: true,
        include_sql: true,
      });
      setExportedDocResult({ url: res.document_url, title: res.title });
    } catch (err: any) {
      alert("Failed to export to Google Docs: " + err.message);
    } finally {
      setExportingDoc(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load dataset metadata, AI configs, and dashboards
  useEffect(() => {
    if (!datasetId || !currentWorkspace) return;
    Promise.all([
      api.datasets.get(datasetId),
      api.datasets.profile(datasetId),
      api.ai.getConfigurations(currentWorkspace.id),
      api.dashboards.list(currentWorkspace.id),
    ]).then(([ds, prof, configs, dbs]) => {
      setDataset(ds);
      setProfile(prof);
      setAiConfigs(configs);
      setDashboardsList(dbs);
      if (dbs.length > 0) setSelectedDashboardId(dbs[0].id);
    });
  }, [datasetId, currentWorkspace]);

  // Load conversation list for this dataset
  const loadConversations = async () => {
    const wsId = currentWorkspace?.id || dataset?.workspace_id;
    if (!wsId || !datasetId) return;
    try {
      setLoadingHistory(true);
      const list = await api.conversations.list(wsId, datasetId);
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentWorkspace, dataset, datasetId]);

  // Load a specific conversation by ID
  const loadConversation = async (id: string) => {
    try {
      setLoading(true);
      loadedConvIdRef.current = id;
      const conv = await api.conversations.get(id);
      setConversationId(conv.id);
      setActiveTitle(conv.title || "Untitled Analysis");
      setSearchParams({ c: conv.id });

      const loadedMessages: ChatMessage[] = (conv.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        analysis: m.analysis,
        clarification_options: m.clarification_options,
      }));
      setMessages(loadedMessages);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setLoading(false);
    }
  };

  // If conversation ID is passed in URL query param ?c=..., load it on mount
  useEffect(() => {
    const targetConvId = searchParams.get("c") || searchParams.get("conversation_id");
    if (targetConvId && targetConvId !== loadedConvIdRef.current) {
      loadConversation(targetConvId);
    }
  }, [searchParams]);

  // If initial prompt is passed via ?q=... (e.g. from home page), handle it
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !inputQuestion && messages.length === 0 && !conversationId) {
      handleAsk(q);
    }
  }, [searchParams, dataset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const activeAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];

  const handleNewChat = () => {
    setConversationId(null);
    loadedConvIdRef.current = null;
    setActiveTitle("New Chat");
    setMessages([]);
    setSearchParams({});
    inputRef.current?.focus();
  };

  const handleAsk = async (questionToAsk: string) => {
    if (!questionToAsk.trim() || !datasetId || !currentWorkspace) return;

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: questionToAsk,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setLoading(true);

    try {
      const res = await api.analytics.query({
        workspace_id: currentWorkspace.id,
        dataset_id: datasetId,
        question: questionToAsk,
        conversation_id: conversationId || undefined,
      });

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
        loadedConvIdRef.current = res.conversation_id;
        setSearchParams({ c: res.conversation_id });
        const convTitle = activeTitle && activeTitle !== "New Chat" ? activeTitle : questionToAsk.slice(0, 45);
        if (!conversationId) {
          setActiveTitle(convTitle);
        }

        // Optimistically update conversation history so it shows up in sidebar immediately
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === res.conversation_id);
          if (existing) {
            return [
              { ...existing, updated_at: new Date().toISOString(), message_count: (existing.message_count || 0) + 2 },
              ...prev.filter((c) => c.id !== res.conversation_id),
            ];
          }
          const newItem: ConversationItem = {
            id: res.conversation_id,
            title: convTitle,
            dataset_id: datasetId,
            workspace_id: currentWorkspace?.id || dataset?.workspace_id || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 2,
          };
          return [newItem, ...prev];
        });

        // Re-sync with server
        loadConversations();
      }

      const assistantMsg: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: res.explanation || res.insights?.join("\n") || res.question,
        analysis: res,
        clarification_options: res.clarification_options,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const isNoAi = err.code === "NO_AI_PROVIDER" || err.message?.includes("Connect your own AI provider");
      const assistantMsg: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: isNoAi
          ? "NO_AI_PROVIDER"
          : `We encountered an issue processing your request: ${err.message || "Unknown error"}. Try rephrasing or verify your BYOK AI provider status.`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

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
      if (conversationId === id) {
        setActiveTitle(editingTitle.trim());
      }
      setEditingConvId(null);
      await loadConversations();
    } catch (err: any) {
      alert("Failed to rename conversation: " + err.message);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat history? This cannot be undone.")) return;
    try {
      await api.conversations.delete(id);
      if (conversationId === id) {
        handleNewChat();
      }
      await loadConversations();
    } catch (err: any) {
      alert("Failed to delete conversation: " + err.message);
    }
  };

  const handleOpenAddToDashboard = (analysis: any) => {
    setSelectedAnalysis(analysis);
    setShowAddToDashboardModal(true);
  };

  const handleConfirmAddToDashboard = async () => {
    if (!selectedAnalysis || !currentWorkspace) return;
    setAddingToDashboard(true);
    try {
      let targetDashboardId = selectedDashboardId;

      if (!targetDashboardId) {
        if (!newDashboardTitle.trim()) {
          alert("Please provide a title for the new dashboard.");
          return;
        }
        const newDb = await api.dashboards.create({
          workspace_id: currentWorkspace.id,
          title: newDashboardTitle,
        });
        targetDashboardId = newDb.id;
      }

      await api.dashboards.addItem(targetDashboardId, {
        title: selectedAnalysis.question || "Analysis Visualization",
        widget_type: selectedAnalysis.chart_spec?.type || "bar",
        grid_pos: { x: 0, y: 0, w: 6, h: 4 },
        query_sql: selectedAnalysis.generated_sql,
        chart_spec: selectedAnalysis.chart_spec,
      });

      setShowAddToDashboardModal(false);
      alert("Chart added to dashboard!");
    } catch (err: any) {
      alert("Failed to add widget: " + err.message);
    } finally {
      setAddingToDashboard(false);
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

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col">
        {/* Workspace Subheader */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={showSidebar ? "Hide Chat History" : "Show Chat History"}
            >
              {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <Link
                to={`/datasets/${dataset?.id}`}
                className="text-xs font-bold text-slate-900 dark:text-white hover:underline truncate max-w-[200px]"
              >
                {dataset?.name || "Dataset"}
              </Link>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
                ({dataset?.duckdb_table_name})
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700">/</span>

            <div className="flex items-center space-x-1.5 max-w-[280px] truncate">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {activeTitle}
              </span>
              {conversationId && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40">
                  Saved
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {activeAi ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40 px-3 py-1 rounded-full flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Model:</span>
                <span>{activeAi.provider.toUpperCase()} ({activeAi.model_name?.split("/").pop()})</span>
              </span>
            ) : (
              <Link
                to="/settings/ai-providers"
                className="text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/60 dark:border-amber-800/60 px-3 py-1 rounded-full flex items-center space-x-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Configure AI Key</span>
              </Link>
            )}
          </div>
        </div>

        {/* Main Content Area: Sidebar + Chat Thread */}
        <div className="flex-1 flex overflow-hidden pt-3 gap-4">
          {/* Saved Chats Sidebar */}
          {showSidebar && (
            <aside className="w-72 sm:w-80 shrink-0 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shadow-xs transition-colors">
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                {/* New Chat Button */}
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-2xl shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Chat</span>
                </button>

                {/* Search Bar for History */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search saved chats..."
                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1 flex items-center justify-between">
                    <span>Chat History</span>
                    <span>{conversations.length}</span>
                  </div>

                  {loadingHistory && conversations.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
                      Loading history...
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 space-y-2">
                      <History className="w-6 h-6 mx-auto opacity-40" />
                      <p className="text-[11px]">
                        {historySearch ? "No chats matching query" : "No saved chats for this dataset yet"}
                      </p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isActive = conversationId === conv.id;
                      const isEditing = editingConvId === conv.id;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => !isEditing && loadConversation(conv.id)}
                          className={`group relative flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer text-xs transition-all ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/60 dark:border-blue-800/60 shadow-2xs"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate mr-2 flex-1">
                            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                            
                            {isEditing ? (
                              <form onSubmit={(e) => handleSaveRename(conv.id, e)} className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                                />
                                <button type="submit" className="p-1 text-emerald-600 hover:text-emerald-700">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingConvId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            ) : (
                              <div className="truncate">
                                <span className="truncate block" title={conv.title}>{conv.title}</span>
                                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 block">
                                  {conv.message_count ? `${conv.message_count} msgs • ` : ""}{formatRelativeTime(conv.updated_at || conv.created_at)}
                                </span>
                              </div>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={(e) => handleStartRename(conv, e)}
                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                                title="Rename Chat"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                                title="Delete Chat"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sidebar Footer Info */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Auto-saved to DuckDB</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            </aside>
          )}

          {/* Chat Thread Container */}
          <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 overflow-hidden transition-colors">
            {/* Scrollable Messages Thread */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Ask Your Data Anything</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Type questions in plain English. Your configured AI agent translates them into validated DuckDB SQL and generates live charts and narrative summaries. Chats are automatically saved and resumeable.
                    </p>
                  </div>

                  {/* Suggested Questions Pills */}
                  {profile?.suggested_questions?.length > 0 && (
                    <div className="pt-2 max-w-lg w-full space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Suggested analytical queries
                      </span>
                      <div className="flex flex-col gap-2">
                        {profile.suggested_questions.map((q: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleAsk(q)}
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-left transition-colors flex items-center justify-between group"
                          >
                            <span>{q}</span>
                            <Sparkles className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((m) => {
                  if (m.role === "user") {
                    return (
                      <div key={m.id} className="flex justify-end">
                        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 text-xs font-medium shadow-sm max-w-xl">
                          {m.content}
                        </div>
                      </div>
                    );
                  }

                  // Special handling for missing AI provider error
                  if (m.content === "NO_AI_PROVIDER") {
                    return (
                      <div key={m.id} className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 space-y-3 max-w-xl">
                        <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Configure Your AI Provider (BYOK)</span>
                        </div>
                        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                          Connect your own AI provider and API key to use natural-language analytics. Your AI usage is billed directly by your selected provider.
                        </p>
                        <Link
                          to="/settings/ai-providers"
                          className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Open AI Settings</span>
                        </Link>
                      </div>
                    );
                  }

                  // Assistant message with chart & insights
                  return (
                    <div key={m.id} className="flex flex-col space-y-4 max-w-3xl">
                      {/* Clarification prompt if intent was ambiguous */}
                      {m.clarification_options && m.clarification_options.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{m.content}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {m.clarification_options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                onClick={() => handleAsk(opt)}
                                className="text-xs bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 font-medium px-3 py-1.5 rounded-xl transition-colors"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plain-Language Textual Explanation */}
                      {m.content && m.content !== "NO_AI_PROVIDER" && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2 transition-colors">
                          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-semibold text-xs">
                            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Executive Summary & Explanation</span>
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                            {m.content}
                          </div>
                        </div>
                      )}

                      {/* Render Visual Chart if available (omit when overview/describe query) */}
                      {m.analysis?.chart_spec && m.analysis.chart_spec.type !== "table" && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                          <ChartRenderer spec={m.analysis.chart_spec} height={300} />
                        </div>
                      )}

                      {/* Grounded Insights Box */}
                      {m.analysis?.insights && m.analysis.insights.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Calculated Business Insights
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                            {m.analysis.insights.map((ins: string, iIdx: number) => (
                              <li key={iIdx} className="flex items-start space-x-2">
                                <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                                <span>{ins}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions Bar: Add to Dashboard & SQL Inspector */}
                      {m.analysis && (
                        <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <button
                            onClick={() => handleOpenAddToDashboard(m.analysis)}
                            className="inline-flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <PlusSquare className="w-3.5 h-3.5" />
                            <span>Add to Dashboard</span>
                          </button>

                          <button
                            onClick={() => handleExportToGoogleDoc(m.analysis)}
                            disabled={exportingDoc}
                            className="inline-flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold bg-emerald-50/80 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl transition-colors"
                            title="Export analysis, KPI table, and SQL query to a formatted Google Doc"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{exportingDoc ? "Exporting..." : "Export to Google Doc"}</span>
                          </button>

                          {m.analysis.generated_sql && (
                            <button
                              onClick={() => setExpandedSqlId(expandedSqlId === m.id ? null : m.id)}
                              className="inline-flex items-center space-x-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>View SQL</span>
                              {expandedSqlId === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}

                          {m.analysis.execution_time_ms !== undefined && (
                            <span className="inline-flex items-center space-x-1 text-slate-400 dark:text-slate-500">
                              <Clock className="w-3 h-3" />
                              <span>{m.analysis.execution_time_ms} ms</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Collapsible SQL Query Inspector */}
                      {expandedSqlId === m.id && m.analysis?.generated_sql && (
                        <div className="bg-slate-900 dark:bg-slate-950 border border-slate-800 text-slate-200 rounded-2xl p-4 text-xs font-mono overflow-x-auto shadow-inner">
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Executed DuckDB SQL</div>
                          <code>{m.analysis.generated_sql}</code>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {loading && (
                <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500 py-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span>Analyzing intent, executing query in DuckDB, and synthesizing insights...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="pt-3 shrink-0 border-t border-slate-100 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk(inputQuestion);
                }}
                className="flex items-center space-x-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder={
                    conversationId
                      ? `Continue this analysis in plain English (e.g. 'Now breakdown by region', 'Filter for 2026')...`
                      : `Ask anything about ${dataset?.name || "your data"}...`
                  }
                  className="flex-1 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={loading || !inputQuestion.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-3.5 rounded-2xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-40"
                >
                  <span>Ask</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex items-center justify-between px-2 pt-1.5 text-[10.5px] text-slate-400">
                <span>💡 Tip: Paste any public Google Sheet or Doc link to ask questions or extract insights directly.</span>
              </div>
            </div>
          </main>
        </div>

        {/* Add to Dashboard Modal */}
        {showAddToDashboardModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Visualization to Dashboard</h3>
                <button
                  onClick={() => setShowAddToDashboardModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Existing Dashboard</label>
                  <select
                    value={selectedDashboardId}
                    onChange={(e) => setSelectedDashboardId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="" className="dark:bg-slate-900">-- Create a new dashboard instead --</option>
                    {dashboardsList.map((db) => (
                      <option key={db.id} value={db.id} className="dark:bg-slate-900">
                        {db.title}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedDashboardId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New Dashboard Title</label>
                    <input
                      type="text"
                      value={newDashboardTitle}
                      onChange={(e) => setNewDashboardTitle(e.target.value)}
                      placeholder="e.g. Executive Sales Overview"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddToDashboardModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAddToDashboard}
                    disabled={addingToDashboard}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md disabled:opacity-50"
                  >
                    {addingToDashboard ? "Adding..." : "Add Widget"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exported Google Doc Modal */}
        {exportedDocResult && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Google Doc Report Created!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your executive briefing, KPI tables, and validated DuckDB SQL have been formatted into Google Docs.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {exportedDocResult.title}
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={() => setExportedDocResult(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Close
                </button>
                <a
                  href={exportedDocResult.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setExportedDocResult(null)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-colors"
                >
                  <span>Open in Google Docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
