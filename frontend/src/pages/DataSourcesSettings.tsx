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
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">External Data Connectors</h1>
          <p className="text-xs text-slate-500">
            Connect production SQL databases, data warehouses, or external stores directly into Autoanalytix
          </p>
        </div>

        {/* Existing sources */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Connected Sources</h3>
          {loading ? (
            <div className="text-xs text-slate-400 py-6 text-center">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No external data sources configured</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Use the form below to connect an external SQL database.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sources.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                      {s.source_type}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Path: {s.connection_config?.database_path}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Connector Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Add External Database Connector</h3>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Connector Name</label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Production Read Replica"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="sqlite">SQLite Database / File</option>
                  <option value="postgresql" disabled>PostgreSQL (Requires Postgres credentials)</option>
                  <option value="mysql" disabled>MySQL (Coming Soon)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Database File Path / URI</label>
              <input
                type="text"
                required
                value={dbPath}
                onChange={(e) => setDbPath(e.target.value)}
                placeholder="./storage/database.sqlite"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                  testResult.success
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border border-rose-200 text-rose-800"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>

              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
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
