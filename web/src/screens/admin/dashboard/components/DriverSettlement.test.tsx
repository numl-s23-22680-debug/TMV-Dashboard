import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverSettlement } from "./DriverSettlement";
import type { DriverSummaryItem } from "../types";
const mocks = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => mocks.query }));
const driver = (initials: string, fullName: string) => ({ initials, fullName, completed: 1, hasAccount: true, active: true, calculatedChargesPounds: 100, totalChargesPounds: 100, revenuePounds: 100, totalCollectionsPounds: 100, invoiceCollectedPounds: 0, totalDurationMinutes: 60, workingUnknownJobs: 0, movingKnownSeconds: 1800, movingUnknownJobs: 0, movingPartialJobs: 0, overtimeMinutes: 90, reviewSentCount: 1, reviewNotSentCount: 0 } as DriverSummaryItem);
const drivers = [driver("ZZ", "Zara"), driver("MA", "Alex"), driver("AB", "Alex")];
beforeEach(() => { mocks.query = { data: { drivers }, isSuccess: true, isLoading: false, isError: false }; });
describe("Driver performance summary", () => {
  it("keeps an alphabetically sorted exact-driver filter and no-job state", () => {
    mocks.query = { ...mocks.query, data: { drivers: [...drivers, { ...driver("WD", "Waiting"), completed: 0 }] } };
    const { container } = render(<DriverSettlement />);
    expect(screen.getByRole("heading", { name: "Performance summary" })).toBeInTheDocument();
    expect(within(screen.getByRole("combobox")).getAllByRole("option").map(option => option.textContent)).toEqual(["All drivers", "Alex (AB)", "Alex (MA)", "Waiting (WD)", "Zara (ZZ)"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "WD" } });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0); expect(screen.getByText("No jobs in this range")).toBeInTheDocument(); expect(screen.getByRole("combobox")).toHaveValue("WD");
  });
  it("shows account-backed drivers including inactive accounts and excludes unrelated identities", () => {
    mocks.query = { ...mocks.query, data: { drivers: [...drivers, { ...driver("ARCHIVE", "Historical"), hasAccount: false }, driver("UNASSIGNED", "Unassigned"), { ...driver("IN", "Inactive"), active: false }] } };
    const { container } = render(<DriverSettlement />); expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(screen.queryByText("Historical")).not.toBeInTheDocument(); expect(screen.queryByText("Unassigned")).not.toBeInTheDocument(); expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
  it("resets a selected driver when no longer available but preserves all supported rows", () => {
    const { rerender, container } = render(<DriverSettlement />); fireEvent.change(screen.getByRole("combobox"), { target: { value: "MA" } });
    mocks.query = { ...mocks.query, data: { drivers: [drivers[0]] } }; rerender(<DriverSettlement from="2026-10-10" />);
    expect(screen.getByRole("combobox")).toHaveValue(""); expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
  });
  it("distinguishes calculated charges from receipts and preserves support metrics through disclosure", () => {
    mocks.query = { ...mocks.query, data: { drivers: [{ ...driver("MA", "Man Van"), calculatedChargesPounds: 653.2, revenuePounds: 376.6, totalCollectionsPounds: 506.6, reviewNotSentCount: 2 }] } };
    const { container } = render(<DriverSettlement />); const cells = within(container.querySelector("tbody tr")!).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("£653.20"); expect(cells[3]).toHaveTextContent("£506.60");
    expect(cells[4]).toHaveTextContent("1h 0m"); expect(cells[0]).toHaveTextContent("Review requests: 1 sent · 2 not sent"); expect(cells[0]).toHaveTextContent("Overtime: 1h 30m");
    expect(screen.queryByRole("columnheader", { name: /Driver Collected/ })).not.toBeInTheDocument();
  });
  it("shows partial timing totals honestly and does not turn entirely missing timing into zero", () => {
    const row = { ...driver("WD", "Driver WD"), completed: 3, totalDurationMinutes: 90, workingUnknownJobs: 2 };
    mocks.query = { ...mocks.query, data: { drivers: [row] } }; const { rerender, container } = render(<DriverSettlement />);
    const cells = () => within(container.querySelector("tbody tr")!).getAllByRole("cell");
    expect(cells()[4]).toHaveTextContent("Known subtotal 1h 30m"); expect(cells()[5]).toHaveTextContent("2 timings missing");
    mocks.query = { ...mocks.query, data: { drivers: [{ ...row, totalDurationMinutes: 0, workingUnknownJobs: 3 }] } }; rerender(<DriverSettlement />);
    expect(cells()[4]).toHaveTextContent("Not recorded"); expect(cells()[4]).not.toHaveTextContent("0h 0m");
  });
  it("never falls back to billed revenue when receipt data is unavailable", () => {
    mocks.query = { ...mocks.query, data: { drivers: [{ ...driver("WD", "Driver WD"), revenuePounds: 300, totalCollectionsPounds: undefined }] } };
    const { container } = render(<DriverSettlement />); expect(within(container.querySelector("tbody tr")!).getAllByRole("cell")[3]).toHaveTextContent("Unverified");
  });
  it("has labeled report and reconcile links with the exact driver and date range", () => {
    window.history.replaceState({}, "", "/admin?section=drivers&driversTab=performance"); render(<DriverSettlement from="2026-10-01" to="2026-10-10" />);
    const link = screen.getByRole("link", { name: "View report for Zara" }); const target = new URL(link.getAttribute("href")!, location.origin);
    expect(target.searchParams.get("driver")).toBe("ZZ"); expect(target.searchParams.get("from")).toBe("2026-10-01"); expect(target.searchParams.get("reportTab")).toBe("summary");
    const comparison = new URL(screen.getByRole("link", { name: "Reconcile records for Zara" }).getAttribute("href")!, location.origin);
    expect(comparison.searchParams.get("reportTab")).toBe("payments"); expect(comparison.searchParams.get("paymentMode")).toBe("reconciliation");
  });
});
