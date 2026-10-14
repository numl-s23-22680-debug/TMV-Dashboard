import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VanMileagePage } from "./VanMileagePage";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../api", () => ({ fetchVanDriverRecords: mocks.fetch, saveVanCompliance: vi.fn(), deleteVanRecord: vi.fn() }));
const vehicle = { id: "QA-vehicle", driverName: "QA Driver", driverEmail: "qa@example.invalid", driverInitials: "QA", vanRegistration: "QA12 ABC", records: [], latestFuel: null, latestService: null, latestMileage: null, compliance: { vanRegistration: "QA12 ABC", roadTaxRenewalDate: "2026-10-10", motExpiryDate: "2027-01-10", serviceIntervalMiles: 8000, lastServiceMileage: 10000, currentMileage: null } };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><VanMileagePage /></QueryClientProvider>);
describe("Vehicle current facts and historical uploads", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z")); mocks.fetch.mockReset().mockImplementation(query => Promise.resolve({ items: query.from || query.to ? [] : [vehicle], pagination: { page: 1, pageSize: 25, total: query.from || query.to ? 0 : 1, totalPages: 1 } })); });
  afterEach(() => vi.useRealTimers());
  it("leads with registration and uses current deadlines independently of the historical range", async () => {
    mount(); await screen.findAllByText("QA12 ABC");
    expect(mocks.fetch).toHaveBeenCalledWith({ page: 1, q: "" });
    expect(screen.queryByText("qa@example.invalid")).not.toBeInTheDocument();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Service due cannot be calculated").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "View vehicle QA12 ABC" }));
    expect(screen.getByRole("dialog", { name: "QA12 ABC" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Record history" }));
    await screen.findByText("No records in this range");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2020-01-01" } });
    await waitFor(() => expect(mocks.fetch.mock.calls.some(([query]) => query.from?.startsWith("2020-01-01"))).toBe(true));
    fireEvent.click(screen.getByRole("radio", { name: "Dates & service" }));
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(mocks.fetch.mock.calls.filter(([query]) => !query.from && !query.to)).toHaveLength(1);
  });
});
