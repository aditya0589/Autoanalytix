import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Layers,
  KeyRound,
  FileSpreadsheet,
  Moon,
  Sun,
  FileText,
  ExternalLink,
  CheckCircle2,
  Lock,
  Cpu,
  TrendingUp,
  Bot,
  Share2,
  Table,
  Check,
  ChevronRight,
  Terminal,
  Globe,
  HelpCircle,
  Play,
  ArrowUpRight,
  Code2,
  FileCheck
} from "lucide-react";
import { useThemeStore } from "../stores/useThemeStore";

export const IntroPage: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<
    "chat" | "workspace" | "ingestion" | "dashboards"
  >("chat");

  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setFaqOpen(faqOpen === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans">
      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Autoanalytix
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v2.0
                </span>
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Capabilities
            </a>
            <a href="#workspace" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
              Google Workspace & MCP
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </a>
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Security & BYOK
            </a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            <Link
              to="/login"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-1.5"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/80 dark:to-indigo-950/80 border border-blue-200/80 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="font-bold">Next-Gen Analytics Engine</span>
            <span className="text-blue-400 dark:text-blue-500">•</span>
            <span>Google Workspace MCP + In-Process DuckDB</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-5xl leading-[1.1] mb-6">
            Ask your business data anything.{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              Grounded in real context.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-3xl mb-10">
            Autoanalytix connects your spreadsheets, Google Sheets, and SQL warehouses to your company strategy in Google Docs. Ask in plain English to execute ultra-fast DuckDB queries, build interactive dashboards, and generate executive-ready reports with zero code.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Free Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm px-6 py-3.5 rounded-xl shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>Explore Preloaded Demo</span>
            </Link>
          </div>

          {/* Ecosystem / Integrations Bar */}
          <div className="w-full max-w-5xl pt-4 pb-12 border-t border-slate-200/80 dark:border-slate-800/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-6">
              Connects seamlessly across your data & intelligence stack
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Google Sheets
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <FileText className="w-4 h-4 text-blue-600" /> Google Docs
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <Database className="w-4 h-4 text-amber-500" /> DuckDB Columnar
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <Sparkles className="w-4 h-4 text-sky-500" /> Google Gemini
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <Bot className="w-4 h-4 text-emerald-500" /> OpenAI & Claude
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <Layers className="w-4 h-4 text-indigo-500" /> PostgreSQL & BigQuery
              </span>
            </div>
          </div>

          {/* Interactive Product Showcase Mockup */}
          <div className="w-full max-w-5xl rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-2xl backdrop-blur-xl overflow-hidden text-left">
            {/* Window titlebar & Tab navigation */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 bg-slate-100/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 ml-2">
                  Autoanalytix Intelligent Workspace
                </span>
              </div>

              {/* Showcase Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveShowcaseTab("chat")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeShowcaseTab === "chat"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Plain-English AI Chat
                </button>
                <button
                  onClick={() => setActiveShowcaseTab("workspace")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeShowcaseTab === "workspace"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Google Workspace & MCP
                </button>
                <button
                  onClick={() => setActiveShowcaseTab("dashboards")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeShowcaseTab === "dashboards"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Interactive Dashboards
                </button>
                <button
                  onClick={() => setActiveShowcaseTab("ingestion")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeShowcaseTab === "ingestion"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Universal Connectors
                </button>
              </div>
            </div>

            {/* Showcase Tab Content */}
            <div className="p-5 sm:p-8">
              {activeShowcaseTab === "chat" && (
                <div className="space-y-6">
                  {/* User query bubble */}
                  <div className="flex items-start space-x-3 max-w-2xl">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                      You
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
                      "Compare our Enterprise ARR performance against Mid-Market in 2026, and tell me if we achieved the target from our Q3 Board Memo."
                    </div>
                  </div>

                  {/* AI Response Card */}
                  <div className="flex items-start space-x-3 w-full">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm p-5 space-y-4 shadow-sm w-full">
                      {/* Agent Reasoning & Tool Calls */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-500" />
                          MCP: read_google_doc("Q3 Board Memo")
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-blue-500" />
                          DuckDB: SELECT segment, SUM(amount) ... (11ms)
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-purple-50 dark:purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3 text-purple-500" />
                          sqlglot AST Validated
                        </span>
                      </div>

                      {/* Mock Chart & KPI Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                            Enterprise ARR
                          </span>
                          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">$2.84M</div>
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            +34.2% YoY (Beat Target)
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                            Mid-Market ARR
                          </span>
                          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">$1.12M</div>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            +18.5% YoY (On Track)
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                            Avg Deal Velocity
                          </span>
                          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">26 Days</div>
                          <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                            -4 days vs target
                          </span>
                        </div>
                      </div>

                      {/* Narrative Insight */}
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <p>
                          <strong className="text-slate-900 dark:text-white">Strategic Summary:</strong> Enterprise revenue expanded to <strong>$2.84M across 48 accounts</strong>, outpacing the $2.5M threshold committed in your <em>Q3 Board Memo</em>. The primary growth driver was expansion in Financial Services and Healthcare tiers.
                        </p>
                        <p>
                          Mid-Market delivered steady growth of <strong>$1.12M</strong>, maintaining a 94.6% gross retention rate. Both segments reflect healthy unit economics with zero unbilled pipeline backlog.
                        </p>
                      </div>

                      {/* Action buttons on insight */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Export to Google Doc
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5" /> Pin to Executive Dashboard
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseTab === "workspace" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Model Context Protocol (MCP) + Google Workspace
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Ground AI in Your Actual Company Knowledge
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Standard BI engines query databases blindly without knowing how your company defines "Active User", "Gross Churn", or "Enterprise Threshold". Autoanalytix connects to your Google Docs to read memos, PRDs, and KPIs before writing a single line of SQL.
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>Paste Any Google Sheet Link:</strong> Zero OAuth friction—pull public or shared sheets directly into DuckDB.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>Bi-Directional Google Docs:</strong> Ingest business definitions + export executive-ready reports with 1 click.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>LangGraph Dynamic MCP Agent:</strong> The agent automatically decides when to consult your Drive docs.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                      <span>google_workspace_agent.py</span>
                      <span className="text-emerald-500">● MCP ACTIVE</span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 space-y-1.5 text-[11px]">
                      <div className="text-blue-500 font-semibold">// 1. Reading Business Strategy Context</div>
                      <div className="text-slate-500 dark:text-slate-400">
                        &gt; tool_call: read_google_doc(doc_id="1Fk_2026_Retention_Strategy")
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-sans">
                        📄 <em>Extracted Strategy: "Target Q3 Net Retention rate &gt; 115%. Churn defined as no active login in 45 days."</em>
                      </div>
                      <div className="text-indigo-500 font-semibold pt-1">// 2. Execution against DuckDB</div>
                      <div className="text-slate-500 dark:text-slate-400">
                        &gt; tool_call: query_duckdb("SELECT account, last_login_date FROM sales WHERE ...")
                      </div>
                      <div className="text-emerald-500 font-semibold pt-1">// 3. Automated Executive Report Draft</div>
                      <div className="text-slate-500 dark:text-slate-400">
                        &gt; tool_call: create_google_doc_report(title="Executive Retention Brief - Q3")
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseTab === "dashboards" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Q3 Executive Revenue & Retention Dashboard</h4>
                      <p className="text-[11px] text-slate-500">Live synchronized with DuckDB & Google Sheets</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> 256-bit Public Link
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-Refreshing
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-500">Total ARR</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">$4,281,400</div>
                      <div className="h-12 w-full bg-blue-100 dark:bg-blue-950/60 rounded-lg flex items-end p-1 gap-1">
                        <div className="w-1/6 bg-blue-600 h-4 rounded-xs"></div>
                        <div className="w-1/6 bg-blue-600 h-6 rounded-xs"></div>
                        <div className="w-1/6 bg-blue-600 h-8 rounded-xs"></div>
                        <div className="w-1/6 bg-blue-600 h-7 rounded-xs"></div>
                        <div className="w-1/6 bg-blue-600 h-10 rounded-xs"></div>
                        <div className="w-1/6 bg-blue-600 h-11 rounded-xs"></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-500">Gross Margin</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">82.4%</div>
                      <div className="h-12 w-full bg-emerald-100 dark:bg-emerald-950/60 rounded-lg flex items-end p-1 gap-1">
                        <div className="w-1/6 bg-emerald-600 h-8 rounded-xs"></div>
                        <div className="w-1/6 bg-emerald-600 h-9 rounded-xs"></div>
                        <div className="w-1/6 bg-emerald-600 h-9 rounded-xs"></div>
                        <div className="w-1/6 bg-emerald-600 h-10 rounded-xs"></div>
                        <div className="w-1/6 bg-emerald-600 h-10 rounded-xs"></div>
                        <div className="w-1/6 bg-emerald-600 h-11 rounded-xs"></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-500">Net Retention Rate</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">118.2%</div>
                      <div className="h-12 w-full bg-indigo-100 dark:bg-indigo-950/60 rounded-lg flex items-end p-1 gap-1">
                        <div className="w-1/6 bg-indigo-600 h-6 rounded-xs"></div>
                        <div className="w-1/6 bg-indigo-600 h-7 rounded-xs"></div>
                        <div className="w-1/6 bg-indigo-600 h-8 rounded-xs"></div>
                        <div className="w-1/6 bg-indigo-600 h-9 rounded-xs"></div>
                        <div className="w-1/6 bg-indigo-600 h-10 rounded-xs"></div>
                        <div className="w-1/6 bg-indigo-600 h-11 rounded-xs"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseTab === "ingestion" && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Connect any data source in seconds. DuckDB parses schemas, profiles distributions, and indexes datasets without external ETL servers.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600 mb-2" />
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Google Sheets</div>
                      <p className="text-[11px] text-slate-500 mt-1">Paste shared link or pick via Google Drive</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <Database className="w-6 h-6 text-blue-600 mb-2" />
                      <div className="text-xs font-bold text-slate-900 dark:text-white">CSV & Excel</div>
                      <p className="text-[11px] text-slate-500 mt-1">Drag-and-drop .csv, .xlsx, .xls with auto-profiling</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <Layers className="w-6 h-6 text-indigo-600 mb-2" />
                      <div className="text-xs font-bold text-slate-900 dark:text-white">PostgreSQL & SQLite</div>
                      <p className="text-[11px] text-slate-500 mt-1">Direct read-only credentials with AST guardrails</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <Globe className="w-6 h-6 text-sky-600 mb-2" />
                      <div className="text-xs font-bold text-slate-900 dark:text-white">BigQuery & Snowflake</div>
                      <p className="text-[11px] text-slate-500 mt-1">Query enterprise cloud warehouses at scale</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Complete Analytical Superpowers
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Engineered for Non-Technical Leaders, Built with Enterprise Rigor
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Eliminate back-and-forth data engineering tickets. Get answers in seconds with mathematical reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Conversational BI in Plain English
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ask "Why did churn spike in June?" or "Which marketing channels have the lowest CAC?". Receive lucid, executive-ready narrative explanations alongside interactive charts.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Google Workspace & MCP Superpowers
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Paste any shared Google Sheet link to ingest rows into DuckDB. Connect Google Docs to infuse strategy and export full analytical briefs directly back into your team's Drive.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Bring Your Own Key (BYOK)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Zero markup on tokens. Hook up Google Gemini, OpenAI, Claude, Groq, or OpenRouter keys. All secrets are secured with authenticated AES-256-GCM encryption at rest.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Strict AST SQL Sandboxing
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Every AI query is validated through <code>sqlglot</code> AST inspection. Only single-statement read-only <code>SELECT</code> queries are allowed. Mutation statements and file access are blocked.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                DuckDB Columnar Speed
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Queries execute in-process over Parquet files in single-digit milliseconds. Handle millions of rows without expensive database clustering or warehouse credit burn.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-3 hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <Share2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Unguessable 256-Bit Public Sharing
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate secure cryptographic links for clients, investors, or board members. Viewers can interact with live charts without needing an account or API key.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deep-Dive: Google Workspace & MCP Section */}
      <section id="workspace" className="py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-8 sm:p-12 md:p-16 border border-indigo-900/50 shadow-2xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span>The Google Workspace MCP Bridge</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Turn Isolated Sheets & Strategic Docs into a Unified Intelligence Engine
              </h2>

              <p className="text-sm sm:text-base text-indigo-100/80 font-normal leading-relaxed">
                Most AI tools guess what numbers mean. Autoanalytix bridges your tabular data (Sheets, DuckDB, Warehouses) with your narrative knowledge (Google Docs strategy memos, PRDs, KPIs).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <div className="text-sm font-bold">1. Shared Link Ingest</div>
                  <p className="text-[11px] text-slate-300">
                    Paste any viewable Google Sheet link. Autoanalytix extracts tabs and streams them into isolated DuckDB tables.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div className="text-sm font-bold">2. Strategy Grounding</div>
                  <p className="text-[11px] text-slate-300">
                    Agent searches your company Google Docs to verify goal definitions, quarterly OKRs, and business rules.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2">
                  <FileCheck className="w-5 h-5 text-indigo-400" />
                  <div className="text-sm font-bold">3. One-Click Doc Briefs</div>
                  <p className="text-[11px] text-slate-300">
                    Export polished executive briefings directly into a formatted Google Doc with structured tables and recommendations.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  <span>Connect Google Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-xs text-indigo-200">
                  Zero setup required for shared links. Full OAuth supported for private Drive files.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Streamlined 3-Step Flow
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              From Raw Data to Executive Clarity in Under 60 Seconds
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Ingest Your Data Source
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Upload a CSV, Excel workbook, paste a Google Sheet link, or configure PostgreSQL/BigQuery. Autoanalytix automatically infers schemas, null rates, and statistical distributions.
              </p>
              <div className="text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                DuckDB Table Created: <span className="text-blue-500">ds_sales_2026</span> (1,200 rows, 14 cols)
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
                2
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Ask Questions in Natural Language
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ask analytical questions as you would to a senior data scientist. The LangGraph agent formulates single-statement read-only SQL, validates AST safety, and runs queries in milliseconds.
              </p>
              <div className="text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                Agent: Plan &rarr; SQLGen &rarr; AST Check &rarr; Execute &rarr; Explain
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/20">
                3
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Visualize, Assemble & Export
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Interact with generated charts (Bar, Line, Area, Pie, KPI, Table). Pin insights to customizable executive dashboards or export directly into a formatted Google Doc report.
              </p>
              <div className="text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                Export Options: Recharts Interactive &bull; Google Docs &bull; 256-bit Public Link
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Architectural Guarantees Section */}
      <section id="security" className="py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Enterprise Trust & Safeguards
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Your Secrets Stay Yours. Your Data Stays Isolated.
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Engineered with strict zero-trust foundations so your proprietary business data never leaks or risks mutation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">AES-256-GCM Encryption</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                API keys and OAuth tokens are encrypted at rest with authenticated AES-GCM. Decryption occurs strictly in-memory.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Strict Read-Only SQL AST</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Queries pass through <code>sqlglot</code> AST validation. All write statements (INSERT, DROP, ALTER) and file system reads are blocked.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">In-Memory DuckDB Isolation</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Workspaces are strictly compartmentalized with deterministic table names, query timeouts, and memory quotas.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Share2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Redacted Public Sharing</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Public viewers only see compiled chart metrics. Raw database schemas, tokens, and internal metadata are completely redacted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Frequently Asked Questions
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Everything You Need to Know
            </h3>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Do I need to know SQL or Python to use Autoanalytix?",
                a: "No! Autoanalytix is explicitly engineered for non-technical business leaders, founders, finance executives, and product managers. You ask in normal conversational English, and our LangGraph agent generates, validates, and runs the DuckDB SQL automatically."
              },
              {
                q: "How does the Google Sheets integration work? Do I need Google Cloud Console?",
                a: "No Google Cloud setup is required! If your Google Sheet is set to 'Anyone with the link can view', you simply paste the URL, and Autoanalytix extracts the tabs directly into DuckDB. If you prefer to connect private enterprise Drive sheets, you can optionally authenticate via Google OAuth in 1 click."
              },
              {
                q: "How does Google Docs context grounding work?",
                a: "Through our Model Context Protocol (MCP) bridge, the LangGraph AI agent can read strategy briefs, PRDs, KPI definitions, and board memos stored in Google Docs. When you ask questions like 'did we hit our target retention rate?', the agent reads the target from the doc and compares it against live data."
              },
              {
                q: "What AI providers can I use with Bring Your Own Key (BYOK)?",
                a: "You can use Google Gemini (Gemini 2.5 Flash / Pro, 1.5 Pro), OpenAI (GPT-4o, GPT-4o-mini), Anthropic Claude (Claude 3.5 Sonnet), Groq (Llama 3.3 70B), or OpenRouter. You pay zero inference markup to us—tokens are billed directly to your own provider account."
              },
              {
                q: "Can I share dashboards with teammates or clients who don't have an account?",
                a: "Yes. Every dashboard can generate a 256-bit cryptographically unguessable public share link. Stakeholders can view and interact with charts without logging in, and you can revoke the link at any moment."
              }
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      faqOpen === idx ? "rotate-90 text-blue-600" : ""
                    }`}
                  />
                </button>
                {faqOpen === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 border-t border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Ready to turn business numbers into decisions in seconds?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Create your free workspace in seconds. Upload a CSV, paste a Google Sheet, or explore our built-in B2B SaaS demo dataset with zero setup.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm px-8 py-4 rounded-xl shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm px-7 py-4 rounded-xl shadow-xs transition-colors"
            >
              <span>Sign In to Existing Workspace</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 py-10 bg-white/70 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Autoanalytix
            </span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span>AI-Native Business Intelligence Platform</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-medium">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#workspace" className="hover:text-blue-600 transition-colors">Google Workspace MCP</a>
            <a href="#security" className="hover:text-blue-600 transition-colors">Security</a>
            <Link to="/login" className="hover:text-blue-600 transition-colors">Login</Link>
            <Link to="/register" className="hover:text-blue-600 transition-colors">Register</Link>
          </div>

          <div>
            © 2026 Autoanalytix Inc. Engineered for non-technical business clarity.
          </div>
        </div>
      </footer>
    </div>
  );
};
