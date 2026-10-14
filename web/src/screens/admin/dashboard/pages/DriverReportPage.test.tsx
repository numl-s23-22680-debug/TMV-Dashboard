import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverReportPage } from "./DriverReportPage";
import { sampleDriverReport } from "../fixtures/driverReport.sample";
import { dateRangeForPreset } from "../components/DateRangePicker";
const load = vi.fn();
const roster = vi.hoisted(() => ({ options: [{ initials: "DEMO", fullName: "Demo Driver", active: true }, { initials: "NEXT", fullName: "Next Driver", active: false }], isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock("../hooks/useDriverOptions", () => ({ useDriverOptions: () => roster }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
beforeEach(() => { load.mockReset(); roster.isError = false; roster.isLoading = false; roster.refetch.mockReset(); window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=comparison"); });
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DriverReportPage loadReport={load} /></QueryClientProvider>);
describe("Driver report navigation and full-range data", () => {
  it("maps legacy Comparison to Payments reconciliation and loads every job page", async () => {
    load.mockImplementation(sampleDriverReport); renderPage();
    expect(await screen.findByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Reconciliation" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Reconciliation filter" })).not.toBeDisabled());
    expect(load.mock.calls.some(call => call[1].jobsPage === 2)).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Reconciliation filter" }), { target: { value: "missing" } });
    expect(screen.getByRole("table", { name: "Receipt reconciliation" })).toHaveTextContent("DEMO-032");
    expect(new URLSearchParams(location.search).get("comparisonFilter")).toBe("missing");
  });
  it("preserves legacy performance and road-charge deep links", async () => {
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=performance");
    load.mockImplementation(sampleDriverReport); renderPage();
    expect(await screen.findByRole("tab", { name: "Jobs & timings" })).toHaveAttribute("aria-selected", "true");
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=tunnels");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(await screen.findByRole("tab", { name: "Road charges" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(load.mock.calls.some(call => call[1].activityScheme === "tunnel")).toBe(true));
    expect(screen.getByRole("button", { name: "Tunnel" })).toHaveAttribute("aria-pressed", "true");
  });
  it("uses Summary and Last 7 days as a retrospective default", async () => {
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO");
    const range = dateRangeForPreset("7d"); load.mockImplementation(sampleDriverReport); renderPage();
    expect(await screen.findByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(load.mock.calls[0][1].from).toBe(range.from);
    expect(load.mock.calls[0][1].to).toBe(new Date(Date.parse(range.to!) + 1).toISOString());
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Tomorrow" })).not.toBeInTheDocument();
  });
  it("retains context in the canonical job link including the selected comparison", async () => {
    load.mockImplementation(sampleDriverReport); renderPage();
    const compare = await screen.findByRole("button", { name: "Compare DEMO-008" });
    fireEvent.click(compare);
    expect(new URLSearchParams(location.search).get("reportJob")).toBe("DEMO-008");
    fireEvent.click(screen.getByRole("button", { name: "Open job DEMO-008" }));
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("jobs"); expect(params.get("job")).toBe("DEMO-008");
    expect(params.get("driver")).toBeNull(); expect(params.get("from")).toBeNull();
    const source = new URL(params.get("reportReturn")!, location.origin);
    expect(source.searchParams.get("driver")).toBe("DEMO"); expect(source.searchParams.get("from")).toBe("2026-10-05");
    expect(source.searchParams.get("reportTab")).toBe("comparison"); expect(source.searchParams.get("reportJob")).toBe("DEMO-008");
  });
  it("switches drivers retaining date scope and workspace, resetting pages and selected job", async () => {
    window.history.replaceState({}, "", `${location.pathname}${location.search}&jobsPage=2&eventsPage=3&roadAlertsPage=2&reportJob=OLD`);
    load.mockImplementation(sampleDriverReport); renderPage();
    await screen.findByRole("tab", { name: "Payments" });
    fireEvent.change(screen.getByRole("combobox", { name: "Select report driver" }), { target: { value: "NEXT" } });
    await waitFor(() => expect(load.mock.calls.some(call => call[0] === "NEXT" && call[1].jobsPage === 1)).toBe(true));
    const params = new URLSearchParams(location.search);
    expect(params.get("driver")).toBe("NEXT"); expect(params.get("from")).toBe("2026-10-05"); expect(params.get("reportTab")).toBe("comparison");
    for (const key of ["jobsPage", "eventsPage", "roadAlertsPage", "reportJob"]) expect(params.has(key)).toBe(false);
  });
  it("offers a complete-range retry instead of presenting a failed page as no matches", async () => {
    load.mockImplementation((driver, query) => query.jobsPage === 2 ? Promise.reject(new Error("Second page unavailable")) : sampleDriverReport(driver, query));
    renderPage();
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("Complete-range job loading failed");
    expect(screen.getByRole("combobox", { name: "Reconciliation filter" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry selected range" })).toBeInTheDocument();
    expect(screen.queryByText("No jobs match this review filter.")).not.toBeInTheDocument();
  });
  it("detects a backend that ignores pagination instead of silently claiming complete coverage", async () => {
    load.mockImplementation((driver, query) => sampleDriverReport(driver, { ...query, jobsPage: 1 })); renderPage();
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("did not return the requested job page");
    expect(screen.getByRole("combobox", { name: "Reconciliation filter" })).toBeDisabled();
  });
  it("retains finance when a secondary GPS source fails", async () => {
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=payments");
    load.mockImplementation(async (driver, query) => { if (query.detail === "full") throw new Error("Synthetic GPS outage"); const report = await sampleDriverReport(driver, query); return { ...report, meta: { ...report.meta, gpsIncluded: false } }; });
    renderPage();
    expect(await screen.findByRole("table", { name: "Payment methods" })).toBeInTheDocument();
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("Synthetic GPS outage");
    expect(screen.getByRole("table", { name: "Payment methods" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry movement and charge details" })).toBeInTheDocument();
  });
  it("keeps filters and driver switching usable after core loading fails", async () => {
    load.mockImplementation((driver, query) => driver === "DEMO" ? Promise.reject(new Error("Synthetic outage")) : sampleDriverReport(driver, query)); renderPage();
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("Synthetic outage");
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Select report driver" }), { target: { value: "NEXT" } });
    expect(await screen.findByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
  });
  it("returns to Drivers performance with the range and without report-only state", async () => {
    load.mockImplementation(sampleDriverReport); renderPage();
    await screen.findByRole("tab", { name: "Payments" });
    fireEvent.click(screen.getByRole("button", { name: "Drivers" }));
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("drivers"); expect(params.get("driversTab")).toBe("performance");
    expect(params.get("from")).toBe("2026-10-05"); expect(params.get("driver")).toBeNull(); expect(params.get("reportTab")).toBeNull();
  });
  it("preserves the report list position when opening and returning from a job", async () => {
    window.history.replaceState({}, "", "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=jobs");
    load.mockImplementation(sampleDriverReport);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<div data-testid="scroll-container"><main id="operations-content"><QueryClientProvider client={client}><DriverReportPage loadReport={load} /></QueryClientProvider></main></div>);
    await screen.findByRole("table", { name: "Jobs and timings" });
    const scroller = screen.getByTestId("scroll-container"); scroller.scrollTop = 460;
    fireEvent.click(screen.getByRole("button", { name: "Open job DEMO-001" }));
    const source = new URLSearchParams(location.search).get("reportReturn")!;
    expect(JSON.parse(sessionStorage.getItem(`tmv:report-position:${source}`)!)).toMatchObject({ top: 460 });
    unmount(); window.history.replaceState({}, "", source);
    render(<div data-testid="restored-scroll"><main id="operations-content"><QueryClientProvider client={client}><DriverReportPage loadReport={load} /></QueryClientProvider></main></div>);
    await screen.findByRole("table", { name: "Jobs and timings" });
    await waitFor(() => expect(screen.getByTestId("restored-scroll").scrollTop).toBe(460));
  });
  it("returns to the originating driver directory with its search and account filters", async () => {
    const origin = "/admin?section=drivers&driversTab=directory&driverSearch=sample&account=inactive";
    window.history.replaceState({}, "", `${location.pathname}${location.search}&driverReturn=${encodeURIComponent(origin)}`);
    load.mockImplementation(sampleDriverReport); renderPage(); await screen.findByRole("tab", { name: "Payments" });
    fireEvent.click(screen.getByRole("button", { name: "Drivers" }));
    expect(location.pathname + location.search).toBe(origin);
  });
  it("restores a cached report under StrictMode without consuming the position in a cancelled frame", async () => {
    const source = "/admin?section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=jobs";
    window.history.replaceState({}, "", source);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const report = await sampleDriverReport("DEMO", { from: "2026-10-05", to: "2026-10-11", pageSize: 25 });
    client.setQueryData(["driver_report", "DEMO", "2026-10-05", "2026-10-11", "day", "core", { jobs: 1, events: 1, visits: 1, charges: 1, roadAlerts: 1 }], report);
    const key = `tmv:report-position:${source}`;
    sessionStorage.setItem(key, JSON.stringify({ top: 620, windowY: 0 }));
    render(<StrictMode><div data-testid="strict-scroll"><main id="operations-content"><QueryClientProvider client={client}><DriverReportPage loadReport={load} /></QueryClientProvider></main></div></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("strict-scroll").scrollTop).toBe(620));
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
