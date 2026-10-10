import React, { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink
} from "lucide-react";

export const DataSourcesSettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New source form
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("sqlite");
  const [dbPath, setDbPath] = useState("./storage/demo.sqlite");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadSources = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const list = await api.dataSources.list(currentWorkspace.id);
      setSources(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [currentWorkspace]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.dataSources.test(sourceType, { database_path: dbPath });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !sourceName) return;
    try {
      await api.dataSources.create({
        workspace_id: currentWorkspace.id,
        name: sourceName,
        source_type: sourceType,
        connection_config: { database_path: dbPath },
      });
      setSourceName("");
      setTestResult(null);
      await loadSources();
    } catch (err: any) {
      alert("Failed to add connector: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this data source?")) return;
    try {
      await api.dataSources.delete(id);
      await loadSources();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            External Data Connectors
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect production SQL databases, data warehouses, or external stores directly into Autoanalytix
          </p>
        </div>

        {/* Existing sources */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4 transition-colors">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connected Sources</h3>
          {loading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Database className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No external data sources configured</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Use the form below to connect an external SQL database.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sources.map((s) => (
                <div key={s.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs uppercase">
                      {s.source_type}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                        Path: {s.connection_config?.database_path}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Connector Form */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5 transition-colors">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add External Database Connector</h3>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Connector Name</label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Production Read Replica"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="sqlite" className="dark:bg-slate-900">SQLite Database / File</option>
                  <option value="postgresql" disabled className="dark:bg-slate-900">PostgreSQL (Requires Postgres credentials)</option>
                  <option value="mysql" disabled className="dark:bg-slate-900">MySQL (Coming Soon)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Database File Path / URI</label>
              <input
                type="text"
                required
                value={dbPath}
                onChange={(e) => setDbPath(e.target.value)}
                placeholder="./storage/database.sqlite"
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center space-x-2.5 ${
                  testResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>

              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors"
              >
                Save Connector
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
