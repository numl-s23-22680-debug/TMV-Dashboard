import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types";
import { PaperDossierReport } from "./PaperDossierReport";

const source = {
  jobId: "SANITIZED-EXPORT",
  customerName: "Example customer",
  driverName: "Example driver",
  driverInitials: "EX",
  status: "COMPLETED",
  bookedStart: "2026-10-13T09:00:00Z",
  bookedFinish: "2026-10-13T10:30:00Z",
  actualFinish: "2026-10-13T10:20:00Z",
  bookedMinutes: 90,
  pickup: "Example pickup",
  dropoff: "Example drop-off",
  evidenceItems: [],
  scenarios: [],
  bookingDetails: {},
  paymentStatus: "UNPAID",
} as unknown as NormalizedJob;

describe("Current job export honesty", () => {
  it("does not replace missing money or signature time with zero or the job finish", () => {
    render(<PaperDossierReport job={source} isPreview />);
    expect(screen.queryByText("£0.00")).not.toBeInTheDocument();
    expect(screen.getByText(/Signed: Not recorded/)).toBeInTheDocument();
    expect(
      screen.getByText(/Scope: this job · Europe\/London/),
    ).toHaveTextContent("Payment unpaid");
    expect(screen.getByText(/Scope: this job/)).toHaveTextContent(
      "Stored charges do not establish receipts",
    );
  });
  it("preserves explicitly known zero charges and never titles an active job completed", () => {
    render(
      <PaperDossierReport
        job={{
          ...source,
          status: "READY",
          amountCharged: 0,
          totalCharges: 0,
          basePrice: 0,
          extraCharges: 0,
          overtimeCharge: 0,
        }}
        isPreview
      />,
    );
    expect(screen.getAllByText("£0.00").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Job details" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Job Completed" }),
    ).not.toBeInTheDocument();
  });
});
