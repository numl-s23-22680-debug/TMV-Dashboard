import React, { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  Download,
  LayoutGrid,
  List,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  fetchJobs,
  fetchJobDetail,
  markJobFinishedManually,
  reassignJob,
} from "../api";
import type { NormalizedJob } from "../types";
import { AdminFilterBar } from "../components/AdminFilterBar";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { JobStatusBadge } from "../components/StatusBadge";
import {
  DateRangePicker,
  defaultDashboardDateRange,
} from "../components/DateRangePicker";
import { ApiErrorState } from "../components/ApiErrorState";
import { BulkDeleteModal } from "../components/BulkDeleteModal";
import { ReportReturnButton } from "../components/ReportReturnButton";
import { formatLondonDateTime, formatLondonTimeOnly } from "../utils/date";
import { downloadCsv, stampForFilename, toCsv } from "../utils/csv";
import { resolveDriver } from "../utils/drivers";
import {
  jobAttentionReasons,
  jobCharge,
  jobMoney,
  jobEvidenceLabel,
  operationalDuration,
} from "../utils/jobPresentation";
import { useDriverOptions } from "../hooks/useDriverOptions";
import { useDialogFocus } from "../../../../ui/useDialogFocus";

export interface JobsPageProps {
  initialStatus?: string;
}
const STATUS_OPTIONS = [
  "All",
  "Scheduled",
  "In Progress",
  "Completed",
  "Cancelled",
];
const STATUS_API: Record<string, string> = {
  Scheduled: "READY",
  "In Progress": "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};
const SORT_API: Record<string, string> = {
  Timing: "bookedStart",
  Total: "amountCharged",
  Status: "status",
};
const readParams = () => new URLSearchParams(window.location.search);
function readStatus(fallback: string) {
  const value = readParams().get("status") || fallback;
  if (value === "Finished" || value === "COMPLETED") return "Completed";
  return STATUS_OPTIONS.includes(value)
    ? value
    : Object.keys(STATUS_API).find((key) => STATUS_API[key] === value) || "All";
}
function listContextKey() {
  const url = new URL(window.location.href);
  url.searchParams.delete("job");
  url.searchParams.delete("reportReturn");
  url.searchParams.delete("fleetReturn");
  return `tmv-jobs-scroll:${url.pathname}${url.search}`;
}

export function JobsPage({ initialStatus = "All" }: JobsPageProps = {}) {
  const initialRange = useMemo(defaultDashboardDateRange, []);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    const explicit = readParams().get("jobsView");
    try {
      return explicit === "cards" ||
        (!explicit && localStorage.getItem("tmv-jobs-view") === "cards")
        ? "cards"
        : "table";
    } catch {
      return "table";
    }
  });
  const [from, setFrom] = useState<string | undefined>(
    () => readParams().get("from") || initialRange.from,
  );
  const [to, setTo] = useState<string | undefined>(
    () => readParams().get("to") || initialRange.to,
  );
  const [searchQuery, setSearchQuery] = useState(
    () => readParams().get("q") || "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState(() =>
    readStatus(initialStatus),
  );
  const [driverFilter, setDriverFilter] = useState(
    () => readParams().get("driver") || "",
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Number(readParams().get("jobsPage")) || 1),
  );
  const [pageSize, setPageSize] = useState(() =>
    [25, 50, 100].includes(Number(readParams().get("pageSize")))
      ? Number(readParams().get("pageSize"))
      : 25,
  );
  const [sortConfig, setSortConfig] = useState(() => ({
    key: SORT_API[readParams().get("jobsSort") || ""]
      ? readParams().get("jobsSort")!
      : "Timing",
    direction:
      readParams().get("jobsDir") === "desc"
        ? ("desc" as const)
        : ("asc" as const),
  }));
  const [selectedRows, setSelectedRows] = useState(new Set<string>());
  const selectedRecords = useRef(new Map<string, NormalizedJob>());
  const [drawerJob, setDrawerJob] = useState<NormalizedJob | null>(null);
  const [openingJob, setOpeningJob] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cardReassignJob, setCardReassignJob] = useState<NormalizedJob | null>(
    null,
  );
  const [manualFinishJob, setManualFinishJob] = useState<NormalizedJob | null>(
    null,
  );
  const [deleteJobIds, setDeleteJobIds] = useState<string[] | null>(null);
  const openedDeepLinkJobRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const searchMounted = useRef(false);
  const restoredScroll = useRef(false);
  const serverStatus = STATUS_API[statusFilter];
  const serverSort = SORT_API[sortConfig.key];
  const { options: driverOptions, isLoading: driverOptionsLoading } =
    useDriverOptions();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "jobs",
      from,
      to,
      debouncedSearch,
      serverStatus,
      driverFilter,
      page,
      pageSize,
      serverSort,
      sortConfig.direction,
    ],
    queryFn: () =>
      fetchJobs({
        page,
        pageSize,
        from,
        to,
        q: debouncedSearch || undefined,
        status: serverStatus,
        driver: driverFilter || undefined,
        sort: serverSort,
        dir: sortConfig.direction,
      }),
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const total = data?.pagination?.total;
  const totalPages = Math.max(1, data?.pagination?.totalPages || 1);
  const activeFilters =
    searchQuery !== "" || statusFilter !== "All" || driverFilter !== "";

  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  useEffect(() => {
    if (!isFetching && data && page > totalPages) setPage(totalPages);
  }, [data, isFetching, page, totalPages]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const values: Record<string, string | number | undefined> = {
      from,
      to,
      q: searchQuery || undefined,
      status: serverStatus,
      driver: driverFilter || undefined,
      jobsPage: page > 1 ? page : undefined,
      pageSize: pageSize !== 25 ? pageSize : undefined,
      jobsSort: sortConfig.key,
      jobsDir: sortConfig.direction,
      jobsView: viewMode,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
    try {
      localStorage.setItem("tmv-jobs-view", viewMode);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [
    from,
    to,
    searchQuery,
    serverStatus,
    driverFilter,
    page,
    pageSize,
    sortConfig,
    viewMode,
  ]);

  async function openJob(id: string) {
    const request = ++requestRef.current;
    openedDeepLinkJobRef.current = id;
    setDetailError(null);
    setOpeningJob(id);
    try {
      const job = await fetchJobDetail(id);
      if (request !== requestRef.current) return;
      if (!job) throw new Error("Job details were not returned. Try again.");
      setDrawerJob(job);
    } catch (err) {
      if (request === requestRef.current)
        setDetailError(
          (err as Error).message || "Job details could not be loaded.",
        );
    } finally {
      if (request === requestRef.current) setOpeningJob(null);
    }
  }
  useEffect(() => {
    const read = () => {
      const id = readParams().get("job");
      if (id && openedDeepLinkJobRef.current !== id) void openJob(id);
    };
    read();
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("popstate", read);
      requestRef.current++;
      openedDeepLinkJobRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (isLoading || isFetching || drawerJob || restoredScroll.current) return;
    restoredScroll.current = true;
    try {
      const position = Number(sessionStorage.getItem(listContextKey()));
      if (position > 0) window.scrollTo(0, position);
    } catch {
      /* Best-effort return position. */
    }
  }, [isLoading, isFetching]);
  function handleOpen(job: NormalizedJob) {
    try {
      sessionStorage.setItem(listContextKey(), String(window.scrollY));
    } catch {
      /* Best effort. */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("job", job.jobId);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
    void openJob(job.jobId);
  }
  function handleCloseDrawer() {
    requestRef.current++;
    setDrawerJob(null);
    setOpeningJob(null);
    setDetailError(null);
    openedDeepLinkJobRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("job");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
  }
  function clearFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("All");
    setDriverFilter("");
    setFrom(initialRange.from);
    setTo(initialRange.to);
    setPage(1);
  }
  function toggleRow(id: string) {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
        selectedRecords.current.delete(id);
      } else {
        next.add(id);
        const record = items.find((job) => job.jobId === id);
        if (record) selectedRecords.current.set(id, record);
      }
      return next;
    });
  }
  function toggleAll() {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      const remove = items.every((job) => previous.has(job.jobId));
      for (const job of items) {
        if (remove) {
          next.delete(job.jobId);
          selectedRecords.current.delete(job.jobId);
        } else {
          next.add(job.jobId);
          selectedRecords.current.set(job.jobId, job);
        }
      }
      return next;
    });
  }
  function handleSort(key: string) {
    setSortConfig((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }
  function exportFilteredCsv() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      from,
      to,
      q: debouncedSearch,
      status: serverStatus,
      driver: driverFilter,
      sort: serverSort,
      dir: sortConfig.direction,
    }))
      if (value) params.set(key, value);
    window.location.href = `/api/admin/jobs/export.csv?${params}`;
  }
  function exportRows(rows: NormalizedJob[]) {
    downloadCsv(
      `tmv-jobs-selected-${stampForFilename()}.csv`,
      toCsv(rows, [
        { header: "Job ID", value: (job) => job.jobId },
        { header: "Customer", value: (job) => job.customerName },
        {
          header: "Scheduled (Europe/London)",
          value: (job) => formatLondonDateTime(job.bookedStart),
        },
        { header: "Driver", value: (job) => job.driverName },
        { header: "Pickup", value: (job) => job.pickup },
        { header: "Drop-off", value: (job) => job.dropoff },
        {
          header: "Delay (min, recorded source)",
          value: (job) =>
            typeof job.delayMinutes === "number"
              ? job.delayMinutes
              : "Not recorded",
        },
        {
          header: "Arrival delay source",
          value: (job) => job.arrivalDelaySource || "Not recorded",
        },
        {
          header: "Payment method",
          value: (job) => job.paymentMethod || "Not recorded",
        },
        { header: "Job status", value: (job) => job.status },
        {
          header: "Amount charged (GBP)",
          value: (job) =>
            typeof job.amountCharged === "number"
              ? (job.amountCharged / 100).toFixed(2)
              : "Not recorded",
        },
        {
          header: "Recorded total charge (GBP)",
          value: (job) =>
            typeof job.totalCharges === "number"
              ? (job.totalCharges / 100).toFixed(2)
              : "Not recorded",
        },
        {
          header: "Payment status",
          value: (job) => job.paymentStatus || "Not recorded",
        },
        {
          header: "Evidence completeness",
          value: (job) => jobEvidenceLabel(job),
        },
        {
          header: "Driver submission",
          value: (job) => (job.driverJobSummary ? "Recorded" : "Not recorded"),
        },
        {
          header: "Coverage notes",
          value: () =>
            "Missing fields remain not recorded. Charge amounts do not establish receipts.",
        },
        { header: "Scope", value: () => "Selected job records" },
        {
          header: "Date range",
          value: () => `${from || "All dates"} – ${to || "All dates"}`,
        },
      ]),
    );
  }
  const sortHeading = (key: string, label: string) => (
    <button
      type="button"
      className="inline-flex min-h-10 items-center gap-1 hover:text-admin-brand"
      onClick={() => handleSort(key)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortConfig.key === key ? (
        sortConfig.direction === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
  const empty = (
    <div className="px-5 py-14 text-center">
      <Search className="mx-auto mb-3 h-7 w-7 text-admin-muted" />
      <h3 className="text-[18px] font-semibold text-admin-ink">
        {activeFilters
          ? "No jobs match your filters"
          : "No jobs in this date range"}
      </h3>
      <p className="mt-2 text-[14px] text-admin-muted">
        {activeFilters
          ? "Clear filters or change the dates to find another job."
          : "Choose a wider date range to see other bookings."}
      </p>
      <button
        onClick={clearFilters}
        className="mt-4 min-h-10 rounded-control border border-admin-line px-4 text-[14px] font-medium text-admin-brand"
      >
        Clear filters
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      <ReportReturnButton />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-admin-ink">
            Jobs
          </h1>
          <p className="mt-1 text-[14px] text-admin-muted">
            Find a booking, inspect its progress, and open the next action.
            London time.
          </p>
        </div>
        <button
          onClick={exportFilteredCsv}
          disabled={!total}
          className="inline-flex min-h-10 items-center gap-2 rounded-control border border-admin-line bg-white px-3 text-[14px] font-medium disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export filtered jobs
        </button>
      </div>
      <AdminFilterBar
        dates={
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(1);
            }}
          />
        }
        count={
          <span aria-live="polite">
            {isLoading
              ? "Loading jobs…"
              : total === undefined
                ? "Count unavailable"
                : `${total} job${total === 1 ? "" : "s"}`}
            {isFetching && !isLoading ? " · Updating…" : ""}
          </span>
        }
      >
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-admin-muted" />
          <input
            aria-label="Search jobs by ID, customer or route"
            placeholder="Search jobs, customers or routes"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 w-full rounded-control border border-admin-line bg-white pl-9 pr-3 text-[14px]"
          />
        </div>
        <select
          aria-label="Filter jobs by status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 min-w-0 rounded-control border border-admin-line bg-white px-3 text-[14px]"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <select
          aria-label="Filter jobs by driver"
          value={driverFilter}
          onChange={(event) => {
            setDriverFilter(event.target.value);
            setPage(1);
          }}
          disabled={driverOptionsLoading}
          className="h-10 min-w-0 max-w-full rounded-control border border-admin-line bg-white px-3 text-[14px]"
        >
          <option value="">
            {driverOptionsLoading ? "Loading drivers…" : "All drivers"}
          </option>
          {driverOptions.map((driver) => (
            <option key={driver.initials} value={driver.initials}>
              {driver.fullName || driver.initials}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label="Jobs view"
          className="inline-flex rounded-control border border-admin-line bg-admin-surface p-1"
        >
          <button
            aria-label="List view"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className={`flex min-h-8 items-center gap-1.5 rounded-control px-2 text-[13px] ${viewMode === "table" ? "bg-white text-admin-brand shadow-sm" : "text-admin-muted"}`}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            aria-label="Card view"
            aria-pressed={viewMode === "cards"}
            onClick={() => setViewMode("cards")}
            className={`flex min-h-8 items-center gap-1.5 rounded-control px-2 text-[13px] ${viewMode === "cards" ? "bg-white text-admin-brand shadow-sm" : "text-admin-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
        <button
          aria-label="Refresh jobs"
          onClick={() => refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-admin-line bg-white"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </button>
        {activeFilters && (
          <button
            onClick={clearFilters}
            className="min-h-10 px-2 text-[14px] font-medium text-admin-brand"
          >
            Clear filters
          </button>
        )}
      </AdminFilterBar>
      {activeFilters && (
        <div
          className="flex flex-wrap gap-2 text-[13px] text-admin-muted"
          aria-label="Active job filters"
        >
          <span className="font-medium">Active filters:</span>
          {searchQuery && <span>Search “{searchQuery}”</span>}
          {statusFilter !== "All" && <span>· {statusFilter}</span>}
          {driverFilter && <span>· Driver {driverFilter}</span>}
        </div>
      )}
      {isError && (
        <ApiErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      )}
      {openingJob && (
        <div
          className="rounded-card border border-admin-line bg-white px-4 py-3 text-[14px]"
          role="status"
        >
          Opening job {openingJob}…
        </div>
      )}
      {detailError && (
        <ApiErrorState
          message={detailError}
          onRetry={() => {
            const id = readParams().get("job");
            if (id) void openJob(id);
          }}
        />
      )}
      {(!isError || data) && (
        <div className="overflow-hidden rounded-module border border-admin-line bg-white">
          {isLoading ? (
            <div aria-label="Loading jobs" className="space-y-4 p-5">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-control bg-admin-surface"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            empty
          ) : (
            <>
              {viewMode === "table" ? (
                <>
                  <div className="hidden lg:block">
                    <table className="w-full table-fixed text-left text-[14px]">
                      <thead className="border-b border-admin-line bg-admin-surface/60 text-[12px] text-admin-muted">
                        <tr>
                          <th className="w-10 px-3">
                            <input
                              type="checkbox"
                              aria-label="Select all jobs on this page"
                              checked={
                                items.length > 0 &&
                                items.every((job) =>
                                  selectedRows.has(job.jobId),
                                )
                              }
                              onChange={toggleAll}
                            />
                          </th>
                          <th
                            className="w-[13%] px-3"
                            aria-sort={
                              sortConfig.key === "Timing"
                                ? sortConfig.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            {sortHeading("Timing", "Scheduled time")}
                          </th>
                          <th className="px-3">Customer & route</th>
                          <th className="w-[13%] px-3">Driver</th>
                          <th className="w-[13%] px-3">
                            {sortHeading("Status", "Job status")}
                          </th>
                          <th className="w-[11%] px-3 text-right">
                            {sortHeading("Total", "Charge")}
                          </th>
                          <th className="w-[15%] px-3">Needs attention</th>
                          <th className="w-[88px] px-3">
                            <span className="sr-only">Open or manage job</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-line/70">
                        {items.map((job) => {
                          const driver = resolveDriver(
                            job.driverName,
                            job.driverInitials,
                          );
                          const charge = jobCharge(job);
                          const reasons = jobAttentionReasons(job);
                          return (
                            <tr
                              key={job.jobId}
                              className="hover:bg-admin-surface/50"
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Select job ${job.jobId}`}
                                  checked={selectedRows.has(job.jobId)}
                                  onChange={() => toggleRow(job.jobId)}
                                />
                              </td>
                              <td className="px-3 py-3">
                                <span className="block font-semibold tabular-nums">
                                  {formatLondonTimeOnly(job.bookedStart)}
                                </span>
                                <span className="mt-1 block text-[12px] text-admin-muted">
                                  {job.bookedStart
                                    ? formatLondonDateTime(
                                        job.bookedStart,
                                      ).split(" · ")[0]
                                    : "Not scheduled"}
                                </span>
                              </td>
                              <td className="min-w-0 px-3 py-3">
                                <button
                                  onClick={() => handleOpen(job)}
                                  className="block max-w-full truncate text-left font-semibold text-admin-ink hover:text-admin-brand"
                                >
                                  {job.customerName || "Customer not recorded"}
                                </button>
                                <span
                                  className="mt-1 block truncate text-[12px] text-admin-muted"
                                  title={`${job.pickup || "Pickup not recorded"} → ${job.dropoff || "Drop-off not recorded"}`}
                                >
                                  {job.pickup || "Pickup not recorded"} →{" "}
                                  {job.dropoff || "Drop-off not recorded"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="block truncate">
                                  {driver.name}
                                </span>
                                <span className="mt-1 block text-[12px] text-admin-muted">
                                  {job.driverInitials || "Unassigned"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <JobStatusBadge status={job.status} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="block font-semibold tabular-nums">
                                  {jobMoney(charge.amount)}
                                </span>
                                <span className="mt-1 block text-[12px] text-admin-muted">
                                  {charge.basis}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`block text-[12px] ${reasons.length ? "text-amber-800" : "text-admin-muted"}`}
                                >
                                  {reasons[0] || "No recorded exception"}
                                </span>
                                {reasons.length > 1 && (
                                  <span className="mt-1 block text-[12px] text-admin-muted">
                                    +{reasons.length - 1} more in details
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpen(job)}
                                    aria-label={`Open job ${job.jobId}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-control border border-admin-line text-admin-brand"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                  <JobActionsMenu
                                    job={job}
                                    onReassign={setCardReassignJob}
                                    onManualFinish={setManualFinishJob}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-admin-line lg:hidden">
                    {items.map((job) => (
                      <JobRow
                        key={job.jobId}
                        job={job}
                        selected={selectedRows.has(job.jobId)}
                        onToggle={toggleRow}
                        onOpen={handleOpen}
                        onReassign={setCardReassignJob}
                        onManualFinish={setManualFinishJob}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((job) => (
                    <JobRow
                      key={job.jobId}
                      job={job}
                      selected={selectedRows.has(job.jobId)}
                      onToggle={toggleRow}
                      onOpen={handleOpen}
                      onReassign={setCardReassignJob}
                      onManualFinish={setManualFinishJob}
                      card
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line px-4 py-3 text-[13px] text-admin-muted">
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total || 0)} of {total} jobs
                </span>
                <div className="flex items-center gap-3">
                  <select
                    aria-label="Jobs per page"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    className="h-9 rounded-control border border-admin-line bg-white px-2"
                  >
                    {[25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size} per page
                      </option>
                    ))}
                  </select>
                  {totalPages > 1 && (
                    <>
                      <button
                        aria-label="Previous page"
                        disabled={page <= 1 || isFetching}
                        onClick={() => setPage((value) => value - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-control border border-admin-line disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span>
                        {page} / {totalPages}
                      </span>
                      <button
                        aria-label="Next page"
                        disabled={page >= totalPages || isFetching}
                        onClick={() => setPage((value) => value + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-control border border-admin-line disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {selectedRows.size > 0 && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-card border border-admin-line bg-admin-ink px-4 py-3 text-[13px] text-white shadow-lg">
          <span className="font-semibold">{selectedRows.size} selected</span>
          <button
            onClick={() =>
              exportRows(
                Array.from(selectedRecords.current.values()).filter((job) =>
                  selectedRows.has(job.jobId),
                ),
              )
            }
            className="min-h-9 px-2"
          >
            Export selected records
          </button>
          <button
            onClick={() => setReassignOpen(true)}
            className="min-h-9 px-2"
          >
            Reassign selected
          </button>
          <details className="relative">
            <summary className="cursor-pointer px-2 py-2">More actions</summary>
            <button
              onClick={() => setDeleteJobIds(Array.from(selectedRows))}
              className="absolute bottom-10 left-0 whitespace-nowrap rounded-control border border-admin-line bg-white p-3 text-red-700 shadow-lg"
            >
              Delete selected jobs…
            </button>
          </details>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="ml-auto min-h-9 px-2"
          >
            Clear selection
          </button>
        </div>
      )}
      {drawerJob && (
        <JobDetailDrawer
          job={drawerJob}
          isOpen
          onClose={handleCloseDrawer}
          onUpdated={() => refetch()}
        />
      )}
      {(reassignOpen || cardReassignJob) && (
        <BulkReassignModal
          jobIds={
            cardReassignJob ? [cardReassignJob.jobId] : Array.from(selectedRows)
          }
          onClose={() => {
            setReassignOpen(false);
            setCardReassignJob(null);
          }}
          onDone={() => {
            setReassignOpen(false);
            setCardReassignJob(null);
            setSelectedRows(new Set());
            void refetch();
          }}
        />
      )}
      {manualFinishJob && (
        <ManualFinishModal
          job={manualFinishJob}
          onClose={() => setManualFinishJob(null)}
          onDone={() => {
            setManualFinishJob(null);
            void refetch();
          }}
        />
      )}
      {deleteJobIds && (
        <BulkDeleteModal
          jobIds={deleteJobIds}
          onClose={() => setDeleteJobIds(null)}
          onDone={() => {
            setDeleteJobIds(null);
            setSelectedRows(new Set());
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function JobRow({
  job,
  selected,
  onToggle,
  onOpen,
  onReassign,
  onManualFinish,
  card = false,
}: {
  job: NormalizedJob;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (job: NormalizedJob) => void;
  onReassign: (job: NormalizedJob) => void;
  onManualFinish: (job: NormalizedJob) => void;
  card?: boolean;
}) {
  const charge = jobCharge(job);
  const reasons = jobAttentionReasons(job);
  return (
    <article
      className={`p-4 ${card ? "rounded-[6px] border" : ""} ${selected ? "border-admin-brand ring-2 ring-inset ring-admin-brand/20" : "border-admin-line"}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Select job ${job.jobId}`}
          checked={selected}
          onChange={() => onToggle(job.jobId)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <button
          onClick={() => onOpen(job)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-[12px] font-medium tabular-nums text-admin-muted">
            {job.bookedStart
              ? formatLondonDateTime(job.bookedStart)
              : "Not scheduled"}
          </span>
          <span className="mt-1 block text-[15px] font-semibold text-admin-ink">
            {job.customerName || "Customer not recorded"}
          </span>
          <span className="mt-1 line-clamp-2 break-words text-[13px] text-admin-muted">
            {job.pickup || "Pickup not recorded"} →{" "}
            {job.dropoff || "Drop-off not recorded"}
          </span>
          <span className="mt-2 block text-[13px] text-admin-ink">
            {job.driverName || "Unassigned"}
            {job.crewSize ? ` · Crew ${job.crewSize}` : ""} ·{" "}
            {operationalDuration(
              job.timeBilling?.scheduledMinutes ?? job.bookedMinutes,
            )}
          </span>
          <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <JobStatusBadge status={job.status} />
            <span className="text-right">
              <span className="block text-[14px] font-semibold tabular-nums">
                {jobMoney(charge.amount)}
              </span>
              <span className="block text-[12px] text-admin-muted">
                {charge.basis}
              </span>
            </span>
          </span>
          {reasons.length > 0 && (
            <span className="mt-3 block text-[12px] text-amber-800">
              {reasons[0]}
              {reasons.length > 1
                ? ` · +${reasons.length - 1} more in details`
                : ""}
            </span>
          )}
          <span className="mt-2 block text-[12px] text-admin-muted">
            {job.jobId}
          </span>
        </button>
        <JobActionsMenu
          job={job}
          onReassign={onReassign}
          onManualFinish={onManualFinish}
        />
      </div>
    </article>
  );
}
function canManualFinish(job: NormalizedJob): boolean {
  return job.status !== "COMPLETED" && job.status !== "CANCELLED";
}

function JobActionsMenu({
  job,
  onReassign,
  onManualFinish,
}: {
  job: NormalizedJob;
  onReassign: (job: NormalizedJob) => void;
  onManualFinish: (job: NormalizedJob) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);
  const allowManualFinish = canManualFinish(job);

  function closeAnd(run: () => void) {
    setOpen(false);
    run();
  }

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        title="Job actions"
        aria-label={`Actions for job ${job.jobId}`}
        className="p-1.5 rounded-full text-admin-muted hover:bg-admin-brand hover:text-white transition"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-card border border-admin-line bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => closeAnd(() => onReassign(job))}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-admin-ink hover:bg-admin-surface"
          >
            <UserPlus className="w-4 h-4 text-admin-muted" /> Reassign driver
          </button>
          {allowManualFinish && (
            <button
              type="button"
              onClick={() => closeAnd(() => onManualFinish(job))}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-admin-status-green hover:bg-admin-status-green-bg"
            >
              <CheckCircle2 className="w-4 h-4" /> Complete job manually
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- bulk reassign ---- */

/**
 * Reassigns every selected job to one driver. The endpoint already existed
 * (api.ts's reassignJob, used by the single-job drawer) -- the toolbar button simply
 * had no handler wired to it.
 */
function BulkReassignModal({
  jobIds,
  onClose,
  onDone,
}: {
  jobIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { options, isLoading: driversLoading } = useDriverOptions();
  const [initials, setInitials] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const dialogRef = useDialogFocus(true, onClose, !busy);

  const drivers = options.filter((d) => d.active);

  async function handleConfirm() {
    if (!initials || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Sequential rather than Promise.all: the progress counter stays truthful, and a
      // partial failure leaves a clear record of how far it got.
      for (const jobId of jobIds.slice(done)) {
        await reassignJob(jobId, initials);
        setDone((n) => n + 1);
      }
      onDone();
    } catch (err: any) {
      setError(
        err?.message ||
          "Couldn't reassign every job. Some may have been changed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-admin-ink/40 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-reassign-title"
        className="bg-white rounded-module shadow-2xl w-full max-w-[440px] p-6 animate-in zoom-in-95"
      >
        <h2 id="bulk-reassign-title" className="text-title text-fg">
          Reassign {jobIds.length} job{jobIds.length === 1 ? "" : "s"}
        </h2>
        <p className="text-[13px] text-admin-muted mt-1">
          {jobIds.length === 1
            ? "This job moves to the selected driver, who will be notified, and the linked Calendar event is updated."
            : "Every selected job moves to the selected driver, who will be notified for each one, and their linked Calendar events are updated."}
        </p>

        <label className="block mt-5">
          <span className="text-label font-semibold text-fg">Assign to</span>
          <div className="relative mt-1.5">
            <select
              value={initials}
              onChange={(e) => setInitials(e.target.value)}
              disabled={busy || driversLoading || done > 0}
              className="w-full h-11 px-3 pr-9 rounded-card border border-admin-line bg-admin-surface outline-none focus:border-admin-brand disabled:opacity-70"
            >
              <option value="">
                {driversLoading ? "Loading drivers…" : "Choose a driver…"}
              </option>
              {!driversLoading &&
                drivers.map((driver) => (
                  <option key={driver.initials} value={driver.initials}>
                    {driver.fullName || driver.initials} ({driver.initials})
                  </option>
                ))}
            </select>
            {driversLoading && (
              <RefreshCw className="w-4 h-4 text-admin-muted animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
        </label>

        {(busy || done > 0) && (
          <p className="text-[13px] text-admin-muted mt-3" role="status">
            {busy ? "Reassigning…" : "Reassigned"} {done} of {jobIds.length}
          </p>
        )}
        {error && (
          <p className="text-[13px] text-admin-status-red mt-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-11 rounded-card bg-admin-surface text-card text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!initials || busy}
            className="flex-1 h-11 rounded-card bg-admin-brand text-white text-[14px] font-semibold disabled:opacity-50"
          >
            {busy ? "Reassigning…" : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualFinishModal({
  job,
  onClose,
  onDone,
}: {
  job: NormalizedJob;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedNote = note.trim();
  const dialogRef = useDialogFocus(true, onClose, !busy);

  async function handleConfirm() {
    if (!trimmedNote || busy) return;
    setBusy(true);
    setError(null);
    try {
      await markJobFinishedManually(job.jobId, trimmedNote);
      onDone();
    } catch (err: any) {
      setError(err?.message || "Couldn't mark this job as finished.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-admin-ink/40 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-finish-title"
        className="bg-white rounded-module shadow-2xl w-full max-w-[460px] p-6 animate-in zoom-in-95"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-full bg-admin-status-green-bg text-admin-status-green flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="manual-finish-title" className="text-title text-fg">
              Complete job manually
            </h2>
            <p className="text-[13px] text-admin-muted mt-1">
              {job.jobId} · {job.customerName || "Not recorded"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900">
          This completes the job for scheduling and driver flow, but missing
          photos or signature will stay missing in the record.
        </div>

        <label className="block mt-5">
          <span className="text-label font-semibold text-fg">Admin note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            rows={4}
            maxLength={1000}
            placeholder="Example: Driver completed this job manually outside the app."
            className="mt-1.5 w-full rounded-card border border-admin-line bg-admin-surface px-3 py-2 text-[13px] text-admin-ink outline-none focus:border-admin-brand disabled:opacity-70"
          />
          <span className="mt-1 block text-[11px] text-admin-muted">
            {trimmedNote.length}/1000
          </span>
        </label>

        {error && (
          <p className="text-[13px] text-admin-status-red mt-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-11 rounded-card bg-admin-surface text-card text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!trimmedNote || busy}
            className="flex-1 h-11 rounded-card bg-admin-status-green text-white text-[14px] font-semibold disabled:opacity-50"
          >
            {busy ? "Finishing..." : "Finish manually"}
          </button>
        </div>
      </div>
    </div>
  );
}
