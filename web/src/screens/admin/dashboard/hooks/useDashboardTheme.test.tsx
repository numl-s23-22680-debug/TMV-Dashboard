import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_THEME_KEY, useDashboardTheme } from "./useDashboardTheme";

describe("dashboard theme preference", () => {
  let dark: boolean;
  let listeners: Set<(event: MediaQueryListEvent) => void>;
  beforeEach(() => {
    localStorage.removeItem(DASHBOARD_THEME_KEY);
    document.documentElement.removeAttribute("data-dashboard-theme");
    dark = false;
    listeners = new Set();
    vi.stubGlobal("matchMedia", () => ({
      get matches() { return dark; },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(DASHBOARD_THEME_KEY);
    document.documentElement.removeAttribute("data-dashboard-theme");
  });
  const changeSystem = (next: boolean) => act(() => {
    dark = next;
    listeners.forEach(listener => listener({ matches: next } as MediaQueryListEvent));
  });

  it("follows changes to the system when no explicit preference exists", () => {
    const { result } = renderHook(useDashboardTheme);
    expect(result.current.preference).toBe("system");
    expect(result.current.resolved).toBe("light");
    changeSystem(true);
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.dataset.dashboardTheme).toBe("dark");
    expect(localStorage.getItem(DASHBOARD_THEME_KEY)).toBeNull();
  });

  it("persists an explicit choice and ignores subsequent system changes", () => {
    const { result, unmount } = renderHook(useDashboardTheme);
    act(() => result.current.setPreference("dark"));
    expect(localStorage.getItem(DASHBOARD_THEME_KEY)).toBe("dark");
    changeSystem(false);
    expect(result.current.resolved).toBe("dark");
    unmount();
    const next = renderHook(useDashboardTheme);
    expect(next.result.current.preference).toBe("dark");
    expect(next.result.current.resolved).toBe("dark");
  });

  it("returning to System removes the override and uses the current system theme", () => {
    localStorage.setItem(DASHBOARD_THEME_KEY, "light");
    const { result } = renderHook(useDashboardTheme);
    changeSystem(true);
    expect(result.current.resolved).toBe("light");
    act(() => result.current.setPreference("system"));
    expect(result.current.resolved).toBe("dark");
    expect(localStorage.getItem(DASHBOARD_THEME_KEY)).toBeNull();
  });

  it("restores the document on unmount without touching the driver theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { unmount } = renderHook(useDashboardTheme);
    expect(document.documentElement.dataset.dashboardTheme).toBe("light");
    unmount();
    expect(document.documentElement.hasAttribute("data-dashboard-theme")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(listeners.size).toBe(0);
  });

  it("ignores an invalid stored preference", () => {
    localStorage.setItem(DASHBOARD_THEME_KEY, "invalid");
    dark = true;
    const { result } = renderHook(useDashboardTheme);
    expect(result.current.preference).toBe("system");
    expect(result.current.resolved).toBe("dark");
  });

  it("still switches when local storage is blocked", () => {
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const { result } = renderHook(useDashboardTheme);
    act(() => result.current.setPreference("dark"));
    expect(result.current.resolved).toBe("dark");
    write.mockRestore();
  });
});
