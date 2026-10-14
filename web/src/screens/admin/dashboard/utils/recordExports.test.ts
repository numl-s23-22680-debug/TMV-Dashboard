import { describe, expect, it } from "vitest";
import { scenarioPageCsv, vehicleHistoryCsv } from "./recordExports";
import { ScenarioItem, VanRecordItem } from "../types";
describe("Scoped record exports", () => {
  it("includes actual identity, range, London timezone and missing evidence facts", () => {
    const csv = scenarioPageCsv([{ id: "QA-record", jobId: "QA-job", clientName: "=malicious()", photos: [], signature: null } as unknown as ScenarioItem], "checkin", { page: 2, from: "2026-10-01", to: "2026-10-13", search: "QA" });
    expect(csv).toContain("QA-record"); expect(csv).toContain("QA-job"); expect(csv).toContain("2026-10-01"); expect(csv).toContain("Europe/London"); expect(csv).toContain("Filtered records on the current page");
    expect(csv).toContain("Not recorded"); expect(csv).toContain("'=malicious()"); expect(csv).not.toContain("Verified");
  });
  it("preserves a known fuel zero while leaving unknown odometer values missing", () => {
    const csv = vehicleHistoryCsv([{ id: "QA-fuel", type: "FUEL", submittedAt: "2026-10-13T09:00:00Z", fuelCost: 0 } as VanRecordItem], "QA12 ABC", { page: 1 });
    expect(csv).toContain("QA12 ABC"); expect(csv).toContain("Recorded fuel cost (GBP)"); expect(csv).toContain(",Not recorded,0,Not recorded,"); expect(csv).toContain("Europe/London");
  });
});
