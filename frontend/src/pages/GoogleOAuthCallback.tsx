import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../stores/useAuthStore";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export const GoogleOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        setStatus("error");
        setErrorMessage("Missing authorization code from Google.");
        return;
      }

      const workspaceId = currentWorkspace?.id || state || "";
      if (!workspaceId) {
        setStatus("error");
        setErrorMessage("No active workspace found to link Google account.");
        return;
      }

      try {
        await api.googleWorkspace.callback({
          workspace_id: workspaceId,
          code,
          state: state || "",
          redirect_uri: window.location.origin + window.location.pathname,
        });

        setStatus("success");
        setTimeout(() => {
          navigate("/settings/data-sources?tab=google");
        }, 1200);
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "Failed to finalize Google Workspace authorization.");
      }
    };

    handleCallback();
  }, [searchParams, currentWorkspace]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connecting Google Workspace</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Securing tokens and encrypting credentials into your workspace vault...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Google Workspace Connected!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google Docs, Sheets, and Drive are now linked to your workspace. Redirecting...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connection Failed</h2>
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate("/settings/data-sources")}
              className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
};
