import type { NormalizedJob } from "../types";

/** Amounts remain integer pence; absent values must never become a known zero. */
export function jobMoney(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(value / 100)
    : "Not recorded";
}

export function operationalDuration(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "Not recorded";
  const minutes = Math.round(value);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes} min`;
}

export function jobCharge(job: NormalizedJob): {
  amount: number | undefined;
  basis: string;
} {
  if (
    typeof job.amountCharged === "number" &&
    Number.isFinite(job.amountCharged)
  )
    return { amount: job.amountCharged, basis: "Amount charged" };
  if (typeof job.totalCharges === "number" && Number.isFinite(job.totalCharges))
    return { amount: job.totalCharges, basis: "Recorded total charge" };
  return { amount: undefined, basis: "Charge not recorded" };
}

export function jobPaymentLabel(job: NormalizedJob): string {
  const status = job.paymentStatus?.trim().toUpperCase();
  if (status === "PAID") return "Payment marked paid";
  if (status === "UNPAID") return "Payment unpaid";
  if (status === "PENDING") return "Payment pending";
  if (status === "PARTIAL" || status === "PARTIALLY_PAID")
    return "Payment partially paid";
  return job.paymentStatus
    ? `Payment: ${job.paymentStatus}`
    : "Payment status not recorded";
}

export function jobEvidenceLabel(job: NormalizedJob): string {
  if (!job.evidenceCompleteness) return "Evidence completeness not recorded";
  const states = Object.values(job.evidenceCompleteness);
  if (!states.length) return "Evidence completeness not recorded";
  if (states.some((state) => state === "FAILED"))
    return "Evidence upload failed";
  if (states.some((state) => state === "MISSING")) return "Evidence incomplete";
  if (states.some((state) => state === "PROCESSING"))
    return "Evidence processing";
  return states.length === 6 && states.every((state) => state === "COMPLETED")
    ? "Evidence complete"
    : "Evidence completeness not recorded";
}

export function jobAttentionReasons(job: NormalizedJob): string[] {
  const reasons: string[] = [];
  if (
    ["UNPAID", "PENDING", "PARTIAL", "PARTIALLY_PAID"].includes(
      job.paymentStatus?.toUpperCase(),
    )
  )
    reasons.push(jobPaymentLabel(job));
  if (job.status === "COMPLETED") {
    if (!job.driverJobSummary) reasons.push("Driver submission missing");
    const evidence = jobEvidenceLabel(job);
    if (["Evidence incomplete", "Evidence upload failed"].includes(evidence))
      reasons.push(evidence);
  }
  if (job.arrivalProofOverdue) reasons.push("Arrival proof overdue");
  if (job.exceptions?.length && !reasons.length)
    reasons.push(job.exceptions[0].detail || job.exceptions[0].type);
  return reasons;
}
