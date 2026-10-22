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
  Terminal,
  Upload,
} from "lucide-react";
import { AwsLogo, GcpLogo, AzureLogo } from "../components/icons/CloudLogos";

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
  // GCP
  gcp_project_id?: string;
  gcp_bucket_name?: string;
  gcp_location?: string;
  has_gcp_credentials?: boolean;
  // Azure
  azure_account_name?: string;
  azure_container_name?: string;
  azure_sas_token_masked?: string;
  azure_connection_string_masked?: string;
  azure_auth_type?: string;
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

const GCP_LOCATIONS = [
  { id: "us-central1", label: "US Central (Iowa) - us-central1" },
  { id: "us-east1", label: "US East (South Carolina) - us-east1" },
  { id: "us-west1", label: "US West (Oregon) - us-west1" },
  { id: "europe-west1", label: "Europe (Belgium) - europe-west1" },
  { id: "europe-west3", label: "Europe (Frankfurt) - europe-west3" },
  { id: "asia-south1", label: "Asia (Mumbai) - asia-south1" },
  { id: "asia-southeast1", label: "Asia (Singapore) - asia-southeast1" },
  { id: "US", label: "Multi-Region: United States (US)" },
  { id: "EU", label: "Multi-Region: European Union (EU)" },
];

const AZURE_REGIONS = [
  { id: "eastus", label: "East US - eastus" },
  { id: "eastus2", label: "East US 2 - eastus2" },
  { id: "westus2", label: "West US 2 - westus2" },
  { id: "centralus", label: "Central US - centralus" },
  { id: "westeurope", label: "West Europe - westeurope" },
  { id: "northeurope", label: "North Europe - northeurope" },
  { id: "centralindia", label: "Central India - centralindia" },
  { id: "southeastasia", label: "Southeast Asia - southeastasia" },
  { id: "japaneast", label: "Japan East - japaneast" },
];

export const CloudStorageSettings: React.FC = () => {
  const { currentWorkspace } = useAuthStore();
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Top mode toggle: Platform vs BYOC
  const [isBYOCMode, setIsBYOCMode] = useState(false);
  const [byocProvider, setByocProvider] = useState<"AWS_S3" | "GCP_GCS" | "AZURE_BLOB">("AWS_S3");

  // Common prefix
  const [prefix, setPrefix] = useState("autoanalytix");

  // Form states - AWS S3
  const [bucketName, setBucketName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [roleArn, setRoleArn] = useState("");
  const [kmsKeyArn, setKmsKeyArn] = useState("");

  // Form states - GCP GCS
  const [gcpBucketName, setGcpBucketName] = useState("");
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpLocation, setGcpLocation] = useState("us-central1");
  const [gcpCredentialsJson, setGcpCredentialsJson] = useState("");
  const [gcpCredsFileName, setGcpCredsFileName] = useState("");

  // Form states - Azure Blob
  const [azureAuthMethod, setAzureAuthMethod] = useState<"sas_token" | "sas_url" | "connection_string" | "service_principal">("sas_token");
  const [azureAccountName, setAzureAccountName] = useState("");
  const [azureContainerName, setAzureContainerName] = useState("");
  const [azureSasToken, setAzureSasToken] = useState("");
  const [azureSasUrl, setAzureSasUrl] = useState("");
  const [azureConnectionString, setAzureConnectionString] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [azureRegion, setAzureRegion] = useState("eastus");

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

  // UI helpers & modals
  const [copiedExternalId, setCopiedExternalId] = useState(false);
  
  // AWS CFN Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [cfnTemplate, setCfnTemplate] = useState<any>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // GCP Script Modal
  const [showGcpModal, setShowGcpModal] = useState(false);
  const [gcpScriptTab, setGcpScriptTab] = useState<"gcloud" | "terraform">("gcloud");
  const [gcpScriptData, setGcpScriptData] = useState<{ gcloud_bash_script: string; terraform_configuration: string } | null>(null);
  const [copiedGcpScript, setCopiedGcpScript] = useState(false);

  // Azure Script Modal
  const [showAzureModal, setShowAzureModal] = useState(false);
  const [azureScriptData, setAzureScriptData] = useState<{ azure_cli_script: string } | null>(null);
  const [copiedAzureScript, setCopiedAzureScript] = useState(false);

  const loadConfig = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const res = await api.cloudStorage.getConfig(currentWorkspace.id);
      setConfig(res);

      if (res.provider === "AWS_S3") {
        setIsBYOCMode(true);
        setByocProvider("AWS_S3");
        setBucketName(res.bucket_name || "");
        setRegion(res.region || "us-east-1");
        setRoleArn(res.role_arn || "");
        setPrefix(res.prefix || "autoanalytix");
        setKmsKeyArn(res.kms_key_arn || "");
      } else if (res.provider === "GCP_GCS" || res.provider === "GCS") {
        setIsBYOCMode(true);
        setByocProvider("GCP_GCS");
        setGcpBucketName(res.gcp_bucket_name || res.bucket_name || "");
        setGcpProjectId(res.gcp_project_id || "");
        setGcpLocation(res.gcp_location || res.region || "us-central1");
        setPrefix(res.prefix || "autoanalytix");
      } else if (res.provider === "AZURE_BLOB" || res.provider === "AZURE") {
        setIsBYOCMode(true);
        setByocProvider("AZURE_BLOB");
        setAzureAccountName(res.azure_account_name || "");
        setAzureContainerName(res.azure_container_name || res.bucket_name || "");
        setAzureRegion(res.region || "eastus");
        setPrefix(res.prefix || "autoanalytix");
      } else {
        setIsBYOCMode(false);
      }
    } catch (err) {
      console.error("Failed to load storage config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [currentWorkspace]);

  const copyToClipboard = (text: string, type: "extId" | "template" | "gcp" | "azure") => {
    navigator.clipboard.writeText(text);
    if (type === "extId") {
      setCopiedExternalId(true);
      setTimeout(() => setCopiedExternalId(false), 2000);
    } else if (type === "template") {
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    } else if (type === "gcp") {
      setCopiedGcpScript(true);
      setTimeout(() => setCopiedGcpScript(false), 2000);
    } else if (type === "azure") {
      setCopiedAzureScript(true);
      setTimeout(() => setCopiedAzureScript(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGcpCredsFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        setGcpCredentialsJson(content);
        if (parsed.project_id && !gcpProjectId) {
          setGcpProjectId(parsed.project_id);
        }
      } catch (err) {
        alert("Invalid JSON file uploaded.");
      }
    };
    reader.readAsText(file);
  };

  const openTemplateModal = async () => {
    if (!currentWorkspace) return;
    setShowTemplateModal(true);
    try {
      const tmpl = await api.cloudStorage.getCloudFormationTemplate(
        currentWorkspace.id,
        bucketName.trim() || undefined,
        prefix.trim() || undefined
      );
      setCfnTemplate(tmpl);
    } catch (err) {
      console.error("Failed to fetch template:", err);
    }
  };

  const openGcpModal = async () => {
    if (!currentWorkspace) return;
    setShowGcpModal(true);
    try {
      const data = await api.cloudStorage.getGcpSetupScript(
        currentWorkspace.id,
        gcpBucketName.trim() || undefined,
        gcpProjectId.trim() || undefined
      );
      setGcpScriptData(data);
    } catch (err) {
      console.error("Failed to fetch GCP scripts:", err);
    }
  };

  const openAzureModal = async () => {
    if (!currentWorkspace) return;
    setShowAzureModal(true);
    try {
      const data = await api.cloudStorage.getAzureSetupScript(
        currentWorkspace.id,
        azureAccountName.trim() || undefined,
        azureContainerName.trim() || undefined
      );
      setAzureScriptData(data);
    } catch (err) {
      console.error("Failed to fetch Azure script:", err);
    }
  };

  const handleTestConnection = async () => {
    if (!currentWorkspace) return;
    setSaveError(null);
    setTesting(true);
    setProbeResult(null);

    try {
      let testPayload: any = {
        provider: byocProvider,
        prefix: prefix.trim() || "autoanalytix",
      };

      if (byocProvider === "AWS_S3") {
        if (!bucketName.trim() || !roleArn.trim()) {
          setSaveError("Please provide both Bucket Name and IAM Role ARN before testing.");
          setTesting(false);
          return;
        }
        testPayload = {
          ...testPayload,
          bucket_name: bucketName.trim(),
          region,
          role_arn: roleArn.trim(),
          kms_key_arn: kmsKeyArn.trim() || undefined,
        };
      } else if (byocProvider === "GCP_GCS") {
        if (!gcpBucketName.trim()) {
          setSaveError("Please provide the GCS Bucket Name before testing.");
          setTesting(false);
          return;
        }
        testPayload = {
          ...testPayload,
          gcp_bucket_name: gcpBucketName.trim(),
          gcp_project_id: gcpProjectId.trim() || undefined,
          gcp_location: gcpLocation,
          gcp_credentials_json: gcpCredentialsJson.trim() || undefined,
        };
      } else if (byocProvider === "AZURE_BLOB") {
        if (!azureContainerName.trim()) {
          setSaveError("Please provide the Azure Blob Container Name before testing.");
          setTesting(false);
          return;
        }
        testPayload = {
          ...testPayload,
          azure_container_name: azureContainerName.trim(),
          azure_account_name: azureAccountName.trim() || undefined,
          azure_sas_token: azureAuthMethod === "sas_token" ? (azureSasToken.trim() || undefined) : undefined,
          azure_sas_url: azureAuthMethod === "sas_url" ? (azureSasUrl.trim() || undefined) : undefined,
          azure_connection_string: azureAuthMethod === "connection_string" ? (azureConnectionString.trim() || undefined) : undefined,
          azure_tenant_id: azureAuthMethod === "service_principal" ? (azureTenantId.trim() || undefined) : undefined,
          azure_client_id: azureAuthMethod === "service_principal" ? (azureClientId.trim() || undefined) : undefined,
          azure_client_secret: azureAuthMethod === "service_principal" ? (azureClientSecret.trim() || undefined) : undefined,
          region: azureRegion,
        };
      }

      const res = await api.cloudStorage.testConnection(currentWorkspace.id, testPayload);
      setProbeResult(res);
    } catch (err: any) {
      setProbeResult({
        healthy: false,
        verified: false,
        provider: byocProvider,
        bucket: bucketName || gcpBucketName || azureContainerName || "storage",
        region: region || gcpLocation || azureRegion,
        steps: {
          auth: { passed: false, message: err.message || "Failed to authenticate" },
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
      if (!isBYOCMode) {
        // Revert to PLATFORM_DEFAULT
        const res = await api.cloudStorage.updateConfig(currentWorkspace.id, {
          provider: "PLATFORM_DEFAULT",
        });
        setConfig(res);
        setSaveSuccess(true);
        setProbeResult(null);
      } else if (byocProvider === "AWS_S3") {
        if (!bucketName.trim() || !roleArn.trim()) {
          throw new Error("Both Bucket Name and IAM Role ARN are required for AWS S3.");
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
      } else if (byocProvider === "GCP_GCS") {
        if (!gcpBucketName.trim()) {
          throw new Error("GCS Bucket Name is required for Google Cloud Storage.");
        }
        const res = await api.cloudStorage.updateConfig(currentWorkspace.id, {
          provider: "GCP_GCS",
          gcp_bucket_name: gcpBucketName.trim(),
          gcp_project_id: gcpProjectId.trim() || undefined,
          gcp_credentials_json: gcpCredentialsJson.trim() || undefined,
          gcp_location: gcpLocation,
          prefix: prefix.trim() || "autoanalytix",
          skip_verification: probeResult?.healthy === true,
        });
        setConfig(res);
        setSaveSuccess(true);
      } else if (byocProvider === "AZURE_BLOB") {
        if (!azureContainerName.trim()) {
          throw new Error("Azure Container Name is required for Azure Blob Storage.");
        }
        const res = await api.cloudStorage.updateConfig(currentWorkspace.id, {
          provider: "AZURE_BLOB",
          azure_container_name: azureContainerName.trim(),
          azure_account_name: azureAccountName.trim() || undefined,
          azure_sas_token: azureAuthMethod === "sas_token" ? (azureSasToken.trim() || undefined) : undefined,
          azure_sas_url: azureAuthMethod === "sas_url" ? (azureSasUrl.trim() || undefined) : undefined,
          azure_connection_string: azureAuthMethod === "connection_string" ? (azureConnectionString.trim() || undefined) : undefined,
          azure_tenant_id: azureAuthMethod === "service_principal" ? (azureTenantId.trim() || undefined) : undefined,
          azure_client_id: azureAuthMethod === "service_principal" ? (azureClientId.trim() || undefined) : undefined,
          azure_client_secret: azureAuthMethod === "service_principal" ? (azureClientSecret.trim() || undefined) : undefined,
          region: azureRegion,
          prefix: prefix.trim() || "autoanalytix",
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

  const isBYOCActive = config?.status === "active" && (config?.provider === "AWS_S3" || config?.provider === "GCP_GCS" || config?.provider === "AZURE_BLOB");

  const getActiveBadgeText = () => {
    if (!config) return "";
    if (config.provider === "AWS_S3") return `BYOC AWS S3 Active (${config.bucket_name})`;
    if (config.provider === "GCP_GCS") return `BYOC GCS Active (gs://${config.bucket_name})`;
    if (config.provider === "AZURE_BLOB") return `BYOC Azure Active (${config.bucket_name})`;
    return "Autoanalytix Managed Cloud";
  };

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
                    BYOC Multi-Cloud
                  </span>
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose where your raw datasets, analytical Parquet files, and caches are stored (AWS, GCP, or Azure).
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBYOCActive ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{getActiveBadgeText()}</span>
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
              onClick={() => setIsBYOCMode(false)}
              className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                !isBYOCMode
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
                    !isBYOCMode
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  {!isBYOCMode && <Check className="w-3 h-3 stroke-[3]" />}
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
              onClick={() => setIsBYOCMode(true)}
              className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                isBYOCMode
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
                      AWS S3, Google Cloud Storage, or Azure Blob
                    </span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isBYOCMode
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  {isBYOCMode && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3.5 leading-relaxed">
                Store 100% of your datasets and Parquet caches in your own cloud account. Autoanalytix retains <strong>zero data at rest</strong>. Instant revocation anytime from your cloud console.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> 100% Data Sovereignty
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> Zero Static Master Keys
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05]">
                  <Check className="w-3 h-3 text-emerald-500" /> HIPAA & SOC 2 Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BYOC Setup Wizard (Rendered when BYOC mode is chosen) */}
        {isBYOCMode && (
          <div className="space-y-6">
            {/* Step 1: Provider Selection */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Choose Your Cloud Provider
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* AWS Card */}
                <div
                  onClick={() => setByocProvider("AWS_S3")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 shadow-xs ${
                    byocProvider === "AWS_S3"
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-600/20"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-white/[0.02]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.06] border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center p-1.5 shadow-xs shrink-0">
                    <AwsLogo className="w-7 h-7 text-[#232F3E] dark:text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Amazon AWS
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Amazon S3 • STS AssumeRole
                    </div>
                  </div>
                  {byocProvider === "AWS_S3" && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </div>

                {/* GCP Card */}
                <div
                  onClick={() => setByocProvider("GCP_GCS")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 shadow-xs ${
                    byocProvider === "GCP_GCS"
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-600/20"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-white/[0.02]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center p-1.5 shadow-xs shrink-0">
                    <GcpLogo className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Google Cloud (GCP)
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Cloud Storage • Service Account
                    </div>
                  </div>
                  {byocProvider === "GCP_GCS" && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </div>

                {/* Azure Card */}
                <div
                  onClick={() => setByocProvider("AZURE_BLOB")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 shadow-xs ${
                    byocProvider === "AZURE_BLOB"
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-600/20"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-white/[0.02]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center p-1.5 shadow-xs shrink-0">
                    <AzureLogo className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Microsoft Azure
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Blob Storage • Scoped SAS / Entra
                    </div>
                  </div>
                  {byocProvider === "AZURE_BLOB" && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Delegation / Provisioning Guide */}
            {byocProvider === "AWS_S3" && (
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

                  {/* 1-Click CloudFormation Button */}
                  {config?.cloudformation_quick_link && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Quickest Setup: Deploy stack in 1 click
                      </span>
                      <a
                        href={config.cloudformation_quick_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold shadow-xs"
                      >
                        <span>Launch CloudFormation Stack</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {byocProvider === "GCP_GCS" && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      Grant Access in Your Google Cloud Project
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={openGcpModal}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Terminal className="w-3.5 h-3.5" /> View gcloud & Terraform Scripts
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Autoanalytix connects to your GCS bucket using a dedicated Service Account with <strong>Storage Object Admin</strong> scoped strictly to your analytics bucket. You retain 100% data residency in your designated Google Cloud region.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Your Workspace External ID</span>
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
              </div>
            )}

            {byocProvider === "AZURE_BLOB" && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      Configure Azure Container Delegation
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={openAzureModal}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Terminal className="w-3.5 h-3.5" /> View Azure CLI Command
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Autoanalytix supports <strong>Zero Master Key</strong> access using a <strong>Container-scoped SAS Token</strong> (Permissions: Read, Write, Delete, List). We never require your Azure subscription root or master account keys.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06]">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Your Workspace External ID</span>
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
              </div>
            )}

            {/* Step 3: Enter Cloud Parameters */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                  {byocProvider === "AWS_S3" && "Enter AWS S3 & Role Details"}
                  {byocProvider === "GCP_GCS" && "Enter Google Cloud Storage Details"}
                  {byocProvider === "AZURE_BLOB" && "Enter Azure Blob Storage Details"}
                </h3>
              </div>

              {/* AWS S3 FORM */}
              {byocProvider === "AWS_S3" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      S3 Bucket Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. acme-corp-private-vault"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      AWS Region
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {AWS_REGIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Assumed IAM Role ARN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="arn:aws:iam::111122223333:role/AutoanalytixStorageRole-XXXX"
                      value={roleArn}
                      onChange={(e) => setRoleArn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Bucket Folder Prefix
                    </label>
                    <input
                      type="text"
                      placeholder="autoanalytix"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Customer KMS Key ARN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="arn:aws:kms:us-east-1:111122223333:key/..."
                      value={kmsKeyArn}
                      onChange={(e) => setKmsKeyArn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* GCP GCS FORM */}
              {byocProvider === "GCP_GCS" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      GCS Bucket Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. acme-analytics-vault (without gs://)"
                      value={gcpBucketName}
                      onChange={(e) => setGcpBucketName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      GCP Project ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. acme-prod-analytics"
                      value={gcpProjectId}
                      onChange={(e) => setGcpProjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      GCP Location / Region
                    </label>
                    <select
                      value={gcpLocation}
                      onChange={(e) => setGcpLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {GCP_LOCATIONS.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Bucket Folder Prefix
                    </label>
                    <input
                      type="text"
                      placeholder="autoanalytix"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Service Account JSON Key
                      </label>
                      <label className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{gcpCredsFileName ? `Selected: ${gcpCredsFileName}` : "Upload Key File (.json)"}</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      placeholder={
                        config?.has_gcp_credentials
                          ? "Credentials saved securely on server (leave blank to keep existing key, or paste new JSON to update)"
                          : 'Paste service account JSON key: {"type": "service_account", "project_id": "...", ...}'
                      }
                      value={gcpCredentialsJson}
                      onChange={(e) => setGcpCredentialsJson(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                    />
                    {config?.has_gcp_credentials && !gcpCredentialsJson && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                        <Check className="w-3.5 h-3.5" /> Service account credentials already configured securely.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AZURE BLOB FORM */}
              {byocProvider === "AZURE_BLOB" && (
                <div className="space-y-4 pt-2">
                  {/* Auth Method selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Authentication Method
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAzureAuthMethod("sas_token")}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                          azureAuthMethod === "sas_token"
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                            : "border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>SAS Token</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Recommended</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">Zero master secrets</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAzureAuthMethod("connection_string")}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                          azureAuthMethod === "connection_string"
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                            : "border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div>Connection String</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">Storage Account Key</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAzureAuthMethod("service_principal")}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                          azureAuthMethod === "service_principal"
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                            : "border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div>Service Principal</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">Azure Entra ID (AD)</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Storage Account Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. acmevaultstorage"
                        value={azureAccountName}
                        onChange={(e) => setAzureAccountName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        Container Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. autoanalytix"
                        value={azureContainerName}
                        onChange={(e) => setAzureContainerName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {azureAuthMethod === "sas_token" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          Container SAS Token <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          placeholder={
                            config?.azure_sas_token_masked
                              ? `Configured (${config.azure_sas_token_masked}). Leave empty to keep existing.`
                              : "e.g. ?sp=racwdl&st=2026-10-01...&sig=..."
                          }
                          value={azureSasToken}
                          onChange={(e) => setAzureSasToken(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Permissions required: <code>racwdl</code> (Read, Add, Create, Write, Delete, List).
                        </p>
                      </div>
                    )}

                    {azureAuthMethod === "connection_string" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          Storage Connection String <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          placeholder={
                            config?.azure_connection_string_masked
                              ? `Configured (${config.azure_connection_string_masked}). Leave empty to keep existing.`
                              : "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
                          }
                          value={azureConnectionString}
                          onChange={(e) => setAzureConnectionString(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    )}

                    {azureAuthMethod === "service_principal" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Directory (Tenant) ID
                          </label>
                          <input
                            type="text"
                            placeholder="00000000-0000-0000-0000-000000000000"
                            value={azureTenantId}
                            onChange={(e) => setAzureTenantId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Application (Client) ID
                          </label>
                          <input
                            type="text"
                            placeholder="00000000-0000-0000-0000-000000000000"
                            value={azureClientId}
                            onChange={(e) => setAzureClientId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Client Secret Value
                          </label>
                          <input
                            type="password"
                            placeholder="Client secret value from Azure App Registration"
                            value={azureClientSecret}
                            onChange={(e) => setAzureClientSecret(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Azure Region
                      </label>
                      <select
                        value={azureRegion}
                        onChange={(e) => setAzureRegion(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        {AZURE_REGIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Blob Folder Prefix
                      </label>
                      <input
                        type="text"
                        placeholder="autoanalytix"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Real-Time Verification Probe */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Probe & Verify Cloud Connection
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                  <span>{testing ? "Testing Probe..." : "Validate Connection"}</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tests authentication, write permissions, read verification, and object deletion directly on your cloud bucket with zero residual footprint.
              </p>

              {/* Probe Result UI */}
              {probeResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    probeResult.healthy
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                      : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {probeResult.healthy ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">
                          {probeResult.healthy ? "Connection Probe Verified" : "Verification Failed"}
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {probeResult.message}
                        </div>
                      </div>
                    </div>
                    {probeResult.latency_ms > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-black/30 border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300">
                        {probeResult.latency_ms} ms
                      </span>
                    )}
                  </div>

                  {/* Step pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                    {Object.entries(probeResult.steps).map(([stepKey, stepVal]) => (
                      <div
                        key={stepKey}
                        className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                          stepVal.passed
                            ? "bg-emerald-100/40 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                            : "bg-rose-100/40 dark:bg-rose-900/20 border-rose-300 dark:border-rose-800/50 text-rose-900 dark:text-rose-200"
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span className="capitalize">{stepKey.replace(/_/g, " ")}</span>
                          {stepVal.passed ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          )}
                        </div>
                        <div className="text-[10px] opacity-80 leading-snug line-clamp-2">
                          {stepVal.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Bar (Save & Activate) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08]">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isBYOCMode ? (
              <span>
                Saving will route all new dataset uploads and Parquet caches directly to your private cloud storage (<strong>{byocProvider === "AWS_S3" ? "Amazon S3" : byocProvider === "GCP_GCS" ? "Google Cloud Storage" : "Azure Blob Storage"}</strong>).
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
              ) : isBYOCMode ? (
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
                    Transfer Historical Datasets to Your Private Cloud
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

        {/* AWS CloudFormation Template Modal */}
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

        {/* GCP Script Modal */}
        {showGcpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    Google Cloud BYOC Setup Scripts
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Provisions GCS bucket & least-privilege Service Account with 1 command.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGcpModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="px-5 pt-3 flex gap-2 border-b border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setGcpScriptTab("gcloud")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                    gcpScriptTab === "gcloud"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  gcloud CLI (Bash)
                </button>
                <button
                  type="button"
                  onClick={() => setGcpScriptTab("terraform")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-all ${
                    gcpScriptTab === "terraform"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Terraform (HCL)
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-sans text-slate-400">
                    Run in Google Cloud Shell or your local terminal
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        gcpScriptTab === "gcloud"
                          ? gcpScriptData?.gcloud_bash_script || ""
                          : gcpScriptData?.terraform_configuration || "",
                        "gcp"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedGcpScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Script
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 dark:bg-black/60 border border-slate-800 dark:border-white/[0.08] overflow-x-auto text-[11px] leading-relaxed">
                  {gcpScriptData
                    ? gcpScriptTab === "gcloud"
                      ? gcpScriptData.gcloud_bash_script
                      : gcpScriptData.terraform_configuration
                    : "Loading GCP scripts..."}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowGcpModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Azure Script Modal */}
        {showAzureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-sky-500" />
                    Azure CLI BYOC Provisioning Script
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Creates container and generates scoped 1-year SAS token with zero master secrets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAzureModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-sans text-slate-400">
                    Run in Azure Cloud Shell or local terminal
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(azureScriptData?.azure_cli_script || "", "azure")
                    }
                    className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedAzureScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Command
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 dark:bg-black/60 border border-slate-800 dark:border-white/[0.08] overflow-x-auto text-[11px] leading-relaxed">
                  {azureScriptData?.azure_cli_script || "Loading Azure CLI script..."}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowAzureModal(false)}
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
