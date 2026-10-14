import { fetchJobs } from "../api";
import type { NormalizedJob } from "../types";
import { DateTime } from "luxon";

/** Insert unknown points, never zero, so the chart cannot bridge an absent day. */
export function dailyRevenueSeries(
  rows: Array<{ date: string; revenuePounds: number; jobsCount: number }>,
) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const series: Array<{
    date: string;
    revenuePounds: number | null;
    jobsCount: number | null;
  }> = [];
  for (const row of sorted) {
    const previous = series[series.length - 1];
    if (previous) {
      let day = DateTime.fromISO(previous.date, { zone: "Europe/London" })
        .startOf("day")
        .plus({ days: 1 });
      const next = DateTime.fromISO(row.date, {
        zone: "Europe/London",
      }).startOf("day");
      while (
        day.isValid &&
        next.isValid &&
        day < next &&
        series.length < 5000
      ) {
        series.push({
          date: day.toISODate()!,
          revenuePounds: null,
          jobsCount: null,
        });
        day = day.plus({ days: 1 });
      }
    }
    series.push(row);
  }
  return series;
}

/** Read every server page; totals never extrapolate from a loaded sample. */
export async function fetchOverviewJobs(from?: string, to?: string) {
  const items: NormalizedJob[] = [];
  let page = 1;
  let total = 0;
  const seen = new Set<string>();
  while (page <= 200) {
    const result = await fetchJobs({
      from,
      to,
      page,
      pageSize: 200,
      sortBy: "bookedStart",
      sortDir: "asc",
    });
    total = result.pagination.total;
    const fresh = result.items.filter((job) => !seen.has(job.jobId));
    for (const job of fresh) {
      seen.add(job.jobId);
      items.push(job);
    }
    if (!result.pagination.hasMore)
      return { items, total, complete: items.length === total };
    // A non-advancing endpoint must produce a coverage warning, not an infinite loop.
    if (!fresh.length) return { items, total, complete: false };
    page++;
  }
  return { items, total, complete: false };
}

export function jobAttentionReasons(job: NormalizedJob): string[] {
  const reasons = (job.exceptions || [])
    .map((exception) => exception.detail || exception.type)
    .filter(Boolean);
  if (job.status === "COMPLETED" && !job.driverJobSummary)
    reasons.push("Driver submission not recorded");
  if (job.trackerStatus === "stale") reasons.push("Tracker signal stale");
  if (job.arrivalProofOverdue) reasons.push("Arrival proof overdue");
  if (Object.values(job.evidenceCompleteness || {}).includes("FAILED"))
    reasons.push("Evidence upload failed");
  if (
    /invoice/i.test(job.paymentMethod || "") &&
    /unpaid|pending|uncollected/i.test(job.paymentStatus || "")
  )
    reasons.push("Invoice payment pending");
  return [...new Set(reasons)];
}
