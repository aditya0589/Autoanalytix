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
    login: (credentials: any) => this.request<any>("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    register: (userData: any) => this.request<any>("/auth/register", { method: "POST", body: JSON.stringify(userData) }),
    getMe: () => this.request<any>("/auth/me"),
  };

  // --- AI Providers (BYOK) ---
  ai = {
    getProviders: () => this.request<any[]>("/ai/providers"),
    getConfigurations: (workspaceId: string) => this.request<any[]>(`/ai/configurations?workspace_id=${workspaceId}`),
    createConfiguration: (workspaceId: string, data: any) =>
      this.request<any>(`/ai/configurations?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) }),
    updateConfiguration: (id: string, data: any) =>
      this.request<any>(`/ai/configurations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteConfiguration: (id: string) =>
      this.request<any>(`/ai/configurations/${id}`, { method: "DELETE" }),
    setDefaultConfiguration: (id: string) =>
      this.request<any>(`/ai/configurations/${id}/default`, { method: "POST" }),
    testSavedConfiguration: (id: string) =>
      this.request<any>(`/ai/configurations/${id}/test`, { method: "POST" }),
    testAdhoc: (data: any) =>
      this.request<any>("/ai/configurations/test-adhoc", { method: "POST", body: JSON.stringify(data) }),
  };

  // --- Datasets ---
  datasets = {
    list: (workspaceId: string) => this.request<any[]>(`/datasets?workspace_id=${workspaceId}`),
    get: (id: string) => this.request<any>(`/datasets/${id}`),
    preview: (id: string, limit = 100) => this.request<any>(`/datasets/${id}/preview?limit=${limit}`),
    profile: (id: string) => this.request<any>(`/datasets/${id}/profile`),
    delete: (id: string) => this.request<any>(`/datasets/${id}`, { method: "DELETE" }),
    loadDemo: (workspaceId: string) =>
      this.request<any>(`/datasets/demo?workspace_id=${workspaceId}`, { method: "POST" }),
    upload: (formData: FormData) =>
      this.request<any>("/datasets/upload", { method: "POST", body: formData }),
  };

  // --- Analytics ---
  analytics = {
    query: (payload: { workspace_id: string; dataset_id: string; question: string; conversation_id?: string; provider_config_id?: string }) =>
      this.request<any>("/analytics/query", { method: "POST", body: JSON.stringify(payload) }),
    get: (id: string) => this.request<any>(`/analytics/${id}`),
  };

  // --- Conversations ---
  conversations = {
    list: (workspaceId: string, datasetId?: string) =>
      this.request<any[]>(`/conversations?workspace_id=${workspaceId}${datasetId ? `&dataset_id=${datasetId}` : ""}`),
    get: (id: string) => this.request<any>(`/conversations/${id}`),
    delete: (id: string) => this.request<any>(`/conversations/${id}`, { method: "DELETE" }),
  };

  // --- Dashboards ---
  dashboards = {
    list: (workspaceId: string) => this.request<any[]>(`/dashboards?workspace_id=${workspaceId}`),
    get: (id: string) => this.request<any>(`/dashboards/${id}`),
    create: (data: any) => this.request<any>("/dashboards", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => this.request<any>(`/dashboards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => this.request<any>(`/dashboards/${id}`, { method: "DELETE" }),
    addItem: (dashboardId: string, data: any) =>
      this.request<any>(`/dashboards/${dashboardId}/items`, { method: "POST", body: JSON.stringify(data) }),
    deleteItem: (dashboardId: string, itemId: string) =>
      this.request<any>(`/dashboards/${dashboardId}/items/${itemId}`, { method: "DELETE" }),
    share: (id: string, enable: boolean, expiresInDays?: number) =>
      this.request<any>(`/dashboards/${id}/share?enable=${enable}${expiresInDays ? `&expires_in_days=${expiresInDays}` : ""}`, { method: "POST" }),
    generateAI: (data: any) =>
      this.request<any>("/dashboards/generate", { method: "POST", body: JSON.stringify(data) }),
  };

  // --- Public Dashboards ---
  publicDashboards = {
    get: (shareToken: string) => this.request<any>(`/public/dashboards/${shareToken}`),
  };

  // --- Data Sources ---
  dataSources = {
    list: (workspaceId: string) => this.request<any[]>(`/data-sources?workspace_id=${workspaceId}`),
    create: (data: any) => this.request<any>("/data-sources", { method: "POST", body: JSON.stringify(data) }),
    test: (sourceType: string, config: any) =>
      this.request<any>(`/data-sources/test?source_type=${sourceType}`, { method: "POST", body: JSON.stringify(config) }),
    delete: (id: string) => this.request<any>(`/data-sources/${id}`, { method: "DELETE" }),
  };
}

export const api = new ApiClient();
