import type { DriverReportJob, ReportSummary } from "../driverReport.types";

/** Compare like-for-like receipts in integer pence. Invoices are not receipts. */
export function receiptDifference(job: DriverReportJob): number | null {
  const system = job.finance.systemPayments.collectedPence;
  const driver = job.manualDetails ? job.finance.manualPayments?.collectedPence : null;
  return system == null || driver == null || !Number.isFinite(system) || !Number.isFinite(driver) ? null : system - driver;
}

export function reconciliationStatus(job: DriverReportJob): "missing" | "unverified" | "difference" | "match" {
  if (!job.manualDetails) return "missing";
  const difference = receiptDifference(job);
  const systemStart = Date.parse(job.actualStart || ""), driverStart = Date.parse(job.manualDetails.startTime);
  const systemFinish = Date.parse(job.actualFinish || ""), driverFinish = Date.parse(job.manualDetails.endTime);
  const startKnown = Number.isFinite(systemStart) && Number.isFinite(driverStart);
  const finishKnown = Number.isFinite(systemFinish) && Number.isFinite(driverFinish);
  const timingDifference = job.duration.differenceMinutes;
  const knownDifference = difference !== null && difference !== 0 || job.finance.paymentMethodDifferences.length > 0 ||
    timingDifference !== null && Number.isFinite(timingDifference) && Math.abs(timingDifference) > .01 ||
    startKnown && systemStart !== driverStart || finishKnown && systemFinish !== driverFinish ||
    (job.roadCharges?.flags.length ?? 0) > 0;
  if (knownDifference) return "difference";
  if (difference === null || !startKnown || !finishKnown ||
    job.duration.workingMinutes == null || !Number.isFinite(job.duration.workingMinutes) ||
    job.duration.manualMinutes == null || !Number.isFinite(job.duration.manualMinutes) ||
    timingDifference == null || !Number.isFinite(timingDifference)) return "unverified";
  return "match";
}

export function reportDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not recorded";
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 ? "−" : ""}${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

export function receiptCoverage(summary: ReportSummary) {
  const missing = summary.unknownSystemCollectionJobs;
  const known = Math.max(0, summary.completedJobs - missing);
  return { missing, known, total: summary.completedJobs, allMissing: summary.completedJobs > 0 && known === 0 };
}
