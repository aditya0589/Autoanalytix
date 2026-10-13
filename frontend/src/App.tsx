import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/useAuthStore";

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

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    if (localStorage.getItem("autoanalytix_token")) {
      loadUser();
    }
  }, []);

  if (isLoading && localStorage.getItem("autoanalytix_token")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-xs text-slate-400 font-medium">
        Loading workspace...
      </div>
    );
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
        {/* Public Landing & Auth Routes */}
        <Route path="/" element={<IntroPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/shared/:shareId" element={<PublicDashboardViewer />} />
        <Route path="/integrations/google/callback" element={<GoogleOAuthCallback />} />

        {/* Protected Application Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chats"
          element={
            <ProtectedRoute>
              <ChatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/datasets"
          element={
            <ProtectedRoute>
              <DatasetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/datasets/:id"
          element={
            <ProtectedRoute>
              <DatasetDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/:datasetId"
          element={
            <ProtectedRoute>
              <AnalyticsWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboards"
          element={
            <ProtectedRoute>
              <DashboardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboards/:id"
          element={
            <ProtectedRoute>
              <DashboardDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboards/:id/edit"
          element={
            <ProtectedRoute>
              <DashboardEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/ai-providers"
          element={
            <ProtectedRoute>
              <AIProvidersSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/data-sources"
          element={
            <ProtectedRoute>
              <DataSourcesSettings />
            </ProtectedRoute>
          }
        />

        {/* Root Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
