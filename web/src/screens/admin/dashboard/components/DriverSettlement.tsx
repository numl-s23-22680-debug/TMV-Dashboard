import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Users, Loader2, RotateCcw } from "lucide-react";
import { fetchDrivers } from "../api";
import { driverReportHref, navigateAdmin } from "../utils/reportNavigation";
import { reportDuration } from "../utils/reportSemantics";
import "./driverReport.css";

export function DriverSettlement({ from, to }: { from?: string; to?: string }) {
  const query = useQuery({ queryKey: ["drivers_summary", from, to, "core", "completed"], queryFn: ({ signal }) => fetchDrivers(from, to, false, signal, true), staleTime: 30_000, gcTime: 5 * 60_000 });
  const [selectedDriver, setSelectedDriver] = React.useState("");
  const drivers = (query.data?.drivers ?? []).filter(driver => driver.initials !== "UNASSIGNED" && driver.hasAccount);
  const options = [...drivers].sort((a, b) => a.fullName.localeCompare(b.fullName) || a.initials.localeCompare(b.initials));
  React.useEffect(() => {
    if (query.isSuccess && selectedDriver && !drivers.some(row => row.initials === selectedDriver)) setSelectedDriver("");
  }, [query.isSuccess, query.data, selectedDriver]);
  const rows = drivers.filter(row => row.completed > 0 && (!selectedDriver || row.initials === selectedDriver));
  return <section className="rpt-breakdown-summary space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-admin-ink">Performance summary</h2><p className="text-sm text-admin-muted">{rows.length} {rows.length === 1 ? "driver" : "drivers"} · Completed work in selected range</p></div>
      <select aria-label="Select driver" value={selectedDriver} onChange={event => setSelectedDriver(event.target.value)} disabled={query.isLoading || query.isError} className="border border-admin-line rounded-md px-3 py-2 bg-white text-sm w-full sm:w-64">
        <option value="">All drivers</option>
        {options.map(driver => <option key={driver.initials} value={driver.initials}>{driver.fullName || driver.initials}{driver.fullName ? ` (${driver.initials})` : ""}</option>)}
      </select>
    </div>
    {query.isLoading ? <div role="status" className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : query.isError ?
      <div role="alert" className="py-6 text-red-700">{(query.error as Error).message}<button title="Retry driver summary" aria-label="Retry driver summary" onClick={() => void query.refetch()} className="ml-3 p-2"><RotateCcw size={16} /></button></div> :
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[760px]" aria-label="Driver performance summary"><thead className="border-y border-admin-line bg-admin-surface text-admin-muted"><tr>
        {["Driver", "Completed jobs", "Calculated charges", "Recorded receipts", "Working time", "Data gaps", "Report"].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}
      </tr></thead><tbody className="divide-y divide-admin-line">{rows.map(row => {
        const href = driverReportHref(row.initials, from, to);
        return <tr key={row.initials} className="bg-white hover:bg-admin-surface/50">
          <td className="p-3" data-label="Driver"><strong className="font-semibold">{row.fullName}</strong><span className="block text-xs text-admin-muted font-normal">{row.initials}</span><details className="rpt-chart-data"><summary>Supporting metrics</summary><p>Review requests: {row.reviewSentCount ?? "Not recorded"} sent · {row.reviewNotSentCount ?? "Not recorded"} not sent</p><p>Overtime: {reportDuration(row.overtimeMinutes)}</p></details></td>
          <td className="p-3 tabular-nums" data-label="Completed jobs">{row.completed}</td><td className="p-3 tabular-nums text-right" data-label="Calculated charges">{row.calculatedChargesPounds == null ? "Not available" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.calculatedChargesPounds)}</td>
          <td className="p-3 tabular-nums text-right" data-label="Recorded receipts">{row.totalCollectionsPounds == null || (row.unknownCollectionJobs ?? 0) >= row.completed ? "Unverified" : `${row.unknownCollectionJobs ? "Known subtotal " : ""}${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.totalCollectionsPounds)}`}</td>
          <td className="p-3 tabular-nums" data-label="Working time">{row.totalDurationMinutes == null || row.totalDurationMinutes === 0 && (row.workingUnknownJobs ?? 0) >= row.completed ? "Not recorded" : `${row.workingUnknownJobs ? "Known subtotal " : ""}${reportDuration(row.totalDurationMinutes)}`}</td>
          <td className="p-3" data-label="Data gaps">{row.workingUnknownJobs || row.missingEvidenceCount || row.unknownCollectionJobs ? <><span>{row.workingUnknownJobs ? `${row.workingUnknownJobs} timings missing` : ""}</span><small className="rpt-block">{row.missingEvidenceCount ? `${row.missingEvidenceCount} evidence gaps` : ""}{row.unknownCollectionJobs ? ` · ${row.unknownCollectionJobs} receipts unverified` : ""}</small></> : "No gaps reported"}</td>
          <td className="p-3" data-label="Report"><div className="rpt-row-actions"><a href={href} aria-label={`View report for ${row.fullName}`} onClick={event => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); navigateAdmin(href); } }} className="rpt-job-link">View report<ArrowUpRight size={15} /></a><a href={driverReportHref(row.initials, from, to, "comparison")} aria-label={`Reconcile records for ${row.fullName}`} onClick={event => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); navigateAdmin(driverReportHref(row.initials, from, to, "comparison")); } }} className="rpt-job-link">Reconcile</a></div></td>
        </tr>;
      })}</tbody></table>{!rows.length && <div className="py-12 text-center text-admin-muted"><Users className="mx-auto mb-3" size={24} />No jobs in this range</div>}<p className="rpt-note">Calculated charges and recorded receipts have separate definitions. Receipts exclude uncollected invoices. A range with missing records shows known subtotals.</p></div>}
  </section>;
}
