import { duckdbWasm } from "./duckdbWasm";
import { browserAi } from "./browserAi";

export interface StoredDataset {
  id: string;
  workspace_id: string;
  name: string;
  duckdb_table_name: string;
  row_count: number;
  column_count: number;
  size_bytes: number;
  created_at: string;
  file_content?: string;
  file_type?: string;
  original_filename?: string;
  columns: any[];
  profile_summary: any;
}

export interface StoredConversation {
  id: string;
  workspace_id: string;
  dataset_id: string;
  dataset_name?: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: any[];
}

export interface StoredDashboard {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  is_public?: boolean;
  share_token?: string;
  share_expires_at?: string;
  layout?: any;
  filters?: any;
  created_at: string;
  updated_at: string;
  items: any[];
}

const STORAGE_KEYS = {
  DATASETS: "autoanalytix_local_datasets",
  CONVERSATIONS: "autoanalytix_local_conversations",
  DASHBOARDS: "autoanalytix_local_dashboards",
  AI_CONFIGS: "autoanalytix_local_ai_configs",
};

export class BrowserStorageService {
  private getLocal<T>(key: string, fallback: T): T {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  }

  private setLocal(key: string, value: any) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value, (_, v) => (typeof v === "bigint" ? Number(v) : v))
      );
    } catch (e) {
      console.warn("Storage write error:", e);
    }
  }

  // --- AI Configs ---
  public getAiConfigs(): any[] {
    return this.getLocal<any[]>(STORAGE_KEYS.AI_CONFIGS, []);
  }

  public saveAiConfig(config: any): any {
    const list = this.getAiConfigs();
    const existingIdx = list.findIndex((c) => c.id === config.id);
    const newConfig = {
      ...config,
      id: config.id || "cfg_" + Date.now(),
      created_at: config.created_at || new Date().toISOString(),
      is_default: list.length === 0 ? true : !!config.is_default,
    };

    if (existingIdx >= 0) {
      list[existingIdx] = newConfig;
    } else {
      list.push(newConfig);
    }

    this.setLocal(STORAGE_KEYS.AI_CONFIGS, list);
    return newConfig;
  }

  public deleteAiConfig(id: string) {
    const list = this.getAiConfigs().filter((c) => c.id !== id);
    this.setLocal(STORAGE_KEYS.AI_CONFIGS, list);
  }

  public setDefaultAiConfig(id: string) {
    const list = this.getAiConfigs().map((c) => ({
      ...c,
      is_default: c.id === id,
    }));
    this.setLocal(STORAGE_KEYS.AI_CONFIGS, list);
  }

  // --- Datasets ---
  public getDatasets(workspaceId?: string): StoredDataset[] {
    const list = this.getLocal<StoredDataset[]>(STORAGE_KEYS.DATASETS, []);
    return workspaceId ? list.filter((d) => d.workspace_id === workspaceId) : list;
  }

  public getDataset(id: string): StoredDataset | null {
    const list = this.getDatasets();
    return list.find((d) => d.id === id) || null;
  }

  public async registerAndSaveDataset(params: {
    name: string;
    fileContent: string | ArrayBuffer;
    format: "csv" | "parquet" | "json";
    workspaceId: string;
    fileType?: string;
    originalFilename?: string;
  }): Promise<StoredDataset> {
    const id = "ds_" + Math.random().toString(36).substring(2, 10);
    const tableName = `dataset_${id}`;

    // Register in DuckDB-Wasm
    await duckdbWasm.registerFile(tableName, params.fileContent, params.format);
    const profile = await duckdbWasm.profileTable(tableName);

    const newDataset: StoredDataset = {
      id,
      workspace_id: params.workspaceId,
      name: params.name,
      duckdb_table_name: tableName,
      row_count: profile.row_count,
      column_count: profile.column_count,
      size_bytes: typeof params.fileContent === "string" ? params.fileContent.length : params.fileContent.byteLength,
      created_at: new Date().toISOString(),
      file_content: typeof params.fileContent === "string" ? params.fileContent : undefined,
      file_type: params.fileType || params.format,
      original_filename: params.originalFilename,
      columns: profile.columns,
      profile_summary: {
        summary: `Dataset containing ${profile.row_count} records across ${profile.column_count} columns.`,
        duplicate_rows_count: profile.duplicate_rows_count,
        missing_cells_count: profile.missing_cells_count,
        missing_cells_percentage: profile.missing_cells_percentage,
        total_cells: profile.total_cells,
        summary_insights: profile.summary_insights,
        suggested_questions: [
          `Show distribution of ${profile.columns[0]?.name || "records"}`,
          `Top 5 ${profile.columns[1]?.name || "categories"} by total volume`,
          `Analyze summary metrics across all columns`,
        ],
      },
    };

    const datasets = this.getDatasets();
    datasets.unshift(newDataset);
    this.setLocal(STORAGE_KEYS.DATASETS, datasets);
    return newDataset;
  }

  public deleteDataset(id: string) {
    const list = this.getDatasets().filter((d) => d.id !== id);
    this.setLocal(STORAGE_KEYS.DATASETS, list);
  }

  public async generateDemoDataset(workspaceId: string): Promise<StoredDataset> {
    // Generate sample B2B SaaS demo data CSV in memory
    const headers = "order_id,customer_name,company,region,product_tier,industry,units_sold,unit_price,discount_pct,total_revenue,order_date\n";
    const tiers = ["Starter", "Professional", "Enterprise", "Custom Unlimited"];
    const regions = ["North America", "EMEA", "APAC", "LATAM"];
    const industries = ["FinTech", "Healthcare", "E-Commerce", "SaaS", "Cybersecurity"];
    const companies = ["Acme Corp", "NovaTech", "Stripewave", "BioGen", "QuantEdge", "CloudScale", "Zenith Health", "Vertex Retail"];

    let rows = "";
    for (let i = 1; i <= 250; i++) {
      const oid = `ORD-2026-${String(i).padStart(4, "0")}`;
      const comp = companies[i % companies.length];
      const cust = `Exec ${i}`;
      const reg = regions[i % regions.length];
      const tier = tiers[i % tiers.length];
      const ind = industries[i % industries.length];
      const units = Math.floor(Math.random() * 20) + 1;
      const unitPrice = tier === "Starter" ? 150 : tier === "Professional" ? 450 : tier === "Enterprise" ? 1200 : 2500;
      const discount = [0, 0.05, 0.1, 0.15, 0.2][Math.floor(Math.random() * 5)];
      const totalRev = Math.round(units * unitPrice * (1 - discount));
      const month = String(Math.floor(Math.random() * 9) + 1).padStart(2, "0");
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
      const date = `2026-${month}-${day}`;

      rows += `${oid},${cust},${comp},${reg},${tier},${ind},${units},${unitPrice},${discount},${totalRev},${date}\n`;
    }

    const csvContent = headers + rows;
    return this.registerAndSaveDataset({
      name: "B2B SaaS Sales & Revenue (Demo)",
      fileContent: csvContent,
      format: "csv",
      workspaceId,
    });
  }

  // --- Conversations ---
  public getConversations(workspaceId?: string, datasetId?: string): StoredConversation[] {
    let list = this.getLocal<StoredConversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    if (workspaceId) list = list.filter((c) => c.workspace_id === workspaceId);
    if (datasetId) list = list.filter((c) => c.dataset_id === datasetId);
    return list;
  }

  public getConversation(id: string): StoredConversation | null {
    const list = this.getConversations();
    return list.find((c) => c.id === id) || null;
  }

  public saveConversation(conv: StoredConversation) {
    const list = this.getConversations();
    const idx = list.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      list[idx] = conv;
    } else {
      list.unshift(conv);
    }
    this.setLocal(STORAGE_KEYS.CONVERSATIONS, list);
  }

  public deleteConversation(id: string) {
    const list = this.getConversations().filter((c) => c.id !== id);
    this.setLocal(STORAGE_KEYS.CONVERSATIONS, list);
  }

  // --- Dashboards ---
  public getDashboards(workspaceId?: string): StoredDashboard[] {
    let list = this.getLocal<StoredDashboard[]>(STORAGE_KEYS.DASHBOARDS, []);
    if (workspaceId) list = list.filter((d) => d.workspace_id === workspaceId);
    return list;
  }

  public getDashboard(id: string): StoredDashboard | null {
    const list = this.getDashboards();
    const db = list.find((d) => d.id === id);
    if (!db) return null;
    const cloned = JSON.parse(JSON.stringify(db));
    if (cloned.layout?.item_order && Array.isArray(cloned.layout.item_order) && cloned.items) {
      const orderMap = new Map(cloned.layout.item_order.map((itemId: string, idx: number) => [itemId, idx]));
      cloned.items = [...cloned.items].sort((a: any, b: any) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
        return orderA - orderB;
      });
    }
    return cloned;
  }

  public saveDashboard(db: StoredDashboard) {
    const list = this.getDashboards();
    const idx = list.findIndex((d) => d.id === db.id);
    if (idx >= 0) {
      list[idx] = db;
    } else {
      list.unshift(db);
    }
    this.setLocal(STORAGE_KEYS.DASHBOARDS, list);
  }

  public deleteDashboard(id: string) {
    const list = this.getDashboards().filter((d) => d.id !== id);
    this.setLocal(STORAGE_KEYS.DASHBOARDS, list);
  }
}

export const browserStore = new BrowserStorageService();
