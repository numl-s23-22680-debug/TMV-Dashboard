import { describe, expect, it, vi } from "vitest";
import { fetchJobs } from "../api";
import {
  dailyRevenueSeries,
  fetchOverviewJobs,
  jobAttentionReasons,
} from "./overview";
import type { NormalizedJob } from "../types";
vi.mock("../api", () => ({ fetchJobs: vi.fn() }));
describe("overview coverage", () => {
  it("reads the full selected range before declaring complete attention coverage", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({
        items: [{ jobId: "A" } as NormalizedJob],
        pagination: { total: 2, hasMore: true } as any,
        meta: {} as any,
      })
      .mockResolvedValueOnce({
        items: [{ jobId: "B" } as NormalizedJob],
        pagination: { total: 2, hasMore: false } as any,
        meta: {} as any,
      });
    const result = await fetchOverviewJobs("2026-10-13", "2026-10-13");
    expect(result.items.map((job) => job.jobId)).toEqual(["A", "B"]);
    expect(result.complete).toBe(true);
    expect(fetchJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, from: "2026-10-13" }),
    );
  });
  it("detects a nonadvancing page as partial rather than inventing a full count", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({
      items: [{ jobId: "A" } as NormalizedJob],
      pagination: { total: 2, hasMore: true } as any,
      meta: {} as any,
    });
    expect((await fetchOverviewJobs()).complete).toBe(false);
  });
  it("does not count optional blank evidence or unknown payment as confirmed issues", () => {
    expect(
      jobAttentionReasons({
        status: "READY",
        evidenceCompleteness: { signature: "MISSING" },
        paymentStatus: "",
        exceptions: [],
      } as unknown as NormalizedJob),
    ).toEqual([]);
    expect(
      jobAttentionReasons({
        status: "COMPLETED",
        exceptions: [],
        driverJobSummary: undefined,
      } as unknown as NormalizedJob),
    ).toContain("Driver submission not recorded");
  });
  it("breaks a chart at missing days with null instead of a zero receipt", () => {
    const result = dailyRevenueSeries([
      { date: "2026-10-01", revenuePounds: 40, jobsCount: 1 },
      { date: "2026-10-03", revenuePounds: 0, jobsCount: 0 },
    ]);
    expect(result).toEqual([
      { date: "2026-10-01", revenuePounds: 40, jobsCount: 1 },
      { date: "2026-10-02", revenuePounds: null, jobsCount: null },
      { date: "2026-10-03", revenuePounds: 0, jobsCount: 0 },
    ]);
  });
});
