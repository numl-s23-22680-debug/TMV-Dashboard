import { beforeEach, describe, expect, it, vi } from "vitest";
import { driverReportHref, driverReturnHref, fleetReturnHref, navigateAdmin, normalizeReportDestination, recordJobHref, recordReturnHref, reportJobHref, reportReturnHref } from "./reportNavigation";

beforeEach(() => window.history.replaceState({}, "", "/admin?section=overview"));
describe("Compatible, scoped record navigation", () => {
  it.each([["comparison", "payments", "reconciliation", "all"], ["performance", "jobs", "overview", "all"], ["tunnels", "road", "overview", "tunnel"], ["congestion", "road", "overview", "congestion"]])("maps the legacy %s link", (tab, expected, paymentMode, roadType) => {
    expect(normalizeReportDestination(tab)).toMatchObject({ tab: expected, paymentMode, roadType });
  });
  it("creates report destinations without unrelated list and fleet parameters", () => {
    window.history.replaceState({}, "", "/admin?section=jobs&search=Customer&page=5&fleetVehicle=SECRET&from=2020-01-01");
    expect(driverReportHref("DEMO", "2026-10-05", "2026-10-11", "comparison")).toBe("/admin?section=driverreport&driver=DEMO&reportTab=payments&paymentMode=reconciliation&from=2026-10-05&to=2026-10-11");
  });
  it("preserves the driver-directory return context in one scoped return parameter", () => {
    const source = "/admin?section=drivers&driversView=directory&q=Sample&driver=DEMO&page=2";
    window.history.replaceState({}, "", source);
    const params = new URL(driverReportHref("DEMO"), location.origin).searchParams;
    expect(params.get("driverReturn")).toBe(source);
    expect(params.has("q")).toBe(false);
    expect(params.has("page")).toBe(false);
    window.history.replaceState({}, "", driverReportHref("DEMO"));
    expect(driverReturnHref()).toBe(source);
  });
  it.each(["https://external.test/admin?section=drivers", "//external.test/admin?section=drivers", "/other?section=drivers", "/admin?section=configurations"])("rejects unsafe driver-directory returns %s", value => {
    window.history.replaceState({}, "", `/admin?section=driverreport&driver=DEMO&driverReturn=${encodeURIComponent(value)}`);
    expect(driverReturnHref()).toBeNull();
  });
  it("opens the exact canonical job while retaining full report return context only in its return URL", () => {
    const source = "/admin?section=driverreport&driver=DEMO&reportTab=payments&paymentMode=reconciliation&comparisonFilter=missing&from=2026-10-05&to=2026-10-11&jobsPage=3&reportJob=DEMO-003";
    window.history.replaceState({}, "", source);
    window.history.replaceState({}, "", reportJobHref("DEMO-003"));
    const params = new URLSearchParams(location.search);
    expect(params.get("section")).toBe("jobs"); expect(params.get("job")).toBe("DEMO-003");
    expect(params.has("jobsPage")).toBe(false);
    expect(reportReturnHref()).toBe(source);
  });
  it("keeps fleet selection, search and filter in a validated return URL", () => {
    const source = "/admin?section=livefleet&fleetVehicle=DEMO-TRACKER&fleetSearch=DEMO&fleetFilter=STALE";
    window.history.replaceState({}, "", source);
    window.history.replaceState({}, "", recordJobHref("DEMO-007"));
    expect(new URLSearchParams(location.search).get("job")).toBe("DEMO-007");
    expect(fleetReturnHref()).toBe(source);
    expect(new URLSearchParams(location.search).has("fleetVehicle")).toBe(false);
  });
  it.each(["https://external.test/admin?section=overview", "//external.test/admin?section=livefleet", "/other?section=livefleet", "/admin?section=configurations", "/admin?section=jobs"])("rejects an unrelated or unsafe record return %s", value => {
    window.history.replaceState({}, "", `/admin?section=jobs&job=DEMO&recordReturn=${encodeURIComponent(value)}`);
    expect(recordReturnHref()).toBeNull();
  });
  it("allows an unsaved settings guard to cancel navigation", () => {
    const listener = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener("tmv:before-navigate", listener);
    navigateAdmin("/admin?section=jobs");
    expect(location.search).toBe("?section=overview");
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("tmv:before-navigate", listener);
  });
});
