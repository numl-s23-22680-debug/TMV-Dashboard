import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Bell, RefreshCw, Send, Trash2 } from "lucide-react";
import { Alert, Button, EmptyState, useMediaQuery } from "../../../../ui";
import {
  dismissNotifications,
  fetchNotifications,
  type NotificationRow,
} from "../api";
import { AdminFilterBar } from "../components/AdminFilterBar";
import {
  DateRangePicker,
  defaultDashboardDateRange,
} from "../components/DateRangePicker";
import { ApiErrorState } from "../components/ApiErrorState";
import { BulkDismissModal } from "../components/BulkDismissModal";
import { SendBroadcastPushModal } from "../components/SendBroadcastPushModal";
import { formatLondonDateTime } from "../utils/date";
import { navigateAdmin, recordJobHref } from "../utils/reportNavigation";

export const NOTIFICATION_STATUS_LABEL: Record<
  NotificationRow["email"]["state"],
  string
> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
  skipped: "No target",
  disabled: "Disabled",
};
const STATUS_STYLE: Record<NotificationRow["email"]["state"], string> = {
  sent: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-800",
  pending: "bg-amber-50 text-amber-800",
  skipped: "bg-slate-100 text-slate-700",
  disabled: "bg-slate-100 text-slate-700",
};
const time = (value: string | undefined) =>
  value
    ? DateTime.fromISO(value, { zone: "Europe/London" }).toMillis()
    : undefined;

export function NotificationsPage() {
  const mobile = useMediaQuery("(max-width: 639px)");
  const params = new URLSearchParams(window.location.search);
  const defaults = defaultDashboardDateRange();
  const [from, setFrom] = useState<string | undefined>(
    () => params.get("from") || defaults.from,
  );
  const [to, setTo] = useState<string | undefined>(
    () => params.get("to") || defaults.to,
  );
  const [searchQuery, setSearchQuery] = useState(
    () => params.get("deliverySearch") || "",
  );
  const [statusFilter, setStatusFilter] = useState(() =>
    ["All", "Sent", "Failed", "Pending"].includes(
      params.get("deliveryStatus") || "",
    )
      ? params.get("deliveryStatus")!
      : "All",
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Number(params.get("deliveryPage")) || 1),
  );
  const pageSize = 25;
  const [broadcast, setBroadcast] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismiss, setDismiss] = useState(false);
  const { data, isLoading, error, refetch, dataUpdatedAt, isFetching } =
    useQuery({
      queryKey: ["notifications"],
      queryFn: fetchNotifications,
      refetchInterval: 30000,
    });
  useEffect(() => {
    const current = new URL(window.location.href);
    for (const [key, value] of [
      ["from", from],
      ["to", to],
      ["deliverySearch", searchQuery],
      ["deliveryStatus", statusFilter === "All" ? "" : statusFilter],
      ["deliveryPage", page === 1 ? "" : String(page)],
    ]) {
      if (value) current.searchParams.set(key!, value);
      else current.searchParams.delete(key!);
    }
    window.history.replaceState({}, "", current.pathname + current.search);
  }, [from, to, searchQuery, statusFilter, page]);
  const allRows = data?.rows ?? [];
  const filtered = allRows.filter((row) => {
    const at = time(row.actualStart);
    const start = time(from);
    const end = time(to);
    if (
      start !== undefined &&
      (at === undefined || !Number.isFinite(at) || at < start)
    )
      return false;
    if (
      end !== undefined &&
      (at === undefined || !Number.isFinite(at) || at > end)
    )
      return false;
    const query = searchQuery.trim().toLowerCase();
    if (
      query &&
      !`${row.jobId} ${row.customerName}`.toLowerCase().includes(query)
    )
      return false;
    return (
      statusFilter === "All" ||
      row.email.state === statusFilter.toLowerCase() ||
      row.sms.state === statusFilter.toLowerCase()
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => {
    if (data) setPage((value) => Math.min(value, totalPages));
  }, [totalPages, data]);
  useEffect(() => {
    if (!data) return;
    const key = `tmv-delivery-scroll:${window.location.pathname + window.location.search}`;
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      const frame = requestAnimationFrame(() => {
        const container =
          document.getElementById("operations-content")?.parentElement;
        if (container) container.scrollTop = Number(saved);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [Boolean(data)]);
  const clear = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPage(1);
  };
  const openJob = (id: string) => {
    const container =
      document.getElementById("operations-content")?.parentElement;
    sessionStorage.setItem(
      `tmv-delivery-scroll:${window.location.pathname + window.location.search}`,
      String(container?.scrollTop ?? 0),
    );
    navigateAdmin(recordJobHref(id));
  };
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.jobId));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold text-fg">Delivery log</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            Available email and SMS records, filtered by job start in London
            time. Sent is not a delivery or read receipt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            iconLeft={<RefreshCw />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            iconLeft={<Send />}
            onClick={() => setBroadcast(true)}
          >
            Broadcast notice
          </Button>
        </div>
      </div>
      <AdminFilterBar
        dates={
          <DateRangePicker
            from={from}
            to={to}
            onChange={(start, end) => {
              setFrom(start);
              setTo(end);
              setPage(1);
            }}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="delivery-status">
            Delivery state
          </label>
          <select
            id="delivery-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-control border border-admin-line bg-white px-3 text-[14px]"
          >
            {["All", "Sent", "Failed", "Pending"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <label htmlFor="delivery-search" className="sr-only">
            Search delivery records
          </label>
          <input
            id="delivery-search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search customer or job ID"
            className="h-11 min-w-0 w-full sm:w-64 rounded-control border border-admin-line px-3 text-[14px]"
          />
          {(searchQuery || statusFilter !== "All") && (
            <Button variant="ghost" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      </AdminFilterBar>
      <div className="flex flex-wrap justify-between gap-2 text-[13px] text-fg-muted">
        <span>
          {isLoading
            ? "Loading records…"
            : `${filtered.length} matching record${filtered.length === 1 ? "" : "s"}`}
        </span>
        {dataUpdatedAt > 0 && (
          <span>
            Last updated{" "}
            {DateTime.fromMillis(dataUpdatedAt)
              .setZone("Europe/London")
              .toFormat("dd LLL yyyy · HH:mm")}{" "}
            · London
          </span>
        )}
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-admin-line bg-white p-3">
          <span className="text-[14px]">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Trash2 />}
              onClick={() => setDismiss(true)}
            >
              Dismiss from log
            </Button>
          </div>
        </div>
      )}
      {isLoading && (
        <div
          role="status"
          className="rounded-module border border-admin-line bg-white p-10 text-center text-[14px] text-fg-muted"
        >
          Loading delivery records…
        </div>
      )}
      {error &&
        (data ? (
          <Alert
            tone="warning"
            title="Delivery log could not refresh"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            }
          >
            Showing the last successfully loaded records.
          </Alert>
        ) : (
          <ApiErrorState
            message={(error as Error).message}
            onRetry={() => void refetch()}
          />
        ))}
      {!isLoading && data && filtered.length === 0 && (
        <EmptyState
          icon={<Bell />}
          title={
            allRows.length
              ? "No matching delivery records"
              : "No delivery records available"
          }
          description="Try a wider date range or clear the status and search filters. This is the delivery log, not the operational alert feed."
          action={
            searchQuery || statusFilter !== "All" ? (
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
      {!isLoading &&
        rows.length > 0 &&
        (mobile ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <article
                key={row.jobId}
                className="rounded-module border border-admin-line bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-3 size-4 shrink-0"
                    aria-label={`Select delivery record ${row.jobId}`}
                    checked={selected.has(row.jobId)}
                    onChange={() => toggle(row.jobId)}
                  />
                  <button
                    aria-label={`Open job ${row.jobId}`}
                    className="min-h-11 min-w-0 text-left text-[14px] font-semibold text-admin-brand"
                    onClick={() => openJob(row.jobId)}
                  >
                    {row.customerName || "Customer not recorded"}
                    <span className="mt-1 block text-[12px] font-normal text-fg-muted">
                      {row.jobId} ·{" "}
                      {row.driverInitials || "Driver not assigned"}
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-[12px] text-fg-muted">
                  Job start {formatLondonDateTime(row.actualStart)} · London
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-admin-line pt-3">
                  {(["email", "sms"] as const).map((channel) => (
                    <div key={channel}>
                      <h4 className="mb-1.5 text-[13px] font-medium text-fg">
                        {channel === "email" ? "Email" : "SMS"}
                      </h4>
                      <ChannelState row={row} channel={channel} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-module border border-admin-line bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-admin-surface text-[12px] text-fg-muted">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all delivery records on this page"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(
                            allSelected
                              ? new Set()
                              : new Set(rows.map((row) => row.jobId)),
                          )
                        }
                      />
                    </th>
                    <th className="p-3">Job / customer</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">SMS</th>
                    <th className="p-3">Job start · London</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-line">
                  {rows.map((row) => (
                    <tr key={row.jobId}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`Select delivery record ${row.jobId}`}
                          checked={selected.has(row.jobId)}
                          onChange={() => toggle(row.jobId)}
                        />
                      </td>
                      <td className="p-3">
                        <button
                          aria-label={`Open job ${row.jobId}`}
                          className="min-h-11 text-left font-medium text-admin-brand hover:underline"
                          onClick={() => openJob(row.jobId)}
                        >
                          {row.customerName || "Customer not recorded"}
                          <span className="block mt-1 font-normal text-[12px] text-fg-muted">
                            {row.jobId}
                          </span>
                        </button>
                      </td>
                      <td className="p-3">
                        {row.driverInitials || "Not assigned"}
                      </td>
                      {(["email", "sms"] as const).map((channel) => (
                        <td key={channel} className="p-3 min-w-[130px]">
                          <ChannelState row={row} channel={channel} />
                        </td>
                      ))}
                      <td className="p-3 text-[13px] text-fg-muted">
                        {formatLondonDateTime(row.actualStart)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap justify-between gap-3 text-[13px] text-fg-muted">
          <span>
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={safePage === 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={safePage === totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      <SendBroadcastPushModal
        isOpen={broadcast}
        onClose={() => setBroadcast(false)}
      />
      {dismiss && (
        <BulkDismissModal
          count={selected.size}
          itemLabel="delivery record"
          onClose={() => setDismiss(false)}
          onConfirm={async () => {
            await dismissNotifications([...selected]);
            setSelected(new Set());
            setDismiss(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function ChannelState({
  row,
  channel,
}: {
  row: NotificationRow;
  channel: "email" | "sms";
}) {
  return (
    <>
      <span
        className={`inline-flex rounded-full px-2 py-1 text-[12px] font-medium ${STATUS_STYLE[row[channel].state]}`}
      >
        {NOTIFICATION_STATUS_LABEL[row[channel].state]}
      </span>
      {row[channel].at && (
        <span className="block mt-1 text-[12px] text-fg-muted">
          {formatLondonDateTime(row[channel].at)}
        </span>
      )}
      <details className="mt-1 text-[12px] text-fg-muted">
        <summary className="min-h-8 cursor-pointer py-1">
          Target & details
        </summary>
        <p className="mt-1 break-all">
          {(channel === "email" ? row.customerEmail : row.customerPhone) ||
            "No target recorded"}
        </p>
        {row[channel].detail && <p className="mt-1">{row[channel].detail}</p>}
      </details>
    </>
  );
}
