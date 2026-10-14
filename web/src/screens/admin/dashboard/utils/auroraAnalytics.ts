import { DateTime } from "luxon";
import { jobCharge } from "./jobPresentation";
import type { NormalizedJob } from "../types";

export const OPERATIONAL_STATUSES = {
  READY: { label: "Scheduled", color: "var(--aurora-chart-violet, #725cff)" },
  IN_PROGRESS: {
    label: "In progress",
    color: "var(--aurora-chart-blue, #3f8cff)",
  },
  COMPLETED: { label: "Completed", color: "var(--aurora-chart-teal, #149b83)" },
  CANCELLED: {
    label: "Cancelled",
    color: "var(--aurora-chart-slate, #8992a8)",
  },
} as const;

export interface StatusSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  filter?: string;
}

/** Preserve all reported statuses. A mismatched subtotal is never a complete denominator. */
export function operationalDistribution(
  rows: Array<{ label: string; value: number }>,
  reportedTotal?: number,
) {
  const values = new Map<string, number>();
  let valid = true;
  for (const row of rows) {
    if (!Number.isFinite(row.value) || row.value < 0) {
      valid = false;
      continue;
    }
    const key = row.label.trim().toUpperCase();
    values.set(key, (values.get(key) || 0) + row.value);
  }
  const keys = [
    ...Object.keys(OPERATIONAL_STATUSES),
    ...[...values.keys()].filter((key) => !(key in OPERATIONAL_STATUSES)),
  ];
  const segments: StatusSegment[] = keys
    .filter((key) => values.has(key))
    .map((key) => {
      const known =
        OPERATIONAL_STATUSES[key as keyof typeof OPERATIONAL_STATUSES];
      return {
        key,
        label: known?.label || key.replaceAll("_", " ").toLowerCase(),
        value: values.get(key)!,
        color: known?.color || "var(--aurora-chart-slate, #8992a8)",
        filter: known ? key : undefined,
      };
    });
  const subtotal = segments.reduce((sum, row) => sum + row.value, 0);
  const complete =
    valid &&
    reportedTotal != null &&
    Number.isFinite(reportedTotal) &&
    reportedTotal >= 0 &&
    subtotal === reportedTotal;
  return {
    segments,
    subtotal,
    complete,
    completionPercentage:
      complete && subtotal > 0
        ? ((values.get("COMPLETED") || 0) / subtotal) * 100
        : null,
  };
}

export interface ActivityPoint {
  date: string;
  endDate: string;
  jobsCount: number | null;
  revenuePounds: number | null;
  knownJobs: number;
  knownRevenue: number;
  knownDays: number;
  knownRevenueDays: number;
  expectedDays: number;
}
export type ActivityPeriod = "day" | "week" | "month";

type DailyRow = { date: string; jobsCount: number; revenuePounds: number };
const londonDay = (value?: string) =>
  value
    ? DateTime.fromISO(value, { zone: "Europe/London" })
        .setZone("Europe/London")
        .startOf("day")
    : null;
const knownNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Fill absent days with unknowns. Duplicate daily rows are ambiguous, rather than additive. */
export function activityDays(rows: DailyRow[], from?: string, to?: string) {
  const byDate = new Map<string, DailyRow | null>();
  for (const row of rows) {
    const day = londonDay(row.date);
    if (!day?.isValid) continue;
    const key = day.toISODate()!;
    byDate.set(key, byDate.has(key) ? null : row);
  }
  const keys = [...byDate.keys()].sort();
  const first = londonDay(from) || londonDay(keys[0]);
  const last = londonDay(to) || londonDay(keys[keys.length - 1]);
  if (!first?.isValid || !last?.isValid || first > last)
    return { points: [] as ActivityPoint[], truncated: false };
  const points: ActivityPoint[] = [];
  let day = first;
  while (day <= last && points.length < 5000) {
    const date = day.toISODate()!;
    const row = byDate.get(date);
    const jobsCount =
      row && knownNumber(row.jobsCount) && row.jobsCount >= 0
        ? row.jobsCount
        : null;
    const revenuePounds =
      row && knownNumber(row.revenuePounds) ? row.revenuePounds : null;
    points.push({
      date,
      endDate: date,
      jobsCount,
      revenuePounds,
      knownJobs: jobsCount ?? 0,
      knownRevenue: revenuePounds ?? 0,
      knownDays: jobsCount == null ? 0 : 1,
      knownRevenueDays: revenuePounds == null ? 0 : 1,
      expectedDays: 1,
    });
    day = day.plus({ days: 1 });
  }
  return { points, truncated: day <= last };
}

/** Only a complete group is charted as a total. Supporting known subtotals remain available. */
export function groupActivity(
  points: ActivityPoint[],
  period: ActivityPeriod,
): ActivityPoint[] {
  if (period === "day") return points;
  const grouped = new Map<string, ActivityPoint[]>();
  for (const point of points) {
    const date = londonDay(point.date)!;
    const key = date.startOf(period).toISODate()!;
    grouped.set(key, [...(grouped.get(key) || []), point]);
  }
  return [...grouped.values()].map((items) => {
    const knownJobs = items.reduce((sum, item) => sum + item.knownJobs, 0);
    const knownRevenue = items.reduce(
      (sum, item) => sum + item.knownRevenue,
      0,
    );
    return {
      date: items[0].date,
      endDate: items[items.length - 1].endDate,
      jobsCount: items.every((item) => item.jobsCount != null)
        ? knownJobs
        : null,
      revenuePounds: items.every((item) => item.revenuePounds != null)
        ? knownRevenue
        : null,
      knownJobs,
      knownRevenue,
      knownDays: items.reduce((sum, item) => sum + item.knownDays, 0),
      knownRevenueDays: items.reduce(
        (sum, item) => sum + item.knownRevenueDays,
        0,
      ),
      expectedDays: items.reduce((sum, item) => sum + item.expectedDays, 0),
    };
  });
}

/** Booked-date buckets come from the full Jobs dataset, so each day opens the same scope.
 * A partial dataset or unplaceable timestamp cannot establish an empty day. */
export function bookingActivityDays(
  jobs: Array<{ bookedStart?: string }>,
  complete: boolean,
  from?: string,
  to?: string,
) {
  const counts = new Map<string, number>();
  let invalidTimestamps = 0;
  for (const job of jobs) {
    const date = londonDay(job.bookedStart);
    if (!date?.isValid) {
      invalidTimestamps++;
      continue;
    }
    const key = date.toISODate()!;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [...counts].map(([date, jobsCount]) => ({
    date,
    jobsCount,
    revenuePounds: NaN,
  }));
  const daily = activityDays(rows, from, to);
  const coverageComplete = complete && invalidTimestamps === 0;
  return {
    ...daily,
    coverageComplete,
    invalidTimestamps,
    points: daily.points.map((point) => ({
      ...point,
      jobsCount: coverageComplete ? counts.get(point.date) || 0 : null,
      knownJobs: counts.get(point.date) || 0,
      knownDays: coverageComplete ? 1 : 0,
    })),
  };
}

/** Stored final charges are not receipts. Sum integer pence only, with explicit coverage. */
export function storedChargeSummary(
  jobs: NormalizedJob[],
  total: number,
  completeRecords: boolean,
) {
  let known = 0;
  let sum = 0;
  let overflow = false;
  for (const job of jobs) {
    const { amount } = jobCharge(job);
    if (amount == null || !Number.isSafeInteger(amount)) continue;
    known++;
    if (!Number.isSafeInteger(sum + amount)) overflow = true;
    else sum += amount;
  }
  const complete =
    completeRecords &&
    jobs.length === total &&
    known === jobs.length &&
    !overflow;
  return {
    known,
    total,
    complete,
    overflow,
    amountPence: overflow
      ? null
      : known > 0
        ? sum
        : complete && total === 0
          ? 0
          : null,
  };
}
