import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailDrawer } from "./JobDetailDrawer";
import type { NormalizedJob } from "../types";

vi.mock("../api", () => ({
  reassignJob: vi.fn(),
  deleteEvidencePhoto: vi.fn(),
  markJobFinishedManually: vi.fn(),
}));
vi.mock("./PdfPreviewModal", () => ({ PdfPreviewModal: () => null }));
const job = {
  jobId: "JOB-EXAMPLE",
  customerName: "Example customer",
  driverName: "Example driver",
  status: "COMPLETED",
  bookedStart: "2026-10-13T09:00:00Z",
  bookedFinish: "2026-10-13T10:30:00Z",
  bookedMinutes: 90,
  amountCharged: 0,
  totalCharges: 12000,
  pickup: "Reading",
  dropoff: "London",
  rawTitle: "2 men 115£/Y-TI",
  paymentStatus: "UNPAID",
  driverViewedAt: "2026-10-13T08:00:00Z",
  evidenceCompleteness: {
    arrival: "COMPLETED",
    vanLoaded: "COMPLETED",
    stopBy: "COMPLETED",
    emptyVan: "COMPLETED",
    organized: "COMPLETED",
    signature: "MISSING",
  },
  evidenceItems: [],
  scenarios: [],
  activity: [],
  bookingDetails: {},
} as unknown as NormalizedJob;

describe("Canonical job detail", () => {
  it("keeps operational completion separate from payment, submission, evidence and viewed status", () => {
    render(<JobDetailDrawer job={job} isOpen onClose={() => {}} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Payment unpaid")).toBeInTheDocument();
    expect(
      screen.getByText("Driver submission not recorded"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Evidence incomplete" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Viewed 13/)).toBeInTheDocument();
    expect(screen.queryByText("Sent (SMS)")).not.toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument();
  });
  it("progressively reveals the original title and evidence from the same record", () => {
    render(<JobDetailDrawer job={job} isOpen onClose={() => {}} />);
    expect(
      screen.getByText(job.rawTitle).closest("details"),
    ).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("tab", { name: "Timeline & evidence" }));
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getAllByText("Customer signature")[0],
    ).toBeInTheDocument();
    expect(within(panel).getAllByText("Not recorded").length).toBeGreaterThan(
      0,
    );
    expect(within(panel).getByText(/Arrival unverified/)).toBeInTheDocument();
    expect(
      within(panel).getAllByText("Calendar schedule")[0],
    ).toBeInTheDocument();
  });
  it("keeps absent driver receipts unknown instead of presenting a measured zero", () => {
    render(<JobDetailDrawer job={job} isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Charges & payment" }));
    expect(screen.getByText(/No driver submission recorded/)).toHaveTextContent(
      "reconciliation differences are unknown",
    );
    expect(
      screen.queryByText("Driver-reported receipts"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Recorded total charge")).toBeInTheDocument();
  });
  it("uses keyboard tabs, traps focus, closes on Escape and restores the opener", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Inspect record</button>
          {open && (
            <JobDetailDrawer job={job} isOpen onClose={() => setOpen(false)} />
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Inspect record" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Copy job reference" }),
    ).toHaveFocus();
    const details = screen.getByRole("tab", { name: "Details" });
    details.focus();
    fireEvent.keyDown(details, { key: "ArrowRight" });
    expect(
      screen.getByRole("tab", { name: "Timeline & evidence" }),
    ).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  it("opens evidence with a keyboard button and closes only the top preview on Escape", () => {
    const evidenceJob = {
      ...job,
      evidenceItems: [
        {
          id: "sample-photo",
          category: "Arrival",
          state: "COMPLETED",
          thumbProxyUrl: "/sanitized-arrival.png",
          provenance: "recorded",
        },
      ],
    } as NormalizedJob;
    const close = vi.fn();
    render(<JobDetailDrawer job={evidenceJob} isOpen onClose={close} />);
    fireEvent.click(screen.getByRole("tab", { name: "Timeline & evidence" }));
    const previewButton = screen.getByRole("button", {
      name: "View Arrival photo",
    });
    previewButton.focus();
    fireEvent.click(previewButton);
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    const photo = screen.getByRole("dialog", { name: "JOB-EXAMPLE - Arrival" });
    expect(photo).toHaveFocus();
    fireEvent.error(within(photo).getByRole("img", { hidden: true }));
    expect(
      within(photo).getByText("Evidence preview could not be loaded."),
    ).toBeInTheDocument();
    expect(
      within(photo).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
    expect(previewButton).toHaveFocus();
  });
  it("restores page scrolling when unmounted with a nested photo preview still open", () => {
    const before = document.body.style.overflow;
    const evidenceJob = { ...job, signatureUrl: "/sanitized-signature.png" };
    const rendered = render(
      <JobDetailDrawer job={evidenceJob} isOpen onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Timeline & evidence" }));
    fireEvent.click(
      screen.getByRole("button", { name: "View customer signature" }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    expect(document.body.style.overflow).toBe("hidden");
    rendered.unmount();
    expect(document.body.style.overflow).toBe(before);
  });
});
