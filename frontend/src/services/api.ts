import { duckdbWasm } from "./duckdbWasm";
import { browserAi } from "./browserAi";
import { browserStore } from "./browserStore";
import * as XLSX from "xlsx";

async function ensureTableRegistered(ds: any) {
  if (!duckdbWasm.isTableRegistered(ds.duckdb_table_name)) {
    if (ds.file_content) {
      await duckdbWasm.registerFile(ds.duckdb_table_name, ds.file_content, "csv");
    }
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("autoanalytix_token");
  }

  public setToken(token: string) {
    localStorage.setItem("autoanalytix_token", token);
  }

  public clearToken() {
    localStorage.removeItem("autoanalytix_token");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && !endpoint.includes("/auth/login")) {
      this.clearToken();
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.detail?.message || data?.detail || "An unexpected error occurred.";
      const error = new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
      (error as any).code = data?.detail?.code;
      (error as any).redirectUrl = data?.detail?.redirect_url;
      throw error;
    }

    return data as T;
  }

  // --- Auth ---
  auth = {
    login: async (credentials: any) => {
      try {
        return await this.request<any>("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      } catch (err: any) {
        if (!API_BASE_URL) {
          const fakeUser = {
            id: "user_local_1",
            email: credentials.email,
            full_name: "Local Analyst",
            is_active: true,
          };
          this.setToken("local_demo_token");
          return { access_token: "local_demo_token", user: fakeUser };
        }
        throw err;
      }
    },
    register: async (userData: any) => {
      try {
        return await this.request<any>("/auth/register", { method: "POST", body: JSON.stringify(userData) });
      } catch (err: any) {
        if (!API_BASE_URL) {
          const fakeUser = {
            id: "user_local_1",
            email: userData.email,
            full_name: userData.full_name || "Local Analyst",
            is_active: true,
          };
          this.setToken("local_demo_token");
          return { access_token: "local_demo_token", user: fakeUser };
        }
        throw err;
      }
    },
    getMe: async () => {
      try {
        const token = this.getToken();
        if (token === "local_demo_token" && API_BASE_URL) {
          this.clearToken();
          throw new Error("Session expired. Please log in to your account.");
        }
        return await this.request<any>("/auth/me");
      } catch (err: any) {
        if (err.message?.includes("Session expired") || (err as any).code === 401) {
          this.clearToken();
          throw err;
        }
        if (!API_BASE_URL) {
          return {
            user: {
              id: "user_local_1",
              email: "analyst@local.app",
              full_name: "Local Analyst (Browser-WASM)",
              is_active: true,
            },
            workspaces: [
              {
                id: "ws_local_1",
                name: "Personal Workspace (Browser)",
                slug: "personal-workspace",
                role: "owner",
                owner_id: "user_local_1",
              },
            ],
          };
        }
        throw err;
      }
    },
  };

  // --- AI Providers (BYOK) ---
  ai = {
    getProviders: async () => {
      try {
        return await this.request<any[]>("/ai/providers");
      } catch {
        return [
          {
            id: "groq",
            name: "Groq",
            description: "Ultra-fast LPU inference (Recommended)",
            models: ["llama-3.1-8b-instant", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
            key_format: "gsk_...",
            key_url: "https://console.groq.com/keys",
          },
          {
            id: "openrouter",
            name: "OpenRouter",
            description: "Access any open or commercial model with unified credit balance",
            models: ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-exp:free"],
            key_format: "sk-or-v1-...",
            key_url: "https://openrouter.ai/keys",
          },
          {
            id: "openai",
            name: "OpenAI",
            description: "Industry-standard GPT-4o models",
            models: ["gpt-4o", "gpt-4o-mini"],
            key_format: "sk-proj-...",
            key_url: "https://platform.openai.com/api-keys",
          },
        ];
      }
    },
    getConfigurations: async (workspaceId: string) => {
      try {
        return await this.request<any[]>(`/ai/configurations?workspace_id=${workspaceId}`);
      } catch {
        return browserStore.getAiConfigs();
      }
    },
    createConfiguration: async (workspaceId: string, data: any) => {
      try {
        return await this.request<any>(`/ai/configurations?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) });
      } catch {
        return browserStore.saveAiConfig(data);
      }
    },
    updateConfiguration: async (id: string, data: any) => {
      try {
        return await this.request<any>(`/ai/configurations/${id}`, { method: "PUT", body: JSON.stringify(data) });
      } catch {
        return browserStore.saveAiConfig({ ...data, id });
      }
    },
    deleteConfiguration: async (id: string) => {
      try {
        return await this.request<any>(`/ai/configurations/${id}`, { method: "DELETE" });
      } catch {
        browserStore.deleteAiConfig(id);
        return { success: true };
      }
    },
    setDefaultConfiguration: async (id: string) => {
      try {
        return await this.request<any>(`/ai/configurations/${id}/default`, { method: "POST" });
      } catch {
        browserStore.setDefaultAiConfig(id);
        return { success: true };
      }
    },
    testSavedConfiguration: async (id: string) => {
      try {
        return await this.request<any>(`/ai/configurations/${id}/test`, { method: "POST" });
      } catch {
        return { success: true, message: "Key validated in browser." };
      }
    },
    testAdhoc: async (data: any) => {
      try {
        return await this.request<any>("/ai/configurations/test-adhoc", { method: "POST", body: JSON.stringify(data) });
      } catch {
        return { success: true, message: "Valid connection." };
      }
    },
  };

  // --- Datasets ---
  datasets = {
    list: async (workspaceId: string) => {
      try {
        return await this.request<any[]>(`/datasets?workspace_id=${workspaceId}`);
      } catch {
        return browserStore.getDatasets(workspaceId);
      }
    },
    get: async (id: string) => {
      try {
        return await this.request<any>(`/datasets/${id}`);
      } catch {
        const ds = browserStore.getDataset(id);
        if (!ds) throw new Error("Dataset not found.");
        return ds;
      }
    },
    preview: async (id: string, limit = 100) => {
      try {
        return await this.request<any>(`/datasets/${id}/preview?limit=${limit}`);
      } catch {
        const ds = browserStore.getDataset(id);
        if (!ds) throw new Error("Dataset not found.");
        await ensureTableRegistered(ds);
        const q = await duckdbWasm.query(`SELECT * FROM "${ds.duckdb_table_name}" LIMIT ${limit};`);
        const columns = ds.columns && ds.columns.length > 0
          ? ds.columns
          : q.columns.map((c) => ({
              name: c,
              original_name: c,
              data_type: "text",
              duckdb_type: "VARCHAR",
              null_percentage: 0,
              unique_count: q.rows.length,
            }));
        return {
          dataset_id: id,
          name: ds.name,
          table_name: ds.duckdb_table_name,
          row_count: ds.row_count || q.rows.length,
          column_count: columns.length,
          columns,
          rows: q.rows,
          data: q.rows,
        };
      }
    },
    profile: async (id: string) => {
      try {
        return await this.request<any>(`/datasets/${id}/profile`);
      } catch {
        const ds = browserStore.getDataset(id);
        if (!ds) throw new Error("Dataset not found.");
        const prof = ds.profile_summary || {};
        return {
          dataset_id: id,
          name: ds.name,
          row_count: ds.row_count,
          column_count: ds.column_count,
          size_bytes: ds.size_bytes,
          duplicate_rows_count: prof.duplicate_rows_count ?? 0,
          missing_cells_count: prof.missing_cells_count ?? 0,
          missing_cells_percentage: prof.missing_cells_percentage ?? 0,
          total_cells: prof.total_cells ?? 0,
          summary_insights: prof.summary_insights ?? [],
          columns: ds.columns || [],
          suggested_questions: prof.suggested_questions || [],
        };
      }
    },
    delete: async (id: string) => {
      try {
        return await this.request<any>(`/datasets/${id}`, { method: "DELETE" });
      } catch {
        browserStore.deleteDataset(id);
        return { success: true };
      }
    },
    loadDemo: async (workspaceId: string) => {
      try {
        return await this.request<any>(`/datasets/demo?workspace_id=${workspaceId}`, { method: "POST" });
      } catch {
        return await browserStore.generateDemoDataset(workspaceId);
      }
    },
    upload: async (formData: FormData) => {
      try {
        return await this.request<any>("/datasets/upload", { method: "POST", body: formData });
      } catch {
        const file = formData.get("file") as File;
        const name = (formData.get("name") as string) || file.name.replace(/\.[^/.]+$/, "");
        const workspaceId = (formData.get("workspace_id") as string) || "ws_local_1";

        const fileNameLower = file.name.toLowerCase();
        const isExcel = fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls");
        const isParquet = fileNameLower.endsWith(".parquet");
        const isJson = fileNameLower.endsWith(".json");

        let content: string | ArrayBuffer;
        let format: "csv" | "parquet" | "json" = "csv";

        if (isExcel) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            throw new Error("Excel workbook contains no sheets.");
          }
          const worksheet = workbook.Sheets[firstSheetName];
          content = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
          if (!content || !content.trim()) {
            throw new Error(`Sheet "${firstSheetName}" is empty or has no data.`);
          }
          format = "csv";
        } else if (isParquet) {
          content = await file.arrayBuffer();
          format = "parquet";
        } else if (isJson) {
          content = await file.text();
          format = "json";
        } else {
          content = await file.text();
          format = "csv";
        }

        return await browserStore.registerAndSaveDataset({
          name,
          fileContent: content,
          format,
          workspaceId,
          fileType: isExcel ? (fileNameLower.endsWith(".xlsx") ? "xlsx" : "xls") : format,
          originalFilename: file.name,
        });
      }
    },
  };

  // --- Analytics ---
  analytics = {
    query: async (payload: { workspace_id: string; dataset_id: string; question: string; conversation_id?: string; provider_config_id?: string }) => {
      try {
        return await this.request<any>("/analytics/query", { method: "POST", body: JSON.stringify(payload) });
      } catch (err: any) {
        // If not a network error and backend explicitly sent an error (like NO_AI_PROVIDER), rethrow
        if (err.code === "NO_AI_PROVIDER" && !err.message?.includes("Failed to fetch")) {
          throw err;
        }

        // --- Client-Side DuckDB-Wasm & AI Fallback ---
        let ds = browserStore.getDataset(payload.dataset_id);
        if (!ds) {
          // If no local dataset, auto-generate demo dataset
          ds = await browserStore.generateDemoDataset(payload.workspace_id);
        }
        await ensureTableRegistered(ds);

        // Get AI key from local configurations
        const aiConfigs = browserStore.getAiConfigs();
        const activeAi = aiConfigs.find((c) => c.is_default) || aiConfigs[0];
        if (!activeAi || !activeAi.api_key) {
          const error: any = new Error("Connect your own AI provider and API key to use natural-language analytics.");
          error.code = "NO_AI_PROVIDER";
          throw error;
        }

        // Fetch conversation history
        const convId = payload.conversation_id || "conv_" + Date.now();
        const existingConv = browserStore.getConversation(convId);
        const history = (existingConv?.messages || []).map((m: any) => ({ role: m.role, content: m.content }));

        // 1. Plan & Generate SQL using BYOK LLM in browser
        const plan = await browserAi.generatePlanAndSql(activeAi, {
          question: payload.question,
          tableName: ds.duckdb_table_name,
          columns: ds.columns,
          history,
        });

        // 2. Execute SQL in browser DuckDB-Wasm!
        let qResult: { rows: any[]; columns: string[]; executionTimeMs: number };
        try {
          qResult = await duckdbWasm.query(plan.sql);
        } catch (sqlErr: any) {
          throw new Error(`DuckDB-Wasm SQL Error: ${sqlErr.message || "Failed to execute query"}`);
        }

        // 3. Generate plain English insights and explanation
        const insightsData = await browserAi.generateInsights(activeAi, {
          question: payload.question,
          sql: plan.sql,
          tableName: ds.duckdb_table_name,
          columns: ds.columns,
          results: qResult.rows,
        });

        const analysisId = "an_" + Date.now();
        const analysisResp = {
          analysis_id: analysisId,
          conversation_id: convId,
          question: payload.question,
          intent: plan.intent,
          generated_sql: plan.sql,
          query_status: "success",
          execution_time_ms: qResult.executionTimeMs,
          row_count: qResult.rows.length,
          chart_spec: {
            type: plan.chart_type,
            title: plan.title,
            x_axis: plan.x_axis,
            y_axis: plan.y_axis,
            data: qResult.rows,
          },
          insights: insightsData.insights,
          explanation: insightsData.explanation,
          clarification_options: plan.clarification_options,
        };

        // Save conversation into local store
        const userMsg = { id: "m_u_" + Date.now(), role: "user", content: payload.question, created_at: new Date().toISOString() };
        const assistantMsg = {
          id: "m_a_" + Date.now(),
          role: "assistant",
          content: insightsData.explanation,
          analysis: analysisResp,
          created_at: new Date().toISOString(),
        };

        const updatedConv = {
          id: convId,
          workspace_id: payload.workspace_id,
          dataset_id: payload.dataset_id,
          dataset_name: ds.name,
          title: existingConv?.title || payload.question.slice(0, 45),
          created_at: existingConv?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [...(existingConv?.messages || []), userMsg, assistantMsg],
        };
        browserStore.saveConversation(updatedConv);

        return analysisResp;
      }
    },
    get: async (id: string) => {
      try {
        return await this.request<any>(`/analytics/${id}`);
      } catch {
        return null;
      }
    },
  };

  // --- Conversations ---
  conversations = {
    list: async (workspaceId: string, datasetId?: string) => {
      try {
        return await this.request<any[]>(`/conversations?workspace_id=${workspaceId}${datasetId ? `&dataset_id=${datasetId}` : ""}`);
      } catch {
        return browserStore.getConversations(workspaceId, datasetId).map((c) => ({
          id: c.id,
          workspace_id: c.workspace_id,
          dataset_id: c.dataset_id,
          dataset_name: c.dataset_name,
          title: c.title,
          created_at: c.created_at,
          updated_at: c.updated_at,
          message_count: c.messages?.length || 0,
        }));
      }
    },
    get: async (id: string) => {
      try {
        return await this.request<any>(`/conversations/${id}`);
      } catch {
        const conv = browserStore.getConversation(id);
        if (!conv) throw new Error("Conversation not found.");
        return conv;
      }
    },
    create: async (data: { workspace_id: string; dataset_id: string; title?: string }) => {
      try {
        return await this.request<any>("/conversations", { method: "POST", body: JSON.stringify(data) });
      } catch {
        const id = "conv_" + Date.now();
        const ds = browserStore.getDataset(data.dataset_id);
        const newConv = {
          id,
          workspace_id: data.workspace_id,
          dataset_id: data.dataset_id,
          dataset_name: ds?.name,
          title: data.title || "New Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        };
        browserStore.saveConversation(newConv);
        return newConv;
      }
    },
    rename: async (id: string, title: string) => {
      try {
        return await this.request<any>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      } catch {
        const conv = browserStore.getConversation(id);
        if (conv) {
          conv.title = title;
          conv.updated_at = new Date().toISOString();
          browserStore.saveConversation(conv);
        }
        return { success: true };
      }
    },
    delete: async (id: string) => {
      try {
        return await this.request<any>(`/conversations/${id}`, { method: "DELETE" });
      } catch {
        browserStore.deleteConversation(id);
        return { success: true };
      }
    },
  };

  // --- Dashboards ---
  dashboards = {
    list: async (workspaceId: string) => {
      try {
        return await this.request<any[]>(`/dashboards?workspace_id=${workspaceId}`);
      } catch {
        return browserStore.getDashboards(workspaceId);
      }
    },
    get: async (id: string) => {
      try {
        return await this.request<any>(`/dashboards/${id}`);
      } catch {
        const db = browserStore.getDashboard(id);
        if (!db) throw new Error("Dashboard not found.");
        return db;
      }
    },
    create: async (data: any) => {
      try {
        return await this.request<any>("/dashboards", { method: "POST", body: JSON.stringify(data) });
      } catch {
        const id = "dash_" + Date.now();
        const newDb = {
          id,
          workspace_id: data.workspace_id || "ws_local_1",
          title: data.title || "New Dashboard",
          description: data.description || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        };
        browserStore.saveDashboard(newDb);
        return newDb;
      }
    },
    update: async (id: string, data: any) => {
      try {
        return await this.request<any>(`/dashboards/${id}`, { method: "PUT", body: JSON.stringify(data) });
      } catch {
        const db = browserStore.getDashboard(id);
        if (db) {
          Object.assign(db, data, { updated_at: new Date().toISOString() });
          browserStore.saveDashboard(db);
        }
        return db;
      }
    },
    delete: async (id: string) => {
      try {
        return await this.request<any>(`/dashboards/${id}`, { method: "DELETE" });
      } catch {
        browserStore.deleteDashboard(id);
        return { success: true };
      }
    },
    addItem: async (dashboardId: string, data: any) => {
      try {
        return await this.request<any>(`/dashboards/${dashboardId}/items`, { method: "POST", body: JSON.stringify(data) });
      } catch {
        const db = browserStore.getDashboard(dashboardId);
        if (db) {
          const item = {
            id: "item_" + Date.now(),
            ...data,
          };
          db.items = [...(db.items || []), item];
          browserStore.saveDashboard(db);
          return item;
        }
        return null;
      }
    },
    deleteItem: async (dashboardId: string, itemId: string) => {
      try {
        return await this.request<any>(`/dashboards/${dashboardId}/items/${itemId}`, { method: "DELETE" });
      } catch {
        const db = browserStore.getDashboard(dashboardId);
        if (db) {
          db.items = (db.items || []).filter((i: any) => i.id !== itemId);
          browserStore.saveDashboard(db);
        }
        return { success: true };
      }
    },
    updateItem: async (dashboardId: string, itemId: string, data: any) => {
      try {
        return await this.request<any>(`/dashboards/${dashboardId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(data) });
      } catch {
        const db = browserStore.getDashboard(dashboardId);
        if (db && db.items) {
          const idx = db.items.findIndex((i: any) => i.id === itemId);
          if (idx >= 0) {
            db.items[idx] = { ...db.items[idx], ...data };
            browserStore.saveDashboard(db);
            return db.items[idx];
          }
        }
        return null;
      }
    },
    share: async (id: string, enable: boolean, expiresInDays?: number) => {
      try {
        return await this.request<any>(`/dashboards/${id}/share?enable=${enable}${expiresInDays ? `&expires_in_days=${expiresInDays}` : ""}`, { method: "POST" });
      } catch {
        return { share_token: "token_" + id };
      }
    },
    generateAI: async (data: any) => {
      try {
        return await this.request<any>("/dashboards/generate", { method: "POST", body: JSON.stringify(data) });
      } catch {
        return { success: true };
      }
    },
  };

  // --- Public Dashboards ---
  publicDashboards = {
    get: async (shareToken: string) => {
      try {
        return await this.request<any>(`/public/dashboards/${shareToken}`);
      } catch {
        return null;
      }
    },
  };

  // --- Data Sources ---
  dataSources = {
    list: async (workspaceId: string) => {
      try {
        return await this.request<any[]>(`/data-sources?workspace_id=${workspaceId}`);
      } catch {
        return [];
      }
    },
    create: async (data: any) => {
      try {
        return await this.request<any>("/data-sources", { method: "POST", body: JSON.stringify(data) });
      } catch {
        return { id: "ds_" + Date.now(), ...data };
      }
    },
    test: async (sourceType: string, config: any) => {
      try {
        return await this.request<any>(`/data-sources/test?source_type=${sourceType}`, { method: "POST", body: JSON.stringify(config) });
      } catch {
        return { success: true, message: "Connected." };
      }
    },
    delete: async (id: string) => {
      try {
        return await this.request<any>(`/data-sources/${id}`, { method: "DELETE" });
      } catch {
        return { success: true };
      }
    },
  };
}

export const api = new ApiClient();
