import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * "system" is a stored *preference*, not a resolved theme — the app still only
 * ever renders light or dark. Keeping the two apart is what lets the UI show
 * System as selected while following the OS live, which a plain light/dark
 * boolean cannot express.
 */
export type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type Ctx = {
  /** What the student picked. */
  theme: ThemePref;
  /** What is actually on screen right now. */
  resolved: Resolved;
  setTheme: (t: ThemePref) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "klausum-theme";

function systemTheme(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(pref: ThemePref): Resolved {
  return pref === "system" ? systemTheme() : pref;
}

function applyTheme(t: Resolved) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>("light");
  const [resolved, setResolved] = useState<Resolved>("light");

  // Hydrate from localStorage on mount
  useEffect(() => {
    let stored: ThemePref = "light";
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "light";
    } catch {}
    if (stored !== "light" && stored !== "dark" && stored !== "system") stored = "light";
    const r = resolve(stored);
    setThemeState(stored);
    setResolved(r);
    applyTheme(r);
  }, []);

  // Follow the OS while "system" is selected. Without this the choice would
  // only take effect on reload, which is not what "System" means to anyone.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = systemTheme();
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    const r = resolve(t);
    setResolved(r);
    applyTheme(r);
  };

  // The quick toggle flips what you can currently see, and commits to it —
  // toggling out of System into an explicit choice is the least surprising
  // behaviour.
  const toggle = () => setTheme(resolved === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
