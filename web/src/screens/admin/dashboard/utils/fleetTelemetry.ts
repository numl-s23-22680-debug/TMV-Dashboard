import { DateTime } from "luxon";

/** Retains the existing dashboard's 30-minute freshness and 2mph motion thresholds.
 * Environment overrides are display policies only; they do not alter tracker data,
 * assignment, billing or evidence. Freshness never establishes a parked vehicle. */
const positiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
export const FLEET_TELEMETRY_POLICY = Object.freeze({
  staleAfterMinutes: positiveNumber(import.meta.env.VITE_FLEET_STALE_AFTER_MINUTES, 30),
  movingAboveMph: positiveNumber(import.meta.env.VITE_FLEET_MOVING_ABOVE_MPH, 2)
});

export function trackerInstant(value: string): DateTime {
  const iso = DateTime.fromISO(value, { zone: "utc" });
  return iso.isValid ? iso : DateTime.fromSQL(value, { zone: "utc" });
}
export function fleetTelemetry(value: string, speedMph: number, now: DateTime = DateTime.utc()) {
  const instant = trackerInstant(value);
  const ageMinutes = instant.isValid ? Math.max(0, now.diff(instant, "minutes").minutes) : null;
  const stale = ageMinutes === null || ageMinutes > FLEET_TELEMETRY_POLICY.staleAfterMinutes;
  const moving = speedMph > FLEET_TELEMETRY_POLICY.movingAboveMph;
  const age = ageMinutes === null ? "Signal time unavailable" : ageMinutes < 1 ? "Updated just now" : ageMinutes < 60 ? `Updated ${Math.round(ageMinutes)} min ago` :
    ageMinutes < 1440 ? `Updated ${Math.round(ageMinutes / 60)} h ago` : `Updated ${Math.round(ageMinutes / 1440)} d ago`;
  return { ageMinutes, stale, moving, age, motion: stale ? `Last known: ${moving ? "moving" : "stopped"}` : moving ? "Moving" : "Stopped",
    freshness: ageMinutes === null ? "Unknown signal age" : stale ? "Stale signal" : "Recent signal" };
}
