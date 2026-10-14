import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveFleetPage } from "./LiveFleetPage";
import { fleetReturnHref } from "../utils/reportNavigation";

const mocks = vi.hoisted(() => ({ fetchJobs: vi.fn() }));
vi.mock("../api", () => ({ fetchJobs: (...args: unknown[]) => mocks.fetchJobs(...args) }));
vi.mock("../components/LiveFleetMap", () => ({ LiveFleetMap: ({ jobs, onSelectJob }: { jobs: Array<{ jobId: string }>; onSelectJob: (id: string) => void }) => <div>{jobs.map(job => <button key={job.jobId} onClick={() => onSelectJob(job.jobId)}>Open {job.jobId}</button>)}</div> }));
beforeEach(() => { window.history.replaceState({}, "", "/admin?section=livefleet&fleetVehicle=DEMO-TRACKER&fleetSearch=Sample"); mocks.fetchJobs.mockReset(); });
describe("Exact current-job navigation from Live Fleet", () => {
  it("fetches all current-job pages and opens the selected job with fleet return context", async () => {
    mocks.fetchJobs.mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ jobId: `DEMO-00${page}` }], pagination: { totalPages: 2 } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LiveFleetPage /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open DEMO-002" })).toBeInTheDocument());
    expect(mocks.fetchJobs).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Open DEMO-002" }));
    expect(new URLSearchParams(location.search).get("job")).toBe("DEMO-002");
    expect(new URLSearchParams(location.search).get("section")).toBe("jobs");
    expect(fleetReturnHref()).toBe("/admin?section=livefleet&fleetVehicle=DEMO-TRACKER&fleetSearch=Sample");
  });
});
