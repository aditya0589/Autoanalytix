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
  Sun,
  Menu,
  X
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      api.ai.getConfigurations(currentWorkspace.id)
        .then((configs) => setAiConfigs(configs))
        .catch(() => setAiConfigs([]));
    }
  }, [currentWorkspace, location.pathname]);

  // Close mobile drawer on route change
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

  const navItems = [
    { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { label: "Chats", path: "/chats", icon: MessageSquare },
    { label: "Datasets", path: "/datasets", icon: Database },
    { label: "Dashboards", path: "/dashboards", icon: BarChart2 },
    { label: "AI Providers (BYOK)", path: "/settings/ai-providers", icon: KeyRound, badge: defaultAi ? "Active" : "Setup" },
    { label: "Data Sources", path: "/settings/data-sources", icon: Layers },
  ];

  const { isDark, toggleTheme } = useThemeStore();

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <Link
            to="/dashboard"
            onClick={() => isMobile && setMobileMenuOpen(false)}
            className="flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-base">
              A
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Autoanalytix</span>
          </Link>

          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                onClick={() => isMobile && setMobileMenuOpen(false)}
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
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between shrink-0 transition-colors duration-200">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col justify-between shadow-2xl transition-transform duration-200 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 transition-colors duration-200">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors shrink-0"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight truncate">
              {navItems.find((n) => location.pathname.startsWith(n.path))?.label || "Analytics Workspace"}
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
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
              className={`hidden sm:flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                defaultAi
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                  : "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
              }`}
            >
              {defaultAi ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate max-w-[150px]">AI: {defaultAi.provider.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Configure AI</span>
                </>
              )}
            </Link>

            <Link
              to="/datasets"
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg shadow-xs transition-colors shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Data</span>
              <span className="sm:hidden">Upload</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};
