import { create } from "zustand";

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (val: boolean) => void;
}

const getInitialTheme = (): boolean => {
  const saved = localStorage.getItem("autoanalytix_theme");
  if (saved) {
    return saved === "dark";
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark;
      localStorage.setItem("autoanalytix_theme", next ? "dark" : "light");
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { isDark: next };
    }),
  setDark: (val: boolean) => {
    localStorage.setItem("autoanalytix_theme", val ? "dark" : "light");
    if (val) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ isDark: val });
  },
}));

// Apply class immediately on module evaluation
if (typeof window !== "undefined") {
  if (getInitialTheme()) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
