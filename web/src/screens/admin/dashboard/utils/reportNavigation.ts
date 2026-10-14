import { DateTime } from "luxon";
export type CanonicalReportTab = "summary" | "jobs" | "payments" | "road";
export type RoadType = "all" | "tunnel" | "congestion";
export function normalizeReportDestination(tab?: string | null, paymentMode?: string | null, roadType?: string | null) {
  const mapped: CanonicalReportTab = tab === "comparison" ? "payments" : tab === "performance" ? "jobs" : tab === "tunnels" || tab === "congestion" ? "road" :
    tab === "jobs" || tab === "payments" || tab === "road" ? tab : "summary";
  return { tab: mapped, paymentMode: tab === "comparison" || paymentMode === "reconciliation" ? "reconciliation" as const : "overview" as const,
    roadType: tab === "tunnels" ? "tunnel" as const : tab === "congestion" ? "congestion" as const : roadType === "tunnel" || roadType === "congestion" ? roadType : "all" as const,
    timingView: tab === "performance" };
}
export function driverReportHref(initials: string, from?: string, to?: string, tab = "summary") {
  const source = new URL(window.location.href);
  const url = new URL(source.pathname, source.origin);
  const destination = normalizeReportDestination(tab);
  url.searchParams.set("section", "driverreport"); url.searchParams.set("driver", initials); url.searchParams.set("reportTab", destination.tab);
  if (destination.paymentMode === "reconciliation") url.searchParams.set("paymentMode", "reconciliation");
  if (destination.roadType !== "all") url.searchParams.set("roadType", destination.roadType);
  if (destination.timingView) url.searchParams.set("timingView", "performance");
  if (source.searchParams.get("section") === "drivers") url.searchParams.set("driverReturn", source.pathname + source.search);
  if (from) url.searchParams.set("from", from); else url.searchParams.delete("from");
  if (to) url.searchParams.set("to", to); else url.searchParams.delete("to");
  return url.pathname + url.search;
}
export function navigateAdmin(href: string) {
  if (!window.dispatchEvent(new CustomEvent("tmv:before-navigate", { detail: { href }, cancelable: true }))) return;
  window.history.pushState({}, "", href); window.dispatchEvent(new PopStateEvent("popstate"));
}
export function reportJobHref(id: string, finished = true) {
  const source = new URL(window.location.href);
  source.searchParams.delete("job"); source.searchParams.delete("reportReturn"); source.searchParams.delete("recordReturn");
  const url = new URL(source.pathname, source.origin);
  url.searchParams.set("section", "jobs"); url.searchParams.set("job", id);
  if (source.searchParams.get("section") === "driverreport") url.searchParams.set("reportReturn", source.pathname + source.search);
  return url.pathname + url.search;
}
/** Records open the exact canonical job; origin-only state stays in the return URL. */
export function recordJobHref(id: string) {
  const source = new URL(window.location.href);
  source.searchParams.delete("job"); source.searchParams.delete("reportReturn"); source.searchParams.delete("recordReturn");
  const url = new URL(source.pathname, source.origin);
  url.searchParams.set("section", "jobs"); url.searchParams.set("job", id);
  if (["livefleet", "overview", "drivers", "van", "liabilities", "notifications", "alerts"].includes(source.searchParams.get("section") || "")) url.searchParams.set("recordReturn", source.pathname + source.search);
  return url.pathname + url.search;
}
export function recordReturnHref(): string | null {
  const raw = new URLSearchParams(window.location.search).get("recordReturn");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !["livefleet", "overview", "drivers", "van", "liabilities", "notifications", "alerts"].includes(url.searchParams.get("section") || "")) return null;
    url.searchParams.delete("job"); url.searchParams.delete("reportReturn"); url.searchParams.delete("recordReturn");
    return url.pathname + url.search;
  } catch { return null; }
}
export function fleetReturnHref(): string | null {
  const href = recordReturnHref();
  return href && new URL(href, window.location.origin).searchParams.get("section") === "livefleet" ? href : null;
}
export function driverReturnHref(): string | null {
  const raw = new URLSearchParams(window.location.search).get("driverReturn");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.searchParams.get("section") !== "drivers") return null;
    for (const key of ["job", "reportReturn", "recordReturn", "driverReturn"]) url.searchParams.delete(key);
    return url.pathname + url.search;
  } catch { return null; }
}
export function reportReturnHref(): string | null {
  const raw = new URLSearchParams(window.location.search).get("reportReturn");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.searchParams.get("section") !== "driverreport" ||
      !/^[A-Z0-9_-]{1,24}$/.test(url.searchParams.get("driver") || "")) return null;
    url.searchParams.delete("job"); url.searchParams.delete("reportReturn");
    return url.pathname + url.search;
  } catch { return null; }
}
export function retainRangeInUrl(from?: string, to?: string) {
  const url = new URL(window.location.href);
  for (const [key, value] of [["from", from], ["to", to]]) { if (value) url.searchParams.set(key!, value); else url.searchParams.delete(key!); }
  window.history.replaceState({}, "", url.pathname + url.search);
}
export function reportApiRange(from: string, to: string) {
  return { from, to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : DateTime.fromISO(to).plus({ milliseconds: 1 }).toUTC().toISO()! };
}
export function londonDateInput(value?: string) { return value ? DateTime.fromISO(value, { zone: "Europe/London" }).setZone("Europe/London").toISODate() || "" : ""; }
