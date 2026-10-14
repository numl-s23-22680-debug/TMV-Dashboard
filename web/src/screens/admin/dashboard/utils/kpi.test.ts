import { describe, it, expect } from "vitest";
import { completionRate, formatDuration, formatArrivalDelay } from "./kpi";

describe("formatDuration", () => {
  it("rounds operational durations to whole minutes", () => {
    expect(formatDuration(266.03433333333336)).toBe("4h 26m");
    expect(formatDuration(194.07958333333346)).toBe("3h 14m");
    expect(formatDuration(0.6244)).toBe("1m");
  });

  it("keeps whole durations concise and carries rounded minutes into hours", () => {
    expect(formatDuration(150)).toBe("2h 30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(59.999)).toBe("1h");
    expect(formatDuration(60.001)).toBe("1h");
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(Number.NaN)).toBe("Not recorded");
    expect(formatDuration(null)).toBe("Not recorded");
  });
});

describe("completionRate", () => {
  it("computes a rounded percentage when there are jobs", () => {
    expect(completionRate(5, 10)).toBe(50);
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(2, 3)).toBe(67);
    expect(completionRate(3, 3)).toBe(100);
  });

  it("returns null (not 98, not 0) when there are no jobs in range", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(5, 0)).toBeNull();
  });

  it("returns 0 when there are jobs but none completed", () => {
    expect(completionRate(0, 12)).toBe(0);
  });

  it("returns null for a negative or non-finite denominator", () => {
    expect(completionRate(1, -4)).toBeNull();
    expect(completionRate(1, Number.NaN)).toBeNull();
    expect(completionRate(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("clamps to 100 if completed somehow exceeds totalJobs", () => {
    expect(completionRate(15, 10)).toBe(100);
  });

  it("treats a negative or non-finite completed count as zero", () => {
    expect(completionRate(-3, 10)).toBe(0);
    expect(completionRate(Number.NaN, 10)).toBe(0);
  });
});

describe("formatArrivalDelay", () => {
  it("distinguishes early, on-time and unverified values", () => {
    expect(formatArrivalDelay(-3)).toBe("3 min early");
    expect(formatArrivalDelay(3.3)).toBe("3 min late");
    expect(formatArrivalDelay(0)).toBe("On time");
    expect(formatArrivalDelay(null)).toBe("Unverified arrival");
  });
});
