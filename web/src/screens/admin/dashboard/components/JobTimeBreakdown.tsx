import React from "react";
import type { NormalizedJob } from "../types";

const sources = {
  calendar: "Calendar",
  settings: "Pricing Settings: overtime",
  "settings-crew-rate": "Pricing Settings: crew",
  "settings-packing-rate": "Pricing Settings: packing",
  unavailable: "Unavailable",
};
const duration = (minutes: unknown) =>
  typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0
    ? `${Number(minutes.toFixed(2))} min`
    : "Not recorded";
const money = (amount: unknown) =>
  typeof amount === "number" && Number.isFinite(amount)
    ? `GBP ${(amount / 100).toFixed(2)}`
    : "Unknown";

export function JobTimeBreakdown({ job }: { job: NormalizedJob }) {
  const billing = job.timeBilling;
  const rows = billing
    ? [
        ["Calendar scheduled time", duration(billing.scheduledMinutes)],
        ["Billing allocation", duration(billing.allocatedMinutes)],
        ["Recorded working time", duration(billing.actualMinutes)],
        ["Calculated overtime", duration(billing.extraMinutes)],
        [
          "Billed 30-minute blocks",
          typeof billing.billedExtraBlocks === "number" &&
          Number.isFinite(billing.billedExtraBlocks)
            ? String(billing.billedExtraBlocks)
            : "Not recorded",
        ],
        ["Rate per 30 minutes", money(billing.ratePer30Pence)],
        ["Rate source", sources[billing.rateSource] || "Not recorded"],
        ["Extra charge", money(billing.extraChargePence)],
      ]
    : [
        ["Calendar scheduled time", duration(job.bookedMinutes)],
        [
          "Recorded working time",
          job.actualMinutes === undefined
            ? "Not recorded"
            : duration(job.actualMinutes),
        ],
        ["Recorded extra charge", money(job.overtimeCharge)],
      ];
  if (job.driverReportedOvertimeMinutes != null)
    rows.push([
      "Driver-reported extra time",
      duration(job.driverReportedOvertimeMinutes),
    ]);
  return (
    <section
      className="border-y border-admin-line py-4"
      aria-label="Job time breakdown"
    >
      <h3 className="mb-3 text-[18px] font-semibold text-admin-ink">
        Time & billing basis
      </h3>
      {billing && (
        <p className="mb-4 text-[13px] text-admin-muted">
          Calendar scheduled time and billing allocation are separate values
          from the saved billing snapshot. Working time uses recorded arrival
          and finish events. Rule version: {billing.ruleVersion}.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[13px] text-admin-muted">{label}</dt>
            <dd className="mt-1 break-words text-[13px] font-semibold tabular-nums text-admin-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {(job.timeBillingIssue || !billing) && (
        <p className="mt-3 text-[12px] text-admin-muted">
          {job.timeBillingIssue ||
            (job.status === "COMPLETED"
              ? "Historical billing: saved charges retained."
              : "Calculation pending recorded arrival and finish times.")}
        </p>
      )}
    </section>
  );
}
