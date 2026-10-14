import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Search, Truck } from "lucide-react";
import { deleteDriver, fetchDrivers, saveDriver } from "../api";
import { driverReportHref, navigateAdmin, retainRangeInUrl } from "../utils/reportNavigation";
import { getAvatarColor, formatVanReg } from "../utils/drivers";
import { AddDriverModal } from "../components/AddDriverModal";
import { ApiErrorState } from "../components/ApiErrorState";
import { DriverSettlement } from "../components/DriverSettlement";
import { DateRangePicker, defaultDashboardDateRange } from "../components/DateRangePicker";
import { AdminFilterBar } from "../components/AdminFilterBar";
import { DriverSummaryItem } from "../types";
import { Button, EmptyState, Modal, SegmentedControl } from "../../../../ui";
import { DRIVER_OPTIONS_QUERY_KEY } from "../hooks/useDriverOptions";

export function DriversPage() {
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(params.get("driversTab") === "performance" ? "performance" : "directory");
  const [search, setSearch] = useState(params.get("driverSearch") || "");
  const [accountFilter, setAccountFilter] = useState(params.get("account") || "all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverSummaryItem | null>(null);
  const [profile, setProfile] = useState<DriverSummaryItem | null>(null);
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState(false);
  const [from, setFrom] = useState<string | undefined>(params.get("from") || defaultDashboardDateRange().from);
  const [to, setTo] = useState<string | undefined>(params.get("to") || defaultDashboardDateRange().to);
  // Directory membership comes from the account roster; dates only scope performance.
  // Account active means app access, and says nothing about availability or presence.
  const query = useQuery({ queryKey: ["drivers_summary"], queryFn: () => fetchDrivers(), staleTime: 30_000 });
  const roster = (query.data?.drivers ?? []).filter(d => d.initials !== "UNASSIGNED" && d.hasAccount);
  const filtered = roster.filter(driver => (accountFilter === "all" || (driver.active !== false) === (accountFilter === "active")) &&
    `${driver.fullName} ${driver.initials} ${driver.vanRegistration || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const persist = (patch: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(patch).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    window.history.replaceState({}, "", url.pathname + url.search);
  };
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["drivers_summary"] });
    void queryClient.invalidateQueries({ queryKey: DRIVER_OPTIONS_QUERY_KEY });
  };
  const changeAccess = async (driver: DriverSummaryItem) => {
    if (!driver.email || !window.confirm(`${driver.active !== false ? "Deactivate" : "Activate"} the app account for ${driver.fullName}? Existing job history is retained.`)) return;
    setPendingAction(true); setActionError("");
    try {
      await saveDriver({ initials: driver.initials, fullName: driver.fullName, email: driver.email, phone: driver.phone,
        vanRegistration: driver.vanRegistration, imei: driver.imei, active: driver.active === false });
      setProfile({ ...driver, active: driver.active === false }); invalidate();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Could not update app access. Please retry."); }
    finally { setPendingAction(false); }
  };
  const remove = async (driver: DriverSummaryItem) => {
    if (!driver.email || !window.confirm(`Permanently delete ${driver.fullName}? Past jobs keep code ${driver.initials}, but the account's name and contact details will be removed. Deactivate instead to retain their reporting identity. This cannot be undone.`)) return;
    setPendingAction(true); setActionError("");
    try { await deleteDriver(driver.email); setProfile(null); invalidate(); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Could not delete account. Please retry."); }
    finally { setPendingAction(false); }
  };
  useEffect(() => {
    const restore = () => {
      const next = new URLSearchParams(window.location.search);
      setTab(next.get("driversTab") === "performance" ? "performance" : "directory");
      setSearch(next.get("driverSearch") || ""); setAccountFilter(next.get("account") || "all");
      setFrom(next.get("from") || defaultDashboardDateRange().from); setTo(next.get("to") || defaultDashboardDateRange().to);
      requestAnimationFrame(restoreDriverListScroll);
    };
    window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!query.data) return;
    const frame = requestAnimationFrame(restoreDriverListScroll);
    return () => cancelAnimationFrame(frame);
  }, [query.data]);
  const openReport = (driver: DriverSummaryItem) => {
    rememberDriverListScroll();
    navigateAdmin(driverReportHref(driver.initials, from, to, "summary"));
  };
  return <div className="space-y-5 max-w-[1440px] mx-auto pb-8" onClickCapture={event => {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (anchor && new URL(anchor.href).searchParams.get("section") === "driverreport") rememberDriverListScroll();
  }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-admin-muted">Manage driver profiles and app access. Review performance separately.</p>
      <Button onClick={() => setIsAddModalOpen(true)} iconLeft={<Plus />}>Add driver</Button>
    </div>
    <SegmentedControl aria-label="Driver views" value={tab} onChange={value => { setTab(value); persist({ driversTab: value }); }}
      options={[{ value: "directory", label: "Directory" }, { value: "performance", label: "Performance summary" }]} />
    {tab === "performance" ? <>
      <AdminFilterBar dates={<DateRangePicker scope="report" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); retainRangeInUrl(f, t); }} />} />
      <DriverSettlement from={from} to={to} />
    </> : <>
      <div className="flex flex-wrap gap-3 items-center rounded-module border border-admin-line bg-white p-3">
        <div className="relative flex-1 min-w-[180px] max-w-md"><Search className="absolute left-3 top-3 w-4 h-4 text-admin-muted" />
          <input aria-label="Search driver directory" value={search} onChange={event => { setSearch(event.target.value); persist({ driverSearch: event.target.value }); }} placeholder="Search name, code or registration" className="h-10 w-full pl-9 pr-3 rounded-card border border-admin-line bg-admin-surface text-sm" /></div>
        <select aria-label="Account access filter" value={accountFilter} onChange={event => { setAccountFilter(event.target.value); persist({ account: event.target.value }); }} className="h-10 px-3 rounded-card border border-admin-line text-sm bg-white">
          <option value="all">All accounts</option><option value="active">Account active</option><option value="inactive">Account inactive</option>
        </select>
        {(search || accountFilter !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setAccountFilter("all"); persist({ driverSearch: "", account: "" }); }}>Clear filters</Button>}
        <span className="ml-auto text-sm text-admin-muted">{query.isLoading ? "Loading drivers…" : query.isError && !query.data ? "Could not load drivers" : `${filtered.length} of ${roster.length} drivers`}</span>
      </div>
      {query.isLoading && <div role="status" className="rounded-module border border-admin-line bg-white p-12 text-center text-admin-muted">Loading driver accounts…</div>}
      {query.isError && <ApiErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {!query.isLoading && (!query.isError || !!query.data) && !filtered.length && <EmptyState icon={<Users />} title={roster.length ? "No drivers match these filters" : "No driver accounts yet"} description={roster.length ? "Search another name or clear the account filter." : "Add a driver to manage app access and vehicle assignments."} action={<Button onClick={() => { if (roster.length) { setSearch(""); setAccountFilter("all"); persist({ driverSearch: "", account: "" }); } else setIsAddModalOpen(true); }}>{roster.length ? "Clear filters" : "Add driver"}</Button>} />}
      {!query.isLoading && (!query.isError || !!query.data) && !!filtered.length && <div className="bg-white rounded-module border border-admin-line overflow-hidden">
        <div className="hidden lg:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_250px] gap-4 px-5 py-3 border-b border-admin-line bg-admin-surface text-xs font-semibold text-admin-muted"><span>Driver</span><span>Account access</span><span>Assigned vehicle</span><span>Actions</span></div>
        <div className="divide-y divide-admin-line">{filtered.map(driver => <article key={driver.initials} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_250px] gap-3 md:gap-4 items-center px-5 py-3">
          <div className="flex gap-3 items-center min-w-0"><span className={`grid place-items-center w-10 h-10 rounded-full shrink-0 font-semibold text-sm ${getAvatarColor(driver.initials)}`}>{driver.initials}</span><div className="min-w-0"><h2 className="font-semibold text-sm text-admin-ink truncate">{driver.fullName}</h2><p className="text-xs text-admin-muted">Driver code {driver.initials}</p></div></div>
          <div><span className={`inline-flex rounded-control px-2.5 py-1 text-xs font-medium ${driver.active !== false ? "bg-admin-status-green-bg text-admin-status-green" : "bg-admin-surface text-admin-muted"}`}>{driver.active !== false ? "Account active" : "Account inactive"}</span></div>
          <div className="text-sm flex gap-2 items-center"><Truck size={16} className="text-admin-muted" /><span className={driver.vanRegistration ? "font-mono text-admin-ink" : "text-admin-muted"}>{driver.vanRegistration ? formatVanReg(driver.vanRegistration) : "Not assigned"}</span></div>
          <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => { setActionError(""); setProfile(driver); }} aria-label={`View profile for ${driver.fullName}`}>View profile</Button><Button variant="ghost" size="sm" onClick={() => openReport(driver)} aria-label={`View report for ${driver.fullName}`}>View report</Button></div>
        </article>)}</div>
      </div>}
      <p className="text-xs text-admin-muted">Account active means app access is enabled. Online status and current availability are not reported by this directory.</p>
    </>}
    <Modal open={!!profile} onClose={() => { if (!pendingAction) setProfile(null); }} dismissible={!pendingAction} title={profile ? `${profile.fullName} · ${profile.initials}` : "Driver profile"} size="lg">
      {profile && <div className="space-y-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">{[["Account access", profile.active !== false ? "Account active" : "Account inactive"], ["Assigned vehicle", profile.vanRegistration ? formatVanReg(profile.vanRegistration) : "Not assigned"], ["Email", profile.email || "Not recorded"], ["Phone", profile.phone || "Not recorded"], ["Tracker assignment", profile.imei ? "Assigned" : "Not assigned"]].map(([label, value]) => <div key={label}><dt className="text-xs text-admin-muted mb-1">{label}</dt><dd className="font-medium text-admin-ink break-words">{value}</dd></div>)}</dl>
        <div className="flex flex-wrap gap-2"><Button onClick={() => { setEditingDriver(profile); setProfile(null); }}>Edit profile</Button><Button variant="secondary" onClick={() => openReport(profile)}>View report</Button></div>
        <details className="border-t border-admin-line pt-4"><summary className="cursor-pointer text-sm font-medium text-admin-muted">Account management</summary><div className="space-y-3 pt-3"><p className="text-sm text-admin-muted">Deactivation preserves job history and the driver's reporting identity.</p><Button variant="secondary" disabled={pendingAction} onClick={() => void changeAccess(profile)}>{profile.active !== false ? "Deactivate app access" : "Activate app access"}</Button><details><summary className="cursor-pointer text-xs text-admin-muted">Permanent account deletion</summary><p className="my-2 text-xs text-admin-muted">Deletion removes the profile name and contact details from historical reporting. Prefer deactivation when keeping this identity is required.</p><Button variant="danger" disabled={pendingAction} onClick={() => void remove(profile)}>Delete account permanently</Button></details></div></details>
        {actionError && <p role="alert" className="text-sm text-admin-status-red">{actionError}</p>}
      </div>}
    </Modal>
    <AddDriverModal isOpen={isAddModalOpen || !!editingDriver} onClose={() => { setIsAddModalOpen(false); setEditingDriver(null); }} driverToEdit={editingDriver} />
  </div>;
}

function driverListScrollKey() { return `tmv-drivers-scroll:${window.location.pathname}${window.location.search}`; }
function rememberDriverListScroll() {
  try { sessionStorage.setItem(driverListScrollKey(), JSON.stringify({ top: document.getElementById("operations-content")?.parentElement?.scrollTop || 0, windowY: window.scrollY })); } catch { /* Optional session storage does not block navigation. */ }
}
function restoreDriverListScroll() {
  try {
    const raw = sessionStorage.getItem(driverListScrollKey());
    if (!raw) return;
    const value = JSON.parse(raw);
    const container = document.getElementById("operations-content")?.parentElement;
    const top = typeof value === "number" ? value : value.top;
    if (container && Number.isFinite(top)) container.scrollTop = top;
    if (Number.isFinite(value.windowY) && window.scrollY !== value.windowY) window.scrollTo({ top: value.windowY, behavior: "instant" });
    sessionStorage.removeItem(driverListScrollKey());
  } catch { /* Ignore a stale or unavailable session-storage entry. */ }
}
