import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DriverReportView, JobComparison } from "./DriverReportView";
import { sampleDriverReport, sampleJobs } from "../fixtures/driverReport.sample";
import { receiptDifference, reconciliationStatus, reportDuration } from "../utils/reportSemantics";
import type { DriverReportJob } from "../driverReport.types";
vi.mock("../api", () => ({ fetchRoadAssessment: vi.fn().mockResolvedValue({ flags: [], comparisons: [], activity: [] }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const props = { from: "2026-10-05", to: "2026-10-11", groupBy: "day" as const, onTab: vi.fn(), onDates: vi.fn(), onGroup: vi.fn(), onPage: vi.fn(), onJob: vi.fn(), onBack: vi.fn(), onRefresh: vi.fn() };
const sample = () => sampleDriverReport("DEMO", { from: props.from, to: props.to, pageSize: 2 });
describe("Driver report workspaces", () => {
  it("has four accessible workspaces and at most four summary metrics", async () => {
    const report = await sample();
    const { container } = render(<DriverReportView {...props} report={report} tab="summary" />);
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Summary", "Jobs & timings", "Payments", "Road charges"]);
    expect(container.querySelectorAll(".rpt-metrics > .rpt-metric")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "report-tab-summary");
    fireEvent.click(await screen.findByText("View chart data", {}, { timeout: 4000 }));
    expect(screen.getByRole("table", { name: "Performance trend data" })).toBeInTheDocument();
  });
  it("shows recorded receipts excluding unpaid invoices and does not reuse accepted charges as receipts", async () => {
    const report = await sample();
    report.summary.systemKnownCollectionsPence = 180400;
    report.summary.paymentCards!.driverCollectionPence = 210700;
    report.summary.systemPaymentsByMethodPence = { Cash: 126400, Card: 54000, Invoice: 30300 };
    const { container } = render(<DriverReportView {...props} report={report} tab="payments" />);
    const metric = (name: string) => [...container.querySelectorAll(".rpt-metric")].find(card => card.querySelector(".rpt-metric-label")?.textContent === name)!;
    expect(metric("Accepted / final charges")).toHaveTextContent("£2,107.00");
    expect(metric("Recorded receipts")).toHaveTextContent("£1,804.00");
    expect(metric("Unpaid invoices")).toHaveTextContent("£303.00");
    const table = screen.getByRole("table", { name: "Payment methods" });
    expect(within(table).getByRole("row", { name: /Unpaid invoice/ })).toHaveTextContent("Uncollected");
    expect(within(table).getByRole("row", { name: /Recorded receipts total/ })).toHaveTextContent("£1,804.00");
    expect(screen.queryByText("Driver Collected")).not.toBeInTheDocument();
    expect(screen.queryByText("Outstanding")).not.toBeInTheDocument();
  });
  it("never presents all missing driver submissions as a measured zero", async () => {
    const report = await sample(); report.summary.pendingManualJobs = report.summary.completedJobs;
    report.summary.paymentCards = { ...report.summary.paymentCards!, manualEntriesKnownPence: 0, manualEntriesPence: null, manualEntryUnknownJobs: report.summary.completedJobs, manualEntryMissingJobs: report.summary.completedJobs };
    render(<DriverReportView {...props} report={report} tab="payments" />);
    expect(screen.getAllByText("Not submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("Driver submitted amount").nextElementSibling).toHaveTextContent("Not submitted");
  });
  it("marks partial receipts as a known subtotal with coverage", async () => {
    const report = await sample(); report.summary.unknownSystemCollectionJobs = 2;
    const { container } = render(<DriverReportView {...props} report={report} tab="summary" />);
    const card = [...container.querySelectorAll(".rpt-metric")].find(card => card.querySelector(".rpt-metric-label")?.textContent === "Recorded receipts")!;
    expect(card).toHaveTextContent("Known subtotal"); expect(card).toHaveTextContent("34/36 jobs");
  });
  it("keeps incomplete GPS separate from punctuality and reveals the full timeline on selection", async () => {
    const report = await sample(); const job = report.jobs.items[0];
    job.timings = { ...job.timings!, trackerArrivalAt: null, trackerUnverifiedReason: "Signal stale" };
    job.duration.arrivalDelayMinutes = 5;
    render(<DriverReportView {...props} report={report} tab="jobs" />);
    expect(screen.getByRole("table", { name: "Jobs and timings" })).toHaveTextContent("Unverified arrival");
    expect(screen.queryByLabelText(`Timeline for ${job.jobId}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Timeline" })[0]);
    const panel = screen.getByLabelText(`Timeline for ${job.jobId}`);
    expect(panel).toHaveTextContent("Signal stale");
    expect(panel).toHaveTextContent("Booked service time1h 30m");
    expect(panel).toHaveTextContent("Allocated / billing-derived time2h 0m");
    expect(panel).toHaveTextContent("Tracker observed");
    expect(panel).toHaveTextContent("Customer signature");
    expect(panel).toHaveTextContent("Vehicle movement time");
    expect(screen.queryByText(/Original Calendar/)).not.toBeInTheDocument();
  });
  it("uses full-range reconciliation jobs rather than the currently loaded page", async () => {
    const report = await sample(); const jobs = sampleJobs;
    render(<DriverReportView {...props} report={report} tab="payments" paymentMode="reconciliation" comparisonFilter="missing" reconciliationJobs={jobs} />);
    const table = screen.getByRole("table", { name: "Receipt reconciliation" });
    expect(table).toHaveTextContent("DEMO-008");
    expect(table).toHaveTextContent("DEMO-032");
    expect(table).not.toHaveTextContent("DEMO-001");
    expect(screen.getByText(/4 matching jobs · Complete selected range/)).toBeInTheDocument();
  });
  it("disables range filters with an explicit partial state until every page is available", async () => {
    render(<DriverReportView {...props} report={await sample()} tab="payments" paymentMode="reconciliation" />);
    expect(screen.getByRole("combobox", { name: "Reconciliation filter" })).toBeDisabled();
    expect(screen.getByText(/Only 2 of 36 jobs are available/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Receipt reconciliation" })).toHaveTextContent("DEMO-001");
  });
  it("presents missing submission as unknown difference with a compact reason", () => {
    const job = sampleJobs[7]; render(<JobComparison job={job} openJob={vi.fn()} />);
    expect(screen.getByText("No driver submission.")).toBeInTheDocument();
    const row = within(screen.getByRole("table", { name: `Comparison for ${job.jobId}` })).getByRole("row", { name: /^Recorded receipts/ });
    expect(row).toHaveTextContent("Not submittedUnknown");
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
  });
  it("compares like-for-like receipts and preserves nonzero invoice evidence", () => {
    const job = structuredClone(sampleJobs[8]);
    job.finance.acceptedPence = 40000;
    expect(job.finance.systemPayments.invoicePence).toBeGreaterThan(0);
    expect(receiptDifference(job)).toBe(0);
    render(<JobComparison job={job} openJob={vi.fn()} />);
    const row = within(screen.getByRole("table", { name: `Comparison for ${job.jobId}` })).getByRole("row", { name: /^Recorded receipts/ });
    expect(within(row).getAllByText("£0.00")).toHaveLength(3);
    expect(screen.getAllByText("Unpaid invoice").length).toBeGreaterThan(0);
    expect(screen.getByText("Accepted / final charge").nextElementSibling).toHaveTextContent("£400.00");
  });
  it("keeps unclassified money visible as evidence and outside the receipt total", async () => {
    const report = await sample(); report.summary.systemPaymentsByMethodPence.Unknown = 1250;
    render(<DriverReportView {...props} report={report} tab="payments" />);
    expect(screen.getByText(/Unclassified payment:/)).toHaveTextContent("£12.50");
    expect(screen.getByText(/Unclassified payment:/)).toHaveTextContent("excluded from receipts");
  });
  it("has a correct zero-record state without unnecessary pagination", async () => {
    const report = await sample(); report.jobs = { ...report.jobs, items: [], total: 0 }; report.summary.completedJobs = 0;
    render(<DriverReportView {...props} report={report} tab="jobs" />);
    expect(screen.getByText(/No jobs in this range/)).toBeInTheDocument();
    expect(screen.getByText("0 records")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next jobs page" })).not.toBeInTheDocument();
    expect(screen.queryByText(/1–0|1-0/)).not.toBeInTheDocument();
  });
  it("supports keyboard navigation across the four tabs", async () => {
    const onTab = vi.fn(); render(<DriverReportView {...props} report={await sample()} tab="jobs" onTab={onTab} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Jobs & timings" }), { key: "ArrowRight" });
    expect(onTab).toHaveBeenCalledWith("payments");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Jobs & timings" }), { key: "End" });
    expect(onTab).toHaveBeenCalledWith("road");
  });
  it("preserves PDF and Excel exports with explicit selected-range scope", async () => {
    const onExport = vi.fn(); render(<DriverReportView {...props} report={await sample()} tab="summary" onExport={onExport} />);
    fireEvent.click(screen.getByText("Export report"));
    expect(screen.getByText("Complete selected range · London time")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download complete PDF report" })); expect(onExport).toHaveBeenCalledWith("pdf");
    fireEvent.click(screen.getByRole("button", { name: "Download complete Excel report" })); expect(onExport).toHaveBeenCalledWith("xlsx");
  });
});
describe("Report semantics", () => {
  it("rounds duration minutes consistently across boundaries", () => {
    expect(reportDuration(223.88)).toBe("3h 44m"); expect(reportDuration(59.8)).toBe("1h 0m"); expect(reportDuration(null)).toBe("Not recorded"); expect(reportDuration(NaN)).toBe("Not recorded");
  });
  it("does not invent a difference for unknown operands or missing submission", () => {
    expect(receiptDifference(sampleJobs[7])).toBeNull();
    const job = matchingJob(); job.finance.systemPayments.collectedPence = null;
    expect(receiptDifference(job)).toBeNull(); expect(reconciliationStatus(job)).toBe("unverified");
  });
  const matchingJob = (): DriverReportJob => {
    const job = structuredClone(sampleJobs[2]);
    job.manualDetails!.startTime = job.actualStart!; job.manualDetails!.endTime = job.actualFinish!;
    job.duration.manualMinutes = job.duration.workingMinutes; job.duration.differenceMinutes = 0;
    job.finance.manualPayments = structuredClone(job.finance.systemPayments);
    job.finance.paymentMethodDifferences = []; job.roadCharges!.flags = [];
    return job;
  };
  it.each(["workingMinutes", "manualMinutes", "differenceMinutes"] as const)("requires known %s before classifying matching receipts and times as a match", field => {
    const job = matchingJob(); expect(reconciliationStatus(job)).toBe("match");
    job.duration[field] = null;
    expect(reconciliationStatus(job)).toBe("unverified");
    job.finance.manualPayments!.collectedPence! -= 100;
    expect(reconciliationStatus(job)).toBe("difference");
  });
  it.each(["actualStart", "actualFinish"] as const)("keeps missing %s in Needs verification when other known fields match", field => {
    const job = matchingJob(); job[field] = null;
    expect(reconciliationStatus(job)).toBe("unverified");
    job.duration.differenceMinutes = 5;
    expect(reconciliationStatus(job)).toBe("difference");
  });
  it("treats invalid timing operands as unverified rather than a measured difference", () => {
    const job = matchingJob(); job.manualDetails!.startTime = "invalid";
    expect(reconciliationStatus(job)).toBe("unverified");
  });
});
