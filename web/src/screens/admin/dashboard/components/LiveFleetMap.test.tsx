import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveFleetMap } from "./LiveFleetMap";

const mocks = vi.hoisted(() => ({ tile: vi.fn(), fit: vi.fn(), query: vi.fn(), popup: vi.fn(), layerHtml: [] as string[] }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (args: unknown) => mocks.query(args) }));
vi.mock("leaflet", () => ({ default: {
  map: () => ({ remove: vi.fn(), on: vi.fn(), off: vi.fn(), removeLayer: vi.fn(), invalidateSize: vi.fn(), fitBounds: mocks.fit, flyTo: vi.fn(), getZoom: () => 11, getCenter: () => ({ lat: 51.5, lng: 0 }), zoomIn: vi.fn(), zoomOut: vi.fn() }),
  tileLayer: (...args: unknown[]) => { mocks.tile(...args); return { addTo: vi.fn() }; },
  divIcon: () => ({}), latLngBounds: () => ({}),
  marker: () => {
    const marker = { addTo: () => marker, bindPopup: (html: string) => { mocks.layerHtml.push(html); return marker; }, on: vi.fn(), isPopupOpen: () => false, openPopup: mocks.popup };
    return marker;
  }
} }));

const tracker = { imei: "SAMPLE-TRACKER", name: "Sample device", plateNumber: "DEMO 123", lat: 51.5, lng: 0, speedMph: 15, lastUpdate: "2020-01-01 12:00:00", driverInitials: "DEMO", driverName: "Sample Driver", odometerMiles: null, ignitionOn: null, batteryVoltage: null, gpsSignalLevel: null, gsmSignalLevel: null, jammingDetected: false };
beforeEach(() => {
  window.history.replaceState({}, "", "/admin?section=livefleet"); sessionStorage.clear(); mocks.tile.mockClear(); mocks.layerHtml.length = 0;
  mocks.query.mockImplementation(({ queryKey }: { queryKey: string[] }) => queryKey[0] === "fleet_live" ? { data: { vehicles: [], fetchedAt: "2026-10-13T12:00:00Z" }, isFetched: true, isLoading: false, refetch: vi.fn() } : { data: { zones: [] }, isFetched: true });
});
describe("Coordinated, trustworthy fleet monitoring", () => {
  it("keeps the single map provider in attribution and removes its redundant selector", () => {
    render(<LiveFleetMap jobs={[]} />);
    expect(screen.queryByRole("combobox", { name: "Map provider" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" })).toBeInTheDocument();
    expect(mocks.tile).toHaveBeenCalledOnce();
    expect(mocks.tile.mock.calls[0][0]).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(screen.getByText("No vehicle positions returned")).toBeInTheDocument();
  });
  it("shows failed tracker loading with a retry instead of a no-records conclusion", () => {
    const retry = vi.fn();
    mocks.query.mockImplementation(({ queryKey }: { queryKey: string[] }) => queryKey[0] === "fleet_live" ? { isError: true, error: new Error("Tracker unavailable"), refetch: retry } : { data: { zones: [] }, isFetched: true });
    render(<LiveFleetMap jobs={[]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load vehicle positions");
    expect(screen.queryByText("No vehicle positions returned")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry vehicle loading" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("separates stale signal from last known movement and preserves fleet search and selection", () => {
    window.history.replaceState({}, "", "/admin?section=livefleet&fleetSearch=DEMO");
    mocks.query.mockImplementation(({ queryKey }: { queryKey: string[] }) => queryKey[0] === "fleet_live" ? { data: { vehicles: [tracker] }, refetch: vi.fn() } : { data: { zones: [] }, isFetched: true });
    render(<LiveFleetMap jobs={[]} />);
    expect(screen.getByRole("textbox", { name: "Search vehicles by registration or driver" })).toHaveValue("DEMO");
    expect(screen.getByText("Last known: moving")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moving (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stale (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Parked/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /DEMO 123.*Sample Driver/ }));
    expect(new URLSearchParams(location.search).get("fleetVehicle")).toBe("SAMPLE-TRACKER");
  });
  it("does not guess a current job when a driver has multiple active jobs", () => {
    mocks.query.mockImplementation(({ queryKey }: { queryKey: string[] }) => queryKey[0] === "fleet_live" ? { data: { vehicles: [tracker] }, refetch: vi.fn() } : { data: { zones: [] }, isFetched: true });
    const jobs = [{ jobId: "DEMO-001", driverInitials: "DEMO", status: "IN_PROGRESS" }, { jobId: "DEMO-002", driverInitials: "DEMO", status: "IN_PROGRESS" }] as Parameters<typeof LiveFleetMap>[0]["jobs"];
    render(<LiveFleetMap jobs={jobs} />);
    expect(screen.getByText("Multiple active jobs; association needs review")).toBeInTheDocument();
    expect(mocks.layerHtml.join("")).not.toContain("View current job");
  });
});
