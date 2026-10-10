import React, { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Plus
} from "lucide-react";

interface AIConfig {
  id: string;
  provider: string;
  model_name: string;
  masked_key: string;
  is_default: boolean;
  connection_status: string;
  last_tested_at?: string;
  custom_endpoint?: string;
}

export const AIProvidersSettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State for new / edit configuration
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const [provList, confList] = await Promise.all([
        api.ai.getProviders(),
        api.ai.getConfigurations(currentWorkspace.id),
      ]);
      setProviders(provList);
      setConfigs(confList);

      if (confList.length === 0) {
        setIsDefault(true);
      }
    } catch (err: any) {
      console.error("Failed to load AI configurations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  // Update model choices when provider changes
  const currentProviderObj = providers.find((p) => p.id === selectedProvider);
  useEffect(() => {
    if (currentProviderObj && currentProviderObj.models.length > 0) {
      setModelName(currentProviderObj.models[0]);
    }
  }, [selectedProvider, providers]);

  const handleTestAdhoc = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: "Please enter an API key to test." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.ai.testAdhoc({
        provider: selectedProvider,
        model_name: modelName,
        api_key: apiKey,
        custom_endpoint: customEndpoint || undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection failed." });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !apiKey) return;
    setSaving(true);
    try {
      await api.ai.saveConfiguration({
        workspace_id: currentWorkspace.id,
        provider: selectedProvider,
        model_name: modelName,
        api_key: apiKey,
        custom_endpoint: customEndpoint || undefined,
        is_default: isDefault,
      });
      setApiKey("");
      setTestResult(null);
      await loadData();
      alert("AI Provider configured successfully!");
    } catch (err: any) {
      alert("Failed to save configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestExisting = async (id: string) => {
    try {
      const res = await api.ai.testExisting(id);
      alert(`Test ${res.success ? "Passed" : "Failed"}: ${res.message} ${res.latency_ms ? `(${res.latency_ms}ms)` : ""}`);
      await loadData();
    } catch (err: any) {
      alert("Test failed: " + err.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.ai.setDefaultConfiguration(id);
      await loadData();
    } catch (err: any) {
      alert("Failed to set default: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider configuration? All associated keys will be permanently purged.")) return;
    try {
      await api.ai.deleteConfiguration(id);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete configuration: " + err.message);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Onboarding Notice Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/70 border border-blue-200 dark:border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Bring Your Own Key (BYOK) Architecture
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                Connect your own AI provider and API key to enable natural-language analytics and automated dashboard generation.
                Your AI usage is billed directly by your selected provider. Autoanalytix never marks up token costs or uses developer-owned keys.
                Credentials are encrypted at rest using AES-GCM and never exposed to the browser.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Get Google Gemini Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Get Groq Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Get OpenRouter Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Get OpenAI Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Get Anthropic Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Existing Configurations Table */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Configured AI Providers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active models available for natural language queries</p>
            </div>
          </div>

          {loading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <KeyRound className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No AI provider configured yet</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Configure Groq, Gemini, OpenRouter, OpenAI, or Claude below to activate natural-language analytics.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {configs.map((conf) => (
                <div key={conf.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xs text-slate-700 dark:text-slate-300 uppercase">
                      {conf.provider.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">{conf.provider}</span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                          {conf.model_name}
                        </span>
                        {conf.is_default && (
                          <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center space-x-3">
                        <span>API Key: <code className="text-slate-600 dark:text-slate-400">{conf.masked_key}</code></span>
                        <span>•</span>
                        <span className={conf.connection_status === "connected" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                          Status: {conf.connection_status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestExisting(conf.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Test</span>
                    </button>
                    {!conf.is_default && (
                      <button
                        onClick={() => handleSetDefault(conf.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(conf.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / Update Provider Form */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6 transition-colors">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-blue-500" />
              <span>Add New AI Provider Configuration</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enter your API key and choose an inference model</p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="groq">Groq (Ultra-Fast Llama & DeepSeek)</option>
                  <option value="openrouter">OpenRouter (Unified Multi-Model)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Model</label>
                <div className="space-y-2">
                  <select
                    value={currentProviderObj?.models.includes(modelName) ? modelName : "custom"}
                    onChange={(e) => {
                      if (e.target.value !== "custom") {
                        setModelName(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    {currentProviderObj?.models.map((m: string) => (
                      <option key={m} value={m} className="dark:bg-slate-900">
                        {m}
                      </option>
                    ))}
                    <option value="custom" className="dark:bg-slate-900">-- Custom Model Identifier --</option>
                  </select>
                  {(!currentProviderObj?.models.includes(modelName) || modelName === "") && (
                    <input
                      type="text"
                      placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">API Key</label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your secret API key (e.g., AIzaSy... or gsk_... or sk-...)"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Your key will be encrypted immediately using authenticated AES-GCM and stored securely.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="default_checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500"
              />
              <label htmlFor="default_checkbox" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Set as default provider for natural-language analytics
              </label>
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
                <span>
                  {testResult.message}
                  {testResult.latency_ms && ` (Latency: ${testResult.latency_ms} ms)`}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleTestAdhoc}
                disabled={testing || !apiKey}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {testing ? "Testing connection..." : "Test Connection"}
              </button>

              <button
                type="submit"
                disabled={saving || !apiKey}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
