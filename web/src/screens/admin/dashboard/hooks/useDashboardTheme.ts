import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type DashboardTheme = "light" | "dark";
export type DashboardThemePreference = DashboardTheme | "system";
export const DASHBOARD_THEME_KEY = "tmv:dashboard-theme";

function readPreference(): DashboardThemePreference {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemIsDark() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Dashboard preferences are independent of the driver application's theme.
 * The document attribute also reaches dialogs rendered through body portals,
 * and is restored when the authenticated dashboard unmounts. */
export function useDashboardTheme() {
  const [preference, setPreferenceState] = useState<DashboardThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemIsDark);
  const resolved: DashboardTheme = preference === "system"
    ? systemDark ? "dark" : "light"
    : preference;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", update);
    setSystemDark(query.matches);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === DASHBOARD_THEME_KEY || event.key === null)
        setPreferenceState(readPreference());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useLayoutEffect(() => {
    const previous = document.documentElement.getAttribute("data-dashboard-theme");
    return () => {
      if (previous === null) document.documentElement.removeAttribute("data-dashboard-theme");
      else document.documentElement.setAttribute("data-dashboard-theme", previous);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-dashboard-theme", resolved);
  }, [resolved]);

  const setPreference = useCallback((next: DashboardThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") window.localStorage.removeItem(DASHBOARD_THEME_KEY);
      else window.localStorage.setItem(DASHBOARD_THEME_KEY, next);
    } catch {
      // Theme selection still works when browser storage is unavailable.
    }
  }, []);

  return { preference, resolved, setPreference };
}
