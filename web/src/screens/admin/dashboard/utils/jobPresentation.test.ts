import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types";
import {
  jobAttentionReasons,
  jobCharge,
  jobEvidenceLabel,
  jobMoney,
  jobPaymentLabel,
  operationalDuration,
} from "./jobPresentation";

describe("Job money, time and independent statuses", () => {
  it("keeps absent money unknown while formatting an explicitly recorded zero", () => {
    expect(jobMoney(undefined)).toBe("Not recorded");
    expect(jobMoney(null)).toBe("Not recorded");
    expect(jobMoney(NaN)).toBe("Not recorded");
    expect(jobMoney(0)).toBe("£0.00");
    expect(
      jobCharge({ amountCharged: 0, totalCharges: 12000 } as NormalizedJob),
    ).toEqual({ amount: 0, basis: "Amount charged" });
  });
  it("does not turn calculated estimates into recorded charges", () => {
    expect(
      jobCharge({ calculatedTotalCharges: 12000 } as NormalizedJob).amount,
    ).toBeUndefined();
  });
  it("rounds operational durations once across an hour boundary and preserves unknown", () => {
    expect(operationalDuration(223.88)).toBe("3h 44m");
    expect(operationalDuration(59.9)).toBe("1h 0m");
    expect(operationalDuration(0)).toBe("0 min");
    expect(operationalDuration(-1)).toBe("Not recorded");
    expect(operationalDuration(undefined)).toBe("Not recorded");
  });
  it("does not infer payment or evidence completion from Completed status", () => {
    const job = {
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      evidenceCompleteness: { arrival: "MISSING" },
    } as NormalizedJob;
    expect(jobPaymentLabel(job)).toBe("Payment unpaid");
    expect(jobEvidenceLabel(job)).toBe("Evidence incomplete");
    expect(jobAttentionReasons(job)).toEqual([
      "Payment unpaid",
      "Driver submission missing",
      "Evidence incomplete",
    ]);
  });
  it("does not fabricate payment status or missing evidence from an incomplete list record", () => {
    const job = { status: "READY" } as NormalizedJob;
    expect(jobPaymentLabel(job)).toBe("Payment status not recorded");
    expect(jobEvidenceLabel(job)).toBe("Evidence completeness not recorded");
    expect(jobAttentionReasons(job)).toEqual([]);
  });
});
