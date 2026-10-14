import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { Modal } from "../../../../ui/Modal";
import type { DriverReport, ReportRoadAlert } from "../driverReport.types";
import type { RoadType } from "../utils/reportNavigation";
import { ManualRoadChargeCard } from "./ManualRoadChargeCard";
import { fetchDriverReport } from "../api";
import "./road-fleet.css";

const money = (pence: number | null) => pence === null ? "Not calculated" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const date = (instant: string | null) => instant ? DateTime.fromISO(instant).setZone("Europe/London").toFormat("dd LLL yyyy, HH:mm") : "Not recorded";
export function roadZoneLabel(row: ReportRoadAlert) {
  const names = row.zone.split(",").map(name => name.replace(/\bcharges?\s*(?:[-\x3a|/&]|\band\b)?\s*alerts?\b/gi, "")
    .replace(/\b(?:charges?|alerts?)\b/gi, "").replace(/\s*[-\x3a|/]\s*(?=[-\x3a|/]|$)/g, "").replace(/^\s*[-\x3a|/]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  return [...new Set(names)].join(", ") || (row.scheme === "congestion" ? "Congestion Zone" : row.scheme === "dartford" ? "Dartford Crossing" : "Blackwall / Silvertown Tunnels");
}
const feeLabel = (row: ReportRoadAlert) => row.estimatedPence !== null ? money(row.estimatedPence) : row.feeReason || (!row.jobId ? "Needs job match" : "Fee unavailable");
export function RoadChargeMetricItems({ summary, type }: { summary: DriverReport["roadAlertSummary"]; type: RoadType }) {
  const values: Array<[string, string | number]> = [["Recorded zone entries", summary?.entries ?? "Unavailable"], ["Entries marked chargeable", summary?.chargeableEntries ?? "Unavailable"],
    [summary?.unpricedEntries ? "Known estimate subtotal" : "Expected fees", !summary ? "Unavailable" : summary.unpricedEntries === summary.entries && !!summary.entries ? "Fees unavailable" : money(summary.estimatedKnownPence)]];
  return <>{values.map(([label, value]) => <div className="rpt-metric" key={label}><div className="rpt-metric-label">{label}</div><strong className={String(value).length > 10 ? "rpt-road-value-long" : undefined}>{value}</strong>
    {label.includes("estimate") && <small className="rpt-metric-caption">{summary!.entries - summary!.unpricedEntries} of {summary!.entries} entries priced</small>}
  </div>)}</>;
}
function ChargeRules({ type, report }: { type: RoadType; report: DriverReport }) {
  return <details className="road-rules"><summary>View charge rules</summary>
    <p>London time (Europe/London). Reference schedule already used by this application; scheme logic remains separate. An entry does not by itself establish a payable authority charge.</p>
    <dl>{type !== "congestion" && <div><dt>Tunnel schemes</dt><dd>Monday–Sunday, 06:00–22:00</dd></div>}{type !== "tunnel" && <div><dt>Congestion</dt><dd>Monday–Friday, 07:00–18:00; Saturday–Sunday, 12:00–18:00</dd></div>}
      <div><dt>Rate basis</dt><dd>See each event: saved job pricing snapshot or current settings estimate.</dd></div><div><dt>Effective date</dt><dd>Not supplied by the report API. Generated {date(report.generatedAt)}.</dd></div>
    </dl>
  </details>;
}
export function DriverRoadAlerts({ report, type, onJob, onPage, embedded = false }: { report: DriverReport; type: RoadType; onJob: (id: string) => void; onPage: (key: string, page: number) => void; embedded?: boolean }) {
  const [selected, setSelected] = useState<ReportRoadAlert | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "unlinked">(() => !embedded && new URLSearchParams(window.location.search).get("reportRoadFilter") === "unlinked" ? "unlinked" : "all");
  const [filteredPage, setFilteredPage] = useState(() => Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get("reportRoadPage"))) || 1));
  const [rangeEvents, setRangeEvents] = useState<ReportRoadAlert[] | null>(null);
  const [rangeError, setRangeError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const scopeRef = useRef(`${report.driver.initials}:${report.range.from}:${report.range.to}:${type}`);
  const changeFilter = (filter: "all" | "unlinked") => {
    setEventFilter(filter); setFilteredPage(1);
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === "driverreport") {
      if (filter === "unlinked") url.searchParams.set("reportRoadFilter", "unlinked"); else url.searchParams.delete("reportRoadFilter");
      url.searchParams.delete("reportRoadPage");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  };
  const changeFilteredPage = (page: number) => {
    setFilteredPage(page);
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === "driverreport") { url.searchParams.set("reportRoadPage", String(page)); window.history.replaceState(window.history.state, "", url.pathname + url.search); }
  };
  useEffect(() => setSelected(null), [report.driver.initials, report.range.from, report.range.to, type]);
  useEffect(() => {
    const scope = `${report.driver.initials}:${report.range.from}:${report.range.to}:${type}`;
    if (scopeRef.current !== scope) { scopeRef.current = scope; changeFilter("all"); setRangeEvents(null); setRangeError(""); }
  }, [report.driver.initials, report.range.from, report.range.to, type]);
  useEffect(() => {
    if (embedded || eventFilter !== "unlinked") return;
    const controller = new AbortController();
    setRangeEvents(null); setRangeError("");
    const load = async () => {
      if (report.roadAlerts?.page === 1 && report.roadAlerts.items.length === report.roadAlerts.total) return report.roadAlerts.items;
      const query = { from: report.range.from, to: report.range.to, detail: "full", activityScheme: type, pageSize: 100 };
      const first = await fetchDriverReport(report.driver.initials, { ...query, roadAlertsPage: 1 }, controller.signal);
      if (!first.roadAlerts) throw new Error("The report service did not return road-event history.");
      const rows = [...first.roadAlerts.items];
      for (let page = 2; page <= Math.ceil(first.roadAlerts.total / first.roadAlerts.pageSize); page++) {
        const next = await fetchDriverReport(report.driver.initials, { ...query, roadAlertsPage: page }, controller.signal);
        if (!next.roadAlerts || next.roadAlerts.page !== page || !next.roadAlerts.items.length) throw new Error("The report service did not return the requested road-event page.");
        rows.push(...next.roadAlerts.items);
      }
      const unique = [...new Map(rows.map(row => [row.id, row])).values()];
      if (unique.length !== first.roadAlerts.total) throw new Error("Road-event coverage changed while loading. Retry the selected range.");
      return unique;
    };
    void load().then(rows => { if (!controller.signal.aborted) setRangeEvents(rows); }).catch(error => { if (!controller.signal.aborted) setRangeError(error instanceof Error ? error.message : "Complete-range road events could not be loaded."); });
    return () => controller.abort();
  }, [eventFilter, report.driver.initials, report.range.from, report.range.to, type, report.generatedAt, report.roadAlerts?.total, retryVersion, embedded]);
  const filtered = eventFilter === "unlinked" && rangeEvents ? rangeEvents.filter(row => !row.jobId) : null;
  useEffect(() => {
    if (!filtered) return;
    const maximum = Math.max(1, Math.ceil(filtered.length / 25));
    if (filteredPage > maximum) changeFilteredPage(maximum);
  }, [filtered?.length, filteredPage]);
  const page = filtered ? { items: filtered.slice((filteredPage - 1) * 25, filteredPage * 25), total: filtered.length, page: filteredPage, pageSize: 25 } : report.roadAlerts;
  const filtering = eventFilter === "unlinked" && !rangeEvents;
  const summary = filtering ? undefined : filtered ? { entries: filtered.length, chargeableEntries: filtered.filter(row => row.chargeable).length,
    estimatedKnownPence: filtered.reduce((sum, row) => sum + (row.estimatedPence ?? 0), 0), unpricedEntries: filtered.filter(row => row.estimatedPence === null).length } : report.roadAlertSummary;
  if (!page) return <section className="rpt-section"><h2>Road charges</h2><p role="status">Road-event history could not be loaded. Return to the report and retry.</p></section>;
  const unlinked = page.items.filter(row => !row.jobId).length;
  const partial = !!report.alertHistoryTruncated || !!report.gpsSummary.truncated || report.gpsSummary.coverage !== "complete";
  const unavailable = ["unavailable", "not-requested"].includes(report.gpsSummary.coverage);
  const totalPages = Math.ceil(page.total / page.pageSize);
  return <>
    {!embedded && <div className="road-review-filter" aria-label="Road-event review filter"><div>{(["all", "unlinked"] as const).map(filter => <button key={filter} type="button" aria-pressed={eventFilter === filter} onClick={() => changeFilter(filter)}>{filter === "all" ? "All events" : "Unlinked events"}</button>)}</div><span>{eventFilter === "unlinked" ? "Reviewing job matches across the complete selected range" : "All returned events, including those without a job match"}</span></div>}
    <div className="rpt-metrics"><RoadChargeMetricItems summary={unavailable ? undefined : summary} type={type} />
      {type !== "all" ? <ManualRoadChargeCard totals={report.summary.manualRoadChargeTotals?.[type]} /> : <div className="rpt-metric"><div className="rpt-metric-label">Driver-reported fees</div>
        {(["tunnel", "congestion"] as const).map(scheme => { const totals = report.summary.manualRoadChargeTotals?.[scheme]; return <p key={scheme} className="road-reported"><span>{scheme === "tunnel" ? "Tunnel" : "Congestion"}</span><b>{totals?.knownJobs ? money(totals.knownPence) : totals?.missingJobs && !totals.unavailableJobs ? "Not submitted" : "Unavailable"}</b>
          {totals && <small>{totals.knownJobs} jobs known · {totals.missingJobs} missing · {totals.unavailableJobs} unavailable{totals.knownJobs && (totals.missingJobs || totals.unavailableJobs) ? " · Known subtotal" : ""}</small>}</p>; })}
      </div>}
    </div>
    <div className="road-coverage" role="status"><strong>{unavailable ? "Tracker history unavailable" : partial ? "Partial tracker coverage" : "Complete returned tracker history"}</strong>
      <span>{unavailable ? "Recorded events and fee totals cannot establish a zero." : "No recorded entry is not proof of no crossing. Fees use the stated rate basis; authority charges are not verified."}</span>
      {!!summary?.unpricedEntries && <span>{summary.unpricedEntries} {summary.unpricedEntries === 1 ? "entry has" : "entries have"} no calculable fee.</span>}
      {!!unlinked && <span>{unlinked} {unlinked === 1 ? "event on this page needs" : "events on this page need"} a job match. These events remain visible.</span>}
    </div>
    {!embedded && <ChargeRules type={type} report={report} />}
    <section className="rpt-section"><h2>{embedded ? type === "tunnel" ? "Tunnel activity" : "Congestion activity" : "Road-charge events"}</h2>
      <p className="rpt-muted mb-3">{report.driver.name} ({report.driver.initials}) · Event times in London. Driver-reported fee totals cover all matching jobs; event estimates reflect the selected review filter. Inspect the linked job to compare reported fees without attributing the same fee to every entry.</p>
      {filtering && <div className="rpt-empty" role={rangeError ? "alert" : "status"}><strong>{rangeError ? "Complete-range road filtering could not be loaded" : "Loading every road-event page in the selected range…"}</strong>{rangeError && <><p>{rangeError}</p><button className="rpt-job-link" onClick={() => setRetryVersion(value => value + 1)}>Retry selected range</button><button className="rpt-job-link" onClick={() => changeFilter("all")}>Show returned events</button></>}</div>}
      {!filtering && !!page.items.length && <div className="rpt-table-scroll"><table className="road-event-table"><thead><tr><th>Scheme / zone</th><th>Event time</th><th>Expected fee</th><th>Evidence / coverage</th><th>Linked job</th><th>Action</th></tr></thead><tbody>{page.items.map(row => <tr key={row.id}>
        <td data-label="Scheme / zone"><strong>{roadZoneLabel(row)}</strong><small className="rpt-block">{row.type === "congestion" ? "Congestion" : "Tunnel"} · {row.scheme}</small></td>
        <td data-label="Event time">{date(row.enteredAt)}<small className="rpt-block">Time in zone: {row.durationSeconds === null ? "Not recorded" : `${Math.round(row.durationSeconds / 60)} min`}</small></td>
        <td data-label="Expected fee">{feeLabel(row)}<small className="rpt-block">{row.rateBasis || "Rate basis unavailable"}</small></td>
        <td data-label="Evidence / coverage"><span className={`road-status ${!row.jobId || row.estimatedPence === null ? "road-status-review" : ""}`}>{!row.jobId ? "Needs job match" : row.estimatedPence === null ? "Fee unavailable" : "Recorded event"}</span><small className="rpt-block">{row.inChargeableHours === null ? "Charging hours unverified" : row.inChargeableHours ? "Within charging hours" : "Outside charging hours"}</small></td>
        <td data-label="Linked job">{row.jobId ? <button className="rpt-job-link" title={`Open job ${row.jobId}`} onClick={() => onJob(row.jobId!)}>{row.jobId}<ArrowUpRight size={13} /></button> : <span className="rpt-muted">Not linked</span>}</td>
        <td data-label="Action"><button className="rpt-job-link" aria-label={`View evidence for ${roadZoneLabel(row)}`} onClick={() => setSelected(row)}>View evidence<ArrowUpRight size={13} /></button></td>
      </tr>)}</tbody></table></div>}
      {!filtering && !page.items.length && <div className="rpt-empty"><strong>{unavailable ? "Tracker history unavailable" : eventFilter === "unlinked" ? "No unlinked events in this selected range" : "No recorded road events in this scope"}</strong><p>{unavailable ? "Retry tracker loading. Missing history is not evidence of no crossing." : embedded ? "No entries were returned for this job in the selected dates." : partial ? "The selected range has partial tracker coverage. Expand the date range or inspect the job evidence." : "No events were returned for this driver, scheme and date range."}</p>{eventFilter === "unlinked" && <button className="rpt-job-link" onClick={() => changeFilter("all")}>Clear review filter</button>}</div>}
      {!filtering && !embedded && page.total > 0 && <div className="rpt-pager"><span>{page.total} recorded {page.total === 1 ? "event" : "events"}{eventFilter === "unlinked" ? " without a job match" : ""} · Showing {page.items.length ? (page.page - 1) * page.pageSize + 1 : 0}–{Math.min(page.page * page.pageSize, page.total)}{report.alertHistoryTruncated ? " · Returned alert history only" : ""}</span>{totalPages > 1 && <div>
        <button aria-label="Previous road alerts page" disabled={page.page <= 1} onClick={() => eventFilter === "unlinked" ? changeFilteredPage(page.page - 1) : onPage("roadAlerts", page.page - 1)}><ChevronLeft size={18} /></button><span>Page {page.page} of {totalPages}</span>
        <button aria-label="Next road alerts page" disabled={page.page >= totalPages} onClick={() => eventFilter === "unlinked" ? changeFilteredPage(page.page + 1) : onPage("roadAlerts", page.page + 1)}><ChevronRight size={18} /></button>
      </div>}</div>}
    </section>
    {selected && createPortal(<Modal open title={`Road-event evidence · ${selected.jobId || "Needs job match"}`} onClose={() => setSelected(null)} size="lg" footer={selected.jobId ? <button className="rpt-job-link" onClick={() => { onJob(selected.jobId!); setSelected(null); }}>Open job {selected.jobId}<ArrowUpRight size={16} /></button> : undefined}>
      <section className="mb-5"><h3 className="font-semibold mb-2">{roadZoneLabel(selected)}</h3><p className="text-sm mb-2">{selected.jobId ? `Linked job: ${selected.jobId}` : "No linked job; matching needs review."} · Expected fee: {feeLabel(selected)}</p>
        <p className="text-sm text-fg-muted mb-3">{selected.linkBasis === "driver-time-match" ? "Association based on driver and job time; verify in job evidence" : selected.linkBasis === "recorded-device" ? "Association based on recorded job device" : "No verified job association"} · {selected.rateBasis || "Rate basis unavailable"}</p>
        <p className="text-sm mb-3">Entry: {date(selected.enteredAt)} · Exit: {date(selected.exitedAt)}. These alerts establish recorded zone activity, not a confirmed authority fee.</p>
        {selected.alerts.map(alert => <div key={alert.id} className="border-t border-line py-3"><strong className="text-sm">{alert.type === "entry" ? "Zone entered" : "Zone exited"}</strong><p className="text-sm whitespace-pre-wrap break-words">{alert.description}</p><time className="text-sm text-fg-muted">{date(alert.occurredAt)}</time></div>)}
      </section>
    </Modal>, document.body)}
  </>;
}
