import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverRoadAlerts, roadZoneLabel } from "./DriverRoadAlerts";
import { sampleDriverReport } from "../fixtures/driverReport.sample";

const sample = (type = "all", pageSize = 25) => sampleDriverReport("DEMO", { from: "2026-10-05", to: "2026-10-11", activityScheme: type, pageSize });
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../api", () => ({ fetchDriverReport: (...args: unknown[]) => mocks.load(...args) }));
beforeEach(() => { window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&reportTab=road"); mocks.load.mockReset(); });
describe("Road charges: events, scope and confidence", () => {
  it("keeps unlinked events visible and aligns the count and pagination with returned rows", async () => {
    const report = await sample("tunnel", 2);
    report.roadAlerts!.items[0] = { ...report.roadAlerts!.items[0], jobId: null, estimatedPence: null, feeReason: "No recorded job pricing" };
    const onPage = vi.fn(), onJob = vi.fn();
    const { container } = render(<DriverRoadAlerts report={report} type="tunnel" onJob={onJob} onPage={onPage} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByText("Needs job match")).toBeInTheDocument();
    expect(screen.getByText(/6 recorded events · Showing 1–2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next road alerts page" }));
    expect(onPage).toHaveBeenCalledWith("roadAlerts", 2);
    fireEvent.click(screen.getAllByRole("button", { name: `View evidence for ${roadZoneLabel(report.roadAlerts!.items[0])}` })[0]);
    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("No linked job; matching needs review.");
    expect(within(modal).queryByRole("button", { name: /Open job/ })).not.toBeInTheDocument();
    expect(onJob).not.toHaveBeenCalled();
  });
  it("retains current-settings estimate provenance in the row and focused evidence", async () => {
    const report = await sample("tunnel");
    report.roadAlerts!.items[0].rateBasis = "Current Pricing Settings estimate";
    const original = JSON.stringify(report);
    const onJob = vi.fn();
    render(<DriverRoadAlerts report={report} type="tunnel" onJob={onJob} onPage={vi.fn()} />);
    expect(screen.getByText("Current Pricing Settings estimate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: report.roadAlerts!.items[0].jobId! }));
    expect(onJob).toHaveBeenCalledWith(report.roadAlerts!.items[0].jobId);
    fireEvent.click(screen.getAllByRole("button", { name: `View evidence for ${roadZoneLabel(report.roadAlerts!.items[0])}` })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Current Pricing Settings estimate");
    expect(within(screen.getByRole("dialog")).getByText("Zone entered")).toBeInTheDocument();
    expect(JSON.stringify(report)).toBe(original);
  });
  it("shows combined schemes without filtering the received page on the client", async () => {
    const report = await sample();
    const { container } = render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(report.roadAlerts!.items.length);
    expect(screen.getAllByText(/Tunnel · dartford/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Congestion · congestion/).length).toBeGreaterThan(0);
    expect(screen.getByText("Driver-reported fees")).toBeInTheDocument();
  });
  it.each(["tunnel", "congestion"] as const)("uses full-range reported %s totals and exposes partial coverage", async type => {
    const report = await sample(type, 1);
    report.summary.manualRoadChargeTotals = { tunnel: { knownPence: 4080, knownJobs: 3, missingJobs: 1, unavailableJobs: 0 }, congestion: { knownPence: 3600, knownJobs: 2, missingJobs: 1, unavailableJobs: 1 } };
    const { container } = render(<DriverRoadAlerts report={report} type={type} onJob={vi.fn()} onPage={vi.fn()} />);
    const card = [...container.querySelectorAll(".rpt-metric")].find(row => row.querySelector(".rpt-metric-label")?.textContent === "Driver-reported fees")!;
    expect(card).toHaveTextContent(type === "tunnel" ? "£40.80" : "£36.00");
    expect(card).toHaveTextContent("Known subtotal");
    expect(card).toHaveTextContent("1 missing entry");
  });
  it("never represents unavailable tracker history as a known zero and hides empty pagination", async () => {
    const report = await sample();
    report.roadAlerts = { items: [], total: 0, page: 1, pageSize: 25 };
    report.gpsSummary.coverage = "unavailable";
    report.summary.manualRoadChargeTotals = undefined;
    const { container } = render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    expect(screen.getAllByText("Tracker history unavailable").length).toBe(2);
    expect(container.textContent).not.toContain("£0.00");
    expect(container.querySelector(".rpt-pager")).toBeNull();
  });
  it("distinguishes a complete zero-event range and keeps rule references secondary", async () => {
    const report = await sample();
    report.roadAlerts = { items: [], total: 0, page: 1, pageSize: 25 };
    report.roadAlertSummary = { entries: 0, chargeableEntries: 0, estimatedKnownPence: 0, unpricedEntries: 0 };
    report.gpsSummary.coverage = "complete";
    const { container } = render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    expect(screen.getByText("Complete returned tracker history")).toBeInTheDocument();
    expect(screen.getByText("No recorded road events in this scope")).toBeInTheDocument();
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("View charge rules")).toBeInTheDocument();
    expect(container.querySelector(".rpt-pager")).toBeNull();
  });
  it("labels unpriced totals as a known subtotal and keeps the reason", async () => {
    const report = await sample("tunnel");
    report.roadAlerts!.items[0] = { ...report.roadAlerts!.items[0], estimatedPence: null, feeReason: "Pricing rate unavailable" };
    report.roadAlertSummary!.unpricedEntries = 1;
    render(<DriverRoadAlerts report={report} type="tunnel" onJob={vi.fn()} onPage={vi.fn()} />);
    expect(screen.getByText("Known estimate subtotal")).toBeInTheDocument();
    expect(screen.getByText("5 of 6 entries priced")).toBeInTheDocument();
    expect(screen.getByText("Pricing rate unavailable")).toBeInTheDocument();
  });
  it("loads every road page before filtering unlinked events across the selected range", async () => {
    const report = await sample("all", 1), rows = report.roadAlerts!.items;
    const linked = rows[0], unlinked = { ...linked, id: "unlinked-later-page", jobId: null, estimatedPence: null };
    const pages = [[linked], [{ ...linked, id: "linked-later-page" }], [unlinked]];
    mocks.load.mockImplementation((_driver: string, query: { roadAlertsPage: number }) => Promise.resolve({ ...report, roadAlerts: { items: pages[query.roadAlertsPage - 1], total: 3, page: query.roadAlertsPage, pageSize: 1 } }));
    const { container } = render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlinked events" }));
    await waitFor(() => expect(screen.getByText("1 recorded event without a job match · Showing 1–1")).toBeInTheDocument());
    expect(mocks.load).toHaveBeenCalledTimes(3);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByText("Fees unavailable")).toBeInTheDocument();
    expect(new URLSearchParams(location.search).get("reportRoadFilter")).toBe("unlinked");
  });
  it("keeps a complete-range filter failure recoverable instead of showing no matching events", async () => {
    const report = await sample("all", 1);
    mocks.load.mockRejectedValue(new Error("Road service unavailable"));
    render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlinked events" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Complete-range road filtering could not be loaded"));
    expect(screen.queryByText("No unlinked events in this selected range")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show returned events" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(new URLSearchParams(location.search).has("reportRoadFilter")).toBe(false);
  });
  it("restores a review filter but clamps its page when the full returned range is smaller", async () => {
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&reportTab=road&reportRoadFilter=unlinked&reportRoadPage=9");
    const report = await sample("all");
    report.roadAlerts!.items[0].jobId = null;
    render(<DriverRoadAlerts report={report} type="all" onJob={vi.fn()} onPage={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("1 recorded event without a job match · Showing 1–1")).toBeInTheDocument());
    expect(new URLSearchParams(location.search).get("reportRoadPage")).toBe("1");
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
