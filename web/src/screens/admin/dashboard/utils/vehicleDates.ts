import { DateTime } from "luxon";

// Existing product notice period, not a legal compliance rule.
export const VEHICLE_DUE_SOON_DAYS = 30;
export function vehicleDaysUntil(value?: string, now: DateTime = DateTime.now()): number | null {
  if (!value) return null;
  const target = DateTime.fromISO(value.slice(0, 10), { zone: "Europe/London" }).startOf("day");
  if (!target.isValid) return null;
  return Math.round(target.diff(now.setZone("Europe/London").startOf("day"), "days").days);
}
export function vehicleDateStatus(value?: string, now: DateTime = DateTime.now()) {
  const days = vehicleDaysUntil(value, now);
  return days === null ? "Date missing" : days < 0 ? "Overdue" : days <= VEHICLE_DUE_SOON_DAYS ? "Due soon" : "Current";
}
