import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { fleetTelemetry } from "./fleetTelemetry";

const now = DateTime.fromISO("2026-10-13T12:00:00Z");
describe("Fleet motion and signal freshness", () => {
  it("retains the existing 30-minute threshold independently from last known motion", () => {
    expect(fleetTelemetry("2026-10-13 11:30:00", 10, now)).toMatchObject({ stale: false, moving: true, motion: "Moving" });
    expect(fleetTelemetry("2026-10-13 11:29:00", 10, now)).toMatchObject({ stale: true, moving: true, motion: "Last known: moving", freshness: "Stale signal" });
    expect(fleetTelemetry("2026-10-13 10:00:00", 0, now).motion).toBe("Last known: stopped");
  });
  it("accepts ISO and UTC SQL tracker instants consistently", () => {
    expect(fleetTelemetry("2026-10-13 11:57:00", 0, now).age).toBe("Updated 3 min ago");
    expect(fleetTelemetry("2026-10-13T12:57:00+01:00", 0, now).age).toBe("Updated 3 min ago");
  });
  it("keeps a missing or invalid tracker time unknown", () => {
    expect(fleetTelemetry("", 0, now)).toMatchObject({ ageMinutes: null, stale: true, age: "Signal time unavailable", freshness: "Unknown signal age" });
    expect(fleetTelemetry("bad timestamp", 12, now).motion).toBe("Last known: moving");
  });
});
