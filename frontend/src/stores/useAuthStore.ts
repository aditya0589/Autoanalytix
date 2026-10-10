import { create } from "zustand";
import { api } from "../services/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  owner_id: string;
}

interface AuthState {
  user: User | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspaces: [],
  currentWorkspace: null,
  isAuthenticated: !!localStorage.getItem("autoanalytix_token"),
  isLoading: true,

  login: async (token: string, user: User) => {
    api.setToken(token);
    set({ user, isAuthenticated: true });
    await get().loadUser();
  },

  logout: () => {
    api.clearToken();
    set({ user: null, workspaces: [], currentWorkspace: null, isAuthenticated: false });
    window.location.href = "/login";
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });
      const data = await api.auth.getMe();
      const currentWs =
        data.workspaces.find((w: Workspace) => w.id === localStorage.getItem("autoanalytix_current_ws")) ||
        data.workspaces[0] ||
        null;

      if (currentWs) {
        localStorage.setItem("autoanalytix_current_ws", currentWs.id);
      }

      set({
        user: data.user,
        workspaces: data.workspaces,
        currentWorkspace: currentWs,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      api.clearToken();
      set({ user: null, workspaces: [], currentWorkspace: null, isAuthenticated: false, isLoading: false });
    }
  },

  setCurrentWorkspace: (workspace: Workspace) => {
    localStorage.setItem("autoanalytix_current_ws", workspace.id);
    set({ currentWorkspace: workspace });
  },
}));
