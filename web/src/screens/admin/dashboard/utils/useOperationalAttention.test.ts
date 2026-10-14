import { describe, expect, it } from "vitest";
import { operationalAttentionItems } from "./useOperationalAttention";
import type { AlertRow, NotificationRow } from "../api";
const row: NotificationRow = {
  jobId: "job-example",
  customerName: "Example",
  customerEmail: "example@example.test",
  customerPhone: "",
  driverInitials: "EX",
  actualStart: "2026-10-13T09:00:00Z",
  email: { state: "sent", detail: "", at: "" },
  sms: { state: "pending", detail: "", at: "" },
};
const event: AlertRow = {
  eventId: "event-1",
  type: "zone_in",
  description: "Congestion Zone",
  category: "congestion",
  deviceName: "EX00 VAN",
  driverInitials: "EX",
  driverName: "Example driver",
  detectedAt: "2026-10-13 09:00:00",
};
describe("Operational attention source", () => {
  it("only includes genuinely failed delivery states, never pending or sent", () => {
    expect(operationalAttentionItems([row], [])).toEqual([]);
    const items = operationalAttentionItems(
      [{ ...row, sms: { ...row.sms, state: "failed" } }],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].href).toBe("/admin?section=jobs&job=job-example");
    expect(items[0].detail).toBe("SMS failed");
  });
  it("groups repeated review events and does not imply charge liability", () => {
    const items = operationalAttentionItems(
      [],
      [
        event,
        { ...event, eventId: "event-2", detectedAt: "2026-10-13 10:00:00" },
        { ...event, type: "zone_out", eventId: "event-3" },
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(2);
    expect(items[0].at).toBe("2026-10-13 10:00:00");
    expect(items[0].detail).toContain("requires charge-rule");
    expect(items[0].href).toBe(
      "/admin?section=livefleet&fleetSearch=EX00%20VAN",
    );
  });
  it("prioritizes real emergency signals without treating routine motion as an exception", () => {
    const items = operationalAttentionItems(
      [],
      [
        event,
        { ...event, type: "moving", eventId: "motion" },
        { ...event, type: "sos", eventId: "sos", category: "other" },
      ],
    );
    expect(items).toHaveLength(2);
    expect(items[0].severity).toBe("Urgent");
  });
});
