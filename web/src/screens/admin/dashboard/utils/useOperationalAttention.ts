import { useQuery } from "@tanstack/react-query";
import {
  fetchAlerts,
  fetchNotifications,
  type AlertRow,
  type NotificationRow,
} from "../api";

export interface OperationalAttentionItem {
  id: string;
  severity: "Urgent" | "Review";
  reason: string;
  detail: string;
  identity: string;
  at: string;
  href: string;
  action: string;
  count: number;
}
/** Raw zone entry is review evidence, never proof of a payable road fee. */
export function operationalAttentionItems(
  deliveries: NotificationRow[],
  events: AlertRow[],
): OperationalAttentionItem[] {
  const items: OperationalAttentionItem[] = deliveries
    .filter((row) => row.email.state === "failed" || row.sms.state === "failed")
    .map((row) => ({
      id: `delivery-${row.jobId}`,
      severity: "Review",
      reason: "Message delivery failed",
      detail: [
        row.email.state === "failed" ? "Email failed" : "",
        row.sms.state === "failed" ? "SMS failed" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      identity: `${row.customerName || row.jobId}${row.driverInitials ? ` · ${row.driverInitials}` : ""}`,
      at:
        row.email.state === "failed"
          ? row.email.at || row.actualStart
          : row.sms.at || row.actualStart,
      href: `/admin?section=jobs&job=${encodeURIComponent(row.jobId)}`,
      action: "Open job",
      count: 1,
    }));
  const grouped = new Map<string, OperationalAttentionItem>();
  for (const row of events) {
    const type = row.type.toLowerCase();
    const urgent = ["sos", "panic"].includes(type);
    const review = ["overspeed", "speed", "jamming"].includes(type);
    const zone =
      ["zone_in", "geofence_in"].includes(type) && row.category !== "other";
    if (!urgent && !review && !zone) continue;
    const group = `${row.deviceName || row.driverInitials || row.eventId}-${row.category}-${type}`;
    const existing = grouped.get(group);
    if (existing) {
      existing.count += 1;
      if (row.detectedAt > existing.at) existing.at = row.detectedAt;
      continue;
    }
    grouped.set(group, {
      id: `event-${row.eventId}`,
      severity: urgent ? "Urgent" : "Review",
      reason: urgent
        ? "Driver emergency signal"
        : zone
          ? `Review ${row.category} zone entry`
          : type === "jamming"
            ? "Tracker interference reported"
            : "Speed alert reported",
      detail: zone
        ? "Zone entry is recorded; fee liability requires charge-rule and journey review."
        : row.description || "Review the recorded tracker event.",
      identity:
        [row.driverName || row.driverInitials, row.deviceName]
          .filter(Boolean)
          .join(" · ") || "Vehicle not linked",
      at: row.detectedAt,
      href: `/admin?section=livefleet${row.deviceName ? `&fleetSearch=${encodeURIComponent(row.deviceName)}` : ""}`,
      action: "View fleet",
      count: 1,
    });
  }
  items.push(...grouped.values());
  return items.sort((a, b) =>
    a.severity === b.severity
      ? b.at.localeCompare(a.at)
      : a.severity === "Urgent"
        ? -1
        : 1,
  );
}
/** Shared by the header and Alerts: identical feed keys, definition, and partial-data state. */
export function useOperationalAttention() {
  const deliveries = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });
  const events = useQuery({
    queryKey: ["gpslive_alerts", undefined, undefined],
    queryFn: () => fetchAlerts(),
    refetchInterval: 30000,
  });
  return {
    items: operationalAttentionItems(
      deliveries.data?.rows ?? [],
      events.data?.rows ?? [],
    ),
    isLoading: deliveries.isLoading || events.isLoading,
    isFetching: deliveries.isFetching || events.isFetching,
    errors: [
      { name: "Delivery records", error: deliveries.error },
      { name: "Tracker events", error: events.error },
    ].filter((item) => item.error),
    updatedAt: Math.min(
      ...[deliveries.dataUpdatedAt, events.dataUpdatedAt].filter(Boolean),
    ),
    loadedSources:
      Number(Boolean(deliveries.data)) + Number(Boolean(events.data)),
    refetch: () => Promise.allSettled([deliveries.refetch(), events.refetch()]),
  };
}
