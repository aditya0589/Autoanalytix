import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
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
  AlertCircle
} from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
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
    { label: "Datasets", path: "/datasets", icon: Database },
    { label: "Dashboards", path: "/dashboards", icon: BarChart2 },
    { label: "AI Providers (BYOK)", path: "/settings/ai-providers", icon: KeyRound, badge: defaultAi ? "Active" : "Setup" },
    { label: "Data Sources", path: "/settings/data-sources", icon: Layers },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <Link to="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-base">
                A
              </div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Autoanalytix</span>
            </Link>
          </div>

          {/* Workspace Switcher */}
          <div className="p-4 border-b border-slate-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
              Workspace
            </div>
            <div className="relative">
              <select
                value={currentWorkspace?.id || ""}
                onChange={(e) => {
                  const ws = workspaces.find((w) => w.id === e.target.value);
                  if (ws) setCurrentWorkspace(ws);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
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
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.badge === "Active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
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
        <div className="p-4 border-t border-slate-100 space-y-3">
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
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-800 truncate">{user?.full_name || "Analyst"}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
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
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              {navItems.find((n) => location.pathname.startsWith(n.path))?.label || "Analytics Workspace"}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* AI Provider Status Pill */}
            <Link
              to="/settings/ai-providers"
              className={`flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                defaultAi
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              }`}
            >
              {defaultAi ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI: {defaultAi.provider.toUpperCase()} ({defaultAi.model_name})</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
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
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
