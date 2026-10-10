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
  AlertCircle
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: any;
  clarification_options?: string[];
}

export const AnalyticsWorkspace: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useAuthStore();

  const [dataset, setDataset] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // If question passed via URL query ?q=..., submit it after initialization
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !inputQuestion && messages.length === 0) {
      handleAsk(q);
    }
  }, [searchParams, dataset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const activeAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];

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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-[calc(100vh-7rem)] flex flex-col justify-between">
        {/* Workspace Subheader */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">{dataset?.name || "Dataset"}</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">({dataset?.duckdb_table_name})</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {activeAi ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40 px-3 py-1 rounded-full flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Model: {activeAi.provider.toUpperCase()} ({activeAi.model_name})</span>
              </span>
            ) : (
              <Link
                to="/settings/ai-providers"
                className="text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/60 dark:border-amber-800/60 px-3 py-1 rounded-full flex items-center space-x-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Configure AI Key to Query</span>
              </Link>
            )}
          </div>
        </div>

        {/* Message Thread Container */}
        <div className="flex-1 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 overflow-y-auto space-y-6 transition-colors my-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ask Your Data Anything</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Type questions in plain English. Your configured AI agent translates them into validated DuckDB SQL and generates live charts and narrative summaries.
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
        <div className="pt-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(inputQuestion);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask anything (e.g. 'Show monthly revenue for 2026', 'Top 5 categories by profit')..."
              className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs px-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder-slate-400"
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
      </div>
    </Layout>
  );
};
