import { describe, expect, it } from "vitest";
import {
  activityDays,
  bookingActivityDays,
  groupActivity,
  operationalDistribution,
  storedChargeSummary,
} from "./auroraAnalytics";
import type { NormalizedJob } from "../types";

describe("Aurora operational analytics", () => {
  it("sums stored integer-pence charges independently of receipts or unpaid invoice state", () => {
    const jobs = [
      {
        amountCharged: 12000,
        paymentStatus: "UNPAID",
        paymentMethod: "Invoice",
        status: "COMPLETED",
      },
      {
        amountCharged: 0,
        totalCharges: 6000,
        paymentStatus: "PAID",
        status: "READY",
      },
      { totalCharges: 3000, status: "CANCELLED" },
    ] as unknown as NormalizedJob[];
    expect(storedChargeSummary(jobs, 3, true)).toMatchObject({
      amountPence: 15000,
      known: 3,
      complete: true,
    });
    expect(
      storedChargeSummary([{ amountCharged: 0 } as NormalizedJob], 1, true),
    ).toMatchObject({ amountPence: 0, complete: true });
    expect(storedChargeSummary([], 0, true)).toMatchObject({
      amountPence: 0,
      complete: true,
    });
  });
  it("reports charge coverage without converting missing or partial data to zero", () => {
    expect(
      storedChargeSummary(
        [{ calculatedTotalCharges: 5000 } as NormalizedJob],
        1,
        true,
      ),
    ).toMatchObject({ amountPence: null, known: 0, complete: false });
    expect(
      storedChargeSummary([{ amountCharged: 0 } as NormalizedJob], 3, false),
    ).toMatchObject({ amountPence: 0, known: 1, total: 3, complete: false });
    expect(storedChargeSummary([], 3, false)).toMatchObject({
      amountPence: null,
      known: 0,
      complete: false,
    });
    expect(
      storedChargeSummary([{ amountCharged: 1.5 } as NormalizedJob], 1, true),
    ).toMatchObject({ amountPence: null, known: 0 });
    expect(
      storedChargeSummary(
        [
          { amountCharged: Number.MAX_SAFE_INTEGER } as NormalizedJob,
          { amountCharged: 1 } as NormalizedJob,
        ],
        2,
        true,
      ),
    ).toMatchObject({ amountPence: null, overflow: true, complete: false });
  });
  it("buckets jobs by booked London date and measures empty days only with complete records", () => {
    const range = bookingActivityDays(
      [{ bookedStart: "2026-03-29T23:30:00Z" }],
      true,
      "2026-03-29",
      "2026-03-30",
    );
    expect(range.points.map((point) => [point.date, point.jobsCount])).toEqual([
      ["2026-03-29", 0],
      ["2026-03-30", 1],
    ]);
    expect(range.coverageComplete).toBe(true);
    const partial = bookingActivityDays(
      [{ bookedStart: "2026-03-29T23:30:00Z" }],
      false,
      "2026-03-29",
      "2026-03-30",
    );
    expect(
      partial.points.map((point) => [point.jobsCount, point.knownJobs]),
    ).toEqual([
      [null, 0],
      [null, 1],
    ]);
  });
  it("does not claim empty days when a job has no placeable booked timestamp", () => {
    const result = bookingActivityDays(
      [{ bookedStart: "not-a-date" }, { bookedStart: "2026-10-13T12:00:00Z" }],
      true,
      "2026-10-12",
      "2026-10-13",
    );
    expect(result.invalidTimestamps).toBe(1);
    expect(result.coverageComplete).toBe(false);
    expect(
      result.points.map((point) => [point.jobsCount, point.knownJobs]),
    ).toEqual([
      [null, 0],
      [null, 1],
    ]);
    expect(
      bookingActivityDays([], true, "2026-10-12", "2026-10-13").points.map(
        (point) => point.jobsCount,
      ),
    ).toEqual([0, 0]);
  });
  it("uses stable status identity and refuses percentages for incomplete totals", () => {
    const result = operationalDistribution(
      [
        { label: "COMPLETED", value: 6 },
        { label: "READY", value: 2 },
      ],
      10,
    );
    expect(result.segments.map((item) => item.key)).toEqual([
      "READY",
      "COMPLETED",
    ]);
    expect(result.segments[0].color).toContain("violet");
    expect(result.subtotal).toBe(8);
    expect(result.complete).toBe(false);
    expect(result.completionPercentage).toBeNull();
    expect(
      operationalDistribution(
        [
          { label: "COMPLETED", value: 6 },
          { label: "READY", value: 2 },
        ],
        8,
      ).completionPercentage,
    ).toBe(75);
  });
  it("preserves unknown statuses without assigning them an operational filter", () => {
    const result = operationalDistribution(
      [{ label: "Imported", value: 3 }],
      3,
    );
    expect(result.segments[0]).toMatchObject({ value: 3, filter: undefined });
    expect(
      operationalDistribution([{ label: "COMPLETED", value: -2 }], 0).complete,
    ).toBe(false);
  });
  it("separates recorded zero from absent days across London daylight saving", () => {
    const { points } = activityDays(
      [
        { date: "2026-03-28", jobsCount: 2, revenuePounds: 20 },
        { date: "2026-03-30", jobsCount: 0, revenuePounds: 0 },
      ],
      "2026-03-27T00:00:00Z",
      "2026-03-30T22:59:59Z",
    );
    expect(points.map((point) => [point.date, point.jobsCount])).toEqual([
      ["2026-03-27", null],
      ["2026-03-28", 2],
      ["2026-03-29", null],
      ["2026-03-30", 0],
    ]);
  });
  it("does not aggregate incomplete groups into apparently complete totals", () => {
    const { points } = activityDays(
      [{ date: "2026-10-12", jobsCount: 4, revenuePounds: 200 }],
      "2026-10-12",
      "2026-10-13",
    );
    const grouped = groupActivity(points, "week");
    expect(grouped[0]).toMatchObject({
      jobsCount: null,
      revenuePounds: null,
      knownJobs: 4,
      knownRevenue: 200,
      knownDays: 1,
      expectedDays: 2,
    });
  });
  it("keeps revenue coverage independent of available daily job counts", () => {
    const { points } = activityDays([
      {
        date: "2026-10-13",
        jobsCount: 4,
        revenuePounds: undefined as unknown as number,
      },
    ]);
    expect(points[0]).toMatchObject({
      jobsCount: 4,
      revenuePounds: null,
      knownDays: 1,
      knownRevenueDays: 0,
    });
    expect(groupActivity(points, "month")[0]).toMatchObject({
      jobsCount: 4,
      revenuePounds: null,
      knownDays: 1,
      knownRevenueDays: 0,
    });
  });
  it("marks duplicate daily rows unknown instead of silently double counting", () => {
    const { points } = activityDays([
      { date: "2026-10-13", jobsCount: 4, revenuePounds: 200 },
      { date: "2026-10-13", jobsCount: 4, revenuePounds: 200 },
    ]);
    expect(points[0]).toMatchObject({ jobsCount: null, revenuePounds: null });
  });
});
