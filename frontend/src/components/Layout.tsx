import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  BarChart2,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  KeyRound,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Menu,
  X,
  Sparkles,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useThemeStore } from "../stores/useThemeStore";
import { api } from "../services/api";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Overview", path: "/dashboard", icon: LayoutDashboard, color: "indigo" },
  { label: "Chats", path: "/chats", icon: MessageSquare, color: "blue" },
  { label: "Datasets", path: "/datasets", icon: Database, color: "emerald" },
  { label: "Dashboards", path: "/dashboards", icon: BarChart2, color: "purple" },
  { label: "AI Providers", path: "/settings/ai-providers", icon: KeyRound, color: "amber" },
  { label: "Data Sources", path: "/settings/data-sources", icon: Layers, color: "rose" },
];

const colorMap: Record<string, { active: string; icon: string; dot: string }> = {
  indigo: {
    active: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-500",
    icon: "text-indigo-500 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  blue: {
    active: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500",
    icon: "text-blue-500 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  emerald: {
    active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500",
    icon: "text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  purple: {
    active: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-l-2 border-purple-500",
    icon: "text-purple-500 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  amber: {
    active: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-l-2 border-amber-500",
    icon: "text-amber-500 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  rose: {
    active: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-l-2 border-rose-500",
    icon: "text-rose-500 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, workspaces, currentWorkspace, setCurrentWorkspace, logout } = useAuthStore();
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isDark, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (currentWorkspace) {
      api.ai
        .getConfigurations(currentWorkspace.id)
        .then((configs) => setAiConfigs(configs))
        .catch(() => setAiConfigs([]));
    }
  }, [currentWorkspace, location.pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const defaultAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];

  const handleLoadDemo = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingDemo(true);
      const dataset = await api.datasets.loadDemo(currentWorkspace.id);
      navigate(`/datasets/${dataset.id}`);
    } catch (err: any) {
      alert("Failed to load demo dataset: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const currentPageLabel =
    navItems.find((n) => location.pathname.startsWith(n.path))?.label || "Workspace";

  const renderSidebar = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-white/[0.05] shrink-0">
        <Link
          to="/dashboard"
          onClick={() => isMobile && setMobileMenuOpen(false)}
          className="flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm shadow-indigo-600/30 group-hover:shadow-indigo-600/50 transition-shadow">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-black text-[15px] tracking-tight text-slate-900 dark:text-white">
              AutoAnalytix
            </span>
            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              v2
            </span>
          </div>
        </Link>
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="btn-ghost p-1.5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      {workspaces.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] shrink-0">
          <div className="relative">
            <select
              value={currentWorkspace?.id || ""}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === e.target.value);
                if (ws) setCurrentWorkspace(ws);
              }}
              className="w-full appearance-none bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-zinc-900">
                  {w.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-1.5 mb-1">
          Navigation
        </div>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          const colors = colorMap[item.color];
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? colors.active
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? colors.icon : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
              />
              <span>{item.label}</span>
              {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${colors.dot} opacity-70`} />}
            </Link>
          );
        })}

        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-1.5 mt-3 mb-1">
          Settings
        </div>
        {navItems.slice(4).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          const colors = colorMap[item.color];
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? colors.active
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? colors.icon : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
              />
              <span>{item.label}</span>
              {item.label === "AI Providers" && (
                <span
                  className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    defaultAi
                      ? "badge-green"
                      : "badge-amber"
                  }`}
                >
                  {defaultAi ? "Active" : "Setup"}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Demo CTA */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-white/[0.05] shrink-0">
        <button
          onClick={handleLoadDemo}
          disabled={loadingDemo}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold py-2.5 px-3 rounded-xl shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse-soft" />
          <span>{loadingDemo ? "Loading Demo..." : "Try Demo Dataset"}</span>
        </button>
      </div>

      {/* User footer */}
      <div className="px-4 pb-4 shrink-0">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group cursor-default">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow-sm">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
              {user?.full_name || "Analyst"}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 bg-white dark:bg-[#0d0d12] border-r border-slate-200 dark:border-white/[0.05] flex-col shrink-0">
        {renderSidebar(false)}
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#0d0d12] border-r border-slate-200 dark:border-white/[0.05] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-spring md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebar(true)}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white dark:bg-[#0d0d12] border-b border-slate-200 dark:border-white/[0.05] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="btn-ghost p-2 -ml-1.5 md:hidden"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                {currentPageLabel}
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                {currentWorkspace?.name || "Workspace"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* AI status pill */}
            <Link
              to="/settings/ai-providers"
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                defaultAi
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                  : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
              }`}
            >
              {defaultAi ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>AI: {defaultAi.provider?.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>Configure AI</span>
                </>
              )}
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all hover:bg-slate-200 dark:hover:bg-white/[0.08]"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Upload CTA */}
            <Link
              to="/datasets"
              className="btn-primary text-xs py-2 px-3 gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Data</span>
              <span className="sm:hidden">Upload</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#09090b] transition-colors duration-200">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
