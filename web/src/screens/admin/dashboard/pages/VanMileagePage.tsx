import { AdminFilterBar } from "../components/AdminFilterBar";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Download, Fuel, Loader2, Pencil, RefreshCw, Search, ShieldCheck, Trash2, Wrench, X } from "lucide-react";
import { DateRangePicker, defaultDashboardDateRange } from "../components/DateRangePicker";
import { ApiErrorState } from "../components/ApiErrorState";
import { fetchVanDriverRecords, saveVanCompliance, deleteVanRecord } from "../api";
import { VanComplianceItem, VanDriverRecordItem, VanRecordItem, VanRecordType } from "../types";
import { formatLondonDate, formatLondonDateTime } from "../utils/date";
import { vehicleDateStatus, vehicleDaysUntil } from "../utils/vehicleDates";
import { Button, EmptyState, SegmentedControl } from "../../../../ui";
import { downloadCsv, stampForFilename } from "../utils/csv";
import { vehiclePageCsv, vehicleHistoryCsv } from "../utils/recordExports";
import { useRecordDialog } from "../hooks/useRecordDialog";

const TYPE_META: Record<VanRecordType, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  MILEAGE: { label: "Mileage", icon: Fuel, className: "bg-admin-surface border-admin-line text-admin-ink" },
  FUEL: { label: "Fuel", icon: Fuel, className: "bg-admin-status-amber-bg border-admin-status-amber/20 text-admin-status-amber" },
  SERVICE: { label: "Service", icon: Wrench, className: "bg-[#EFF6FF] border-[#2563EB]/20 text-[#2563EB]" }
};
const COMPLIANCE_ALERT_DAYS = 30;
// Miles-remaining threshold that turns the service gauge amber, mirroring
// COMPLIANCE_ALERT_DAYS's role for the date rings.
const SERVICE_MILEAGE_WARNING_MILES = 500;

function recordDetail(item: VanRecordItem | null, type: VanRecordType): string {
  if (!item) return "Not recorded";
  switch (type) {
    case "FUEL":
      return [
        item.odometerReading == null ? "" : `${item.odometerReading.toLocaleString()} mi`,
        item.fuelCost == null ? "" : `£${item.fuelCost.toFixed(2)}`
      ].filter(Boolean).join(" · ") || "Not recorded";
    case "SERVICE":
      return [
        item.serviceMileage == null ? "" : `${item.serviceMileage.toLocaleString()} mi`,
        item.serviceType,
        item.serviceDate ? formatLondonDate(item.serviceDate) : ""
      ].filter(Boolean).join(" · ") || "Not recorded";
    case "MILEAGE":
    default:
      return item.mileage == null ? "Not recorded" : item.mileage.toLocaleString();
  }
}

function VehicleDateCell({ value }: { value?: string }) {
  const status = vehicleDateStatus(value);
  return <div><span className={`text-xs font-medium ${status === "Overdue" ? "text-admin-status-red" : status === "Due soon" ? "text-admin-status-amber" : "text-admin-muted"}`}>{status}</span><p className="mt-1 text-sm text-admin-ink">{value && vehicleDaysUntil(value) !== null ? formatLondonDate(value) : "Not recorded"}</p></div>;
}

export function VanMileagePage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string | undefined>(() => defaultDashboardDateRange().from);
  const [to, setTo] = useState<string | undefined>(() => defaultDashboardDateRange().to);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VanDriverRecordItem | null>(null);
  // Keep the current vehicle snapshot independent of historical upload filters.
  const current = useQuery({ queryKey: ["van-current-records", page, search], queryFn: () => fetchVanDriverRecords({ page, q: search }), retry: 1 });
  const history = useQuery({ queryKey: ["van-record-history", selected?.id, from, to], queryFn: () => fetchVanDriverRecords({ page: 1, q: selected?.vanRegistration || selected?.driverInitials, from, to }), enabled: !!selected, retry: 1 });
  const historical = history.data?.items.find(row => row.id === selected?.id) || history.data?.items.find(row => row.vanRegistration && row.vanRegistration === selected?.vanRegistration);
  const items = current.data?.items || [];
  const pagination = current.data?.pagination;
  const attention = (item: VanDriverRecordItem) => {
    const deadlines = [["MOT", item.compliance?.motExpiryDate], ["Tax", item.compliance?.roadTaxRenewalDate], ["Insurance", item.compliance?.insuranceExpiryDate]].filter(([, date]) => ["Overdue", "Due soon"].includes(vehicleDateStatus(date)));
    const service = buildServiceMileageItem(item.compliance);
    return [...deadlines.map(([label, date]) => `${label} ${vehicleDateStatus(date).toLowerCase()}`), ...(service.tone === "danger" || service.tone === "warning" ? [service.tone === "danger" ? "Service overdue" : "Service due soon"] : [])];
  };
  const onSaved = (compliance: VanComplianceItem) => { setSelected(item => item ? { ...item, compliance } : item); void current.refetch(); };
  const onDeleted = (id: string) => { setSelected(item => item ? { ...item, records: item.records.filter(record => record.id !== id), latestFuel: item.latestFuel?.id === id ? null : item.latestFuel, latestService: item.latestService?.id === id ? null : item.latestService } : item); void current.refetch(); void history.refetch(); };
  return <div className="space-y-4 max-w-[1440px] mx-auto pb-8">
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-module border border-admin-line">
      <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-3 w-4 h-4 text-admin-muted" /><input aria-label="Search vehicles" placeholder="Search registration or assigned driver" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="h-10 pl-9 pr-3 w-full border border-admin-line rounded-card text-sm" /></div>
      {search && <Button variant="ghost" onClick={() => { setSearch(""); setPage(1); }}>Clear search</Button>}
      <Button variant="secondary" size="sm" iconLeft={<Download size={16} />} disabled={!items.length} onClick={() => downloadCsv(`TMV-vehicles-page-${page}-${stampForFilename()}.csv`, vehiclePageCsv(items, page))}>Export page CSV</Button><span className="text-sm text-admin-muted ml-auto">{current.isLoading ? "Loading…" : current.isError && !current.data ? "Could not load vehicles" : `${pagination?.total ?? 0} vehicle assignments`}</span>
      <button aria-label="Refresh vehicle records" onClick={() => void current.refetch()} className="w-10 h-10 border border-admin-line rounded-card grid place-items-center text-admin-muted"><RefreshCw size={16} className={current.isFetching ? "animate-spin" : ""} /></button>
    </div>
    <p className="text-xs text-admin-muted">Current date status as of {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date())} · London. Dates are recorded deadlines; they do not prove legal compliance. Due soon means within 30 days.</p>
    {current.isError && <ApiErrorState message={(current.error as Error).message} onRetry={() => void current.refetch()} />}
    {current.isLoading ? <div role="status" className="bg-white border border-admin-line rounded-module p-12 text-center text-admin-muted">Loading current vehicle records…</div> : (!current.isError || !!current.data) && !items.length ? <EmptyState icon={<Wrench />} title={search ? "No matching vehicles" : "No vehicle records"} description={search ? "Try another registration or assigned driver." : "Vehicle records appear when a driver has an assignment or submits a vehicle record."} action={search ? <Button variant="secondary" onClick={() => setSearch("")}>Clear search</Button> : undefined} /> : (!current.isError || !!current.data) && <div className="rounded-module bg-white border border-admin-line overflow-hidden">
      <div className="hidden md:block overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-admin-surface border-b border-admin-line"><tr>{["Registration", "Assigned driver", "Service due", "MOT expiry", "Tax renewal", "Needs attention", "Actions"].map(label => <th key={label} className="px-4 py-3 text-xs font-medium text-admin-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-admin-line">{items.map(item => { const service = buildServiceMileageItem(item.compliance), issues = attention(item); return <tr key={item.id} className="hover:bg-admin-surface/40"><td className="px-4 py-3 font-mono font-semibold text-admin-ink">{item.vanRegistration || "Registration missing"}</td><td className="px-4 py-3">{item.driverName || "Name not recorded"}<p className="text-xs text-admin-muted mt-1">{item.driverInitials || "Code not recorded"}</p></td><td className="px-4 py-3 text-xs text-admin-muted">{service.statusLabel}</td><td className="px-4 py-3"><VehicleDateCell value={item.compliance?.motExpiryDate} /></td><td className="px-4 py-3"><VehicleDateCell value={item.compliance?.roadTaxRenewalDate} /></td><td className="px-4 py-3 text-xs text-admin-muted">{issues.length ? issues.map(issue => <p key={issue} className={issue.includes("overdue") ? "text-admin-status-red" : "text-admin-status-amber"}>{issue}</p>) : "No recorded due alerts"}</td><td className="px-4 py-3"><Button variant="secondary" size="sm" onClick={() => setSelected(item)} aria-label={`View vehicle ${item.vanRegistration || item.driverInitials}`}>View vehicle</Button></td></tr>; })}</tbody></table></div>
      <div className="md:hidden divide-y divide-admin-line">{items.map(item => <article key={item.id} className="p-4 space-y-3"><div className="flex justify-between gap-3"><h2 className="font-mono font-semibold text-admin-ink">{item.vanRegistration || "Registration missing"}</h2><span className="text-xs text-admin-muted">{item.driverName || item.driverInitials}</span></div><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-admin-muted mb-1">MOT expiry</p><VehicleDateCell value={item.compliance?.motExpiryDate} /></div><div><p className="text-xs text-admin-muted mb-1">Tax renewal</p><VehicleDateCell value={item.compliance?.roadTaxRenewalDate} /></div></div><p className="text-xs text-admin-muted">Service: {buildServiceMileageItem(item.compliance).statusLabel}</p><Button variant="secondary" size="sm" onClick={() => setSelected(item)}>View vehicle</Button></article>)}</div>
      {!!pagination?.total && <div className="border-t border-admin-line p-4 flex flex-wrap gap-3 items-center justify-between text-sm text-admin-muted"><span>Showing {(page - 1) * pagination.pageSize + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total} assignments</span>{pagination.totalPages > 1 && <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>}</div>}
    </div>}
    {selected && <VanDriverModal item={selected} historical={historical} historyLoading={history.isLoading} historyError={history.isError} onRetry={() => void history.refetch()} from={from} to={to} onDateChange={(f, t) => { setFrom(f); setTo(t); }} onClose={() => setSelected(null)} onSaved={onSaved} onRecordDeleted={onDeleted} />}
  </div>;
}

function VanDriverModal({ item, historical, historyLoading, historyError, onRetry, from, to, onDateChange, onClose, onSaved, onRecordDeleted }: {
  item: VanDriverRecordItem; historical?: VanDriverRecordItem; historyLoading: boolean; historyError: boolean; onRetry: () => void; from?: string; to?: string; onDateChange: (from?: string, to?: string) => void; onClose: () => void; onSaved: (compliance: VanComplianceItem) => void; onRecordDeleted: (recordId: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState("vehicle");
  const [recordError, setRecordError] = useState("");
  const { panelRef, titleId } = useRecordDialog(true, onClose);
  async function handleDeleteRecord(id: string) {
    if (deletingId || !window.confirm("Delete this vehicle photo record permanently? This cannot be undone.")) return;
    setDeletingId(id); setRecordError("");
    try { await deleteVanRecord(id); onRecordDeleted(id); } catch (error) { setRecordError(error instanceof Error ? error.message : "Could not delete record."); } finally { setDeletingId(null); }
  }
  const historyState = historyLoading ? <p role="status" className="p-8 text-center text-sm text-admin-muted">Loading records in this range…</p> : historyError ? <ApiErrorState message="Could not load historical records. Current vehicle dates remain available." onRetry={onRetry} /> : null;
  return <div className="fixed inset-0 z-[100] flex justify-center items-center p-0 sm:p-6 bg-black/40"><div className="absolute inset-0" onClick={onClose} /><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative w-full max-w-4xl h-full sm:h-auto max-h-[100dvh] sm:max-h-[92vh] bg-white rounded-none sm:rounded-module border border-admin-line flex flex-col overflow-hidden outline-none">
    <header className="p-4 sm:px-6 border-b border-admin-line flex items-center justify-between gap-4"><div><h2 id={titleId} className="text-xl font-semibold text-admin-ink">{item.vanRegistration || "Vehicle registration missing"}</h2><p className="text-xs text-admin-muted mt-1">Assigned driver: {item.driverName || item.driverInitials || "Not recorded"}</p></div><button aria-label="Close vehicle details" onClick={onClose} className="h-10 w-10 grid place-items-center rounded-card text-admin-muted hover:bg-admin-surface"><X size={20} /></button></header>
    <div className="p-4 sm:p-6 overflow-y-auto space-y-5"><SegmentedControl aria-label="Vehicle detail views" value={tab} onChange={setTab} options={[{ value: "vehicle", label: "Dates & service" }, { value: "fuel", label: "Fuel" }, { value: "history", label: "Record history" }]} />
      {recordError && <p role="alert" className="text-sm text-admin-status-red">{recordError}</p>}
      {tab === "vehicle" ? <><p className="text-xs text-admin-muted">Current dates and service mileage are independent of the historical record filter. Stored deadlines are not a compliance certification.</p><div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4"><CompliancePreview item={item} onSaved={onSaved} /><ServicePreview item={item} onSaved={onSaved} onDelete={item.latestService ? () => void handleDeleteRecord(item.latestService!.id) : undefined} deleting={deletingId === item.latestService?.id} /></div></> : <>
        <AdminFilterBar dates={<DateRangePicker scope="report" from={from} to={to} onChange={onDateChange} />} count="Historical records · London time" />
        {historyState || (tab === "fuel" ? <RecordPreview title="Fuel record in selected range" item={historical?.latestFuel ?? null} type="FUEL" onDelete={historical?.latestFuel ? () => void handleDeleteRecord(historical.latestFuel!.id) : undefined} deleting={deletingId === historical?.latestFuel?.id} /> : <div className="border border-admin-line rounded-card divide-y divide-admin-line">{(historical?.records || []).map(record => <div key={record.id} className="flex items-center gap-3 p-3"><a href={record.photoUrl} target="_blank" rel="noreferrer" className="flex gap-3 items-center min-w-0 flex-1"><img src={record.thumbUrl || record.photoUrl} alt={`${TYPE_META[record.type].label} evidence`} className="w-12 h-12 object-cover rounded-card border border-admin-line" /><div className="min-w-0"><p className="text-sm font-medium text-admin-ink">{TYPE_META[record.type].label} · {recordDetail(record, record.type)}</p><p className="text-xs text-admin-muted mt-1">{formatLondonDateTime(record.submittedAt)}</p></div></a><details><summary className="p-2 cursor-pointer text-admin-muted" aria-label="Record actions">•••</summary><button onClick={() => void handleDeleteRecord(record.id)} disabled={!!deletingId} className="text-xs text-admin-status-red p-2">Delete record</button></details></div>)}{!historical?.records.length && <EmptyState title="No records in this range" description="Try a wider date range. Missing uploads are not classified as required records." className="border-0" />}</div>)}
        <Button variant="secondary" size="sm" iconLeft={<Download size={16} />} disabled={!historical?.records.length} onClick={() => downloadCsv(`TMV-${item.vanRegistration || item.driverInitials}-records-${stampForFilename()}.csv`, vehicleHistoryCsv(historical?.records || [], item.vanRegistration, { from, to, page: 1 }))}>Export loaded records CSV</Button><details><summary className="text-xs text-admin-muted cursor-pointer">Other export options</summary><button className="my-2 text-sm text-admin-brand" onClick={() => { window.location.href = "/api/admin/van/records/export.csv"; }}>Original vehicle CSV export</button><p className="text-xs text-admin-muted">Original export scope has not been verified. It may include records outside these filters.</p></details>
      </>}
    </div>
  </div></div>;
}

function RecordPreview({
  title, item, type, onDelete, deleting
}: {
  title: string; item: VanRecordItem | null; type: VanRecordType;
  onDelete?: () => void; deleting?: boolean;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div className="bg-white rounded-module border border-admin-line p-4">
      <div className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-[12px] font-semibold ${meta.className}`}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div className="mt-3 text-[18px] font-bold text-admin-ink">{recordDetail(item, type)}</div>
      <div className="mt-1 text-[12px] text-admin-muted">{item ? formatLondonDateTime(item.submittedAt) : "No record in selected range"}</div>
      {item?.photoUrl ? (
        <div className="relative group/photo mt-4">
          <a href={item.photoUrl} target="_blank" rel="noreferrer" className="block">
            <img src={item.photoUrl} alt={title} className="w-full aspect-[4/3] object-contain rounded-card bg-admin-surface border border-admin-line" />
          </a>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              title="Delete photo"
              aria-label={`Delete ${title} photo`}
              className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-white/90 text-admin-status-red opacity-100 hover:bg-admin-status-red hover:text-white transition shadow-sm disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      ) : <p className="mt-3 text-xs text-admin-muted">No photo attached.</p>}
    </div>
  );
}

/**
 * Service record preview + the "miles remaining until next service" gauge and its
 * admin-editable interval/override -- kept together here rather than split across
 * this panel (read-only record) and CompliancePreview (dates), since both the driver
 * app's own "Vehicle Service" card and this panel now agree: service-mileage
 * tracking is a Service concern, not a Compliance one. Saving here still round-trips
 * the *whole* compliance document (see saveVanCompliance), so it passes through the
 * current road-tax/MOT/insurance/notes values unchanged rather than clearing them.
 */
function ServicePreview({
  item, onSaved, onDelete, deleting
}: {
  item: VanDriverRecordItem; onSaved: (compliance: VanComplianceItem) => void;
  onDelete?: () => void; deleting?: boolean;
}) {
  const [serviceIntervalMiles, setServiceIntervalMiles] = useState(String(item.compliance?.serviceIntervalMiles ?? ""));
  const [lastServiceMileageOverride, setLastServiceMileageOverride] = useState(String(item.compliance?.lastServiceMileageOverride ?? ""));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mileageItem = buildServiceMileageItem(item.compliance);
  const meta = TYPE_META.SERVICE;
  const Icon = meta.icon;

  useEffect(() => {
    setServiceIntervalMiles(String(item.compliance?.serviceIntervalMiles ?? ""));
    setLastServiceMileageOverride(String(item.compliance?.lastServiceMileageOverride ?? ""));
    setError("");
  }, [item.compliance]);

  async function handleSave() {
    if (!item.vanRegistration || saving) return;
    const interval = serviceIntervalMiles.trim() ? Number(serviceIntervalMiles) : null;
    const override = lastServiceMileageOverride.trim() ? Number(lastServiceMileageOverride) : null;
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      setError("Enter a valid service interval.");
      return;
    }
    if (override !== null && (!Number.isFinite(override) || override < 0)) {
      setError("Enter a valid last service mileage.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const compliance = await saveVanCompliance(item.vanRegistration, {
        roadTaxRenewalDate: item.compliance?.roadTaxRenewalDate || "",
        motExpiryDate: item.compliance?.motExpiryDate || "",
        insuranceExpiryDate: item.compliance?.insuranceExpiryDate || "",
        notes: item.compliance?.notes || "",
        serviceIntervalMiles: interval,
        lastServiceMileageOverride: override
      });
      onSaved(compliance);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save service settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-module border border-admin-line overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-[12px] font-semibold ${meta.className}`}>
          <Icon className="w-3.5 h-3.5" /> Service
        </div>
        <button
          type="button"
          onClick={() => setEditing(value => !value)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-admin-surface text-admin-muted transition hover:bg-admin-line/40 hover:text-admin-ink"
          title={editing ? "Close editor" : "Edit service interval"}
          aria-label={editing ? "Close service settings editor" : "Edit service interval"}
        >
          {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[18px] font-bold text-admin-ink">{recordDetail(item.latestService, "SERVICE")}</div>
        <div className="mt-1 text-[12px] text-admin-muted">
          {item.latestService ? formatLondonDateTime(item.latestService.submittedAt) : "No service record on file"}
        </div>
        {item.latestService?.photoUrl ? (
          <div className="relative group/photo mt-4">
            <a href={item.latestService.photoUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={item.latestService.photoUrl}
                alt="Service"
                className="w-full aspect-[4/3] object-contain rounded-card bg-admin-surface border border-admin-line"
              />
            </a>
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={deleting}
                title="Delete photo"
                aria-label="Delete Service photo"
                className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-white/90 text-admin-status-red opacity-100 hover:bg-admin-status-red hover:text-white transition shadow-sm disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        ) : <p className="mt-3 text-xs text-admin-muted">No service receipt attached.</p>}
      </div>

      <div className="border-t border-admin-line px-4">
        <ServiceMileageStatus item={mileageItem} />
      </div>

      {editing && (
        <div className="space-y-3 border-t border-admin-line bg-admin-surface px-4 py-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">Service interval (miles)</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={serviceIntervalMiles}
              onChange={event => setServiceIntervalMiles(event.target.value)}
              placeholder="e.g. 8000"
              className="mt-1 h-9 w-full rounded-card border border-admin-line bg-white px-3 text-[13px] font-semibold text-admin-ink outline-none focus:border-admin-brand"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">Override last service mileage</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={lastServiceMileageOverride}
              onChange={event => setLastServiceMileageOverride(event.target.value)}
              placeholder="Leave blank to use the driver's most recent Service log"
              className="mt-1 h-9 w-full rounded-card border border-admin-line bg-white px-3 text-[13px] font-semibold text-admin-ink outline-none focus:border-admin-brand"
            />
            <span className="mt-1 block text-[11px] text-admin-muted">
              Only needed to correct a bad log entry -- clear it to go back to automatic.
            </span>
          </label>
          {error && <div className="text-[12px] font-semibold text-admin-status-red">{error}</div>}
          <button
            type="button"
            disabled={!item.vanRegistration || saving}
            onClick={() => void handleSave()}
            className="h-9 w-full rounded-card bg-admin-brand px-3 text-[13px] font-bold text-white transition hover:bg-admin-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save service settings"}
          </button>
        </div>
      )}
    </div>
  );
}

function CompliancePreview({ item, onSaved }: { item: VanDriverRecordItem; onSaved: (compliance: VanComplianceItem) => void }) {
  const [roadTaxRenewalDate, setRoadTaxRenewalDate] = useState(item.compliance?.roadTaxRenewalDate || "");
  const [motExpiryDate, setMotExpiryDate] = useState(item.compliance?.motExpiryDate || "");
  const [notes, setNotes] = useState(item.compliance?.notes || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const complianceItems = buildComplianceItems({
    roadTaxRenewalDate: item.compliance?.roadTaxRenewalDate || roadTaxRenewalDate,
    motExpiryDate: item.compliance?.motExpiryDate || motExpiryDate
  });

  useEffect(() => {
    setRoadTaxRenewalDate(item.compliance?.roadTaxRenewalDate || "");
    setMotExpiryDate(item.compliance?.motExpiryDate || "");
    setNotes(item.compliance?.notes || "");
    setError("");
  }, [item.compliance]);

  async function handleSave() {
    if (!item.vanRegistration || saving) return;
    setSaving(true);
    setError("");
    try {
      // Service interval/override live in ServicePreview now, but this save still
      // round-trips the whole compliance document -- pass them through unchanged.
      const compliance = await saveVanCompliance(item.vanRegistration, {
        roadTaxRenewalDate,
        motExpiryDate,
        insuranceExpiryDate: item.compliance?.insuranceExpiryDate || "",
        notes,
        serviceIntervalMiles: item.compliance?.serviceIntervalMiles ?? null,
        lastServiceMileageOverride: item.compliance?.lastServiceMileageOverride ?? null
      });
      onSaved(compliance);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save compliance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-module border border-admin-line bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-admin-brand-soft text-admin-brand">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-card bg-white/25">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-bold">Vehicle dates</h3>
            <p className="truncate text-[11px] font-semibold opacity-85">{item.vanRegistration || "No van recorded"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(value => !value)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-admin-brand transition hover:bg-white/30"
          title={editing ? "Close editor" : "Edit compliance dates"}
          aria-label={editing ? "Close compliance editor" : "Edit compliance dates"}
        >
          {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
      </div>

      <div className="divide-y divide-admin-line px-4">
        {complianceItems.map((complianceItem, index) => (
          <ComplianceStatus key={complianceItem.key} item={complianceItem} showRing={index === 0} />
        ))}
      </div>

      {item.compliance?.notes && !editing && (
        <div className="border-t border-admin-line px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">Notes</p>
          <p className="mt-1 text-[13px] font-medium text-admin-ink">{item.compliance.notes}</p>
        </div>
      )}

      {editing && (
        <div className="space-y-3 border-t border-admin-line bg-admin-surface px-4 py-4">
          <ComplianceInput label="Road tax renewal" value={roadTaxRenewalDate} onChange={setRoadTaxRenewalDate} />
          <ComplianceInput label="MOT expiry" value={motExpiryDate} onChange={setMotExpiryDate} />
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">Notes</span>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-card border border-admin-line bg-white px-3 py-2 text-[13px] font-medium text-admin-ink outline-none focus:border-admin-brand"
              placeholder="Optional"
            />
          </label>
          {error && <div className="text-[12px] font-semibold text-admin-status-red">{error}</div>}
          <button
            type="button"
            disabled={!item.vanRegistration || saving}
            onClick={() => void handleSave()}
            className="h-9 w-full rounded-card bg-admin-brand px-3 text-[13px] font-bold text-white transition hover:bg-admin-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save compliance"}
          </button>
        </div>
      )}
    </div>
  );
}

type ComplianceStatusItem = {
  key: "roadTaxRenewalDate" | "motExpiryDate";
  label: string;
  rawDate?: string;
  formattedDate: string;
  daysRemaining: number | null;
  centerLabel: string;
  statusLabel: string;
  tone: "ok" | "warning" | "danger" | "empty";
  ringPercent: number;
};

function buildComplianceItems(compliance: Pick<VanComplianceItem, "roadTaxRenewalDate" | "motExpiryDate">): ComplianceStatusItem[] {
  return [
    buildComplianceItem("roadTaxRenewalDate", "Next road tax renewal", compliance.roadTaxRenewalDate),
    buildComplianceItem("motExpiryDate", "Next MOT date", compliance.motExpiryDate)
  ];
}

function buildComplianceItem(key: ComplianceStatusItem["key"], label: string, rawDate?: string): ComplianceStatusItem {
  const daysRemaining = daysUntil(rawDate);
  const hasDate = daysRemaining !== null;
  const expired = hasDate && daysRemaining < 0;
  const dueSoon = hasDate && daysRemaining >= 0 && daysRemaining <= COMPLIANCE_ALERT_DAYS;
  const tone = !hasDate ? "empty" : expired ? "danger" : dueSoon ? "warning" : "ok";
  const ringPercent = !hasDate
    ? 0
    : expired
      ? 100
      : dueSoon
        ? Math.max(8, Math.round(((COMPLIANCE_ALERT_DAYS - daysRemaining) / COMPLIANCE_ALERT_DAYS) * 100))
        : 100; // "ok" -- full ring, same always-on style as the Service panel's mileage gauge

  return {
    key,
    label,
    rawDate,
    formattedDate: rawDate ? formatComplianceDate(rawDate) : "Not recorded",
    daysRemaining,
    centerLabel: centerLabel(daysRemaining),
    statusLabel: statusLabel(daysRemaining),
    tone,
    ringPercent
  };
}

function ComplianceStatus({ item }: { item: ComplianceStatusItem; showRing?: boolean }) {
  const status = vehicleDateStatus(item.rawDate);
  return <div className="flex items-center justify-between gap-4 py-4"><div><h4 className="text-sm font-medium text-admin-ink">{item.label}</h4><p className="text-xs text-admin-muted mt-1">{item.formattedDate}</p></div><span className={`text-xs rounded-control px-2.5 py-1 ${status === "Overdue" ? "bg-admin-status-red-bg text-admin-status-red" : status === "Due soon" ? "bg-admin-status-amber-bg text-admin-status-amber" : "bg-admin-surface text-admin-muted"}`}>{status}</span></div>;
}

type ServiceMileageStatusItem = {
  hasInterval: boolean;
  hasBaseline: boolean;
  currentMileage: number | null;
  milesRemaining: number | null;
  serviceIntervalMiles: number | null;
  tone: "ok" | "warning" | "danger" | "empty";
  ringPercent: number;
  centerLabel: string;
  topLabel: string;
  statusLabel: string;
};

/**
 * Always-on gauge (unlike the date rings above, which only appear inside their alert
 * window) -- miles since the last logged Service against the admin's configured
 * interval for this van. `lastServiceMileage`/`currentMileage` are server-computed
 * (see backend's van-mileage.service.ts): the former from the most recent Service log
 * (or this admin's manual override below), the latter reconciled across whichever
 * record type -- Mileage, Fuel or Service -- most recently carried an odometer reading.
 */
function buildServiceMileageItem(compliance?: VanComplianceItem | null): ServiceMileageStatusItem {
  const serviceIntervalMiles = compliance?.serviceIntervalMiles ?? null;
  const lastServiceMileage = compliance?.lastServiceMileage ?? null;
  const currentMileage = compliance?.currentMileage ?? null;
  const hasInterval = typeof serviceIntervalMiles === "number" && serviceIntervalMiles > 0;
  const hasBaseline = typeof lastServiceMileage === "number";

  if (!hasInterval || !hasBaseline) {
    return {
      hasInterval,
      hasBaseline,
      currentMileage,
      milesRemaining: null,
      serviceIntervalMiles,
      tone: "empty",
      ringPercent: 0,
      centerLabel: "Missing",
      topLabel: "Not recorded",
      statusLabel: !hasInterval ? "Interval not set" : "No service logged yet"
    };
  }

  if (currentMileage === null) return { hasInterval, hasBaseline, currentMileage, milesRemaining: null, serviceIntervalMiles, tone: "empty", ringPercent: 0, centerLabel: "Not recorded", topLabel: "Current odometer missing", statusLabel: "Service due cannot be calculated" };
  const milesSinceService = Math.max(0, currentMileage - lastServiceMileage);
  const milesRemaining = serviceIntervalMiles - milesSinceService;
  const nextServiceMileage = lastServiceMileage + serviceIntervalMiles;
  const overdue = milesRemaining < 0;
  const dueSoon = !overdue && milesRemaining <= SERVICE_MILEAGE_WARNING_MILES;
  const tone: ServiceMileageStatusItem["tone"] = overdue ? "danger" : dueSoon ? "warning" : "ok";
  const ringPercent = Math.min(100, Math.max(0, Math.round((milesSinceService / serviceIntervalMiles) * 100)));

  return {
    hasInterval,
    hasBaseline,
    currentMileage,
    milesRemaining,
    serviceIntervalMiles,
    tone,
    ringPercent,
    centerLabel: overdue ? `${Math.abs(milesRemaining).toLocaleString()} mi over` : `${milesRemaining.toLocaleString()} mi`,
    topLabel: `Next service at: ${nextServiceMileage.toLocaleString()} mi`,
    statusLabel: overdue
      ? `Overdue by ${Math.abs(milesRemaining).toLocaleString()} mi`
      : `Remaining miles: ${milesRemaining.toLocaleString()}`
  };
}

function ServiceMileageStatus({ item }: { item: ServiceMileageStatusItem }) {
  return <div className="py-4 space-y-2"><p className="text-sm font-medium text-admin-ink">{item.topLabel}</p><p className={`text-sm ${item.tone === "danger" ? "text-admin-status-red" : item.tone === "warning" ? "text-admin-status-amber" : "text-admin-muted"}`}>{item.statusLabel}</p>{item.milesRemaining !== null && <div className="h-2 bg-admin-surface rounded-full overflow-hidden" aria-hidden="true"><div className={`h-full ${item.tone === "danger" ? "bg-admin-status-red" : "bg-admin-brand"}`} style={{ width: `${item.ringPercent}%` }} /></div>}{item.hasInterval && <p className="text-xs text-admin-muted">Configured interval: {item.serviceIntervalMiles!.toLocaleString()} miles. Based on the latest recorded odometer and service baseline.</p>}</div>;
}

function daysUntil(rawDate?: string): number | null { return vehicleDaysUntil(rawDate); }

function formatComplianceDate(rawDate: string): string {
  const dateOnly = rawDate.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return rawDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(date)
    .toUpperCase();
}

function centerLabel(daysRemaining: number | null): string {
  if (daysRemaining === null) return "Missing";
  if (daysRemaining < 0) return "Expired";
  if (daysRemaining === 0) return "Today";
  return `${daysRemaining} days`;
}

function statusLabel(daysRemaining: number | null): string {
  if (daysRemaining === null) return "Add date";
  if (daysRemaining < 0) return `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`;
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining <= COMPLIANCE_ALERT_DAYS) return `Alert: Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  return "Status: OK";
}

function ComplianceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-card border border-admin-line bg-admin-surface px-3 text-[13px] font-semibold text-admin-ink outline-none focus:border-admin-brand focus:bg-white"
      />
    </label>
  );
}
