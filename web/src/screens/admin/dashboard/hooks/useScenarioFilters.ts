import { useState } from "react";
import { defaultDashboardDateRange } from "../components/DateRangePicker";

export interface ScenarioFilters {
  from?: string;
  to?: string;
  driverFilter: string;
  searchQuery: string;
}
export interface ScenarioFilterControl {
  value: ScenarioFilters;
  onChange: (patch: Partial<ScenarioFilters>) => void;
}
export const defaultScenarioFilters = (): ScenarioFilters => {
  const params = new URLSearchParams(window.location.search);
  const defaults = defaultDashboardDateRange();
  return { from: params.get("evidenceAllDates") === "1" ? undefined : params.get("from") || defaults.from, to: params.get("evidenceAllDates") === "1" ? undefined : params.get("to") || defaults.to,
    driverFilter: params.get("evidenceDriver") || "", searchQuery: params.get("evidenceSearch") || "" };
};

export function useScenarioFilters(control?: ScenarioFilterControl) {
  const [local, setLocal] = useState(defaultScenarioFilters);
  const update = (patch: Partial<ScenarioFilters>) => {
    const url = new URL(window.location.href);
    const keys = { from: "from", to: "to", driverFilter: "evidenceDriver", searchQuery: "evidenceSearch" };
    Object.entries(patch).forEach(([key, value]) => value ? url.searchParams.set(keys[key as keyof ScenarioFilters], value) : url.searchParams.delete(keys[key as keyof ScenarioFilters]));
    if ("from" in patch || "to" in patch) { if (!url.searchParams.has("from") && !url.searchParams.has("to")) url.searchParams.set("evidenceAllDates", "1"); else url.searchParams.delete("evidenceAllDates"); }
    window.history.replaceState({}, "", url.pathname + url.search);
    if (control) control.onChange(patch);
    else setLocal(previous => ({ ...previous, ...patch }));
  };
  return { ...(control?.value ?? local),
    setFrom: (from?: string) => update({ from }), setTo: (to?: string) => update({ to }),
    setDriverFilter: (driverFilter: string) => update({ driverFilter }), setSearchQuery: (searchQuery: string) => update({ searchQuery }) };
}
