import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { fetchDriverReport } from "../api";
import { DriverReportView } from "../components/DriverReportView";
import { DateRangePicker, dateRangeForPreset } from "../components/DateRangePicker";
import { driverReturnHref, navigateAdmin, normalizeReportDestination, reportApiRange, reportJobHref } from "../utils/reportNavigation";
import type { DriverReportJob } from "../driverReport.types";
import { downloadDriverReport } from "../utils/driverReportDownload";
import { useDriverOptions } from "../hooks/useDriverOptions";

function locationState() {
  const params = new URLSearchParams(window.location.search), fallback = dateRangeForPreset("7d");
  const destination = normalizeReportDestination(params.get("reportTab"), params.get("paymentMode"), params.get("roadType"));
  const filter = params.get("comparisonFilter");
  return { driver: params.get("driver") || "", ...destination, comparisonFilter: ["all", "missing", "differences"].includes(filter || "") ? filter! : "needs-review", selectedJob: params.get("reportJob") || "",
    from: params.get("from") || fallback.from!, to: params.get("to") || fallback.to!, groupBy: "day" as const,
    pages: Object.fromEntries(["jobs", "events", "visits", "charges", "roadAlerts"].map(key => [key, Number(params.get(`${key}Page`) || 1)])) };
}
const scrollKey = () => `tmv:report-position:${window.location.pathname}${window.location.search}`;
function rememberReportPosition() {
  try { sessionStorage.setItem(scrollKey(), JSON.stringify({ top: document.getElementById("operations-content")?.parentElement?.scrollTop ?? 0, windowY: window.scrollY })); } catch { /* Session storage may be unavailable in private contexts. */ }
}
export function DriverReportPage({ loadReport = fetchDriverReport }: { loadReport?: typeof fetchDriverReport } = {}) {
  const [state, setState] = useState(locationState);
  const driverRoster = useDriverOptions();
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState("");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => { exportController.current?.abort(); exportController.current = null; setExporting(null); setExportError("");
    return () => { exportController.current?.abort(); exportController.current = null; }; }, [state.driver, state.from, state.to, state.groupBy]);
  const exportReport = async (format: "pdf" | "xlsx") => {
    if (exportController.current) return;
    const controller = new AbortController(); exportController.current = controller; setExporting(format); setExportError("");
    try { await downloadDriverReport(state.driver, state.from, state.to, state.groupBy, format, controller.signal); }
    catch (error) { if (!controller.signal.aborted) setExportError(error instanceof Error ? error.message : "Report download failed."); }
    finally { if (exportController.current === controller) { exportController.current = null; setExporting(null); } }
  };
  useEffect(() => { const read = () => setState(locationState()); window.addEventListener("popstate", read); return () => window.removeEventListener("popstate", read); }, []);
  const update = (values: Record<string, string | number>, resetPages = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, String(value));
    if (resetPages) for (const key of [...Object.keys(state.pages), "liabilities"]) url.searchParams.delete(`${key}Page`);
    if (values.driver !== undefined || resetPages) { url.searchParams.delete("job"); url.searchParams.delete("reportJob"); }
    if (url.pathname + url.search === window.location.pathname + window.location.search) return;
    navigateAdmin(url.pathname + url.search);
  };
  const activityScheme = state.tab === "road" ? state.roadType : "all";
  const coreQuery = useQuery({ queryKey: ["driver_report", state.driver, state.from, state.to, state.groupBy, "core", state.pages],
    queryFn: ({ signal }) => loadReport(state.driver, { ...reportApiRange(state.from, state.to), groupBy: state.groupBy, pageSize: 25, detail: "core", activityScheme: "all",
      ...Object.fromEntries(Object.entries(state.pages).map(([key, value]) => [`${key}Page`, value])) }, signal),
    enabled: !!state.driver, retry: 1, staleTime: 30_000, gcTime: 5 * 60_000 });
  // Older backends may return a complete response to the core request; avoid fetching it twice.
  const needsDetails = ((coreQuery.data?.summary.completedJobs ?? 0) > 0 || state.tab === "road") && (coreQuery.data?.meta.gpsIncluded === false || activityScheme !== "all");
  const detailQuery = useQuery({ queryKey: ["driver_report", state.driver, state.from, state.to, state.groupBy, "full", state.pages, activityScheme],
    queryFn: ({ signal }) => loadReport(state.driver, { ...reportApiRange(state.from, state.to), groupBy: state.groupBy, pageSize: 25, activityScheme,
      detail: "full", ...Object.fromEntries(Object.entries(state.pages).map(([key, value]) => [`${key}Page`, value])) }, signal),
    enabled: !!state.driver && coreQuery.isSuccess && needsDetails, retry: 1, staleTime: 30_000, gcTime: 5 * 60_000 });
  const data = needsDetails ? detailQuery.data ?? coreQuery.data : coreQuery.data;
  const gpsLoading = needsDetails && !detailQuery.data && !detailQuery.isError;
  const gpsError = needsDetails && detailQuery.isError ? (detailQuery.error as Error)?.message || "Movement and charge details could not be loaded." : undefined;
  const reconciliationQuery = useQuery({ queryKey: ["driver_report", state.driver, state.from, state.to, state.groupBy, "reconciliation-all"],
    queryFn: async ({ signal }) => {
      const query = { ...reportApiRange(state.from, state.to), groupBy: state.groupBy, pageSize: 25, detail: "core", activityScheme: "all" };
      const first = await loadReport(state.driver, { ...query, jobsPage: 1 }, signal);
      const jobs: DriverReportJob[] = [...first.jobs.items];
      const pages = Math.ceil(first.jobs.total / first.jobs.pageSize);
      // The report endpoint supports pagination. Load all pages before applying a range filter.
      for (let page = 2; page <= pages; page++) {
        if (signal.aborted) throw new DOMException("Request aborted", "AbortError");
        const next = await loadReport(state.driver, { ...query, jobsPage: page }, signal);
        if (next.jobs.page !== page || next.jobs.items.length === 0) throw new Error("The report service did not return the requested job page.");
        jobs.push(...next.jobs.items);
      }
      const unique = [...new Map(jobs.map(job => [job.jobId, job])).values()];
      if (unique.length !== first.jobs.total) throw new Error("Job coverage changed while loading. Retry the selected range.");
      return unique;
    }, enabled: !!state.driver && coreQuery.isSuccess && state.tab === "payments" && state.paymentMode === "reconciliation" && (coreQuery.data?.jobs.total ?? 0) > (coreQuery.data?.jobs.items.length ?? 0), retry: 1, staleTime: 30_000, gcTime: 5 * 60_000 });
  useEffect(() => {
    if (!data || state.tab === "payments" && state.paymentMode === "reconciliation" && data.jobs.total > data.jobs.items.length && !reconciliationQuery.data && !reconciliationQuery.isError) return;
    let position: { top?: number; windowY?: number } | null = null;
    const key = scrollKey();
    try { const raw = sessionStorage.getItem(key); if (raw) position = JSON.parse(raw); } catch { return; }
    if (!position) return;
    const frame = requestAnimationFrame(() => {
      const container = document.getElementById("operations-content")?.parentElement;
      if (container && Number.isFinite(position?.top)) container.scrollTop = position!.top!;
      if (Number.isFinite(position?.windowY) && window.scrollY !== position!.windowY) window.scrollTo({ top: position!.windowY, behavior: "instant" });
      // StrictMode can cancel the first scheduled frame and replay this effect.
      // Consume the saved position only after a frame actually restores it.
      try { sessionStorage.removeItem(key); } catch { /* Scroll restoration works without storage access. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [data, reconciliationQuery.data, reconciliationQuery.isError, state.tab, state.paymentMode]);
  const driverLabel = (name: string, initials: string) => name && name !== initials ? `${name} (${initials})` : initials;
  const currentName = data?.driver.initials === state.driver ? data.driver.name : state.driver;
  const driverFilter = <div className="rpt-driver-filter">
    <label className="rpt-driver-label"><span className="sr-only">Driver</span>
      <select aria-label="Select report driver" value={state.driver} disabled={driverRoster.isLoading || !driverRoster.options.length}
        onChange={event => { if (event.target.value) update({ driver: event.target.value }, true); }}
        className="min-h-[44px] w-full rounded-md border border-admin-line bg-white px-3 py-2 text-sm text-admin-ink">
        {!state.driver && <option value="" disabled>Select driver</option>}
        {state.driver && !driverRoster.options.some(driver => driver.initials === state.driver) && <option value={state.driver}>{driverLabel(currentName, state.driver)}</option>}
        {driverRoster.options.map(driver => <option key={driver.initials} value={driver.initials}>{driverLabel(driver.fullName, driver.initials)}{!driver.active ? " (Inactive)" : ""}</option>)}
      </select>
    </label>
    {driverRoster.isError && <div className="flex items-center gap-2 text-xs text-red-700"><span role="status">Driver list unavailable</span><button type="button" title="Retry driver list" aria-label="Retry driver list" onClick={() => void driverRoster.refetch()} className="rounded-md border border-admin-line bg-white p-2"><RefreshCw size={16} /></button></div>}
  </div>;
  if (!state.driver) return <>{driverFilter}<section className="py-12 text-center text-admin-muted"><h1 className="text-xl font-semibold">No driver selected</h1><button className="mt-4 text-admin-brand" onClick={() => navigateAdmin(`${window.location.pathname}?section=drivers`)}>Drivers</button></section></>;
  if (coreQuery.isLoading && !data) return <>{driverFilter}<DateRangePicker scope="report" from={state.from} to={state.to} onChange={(from, to) => { if (from && to) update({ from, to }, true); }} /><div role="status" className="flex justify-center items-center gap-3 min-h-[300px] text-admin-muted"><Loader2 className="animate-spin" size={22} />Loading driver report</div></>;
  if (!data) return <>{driverFilter}<section><DateRangePicker scope="report" from={state.from} to={state.to} onChange={(from, to) => { if (from && to) update({ from, to }, true); }} /><div role="alert" className="py-12 text-center text-red-700"><AlertCircle className="mx-auto mb-3" /><p>{(coreQuery.error as Error)?.message || "Driver report unavailable"}</p><button title="Retry driver report" aria-label="Retry driver report" onClick={() => void coreQuery.refetch()} className="inline-flex mt-4 p-3 border border-admin-line rounded-md"><RefreshCw size={18} /></button></div></section></>;
  return <DriverReportView report={data} tab={state.tab} from={state.from} to={state.to} groupBy={state.groupBy} refreshing={coreQuery.isFetching || detailQuery.isFetching} driverFilter={driverFilter}
    paymentMode={state.paymentMode} onPaymentMode={mode => update({ reportTab: "payments", paymentMode: mode })}
    comparisonFilter={state.comparisonFilter} onComparisonFilter={filter => update({ comparisonFilter: filter })}
    selectedReportJob={state.selectedJob} onSelectReportJob={id => update({ reportJob: id })}
    roadType={state.roadType} onRoadType={type => update({ reportTab: "road", roadType: type }, true)}
    reconciliationJobs={reconciliationQuery.data ?? (data.jobs.total <= data.jobs.items.length ? data.jobs.items : undefined)}
    reconciliationLoading={state.tab === "payments" && state.paymentMode === "reconciliation" && data.jobs.total > data.jobs.items.length && !reconciliationQuery.data && !reconciliationQuery.isError}
    reconciliationError={reconciliationQuery.isError ? (reconciliationQuery.error as Error)?.message : undefined} onRetryReconciliation={() => void reconciliationQuery.refetch()}
    reportError={coreQuery.isError ? (coreQuery.error as Error)?.message : undefined}
    gpsLoading={gpsLoading} gpsError={gpsError} onRetryGps={() => void detailQuery.refetch()}
    onExport={format => void exportReport(format)} exporting={exporting} exportError={exportError}
    onTab={tab => update({ reportTab: tab, paymentMode: state.paymentMode, roadType: state.roadType })} onGroup={group => update({ groupBy: group }, true)} onPage={(key, page) => update({ [`${key}Page`]: page })}
    onDates={(from, to) => { if (from && to) update({ from, to }, true); }}
    onJob={id => { rememberReportPosition(); const job = data.jobs.items.find(row => row.jobId === id); navigateAdmin(reportJobHref(id, !job || job.status === "COMPLETED")); }}
    onBack={() => { const origin = driverReturnHref(); if (origin) { navigateAdmin(origin); return; } const url = new URL(window.location.pathname, window.location.origin); url.searchParams.set("section", "drivers"); url.searchParams.set("driversTab", "performance"); url.searchParams.set("from", state.from); url.searchParams.set("to", state.to); navigateAdmin(url.pathname + url.search); }}
    onRefresh={() => { void coreQuery.refetch(); if (needsDetails) void detailQuery.refetch(); }} />;
}
