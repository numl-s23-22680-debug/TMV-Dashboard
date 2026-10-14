import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { vehicleDateStatus, vehicleDaysUntil } from "./vehicleDates";
import { scenarioJobId, scenarioReviewStatus, scenarioSignatureStatus } from "./evidenceRecords";

const now = DateTime.fromISO("2026-10-13T00:05:00", { zone: "Europe/London" });
describe("Vehicle deadlines use the operational London day", () => {
  it("distinguishes stored overdue, due soon, current and missing dates", () => {
    expect(vehicleDateStatus("2026-10-10", now)).toBe("Overdue"); expect(vehicleDateStatus("2026-10-13", now)).toBe("Due soon");
    expect(vehicleDateStatus("2026-12-13", now)).toBe("Current"); expect(vehicleDateStatus(undefined, now)).toBe("Date missing");
    expect(vehicleDateStatus("2026-02-31", now)).toBe("Date missing");
  });
  it("uses the London day at UTC midnight boundaries and across DST", () => {
    expect(vehicleDaysUntil("2026-10-12", now)).toBe(-1);
    expect(vehicleDaysUntil("2026-10-26", DateTime.fromISO("2026-10-24T12:00:00Z"))).toBe(2);
  });
});
describe("Evidence facts", () => {
  it("recognizes supported signature URLs without inventing consent or review", () => {
    expect(scenarioSignatureStatus({ signature: { thumbUrl: "example.invalid/signature" } })).toBe("Signed");
    expect(scenarioSignatureStatus({ signature: null })).toBe("Not recorded");
    expect(scenarioSignatureStatus({ signatureRequired: false })).toBe("Not required");
    expect(scenarioReviewStatus({}, "liability")).toBe("Reported · review not recorded");
    expect(scenarioReviewStatus({ reviewStatus: "Verified" }, "liability")).toBe("Verified");
  });
  it("only links the exact stored job identity", () => { expect(scenarioJobId({ rawRecord: { "Job ID": "exact-job" } })).toBe("exact-job"); expect(scenarioJobId({ id: "submission-only" })).toBeNull(); });
});
