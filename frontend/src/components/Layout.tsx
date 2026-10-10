import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  BarChart2,
  Sparkles,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  KeyRound,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useThemeStore } from "../stores/useThemeStore";
import { api } from "../services/api";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, workspaces, currentWorkspace, setCurrentWorkspace, logout } = useAuthStore();
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      api.ai.getConfigurations(currentWorkspace.id)
        .then((configs) => setAiConfigs(configs))
        .catch(() => setAiConfigs([]));
    }
  }, [currentWorkspace, location.pathname]);

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

  const navItems = [
    { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { label: "Chats", path: "/chats", icon: MessageSquare },
    { label: "Datasets", path: "/datasets", icon: Database },
    { label: "Dashboards", path: "/dashboards", icon: BarChart2 },
    { label: "AI Providers (BYOK)", path: "/settings/ai-providers", icon: KeyRound, badge: defaultAi ? "Active" : "Setup" },
    { label: "Data Sources", path: "/settings/data-sources", icon: Layers },
  ];

  const { isDark, toggleTheme } = useThemeStore();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 transition-colors duration-200">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
            <Link to="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-base">
                A
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Autoanalytix</span>
            </Link>
          </div>

          {/* Workspace Switcher */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-1">
              Workspace
            </div>
            <div className="relative">
              <select
                value={currentWorkspace?.id || ""}
                onChange={(e) => {
                  const ws = workspaces.find((w) => w.id === e.target.value);
                  if (ws) setCurrentWorkspace(ws);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id} className="dark:bg-slate-900">
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.badge === "Active"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Demo button & User Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <button
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loadingDemo ? "Loading Demo..." : "Try Demo Dataset"}</span>
          </button>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.full_name || "Analyst"}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 transition-colors duration-200">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {navItems.find((n) => location.pathname.startsWith(n.path))?.label || "Analytics Workspace"}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* AI Provider Status Pill */}
            <Link
              to="/settings/ai-providers"
              className={`flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                defaultAi
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                  : "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
              }`}
            >
              {defaultAi ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>AI: {defaultAi.provider.toUpperCase()} ({defaultAi.model_name})</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Configure AI Provider (BYOK)</span>
                </>
              )}
            </Link>

            <Link
              to="/datasets"
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Upload Data</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};
