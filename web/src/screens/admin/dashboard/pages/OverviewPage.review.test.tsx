import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
const { fetchSummary, fetchOverviewJobs } = vi.hoisted(() => ({
  fetchSummary: vi.fn(),
  fetchOverviewJobs: vi.fn(),
}));
vi.mock("../api", () => ({ fetchSummary }));
vi.mock("../utils/overview", async (original) => ({
  ...(await original<typeof import("../utils/overview")>()),
  fetchOverviewJobs,
}));
vi.mock("../components/DateRangePicker", () => ({
  DateRangePicker: () => null,
  defaultDashboardDateRange: () => ({ from: "2026-10-13", to: "2026-10-13" }),
}));
const summary = {
  kpis: { scheduled: 1, inProgress: 1, completed: 1, totalJobs: 3 },
  charts: { statusBreakdown: [], revenueOverTime: [] },
  meta: { fetchedAt: "2026-10-13T12:00:00Z" },
};
const job = {
  jobId: "SAFE-1",
  status: "COMPLETED",
  bookedStart: "2026-10-13T09:00:00Z",
  customerName: "Synthetic Customer",
  pickup: "Sample pickup",
  dropoff: "Sample dropoff",
  driverName: "Sample Driver",
  exceptions: [],
  evidenceCompleteness: {},
};
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <OverviewPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  history.replaceState({}, "", "/admin?section=overview");
  fetchSummary.mockResolvedValue(summary);
  fetchOverviewJobs.mockResolvedValue({
    items: [job],
    total: 1,
    complete: true,
  });
});
describe("operational overview", () => {
  it("renders missing final charges honestly and moves the attention count into its panel", async () => {
    mount();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "View final charges" }),
      ).toHaveTextContent("Not recorded"),
    );
    expect(
      screen.getByRole("button", { name: "View final charges" }),
    ).toHaveTextContent("0 of 1 jobs with charge values");
    expect(
      screen.getByRole("button", { name: "View needs attention" }),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: "View total jobs" }),
    ).toHaveTextContent("3");
  });
  it("labels partial recorded zero charges as a known subtotal", async () => {
    fetchOverviewJobs.mockResolvedValue({
      items: [{ ...job, amountCharged: 0 }],
      total: 2,
      complete: false,
    });
    mount();
    const charges = await screen.findByRole("button", {
      name: "View final charges",
    });
    await waitFor(() => expect(charges).toHaveTextContent("£0.00"));
    expect(charges).toHaveTextContent("Known subtotal · 1 of 2 jobs");
    expect(charges).toHaveTextContent("not receipts");
  });
  it("opens the exact status filter from the circular legend without unrelated parameters", async () => {
    history.replaceState({}, "", "/admin?section=overview&search=unrelated");
    fetchSummary.mockResolvedValue({
      ...summary,
      charts: {
        ...summary.charts,
        statusBreakdown: [
          { label: "COMPLETED", value: 1 },
          { label: "READY", value: 2 },
        ],
      },
    });
    mount();
    const legend = await screen.findByRole("button", {
      name: "View scheduled jobs: 2",
    });
    legend.focus();
    expect(legend).toHaveFocus();
    fireEvent.click(legend);
    const params = new URLSearchParams(location.search);
    expect(params.get("status")).toBe("READY");
    expect(params.get("from")).toBe("2026-10-13");
    expect(params.has("search")).toBe(false);
  });
  it("shows a status subtotal rather than claiming the complete total inside an incomplete ring", async () => {
    fetchSummary.mockResolvedValue({
      ...summary,
      charts: {
        ...summary.charts,
        statusBreakdown: [{ label: "COMPLETED", value: 1 }],
      },
    });
    mount();
    expect(await screen.findByText("Reported statuses")).toBeInTheDocument();
    expect(screen.getByText(/Percentages are unavailable/)).toBeInTheDocument();
    expect(
      screen.queryByText("33% of jobs · payment separate"),
    ).not.toBeInTheDocument();
  });
  it("switches to a real daily heatmap and opens its London day with a scoped URL", async () => {
    fetchSummary.mockResolvedValue({
      ...summary,
      charts: {
        ...summary.charts,
        revenueOverTime: [
          { date: "2026-10-13", jobsCount: 3, revenuePounds: 45 },
        ],
      },
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Activity heatmap" }),
    );
    const day = await screen.findByRole("button", {
      name: /13 Oct 2026: 1 booked jobs.*Open jobs for this day/,
    });
    fireEvent.click(day);
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("jobs");
    expect(params.get("from")).toBe("2026-10-12T23:00:00.000Z");
    expect(params.get("to")).toBe("2026-10-13T22:59:59.999Z");
  });

  it("starts with daily work and opens the exact attention job with return context", async () => {
    mount();
    expect(
      await screen.findByText("Driver submission not recorded"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Driver Breakdown")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open job" }));
    const params = new URLSearchParams(location.search);
    expect(params.get("job")).toBe("SAFE-1");
    expect(params.get("recordReturn")).toContain("section=overview");
  });
  it("retains partial-count coverage instead of implying a complete exception count", async () => {
    fetchOverviewJobs.mockResolvedValue({
      items: [job],
      total: 3,
      complete: false,
    });
    mount();
    expect(
      await screen.findByText(/Partial records: 1 of 3/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View needs attention" }),
    ).toHaveTextContent("1+");
  });
  it("does not render failed loading as zero jobs or no issues", async () => {
    fetchOverviewJobs.mockRejectedValue(new Error("offline"));
    mount();
    expect(
      await screen.findByText("Attention records could not load"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No recorded job issues in this scope"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View needs attention" }),
    ).toHaveTextContent("Unavailable");
  });
  it("moves performance to Drivers while retaining range", async () => {
    mount();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Driver performance" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Driver performance" }));
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("drivers");
    expect(params.get("driversTab")).toBe("performance");
    expect(params.get("from")).toBe("2026-10-13");
  });
});
