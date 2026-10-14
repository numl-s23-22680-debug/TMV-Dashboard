import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiabilityPage } from "./LiabilityPage";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), detail: vi.fn().mockResolvedValue({ jobId: "QA-JOB" }) }));
vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), fetchScenarios: mocks.fetch, fetchJobDetail: mocks.detail }));
vi.mock("../hooks/useDriverOptions", () => ({ useDriverOptions: () => ({ options: [{ initials: "QA", fullName: "QA Driver", active: true }], isLoading: false }) }));
vi.mock("../components/LiabilityConfigModal", () => ({ LiabilityConfigModal: () => null }));
vi.mock("../components/JobDetailDrawer", () => ({ JobDetailDrawer: ({ job, onClose }: any) => <div role="dialog" aria-label="Job details"><span>{job.jobId}</span><button onClick={onClose}>Close job</button></div> }));
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LiabilityPage /></QueryClientProvider>);

describe("Unified Liability page", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin?section=liabilities");
    mocks.fetch.mockReset().mockImplementation((kind, page) => Promise.resolve({ kind, items: [{ id: `submission-${kind}`, jobId: "QA-JOB", timestamp: "2026-10-10T09:00:00Z",
      clientName: "Alex Example", driverName: "QA Driver", driverInitials: "QA", driver: "qa@example.invalid", containerNumber: "Container 100", address: "10 Synthetic Road London",
      damageCategories: "Item condition note", photos: [], signature: null }], pagination: { page, pageSize: 25, total: 50, totalPages: 2 } }));
  });
  it("opens the exact linked job in the canonical detail while retaining evidence context", async () => {
    renderPage(); await screen.findAllByText("Alex Example");
    fireEvent.change(screen.getByLabelText("Search submissions"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Filter by driver"), { target: { value: "QA" } });
    await waitFor(() => expect(mocks.fetch.mock.calls.some(call => call[2] === "QA")).toBe(true));
    const urlBefore = window.location.search;
    fireEvent.click(await screen.findByRole("button", { name: "Open job QA-JOB" }));
    await screen.findByRole("button", { name: "Close job" });
    expect(mocks.detail).toHaveBeenCalledWith("QA-JOB");
    fireEvent.click(screen.getByRole("button", { name: "Close job" }));
    expect(screen.getByLabelText("Search submissions")).toHaveValue("Alex"); expect(screen.getByLabelText("Filter by driver")).toHaveValue("QA");
    expect(window.location.search).toBe(urlBefore);
  });
  it("renders zero records without impossible pagination", async () => {
    mocks.fetch.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    renderPage();
    await screen.findAllByText("No records in this range");
    expect(screen.queryByText(/Showing 1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });
  it("does not slice a server-paginated parking response twice", async () => {
    mocks.fetch.mockImplementation((kind, page) => Promise.resolve({ kind, items: [{ id: `row-${page}`, jobId: `QA-${page}`, clientName: `Customer page ${page}`, photos: [], signature: { thumbUrl: "signature.png" } }], pagination: { page, pageSize: 25, total: 50, totalPages: 2 } }));
    renderPage(); await screen.findAllByText("Customer page 1");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findAllByText("Customer page 2");
    expect(screen.getByText("Showing 26–50 of 50 records")).toBeInTheDocument();
    expect(screen.getAllByText("Signed").length).toBeGreaterThan(0);
  });
  it("has four switchable views and only requests the active scenario", async () => {
    renderPage();
    expect(screen.getAllByRole("radio").map(item => item.textContent)).toEqual(["Check-in", "Checkout", "Parking", "Incidents / liability"]);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(mocks.fetch.mock.calls.every(call => call[0] === "parking")).toBe(true);
    expect(screen.getByRole("radio", { name: "Parking" })).toHaveAttribute("aria-checked", "true");
    for (const [label, kind] of [["Check-in", "checkin"], ["Checkout", "checkout"], ["Parking", "parking"], ["Incidents / liability", "liability"]]) {
      fireEvent.click(screen.getByRole("radio", { name: label }));
      await waitFor(() => expect(mocks.fetch.mock.calls.some(call => call[0] === kind && call[1] === 1)).toBe(true));
      expect(screen.getByRole("radio", { name: label })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByLabelText("Filter by driver")).toBeInTheDocument();
      expect(screen.getByLabelText("Search submissions")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Export current page CSV" })).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Date filters" })).getByLabelText("From date")).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Other filters" })).getByLabelText("Filter by driver")).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Other filters" })).getByLabelText("Search submissions")).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Other filters" })).getByRole("radiogroup", { name: "Liability views" })).toBeInTheDocument();
    }
  });
  it("keeps Parking filters separate from the table frame and above it like Jobs", async () => {
    renderPage();
    await screen.findAllByText("Alex Example");
    const dates = screen.getByRole("group", { name: "Date filters" });
    const controls = screen.getByRole("group", { name: "Other filters" });
    const bar = dates.parentElement!;
    const table = screen.getByRole("table");
    expect(bar.contains(table)).toBe(false);
    expect(bar.parentElement).toBe(table.parentElement!.parentElement!.parentElement);
    expect(bar.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(controls).getByRole("radiogroup", { name: "Liability views" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Refresh Data" }).compareDocumentPosition(within(controls).getByRole("button", { name: "Export current page CSV" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("retains shared driver, search and date filters across all four views and resets pagination", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: "Check-in" }));
    await screen.findAllByText("Alex Example");
    fireEvent.change(screen.getByLabelText("Filter by driver"), { target: { value: "QA" } });
    fireEvent.change(screen.getByLabelText("Search submissions"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-10" } });
    await waitFor(() => expect(mocks.fetch.mock.calls.some(call => call[2] === "QA" && call[3] === "2026-10-08T23:00:00.000Z" && call[4] === "2026-10-10T22:59:59.999Z")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.fetch.mock.calls.some(call => call[0] === "checkin" && call[1] === 2)).toBe(true));
    for (const label of ["Checkout", "Parking", "Incidents / liability", "Check-in"]) {
      fireEvent.click(screen.getByRole("radio", { name: label }));
      expect(screen.getByLabelText("Filter by driver")).toHaveValue("QA");
      expect(screen.getByLabelText("Search submissions")).toHaveValue("Alex");
      expect(screen.getByLabelText("From date")).toHaveValue("2026-10-09");
      expect(screen.getByLabelText("To date")).toHaveValue("2026-10-10");
    }
    await waitFor(() => expect(mocks.fetch.mock.calls.at(-1)?.[1]).toBe(1));
  });
  it.each([["checkin", "Check-in"], ["checkout", "Checkout"], ["parking", "Parking"], ["liability", "Incidents / liability"]])("restores legacy %s links", (section, label) => {
    window.history.replaceState({}, "", `/admin?section=${section}`);
    renderPage(); expect(screen.getByRole("radio", { name: label })).toHaveAttribute("aria-checked", "true");
  });
  it("supports keyboard switching and browser history restoration", () => {
    renderPage();
    screen.getByRole("radio", { name: "Parking" }).focus();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Parking" }), { key: "ArrowRight" });
    expect(new URLSearchParams(location.search).get("liabilityTab")).toBe("liability");
    expect(screen.getByRole("radio", { name: "Incidents / liability" })).toHaveFocus();
    window.history.replaceState({}, "", "/admin?section=liabilities&liabilityTab=parking");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(screen.getByRole("radio", { name: "Parking" })).toHaveAttribute("aria-checked", "true");
  });
  it("falls back to parking for an invalid view and honors an explicit current link", () => {
    window.history.replaceState({}, "", "/admin?section=liabilities&liabilityTab=invalid");
    renderPage();
    expect(screen.getByRole("radio", { name: "Parking" })).toHaveAttribute("aria-checked", "true");
    window.history.replaceState({}, "", "/admin?section=liabilities&liabilityTab=checkout");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(screen.getByRole("radio", { name: "Checkout" })).toHaveAttribute("aria-checked", "true");
  });
});
