import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/useAuthStore";
import { Zap } from "lucide-react";

import { IntroPage } from "./pages/IntroPage";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { DashboardHome } from "./pages/DashboardHome";
import { DatasetsPage } from "./pages/DatasetsPage";
import { DatasetDetail } from "./pages/DatasetDetail";
import { AnalyticsWorkspace } from "./pages/AnalyticsWorkspace";
import { DashboardsPage } from "./pages/DashboardsPage";
import { DashboardDetail } from "./pages/DashboardDetail";
import { DashboardEditor } from "./pages/DashboardEditor";
import { AIProvidersSettings } from "./pages/AIProvidersSettings";
import { DataSourcesSettings } from "./pages/DataSourcesSettings";
import { PublicDashboardViewer } from "./pages/PublicDashboardViewer";
import { ChatsPage } from "./pages/ChatsPage";
import { GoogleOAuthCallback } from "./pages/GoogleOAuthCallback";
import { CloudStorageSettings } from "./pages/CloudStorageSettings";

// Premium loading screen
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#09090b] gap-4">
    <div className="relative">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 animate-pulse-soft">
        <Zap className="w-7 h-7 text-white" />
      </div>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 blur-xl opacity-30 animate-pulse" />
    </div>
    {/* Loading bar */}
    <div className="w-48 h-0.5 bg-slate-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full loading-bar" />
    </div>
    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
      Loading workspace…
    </p>
  </div>
);

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    if (localStorage.getItem("autoanalytix_token")) {
      loadUser();
    }
  }, []);

  if (isLoading && localStorage.getItem("autoanalytix_token")) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && !localStorage.getItem("autoanalytix_token")) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<IntroPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/shared/:shareId" element={<PublicDashboardViewer />} />
        <Route path="/integrations/google/callback" element={<GoogleOAuthCallback />} />

        {/* Protected Application Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
        <Route path="/chats" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
        <Route path="/datasets" element={<ProtectedRoute><DatasetsPage /></ProtectedRoute>} />
        <Route path="/datasets/:id" element={<ProtectedRoute><DatasetDetail /></ProtectedRoute>} />
        <Route path="/analytics/:datasetId" element={<ProtectedRoute><AnalyticsWorkspace /></ProtectedRoute>} />
        <Route path="/dashboards" element={<ProtectedRoute><DashboardsPage /></ProtectedRoute>} />
        <Route path="/dashboards/:id" element={<ProtectedRoute><DashboardDetail /></ProtectedRoute>} />
        <Route path="/dashboards/:id/edit" element={<ProtectedRoute><DashboardEditor /></ProtectedRoute>} />
        <Route path="/settings/ai-providers" element={<ProtectedRoute><AIProvidersSettings /></ProtectedRoute>} />
        <Route path="/settings/data-sources" element={<ProtectedRoute><DataSourcesSettings /></ProtectedRoute>} />
        <Route path="/settings/cloud-storage" element={<ProtectedRoute><CloudStorageSettings /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
