import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = typeof localStorage !== "undefined" ? (localStorage.getItem("ucol-theme") as Theme | null) : null;
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("light", theme === "light");
    el.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("ucol-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);

// Concrete color strings for JS-driven surfaces (Recharts, SVG stroke) that can't use opacity utilities.
export function chartColors(theme: Theme) {
  const light = theme === "light";
  return {
    axis: light ? "#5b5c6b" : "#ffffff66",
    grid: light ? "#00000010" : "#ffffff0d",
    ringTrack: light ? "#00000014" : "#ffffff14",
    emptyCell: light ? "#0000000a" : "#ffffff08",
    tip: {
      background: light ? "#ffffff" : "#14141c",
      border: `1px solid ${light ? "#0000001f" : "#ffffff20"}`,
      borderRadius: 8,
      fontSize: 12,
      color: light ? "#1b1c24" : "#e9e9f1",
    },
  };
}
