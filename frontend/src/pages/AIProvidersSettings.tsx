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
  Plus,
  Zap,
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

const providers = [
  { id: "gemini", label: "Google Gemini", badge: "Recommended", badgeColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "groq", label: "Groq", badge: "Ultra-Fast", badgeColor: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/50", keyUrl: "https://console.groq.com/keys" },
  { id: "openrouter", label: "OpenRouter", badge: "Multi-Model", badgeColor: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50", keyUrl: "https://openrouter.ai/keys" },
  { id: "openai", label: "OpenAI", badge: "", badgeColor: "", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic Claude", badge: "", badgeColor: "", keyUrl: "https://console.anthropic.com/settings/keys" },
];

export const AIProvidersSettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const [provList, confList] = await Promise.all([
        api.ai.getProviders(),
        api.ai.getConfigurations(currentWorkspace.id),
      ]);
      setAvailableProviders(provList);
      setConfigs(confList);
      if (confList.length === 0) setIsDefault(true);
    } catch (err) {
      console.error("Failed to load AI configs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentWorkspace]);

  const currentProviderObj = availableProviders.find((p) => p.id === selectedProvider);
  useEffect(() => {
    if (currentProviderObj?.models?.length > 0) setModelName(currentProviderObj.models[0]);
  }, [selectedProvider, availableProviders]);

  const handleTestAdhoc = async () => {
    if (!apiKey) { setTestResult({ success: false, message: "Please enter an API key to test." }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.ai.testAdhoc({ provider: selectedProvider, model_name: modelName, api_key: apiKey, custom_endpoint: customEndpoint || undefined });
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
      await api.ai.saveConfiguration({ workspace_id: currentWorkspace.id, provider: selectedProvider, model_name: modelName, api_key: apiKey, custom_endpoint: customEndpoint || undefined, is_default: isDefault });
      setApiKey("");
      setTestResult(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestExisting = async (id: string) => {
    try {
      const res = await api.ai.testExisting(id, currentWorkspace?.id);
      alert(`Test ${res.success ? "Passed ✓" : "Failed ✗"}: ${res.message}${res.latency_ms ? ` (${res.latency_ms}ms)` : ""}`);
      await loadData();
    } catch (err: any) {
      alert("Test failed: " + err.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.ai.setDefaultConfiguration(id, currentWorkspace?.id);
      await loadData();
    } catch (err: any) {
      alert("Failed: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provider configuration? All associated keys will be permanently purged.")) return;
    try {
      await api.ai.deleteConfiguration(id, currentWorkspace?.id);
      await loadData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">AI Providers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure your own API keys — BYOK architecture, zero markup
          </p>
        </div>

        {/* BYOK Banner */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Bring Your Own Key (BYOK)</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Connect your own AI provider API key to enable natural-language analytics. Your usage is billed directly by the provider — AutoAnalytix never marks up token costs.
              Keys are encrypted at rest using <strong>AES-GCM</strong> and never exposed to the browser after submission.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              {providers.map((p) => (
                <a key={p.id} href={p.keyUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Get {p.label} Key <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Existing Configurations */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.05]">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Configured Providers</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Active models available for AI queries</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="skeleton w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-48" />
                    <div className="skeleton h-2.5 w-36" />
                  </div>
                  <div className="skeleton h-8 w-20 rounded-xl" />
                </div>
              ))}
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl">
              <KeyRound className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No providers configured</p>
              <p className="text-[12px] text-slate-400 mt-1">Add an API key below to enable AI-powered analytics.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {configs.map((conf) => (
                <div key={conf.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center font-black text-[11px] text-slate-700 dark:text-slate-300 uppercase">
                      {conf.provider.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-900 dark:text-white capitalize">{conf.provider}</span>
                        <code className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-white/[0.06]">
                          {conf.model_name}
                        </code>
                        {conf.is_default && (
                          <span className="text-[10px] font-semibold badge-blue">Default</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="text-slate-400">Key: <code className="text-slate-500 dark:text-slate-400">{conf.masked_key}</code></span>
                        <span className={`font-semibold ${conf.connection_status === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {conf.connection_status === "connected" ? "● Connected" : "○ " + conf.connection_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTestExisting(conf.id)}
                      className="btn-secondary text-xs gap-1.5 py-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Test
                    </button>
                    {!conf.is_default && (
                      <button
                        onClick={() => handleSetDefault(conf.id)}
                        className="btn-ghost text-xs text-indigo-600 dark:text-indigo-400 py-1.5"
                      >
                        Set Default
                      </button>
                    )}
                    <button onClick={() => handleDelete(conf.id)} className="btn-ghost p-1.5 text-slate-300 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Provider Form */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Add Provider Configuration</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Enter your API key and select an inference model</p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Provider selector cards */}
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-2.5">AI Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProvider(p.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                      selectedProvider === p.id
                        ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50"
                        : "border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-bold truncate ${selectedProvider === p.id ? "text-indigo-800 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"}`}>
                        {p.label}
                      </div>
                      {p.badge && (
                        <div className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded border inline-block ${p.badgeColor}`}>
                          {p.badge}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Model</label>
                <div className="space-y-2">
                  <select
                    value={currentProviderObj?.models?.includes(modelName) ? modelName : "custom"}
                    onChange={(e) => { if (e.target.value !== "custom") setModelName(e.target.value); }}
                    className="input text-sm font-mono"
                  >
                    {currentProviderObj?.models?.map((m: string) => (
                      <option key={m} value={m} className="dark:bg-zinc-900">{m}</option>
                    ))}
                    <option value="custom" className="dark:bg-zinc-900">-- Custom model ID --</option>
                  </select>
                  {(!currentProviderObj?.models?.includes(modelName) || modelName === "") && (
                    <input
                      type="text"
                      placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="input text-sm font-mono"
                    />
                  )}
                </div>
              </div>

              {/* Key gets full width */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  API Key
                  {selectedProviderInfo?.keyUrl && (
                    <a href={selectedProviderInfo.keyUrl} target="_blank" rel="noreferrer"
                      className="ml-2 text-indigo-600 dark:text-indigo-400 font-normal hover:underline inline-flex items-center gap-0.5">
                      Get key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your secret key (AIzaSy…, gsk_…, sk-…)"
                  className="input text-sm font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Encrypted at rest with AES-GCM. Never visible after submission.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                id="default_checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              Set as default provider for natural-language analytics
            </label>

            {/* Test result */}
            {testResult && (
              <div className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 border ${
                testResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300"
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{testResult.message}{testResult.latency_ms ? ` (${testResult.latency_ms}ms)` : ""}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3.5 rounded-xl text-sm flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                AI provider configured successfully!
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTestAdhoc}
                disabled={testing || !apiKey}
                className="btn-secondary text-sm gap-2"
              >
                {testing ? (
                  <><span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />Testing…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 text-amber-500" />Test Connection</>
                )}
              </button>

              <button
                type="submit"
                disabled={saving || !apiKey}
                className="btn-primary text-sm gap-2"
              >
                {saving ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />Save Configuration</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
