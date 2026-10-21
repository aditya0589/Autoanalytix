import React, { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/useAuthStore";
import { api } from "../services/api";
import {
  Cloud,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Server,
  ArrowRight,
  Database,
  Lock,
  Layers,
  FileCode,
  Zap,
  HardDrive,
  KeyRound,
  Download,
  AlertTriangle,
  Info,
} from "lucide-react";

interface StorageConfig {
  mode: string;
  provider: string;
  external_id: string;
  bucket_name?: string;
  region?: string;
  role_arn?: string;
  prefix?: string;
  kms_key_arn?: string;
  status: string;
  verified: boolean;
  verified_at?: string;
  last_error?: string;
  platform_account_id: string;
  backend_role_arn: string;
  cloudformation_quick_link?: string;
}

interface ProbeStep {
  passed: boolean;
  message: string;
}

interface ProbeResult {
  healthy: boolean;
  verified: boolean;
  provider: string;
  bucket: string;
  region: string;
  role_arn?: string;
  steps: Record<string, ProbeStep>;
  latency_ms: number;
  message: string;
  error?: string;
}

const AWS_REGIONS = [
  { id: "us-east-1", label: "US East (N. Virginia) - us-east-1" },
  { id: "us-east-2", label: "US East (Ohio) - us-east-2" },
  { id: "us-west-1", label: "US West (N. California) - us-west-1" },
  { id: "us-west-2", label: "US West (Oregon) - us-west-2" },
  { id: "eu-west-1", label: "Europe (Ireland) - eu-west-1" },
  { id: "eu-central-1", label: "Europe (Frankfurt) - eu-central-1" },
  { id: "ap-south-1", label: "Asia Pacific (Mumbai) - ap-south-1" },
  { id: "ap-southeast-1", label: "Asia Pacific (Singapore) - ap-southeast-1" },
  { id: "ap-northeast-1", label: "Asia Pacific (Tokyo) - ap-northeast-1" },
];

export const CloudStorageSettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for BYOC
  const [targetProvider, setTargetProvider] = useState<"PLATFORM_DEFAULT" | "AWS_S3">("PLATFORM_DEFAULT");
  const [bucketName, setBucketName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [roleArn, setRoleArn] = useState("");
  const [prefix, setPrefix] = useState("autoanalytix");
  const [kmsKeyArn, setKmsKeyArn] = useState("");

  // Testing & Probe state
  const [testing, setTesting] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string; migrated_count: number } | null>(null);

  // UI helpers
  const [copiedExternalId, setCopiedExternalId] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [cfnTemplate, setCfnTemplate] = useState<any>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [templateFormat, setTemplateFormat] = useState<"json" | "yaml">("json");

  const loadConfig = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const res = await api.cloudStorage.getConfig(currentWorkspace.id);
      setConfig(res);
      setTargetProvider(res.provider === "AWS_S3" ? "AWS_S3" : "PLATFORM_DEFAULT");
      setBucketName(res.bucket_name || "");
      setRegion(res.region || "us-east-1");
      setRoleArn(res.role_arn || "");
      setPrefix(res.prefix || "autoanalytix");
      setKmsKeyArn(res.kms_key_arn || "");
    } catch (err) {
      console.error("Failed to load storage config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [currentWorkspace]);

  const copyToClipboard = (text: string, type: "extId" | "template") => {
    navigator.clipboard.writeText(text);
    if (type === "extId") {
      setCopiedExternalId(true);
      setTimeout(() => setCopiedExternalId(false), 2000);
    } else {
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    }
  };

  const handleTestConnection = async () => {
    if (!currentWorkspace) return;
    if (!bucketName.trim() || !roleArn.trim()) {
      setSaveError("Please provide both Bucket Name and IAM Role ARN before testing.");
      return;
    }

    setSaveError(null);
    setTesting(true);
    setProbeResult(null);

    try {
      const res = await api.cloudStorage.testConnection(currentWorkspace.id, {
        provider: "AWS_S3",
        bucket_name: bucketName.trim(),
        region,
        role_arn: roleArn.trim(),
        prefix: prefix.trim(),
        kms_key_arn: kmsKeyArn.trim() || undefined,
      });
      setProbeResult(res);
    } catch (err: any) {
      setProbeResult({
        healthy: false,
        verified: false,
        provider: "AWS_S3",
        bucket: bucketName,
        region,
        role_arn: roleArn,
        steps: {
          sts_assume_role: { passed: false, message: err.message || "Failed to contact STS" },
        },
        latency_ms: 0,
        message: err.message || "Test failed",
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (targetProvider === "PLATFORM_DEFAULT") {
        const res = await api.cloudStorage.updateConfig(currentWorkspace.id, {
          provider: "PLATFORM_DEFAULT",
        });
        setConfig(res);
        setSaveSuccess(true);
        setProbeResult(null);
      } else {
        if (!bucketName.trim() || !roleArn.trim()) {
          throw new Error("Both Bucket Name and IAM Role ARN are required.");
        }
        const res = await api.cloudStorage.updateConfig(currentWorkspace.id, {
          provider: "AWS_S3",
          bucket_name: bucketName.trim(),
          region,
          role_arn: roleArn.trim(),
          prefix: prefix.trim() || "autoanalytix",
          kms_key_arn: kmsKeyArn.trim() || undefined,
          skip_verification: probeResult?.healthy === true,
        });
        setConfig(res);
        setSaveSuccess(true);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update storage configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!currentWorkspace) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await api.cloudStorage.migrateDatasets(currentWorkspace.id);
      setMigrationResult(res);
    } catch (err: any) {
      setMigrationResult({
        success: false,
        message: err.message || "Dataset migration failed.",
        migrated_count: 0,
      });
    } finally {
      setMigrating(false);
    }
  };

  const openTemplateModal = async () => {
    if (!currentWorkspace) return;
    setShowTemplateModal(true);
    try {
      const tmpl = await api.cloudStorage.getCloudFormationTemplate(
        currentWorkspace.id,
        bucketName || undefined,
        prefix || undefined
      );
      setCfnTemplate(tmpl);
    } catch (err) {
      console.error("Failed to fetch template:", err);
    }
  };

  const isBYOCActive = config?.provider === "AWS_S3" && config?.status === "active";

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                  Cloud Storage & Data Sovereignty
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    BYOC / BYOS
                  </span>
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose where your raw datasets, analytical Parquet files, and caches are stored.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBYOCActive ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>BYOC S3 Active ({config.bucket_name})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-medium">
                <Database className="w-4 h-4 text-indigo-500" />
                <span>Autoanalytix Managed Cloud</span>
              </div>
            )}
          </div>
        </div>

        {/* Dual Mode Card Selector */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Select Storage Mode
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Platform Managed */}
            <div
              onClick={() => setTargetProvider("PLATFORM_DEFAULT")}
              className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                targetProvider === "PLATFORM_DEFAULT"
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md shadow-indigo-600/5"
                  : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      Autoanalytix Managed Cloud
                    </h3>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Standard SaaS (Default)
                    </span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    targetProvider === "PLATFORM_DEFAULT"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  {targetProvider === "PLATFORM_DEFAULT" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3.5 leading-relaxed">
                Zero configuration required. Datasets are stored in Autoanalytix’s central S3 bucket encrypted with AES-256. Perfect for fast onboarding, prototypes, and internal teams.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> Instant 1-Click
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> Encrypted at Rest
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> Storage Included
                </span>
              </div>
            </div>

            {/* Option 2: BYOC / BYOS */}
            <div
              onClick={() => setTargetProvider("AWS_S3")}
              className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                targetProvider === "AWS_S3"
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md shadow-indigo-600/5"
                  : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      Bring Your Own Cloud (BYOC)
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Zero-Retention
                      </span>
                    </h3>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Enterprise & Compliance Privacy Mode
                    </span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    targetProvider === "AWS_S3"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  {targetProvider === "AWS_S3" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3.5 leading-relaxed">
                Store 100% of your datasets and Parquet caches in your own AWS S3 bucket. Autoanalytix retains <strong>zero data at rest</strong>. Instant revocation anytime from your AWS console.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> 100% Data Sovereignty
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> STS AssumeRole (No Keys)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> HIPAA & SOC 2 Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BYOC Setup Wizard (Rendered when BYOC mode is chosen) */}
        {targetProvider === "AWS_S3" && (
          <div className="space-y-6">
            {/* Step 1: Provider Selection */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Choose Cloud Provider
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FF9900]/10 flex items-center justify-center font-bold text-xs text-[#FF9900]">
                    AWS
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">
                      Amazon S3
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Production Ready
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>

                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-white/[0.02] flex items-center gap-3 opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-[#4285F4]/10 flex items-center justify-center font-bold text-xs text-[#4285F4]">
                    GCP
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-300">
                      Cloud Storage
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Phase 2 (Roadmap)
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-white/[0.02] flex items-center gap-3 opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-[#0089D6]/10 flex items-center justify-center font-bold text-xs text-[#0089D6]">
                    AZ
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-300">
                      Azure Blob
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Phase 3 (Roadmap)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Cross-Account IAM Delegation (Zero Static Secrets) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Deploy IAM Role in Your AWS Account
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={openTemplateModal}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5" /> View CloudFormation Template
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-3">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Autoanalytix uses <strong>AWS STS AssumeRole with External ID</strong> delegation. We never ask for or store long-lived AWS Access Keys. You retain 100% control and can revoke access anytime in your AWS console.
                  </div>
                </div>

                {/* External ID Display */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06]">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Your Secure Workspace External ID (Confused Deputy Protection)</span>
                    <span className="text-[10px] text-slate-400">Cryptographically Unique</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs px-3 py-2 rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] text-indigo-600 dark:text-indigo-300 select-all overflow-x-auto">
                      {config?.external_id || "Loading..."}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(config?.external_id || "", "extId")}
                      className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-white/[0.08] hover:bg-slate-300 dark:hover:bg-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedExternalId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 1-Click Launch AWS Console */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-sky-500/10 border border-indigo-500/20">
                <div className="space-y-0.5">
                  <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-500" /> 1-Click AWS CloudFormation Deployment
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pre-configures the exact trust policy and scoped S3 permissions automatically.
                  </p>
                </div>
                <a
                  href={config?.cloudformation_quick_link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 transition-all shrink-0"
                >
                  <span>Launch in AWS Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Step 3: Bucket & Role Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                  Configure Bucket & Role Details
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* S3 Bucket Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    S3 Bucket Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    placeholder="e.g. acme-analytics-vault"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">
                    Existing S3 bucket in your AWS account.
                  </span>
                </div>

                {/* AWS Region */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    AWS Region <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r.id} value={r.id} className="dark:bg-zinc-900">
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role ARN */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Assumed Role ARN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/AutoanalytixStorageAccessRole"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">
                    The output Role ARN generated by your CloudFormation stack.
                  </span>
                </div>

                {/* S3 Subfolder Prefix */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Storage Prefix / Subfolder
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="autoanalytix"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">
                    All objects will be stored under s3://{bucketName || "bucket"}/{prefix || "autoanalytix"}/
                  </span>
                </div>

                {/* Customer KMS Key ARN (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Customer KMS Key ARN</span>
                    <span className="text-[10px] font-normal text-slate-400">Optional (CMK)</span>
                  </label>
                  <input
                    type="text"
                    value={kmsKeyArn}
                    onChange={(e) => setKmsKeyArn(e.target.value)}
                    placeholder="arn:aws:kms:us-east-1:123456789012:key/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">
                    Optional AWS KMS CMK for hardware-backed object encryption.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4: Validate & Test Connection Probe */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      Validate & Test Connection
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Executes real-time STS AssumeRole, PutObject, GetObject, and DeleteObject probes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !bucketName.trim() || !roleArn.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                  <span>{testing ? "Running 4-Step Probe..." : "Run Test Probe"}</span>
                </button>
              </div>

              {/* Probe Result Cards */}
              {probeResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    probeResult.healthy
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40"
                      : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {probeResult.healthy ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span
                        className={`text-xs font-bold ${
                          probeResult.healthy
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {probeResult.message}
                      </span>
                    </div>
                    {probeResult.latency_ms > 0 && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Latency: {probeResult.latency_ms}ms
                      </span>
                    )}
                  </div>

                  {/* Step by step diagnostics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                    {Object.entries(probeResult.steps).map(([key, step]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/70 dark:bg-black/30 text-[11px]"
                      >
                        {step.passed ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                          {key.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span
                          className={`ml-auto font-medium ${
                            step.passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                          }`}
                        >
                          {step.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {probeResult.error && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-950/40 p-2.5 rounded-lg font-mono">
                      {probeResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Bar (Save & Activate) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08]">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {targetProvider === "AWS_S3" ? (
              <span>
                Saving will route all new dataset uploads and Parquet caches directly to your AWS S3 bucket.
              </span>
            ) : (
              <span>
                Reverting will switch this workspace back to Autoanalytix managed cloud storage.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saved successfully
              </span>
            )}
            {saveError && (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {saveError}
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : targetProvider === "AWS_S3" ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" /> Save & Activate BYOC Storage
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Revert to Managed Storage
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dataset Migration Tool (If BYOC is active) */}
        {isBYOCActive && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-sky-50/50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-sky-950/20 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Transfer Historical Datasets to Your Bucket
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Move existing datasets uploaded before enabling BYOC into your private cloud bucket.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMigrate}
                disabled={migrating}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${migrating ? "animate-spin" : ""}`} />
                <span>{migrating ? "Transferring..." : "Migrate Datasets"}</span>
              </button>
            </div>

            {migrationResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  migrationResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="font-semibold">{migrationResult.message}</div>
              </div>
            )}
          </div>
        )}

        {/* CloudFormation Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    AWS CloudFormation IAM Template
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deploys AutoanalytixStorageAccessRole with least-privilege scoped policies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[11px] font-sans text-slate-400">
                    Template Format: JSON
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(cfnTemplate, null, 2), "template")
                    }
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedTemplate ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Template
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 dark:bg-black/60 border border-slate-800 dark:border-white/[0.08] overflow-x-auto text-[11px] leading-relaxed">
                  {cfnTemplate ? JSON.stringify(cfnTemplate, null, 2) : "Loading template..."}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
