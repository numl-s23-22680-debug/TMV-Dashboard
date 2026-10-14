import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobsPage } from "./JobsPage";
import { fetchJobDetail, fetchJobs } from "../api";

const fixture = {
  jobId: "UI-JOB",
  customerName: "Sample Customer",
  driverInitials: "WD",
  driverName: "Driver WD",
  pickup: "Reading",
  dropoff: "London",
  bookedStart: "2026-10-11T09:00:00Z",
  status: "READY",
  amountCharged: 0,
  totalCharges: 10000,
  rawTitle: "2 men 115£/Y-TI",
};
vi.mock("../api", () => ({
  fetchJobs: vi.fn(),
  fetchDrivers: vi.fn(),
  fetchJobDetail: vi.fn(),
  markJobFinishedManually: vi.fn(),
  reassignJob: vi.fn(),
}));
vi.mock("../hooks/useDriverOptions", () => ({
  useDriverOptions: () => ({
    options: [{ initials: "WD", fullName: "Driver WD" }],
    isLoading: false,
  }),
}));
vi.mock("../components/JobDetailDrawer", () => ({
  JobDetailDrawer: ({ job, onClose }: any) => (
    <div role="dialog" aria-label="Job details">
      {job.jobId}
      <button onClick={onClose}>Close details</button>
    </div>
  ),
}));

function renderJobs(initialStatus?: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <JobsPage initialStatus={initialStatus} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/admin?section=jobs");
  vi.mocked(fetchJobs).mockResolvedValue({
    items: [fixture],
    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  } as any);
  vi.mocked(fetchJobDetail).mockResolvedValue(fixture as any);
});

describe("Jobs navigation and scan view", () => {
  it("defaults to list, preserves optional cards and opens the exact record without losing selection", async () => {
    renderJobs();
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await screen.findAllByText("Sample Customer");
    fireEvent.click(screen.getByRole("button", { name: "Card view" }));
    const customer = screen.getByText("Sample Customer");
    const selection = screen.getByRole("checkbox", {
      name: "Select job UI-JOB",
    });
    fireEvent.click(selection);
    expect(selection).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for job UI-JOB" }),
    );
    expect(screen.getByText("Reassign driver")).toBeInTheDocument();
    fireEvent.click(customer.closest("button")!);
    expect(
      await screen.findByRole("dialog", { name: "Job details" }),
    ).toHaveTextContent("UI-JOB");
    expect(fetchJobDetail).toHaveBeenCalledWith("UI-JOB");
    expect(new URLSearchParams(window.location.search).get("job")).toBe(
      "UI-JOB",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(
      screen.queryByRole("dialog", { name: "Job details" }),
    ).not.toBeInTheDocument();
    expect(selection).toBeChecked();
    expect(new URLSearchParams(window.location.search).get("job")).toBeNull();
  });

  it("uses structured route fields and preserves a known zero charge", async () => {
    window.history.replaceState({}, "", "/admin?section=jobs&jobsView=cards");
    renderJobs();
    await screen.findByText("Sample Customer");
    expect(screen.getByText("Reading → London")).toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument();
    expect(screen.queryByText(fixture.rawTitle)).not.toBeInTheDocument();
  });

  it("retains URL filters, server sort and pagination on mount and after opening a job", async () => {
    window.history.replaceState(
      {},
      "",
      "/admin?section=jobs&from=2026-10-01&to=2026-10-13&q=Sample&driver=WD&status=COMPLETED&jobsPage=2&jobsSort=Total&jobsDir=desc",
    );
    vi.mocked(fetchJobs).mockResolvedValue({
      items: [fixture],
      pagination: { page: 2, pageSize: 25, total: 40, totalPages: 2 },
    } as any);
    renderJobs();
    await screen.findAllByText("Sample Customer");
    expect(fetchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        q: "Sample",
        driver: "WD",
        status: "COMPLETED",
        sort: "amountCharged",
        dir: "desc",
      }),
    );
    expect(
      screen.getByRole("combobox", { name: "Filter jobs by status" }),
    ).toHaveValue("Completed");
    fireEvent.click(screen.getByRole("button", { name: "Open job UI-JOB" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("jobsPage")).toBe("2");
    expect(params.get("q")).toBe("Sample");
    expect(params.get("driver")).toBe("WD");
    expect(params.get("jobsDir")).toBe("desc");
  });

  it("treats Finished as the Completed Jobs filter with the same canonical screen", async () => {
    renderJobs("Finished");
    await screen.findAllByText("Sample Customer");
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(fetchJobs).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("clears both driver and status filters and never displays invalid empty pagination", async () => {
    window.history.replaceState(
      {},
      "",
      "/admin?section=jobs&driver=WD&status=UNSUPPORTED&q=missing",
    );
    vi.mocked(fetchJobs).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    } as any);
    renderJobs();
    await screen.findByRole("heading", { name: "No jobs match your filters" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0],
    );
    expect(
      screen.getByRole("combobox", { name: "Filter jobs by driver" }),
    ).toHaveValue("");
    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("q")).toBeNull(),
    );
    expect(screen.queryByText(/Showing 1–0/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next page" }),
    ).not.toBeInTheDocument();
  });

  it("opens a cold deep link when React StrictMode replays effects", async () => {
    window.history.replaceState({}, "", "/admin?section=jobs&job=UI-JOB");
    render(
      <React.StrictMode>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <JobsPage />
        </QueryClientProvider>
      </React.StrictMode>,
    );
    expect(
      await screen.findByRole("dialog", { name: "Job details" }),
    ).toHaveTextContent("UI-JOB");
    expect(screen.queryByText("Opening job UI-JOB…")).not.toBeInTheDocument();
  });

  it("shows a recoverable exact-record error instead of silently failing a deep link", async () => {
    window.history.replaceState({}, "", "/admin?section=jobs&job=MISSING-JOB");
    vi.mocked(fetchJobDetail).mockRejectedValue(new Error("Job not found"));
    renderJobs();
    expect(await screen.findByText("Job not found")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try again/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("restores saved list position once and does not reset current scrolling on refresh", async () => {
    const href =
      "/admin?section=jobs&from=2026-10-13&to=2026-10-13&jobsSort=Timing&jobsDir=asc&jobsView=table";
    window.history.replaceState({}, "", href);
    sessionStorage.setItem(`tmv-jobs-scroll:${href}`, "500");
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    renderJobs();
    await screen.findAllByText("Sample Customer");
    await waitFor(() => expect(scroll).toHaveBeenCalledWith(0, 500));
    fireEvent.click(screen.getByRole("button", { name: "Refresh jobs" }));
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(2));
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockRestore();
  });
});
