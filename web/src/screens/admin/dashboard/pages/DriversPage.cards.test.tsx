import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriversPage } from "./DriversPage";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("../api", () => ({ fetchDrivers: mocks.fetch, saveDriver: mocks.save, deleteDriver: mocks.remove }));
vi.mock("../components/AddDriverModal", () => ({ AddDriverModal: ({ isOpen, onClose }: any) => isOpen ? <div role="dialog" aria-label="Edit driver"><button onClick={onClose}>Close editor</button></div> : null }));
vi.mock("../components/DriverSettlement", () => ({ DriverSettlement: ({ from, to }: any) => <div data-testid="performance">Performance for {from} to {to}</div> }));
const driver = { initials: "QA", fullName: "Sample Driver", hasAccount: true, active: true, vanRegistration: "QA12 ABC", email: "qa@example.invalid", phone: "000000000", completed: 3, assigned: 4 };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DriversPage /></QueryClientProvider>);

describe("Driver directory and performance", () => {
  beforeEach(() => { window.history.replaceState({}, "", "/admin?section=drivers&from=2026-10-10&to=2026-10-11"); mocks.fetch.mockReset().mockResolvedValue({ drivers: [driver, { ...driver, initials: "HX", fullName: "Historical Driver", active: false }, { ...driver, initials: "JO", fullName: "Job-only code", hasAccount: false }] }); });
  it("loads the account roster without performance dates and keeps contacts inside profiles", async () => {
    mount(); await screen.findByText("Sample Driver");
    expect(mocks.fetch).toHaveBeenCalledWith();
    expect(screen.queryByLabelText("From date")).not.toBeInTheDocument();
    expect(screen.queryByText("Job-only code")).not.toBeInTheDocument();
    expect(screen.queryByText("qa@example.invalid")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View profile for Sample Driver" }));
    expect(screen.getByRole("dialog", { name: "Sample Driver · QA" })).toBeInTheDocument();
    expect(screen.getByText("qa@example.invalid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.getByRole("dialog", { name: "Edit driver" })).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("filters app access separately from availability, and opens reports with the selected range", async () => {
    mount(); await screen.findByText("Sample Driver");
    fireEvent.change(screen.getByLabelText("Account access filter"), { target: { value: "active" } });
    expect(screen.queryByText("Historical Driver")).not.toBeInTheDocument();
    expect(screen.getAllByText("Account active").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "View report for Sample Driver" }));
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("driverreport"); expect(params.get("driver")).toBe("QA"); expect(params.get("reportTab")).toBe("summary");
    expect(params.get("from")).toBe("2026-10-10"); expect(params.get("to")).toBe("2026-10-11");
  });
  it("moves the aggregate view behind the performance tab", async () => {
    mount(); await screen.findByText("Sample Driver");
    fireEvent.click(screen.getByRole("radio", { name: "Performance summary" }));
    expect(screen.getByTestId("performance")).toHaveTextContent("2026-10-10 to 2026-10-11");
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(new URLSearchParams(location.search).get("driversTab")).toBe("performance");
  });
});
