import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, Settings2 } from "lucide-react";
import { fetchJobDetail, fetchScenarios } from "../api";
import { ScenarioItem } from "../types";
import { useDriverOptions } from "../hooks/useDriverOptions";
import { useScenarioFilters, ScenarioFilterControl } from "../hooks/useScenarioFilters";
import { resolveDriver } from "../utils/drivers";
import { formatLondonDateTime } from "../utils/date";
import { evidencePhotoCount } from "../utils/evidence";
import { scenarioPointFromRecord } from "../utils/scenarioPoint";
import { scenarioJobId, scenarioReviewStatus, scenarioSignatureStatus } from "../utils/evidenceRecords";
import { SubmissionPageTemplate } from "../components/SubmissionPageTemplate";
import { SubmissionDetailDrawer } from "../components/SubmissionDetailDrawer";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { LiabilityConfigModal } from "../components/LiabilityConfigModal";
import { ApiErrorState } from "../components/ApiErrorState";
import { downloadCsv, stampForFilename } from "../utils/csv";
import { scenarioPageCsv } from "../utils/recordExports";
import { Button, EmptyState, Modal } from "../../../../ui";

interface Props { kind: "checkin" | "checkout" | "parking" | "liability"; filterControl?: ScenarioFilterControl; viewSwitcher?: React.ReactNode }
const TITLES = { checkin: "Check-in", checkout: "Checkout", parking: "Parking evidence", liability: "Incident / liability reports" };

export function ScenariosPage({ kind, filterControl, viewSwitcher }: Props) {
  const [page, setPage] = useState(() => Math.max(1, Number(new URLSearchParams(location.search).get("evidencePage")) || 1));
  const { from, to, searchQuery, driverFilter, setFrom, setTo, setSearchQuery, setDriverFilter } = useScenarioFilters(filterControl);
  const [preview, setPreview] = useState<ScenarioItem | null>(null);
  const [download, setDownload] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const query = useQuery({ queryKey: ["scenarios", kind, page, from, to, driverFilter], queryFn: () => fetchScenarios(kind, page, driverFilter || undefined, from, to), retry: 1 });
  const linkedJob = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJobDetail(jobId!), enabled: !!jobId, retry: 1 });
  const { options: driverOptions, isLoading: driverOptionsLoading } = useDriverOptions();
  const closeJob = useCallback(() => setJobId(null), []);
  const closeEvidence = useCallback(() => { setPreview(null); setDownload(false); }, []);
  const changePage = (next: number) => { setPage(next); const url = new URL(location.href); url.searchParams.set("evidencePage", String(next)); history.replaceState({}, "", url.pathname + url.search); };
  const previousKind = useRef(kind);
  useEffect(() => { if (previousKind.current !== kind) changePage(1); previousKind.current = kind; }, [kind]);
  const items = query.data?.items ?? [];
  const filtered = items.filter((item: any) => {
    const raw = item.rawRecord || item;
    return !searchQuery || [item.clientName, raw["Client Name"], raw["Client Full Name"], item.driverName, item.driver, raw["Driver"], scenarioJobId(item), item.containerNumber, raw["Container Number"], item.damageCategories, item.address, raw["Address"]].filter(Boolean).join(" ").toLowerCase().includes(searchQuery.toLowerCase());
  });
  const pageSize = query.data?.pagination.pageSize || 25;
  const total = query.data?.pagination.total ?? 0;
  const clear = () => { setSearchQuery(""); setDriverFilter(""); setFrom(undefined); setTo(undefined); changePage(1); };
  const openPreview = (item: ScenarioItem, autoDownload = false) => { setDownload(autoDownload); setPreview(item); };
  const cells = (item: any) => {
    const raw = item.rawRecord || item;
    const id = scenarioJobId(item);
    const customer = item.clientName || raw["Client Name"] || raw["Client Full Name"] || "Customer not recorded";
    const driver = resolveDriver(item.driverName || item.driver || raw["Driver"], item.driverInitials);
    const timestamp = item.timestamp || raw["Timestamp"] || raw["Date"] || "";
    const photos = evidencePhotoCount(item);
    const signature = scenarioSignatureStatus(item);
    const point = scenarioPointFromRecord(item);
    const ref = kind === "parking" ? item.address || raw["Address"] : kind === "liability" ? item.damageCategories || raw["Damage Categories"] : item.containerNumber || raw["Container Number"];
    return { id, customer, driver, time: timestamp ? formatLondonDateTime(timestamp) : "Time not recorded", photos, signature, point, ref, review: scenarioReviewStatus(item, kind) };
  };
  const empty = <EmptyState icon={<ClipboardList />} title={searchQuery ? "No matches on this page" : "No records in this range"} description={searchQuery ? "Search applies to this loaded page. Try another page or clear the search." : "There are no recorded submissions for the selected dates and driver. This does not establish that evidence was not required."} action={<Button variant="secondary" onClick={clear}>{searchQuery || driverFilter ? "Clear filters" : "Expand date range"}</Button>} className="border-0 rounded-none" />;
  const state = query.isLoading ? <div role="status" className="p-12 text-center text-sm text-admin-muted">Loading {TITLES[kind].toLowerCase()} records…</div> : query.isError && !query.data ? <ApiErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} className="border-0" /> : !filtered.length ? empty : null;
  const header = ["Job / customer", "Driver", "Event time · London", "Evidence", "Signature status", "Review state", "Actions"].map(label => <th key={label} className="px-4 py-3 text-xs font-medium text-admin-muted">{label}</th>);
  const recordRows = filtered.map((item: any) => {
    const row = cells(item);
    return <tr key={item.id} className="hover:bg-admin-surface/50">
      <td className="px-4 py-3 max-w-[260px]"><div className="font-medium text-admin-ink break-words">{row.customer}</div>{row.id ? <button onClick={() => setJobId(row.id)} className="text-xs text-admin-brand hover:underline mt-1" aria-label={`Open job ${row.id}`}>Job {row.id.length > 22 ? `${row.id.slice(0, 22)}…` : row.id}</button> : <div className="text-xs text-admin-muted mt-1">Job link not recorded</div>}{row.ref && <p className="text-xs text-admin-muted mt-1 break-words">{kind === "checkin" || kind === "checkout" ? "Storage container: " : ""}{row.ref}</p>}</td>
      <td className="px-4 py-3 text-sm text-admin-ink">{row.driver.name}<div className="text-xs text-admin-muted mt-1">{row.driver.code}</div></td>
      <td className="px-4 py-3 text-xs text-admin-muted tabular-nums whitespace-nowrap">{row.time}{row.point && <p className="mt-1" title={row.point.full}>{row.point.point}</p>}</td>
      <td className="px-4 py-3 text-sm text-admin-muted">{row.photos === null ? "Photo count not recorded" : row.photos ? `${row.photos} photo${row.photos === 1 ? "" : "s"}` : "No photos recorded"}</td>
      <td className="px-4 py-3"><span className={`text-xs rounded-control px-2 py-1 inline-block ${row.signature === "Signed" ? "bg-admin-status-green-bg text-admin-status-green" : "bg-admin-surface text-admin-muted"}`}>{row.signature}</span></td>
      <td className="px-4 py-3 text-xs text-admin-muted max-w-[160px]">{row.review}</td>
      <td className="px-4 py-3"><div className="flex gap-1"><Button variant="secondary" size="sm" onClick={() => openPreview(item)} aria-label={`View evidence for ${row.customer}`}>View evidence</Button></div></td>
    </tr>;
  });
  const mobile = state || filtered.map((item: any) => { const row = cells(item); return <article key={item.id} className="p-4 space-y-3">
    <div className="flex justify-between gap-3"><h2 className="text-sm font-semibold text-admin-ink">{row.customer}</h2><span className="text-xs text-admin-muted">{row.signature}</span></div>
    <p className="text-xs text-admin-muted">{row.time} · {row.driver.name}</p>{row.ref && <p className="text-sm text-admin-ink break-words">{kind === "checkin" || kind === "checkout" ? "Storage container: " : ""}{row.ref}</p>}
    <p className="text-xs text-admin-muted">{row.photos === null ? "Photos not recorded" : `${row.photos} photos recorded`} · {row.review}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => openPreview(item)}>View evidence</Button>{row.id && <Button variant="ghost" size="sm" onClick={() => setJobId(row.id)}>Open job</Button>}<Button variant="ghost" size="sm" onClick={() => openPreview(item, true)}>Download PDF</Button></div>
  </article>; });
  return <>
    <SubmissionPageTemplate title={TITLES[kind]} icon={FileText} viewSwitcher={viewSwitcher} search={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search this page: job, customer, driver" driverFilter={driverFilter} onDriverFilterChange={value => { setDriverFilter(value); changePage(1); }} driverOptions={driverOptions} driverOptionsLoading={driverOptionsLoading} from={from} to={to} onDateChange={(f, t) => { setFrom(f); setTo(t); changePage(1); }} itemCount={filtered.length} countLabel={query.isLoading ? "Loading records…" : query.isError && !query.data ? "Could not load records" : undefined} isFetching={query.isFetching} onRefresh={() => void query.refetch()} page={page} pageSize={pageSize} totalItems={total} onPageChange={changePage} tableHeader={header} tableBody={state ? <tr><td colSpan={7}>{state}</td></tr> : recordRows} mobileRows={mobile} hasFilters={!!(searchQuery || driverFilter || from || to)} onClearFilters={clear}
      notice={<>{query.isError && query.data && <ApiErrorState message="Refresh failed. Previously loaded records remain available." onRetry={() => void query.refetch()} />}<p className="text-xs text-admin-muted">Submissions and evidence remain separate from job completion. A signature on file does not establish review or resolution.</p></>}
      onExportCsv={() => downloadCsv(`TMV-${kind}-page-${page}-${stampForFilename()}.csv`, scenarioPageCsv(filtered, kind, { from, to, page, driver: driverFilter, search: searchQuery }))} onOriginalExportCsv={() => { window.location.href = `/api/admin/scenarios/${kind}/export.csv`; }}
      secondaryAction={kind === "liability" ? <button onClick={() => setConfigOpen(true)} className="h-10 w-10 rounded-card border border-admin-line text-admin-muted grid place-items-center" aria-label="Manage incident categories"><Settings2 size={16} /></button> : undefined} />
    {preview && <SubmissionDetailDrawer job={preview} kind={kind} isOpen autoDownload={download} onClose={closeEvidence} onOpenJob={id => { closeEvidence(); setJobId(id); }} onNavigate={direction => { const index = filtered.findIndex(item => item.id === preview.id); const next = filtered[index + (direction === "next" ? 1 : -1)]; if (next) setPreview(next); }} hasPrev={filtered.findIndex(item => item.id === preview.id) > 0} hasNext={filtered.findIndex(item => item.id === preview.id) < filtered.length - 1} />}
    {jobId && linkedJob.data && <JobDetailDrawer job={linkedJob.data} isOpen onClose={closeJob} onUpdated={() => void linkedJob.refetch()} />}
    <Modal open={!!jobId && !linkedJob.data} onClose={closeJob} title="Job details"><div>{linkedJob.isError ? <ApiErrorState message={(linkedJob.error as Error).message} onRetry={() => void linkedJob.refetch()} /> : <p role="status" className="text-sm text-admin-muted">Loading linked job…</p>}</div></Modal>
    {kind === "liability" && <LiabilityConfigModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />}
  </>;
}
