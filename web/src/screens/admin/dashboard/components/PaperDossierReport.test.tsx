import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobScenarioSection } from "./JobScenarioSection";
import { JobDetailDrawer } from "./JobDetailDrawer";
import { PaperDossierReport } from "./PaperDossierReport";
import { PaperJobReport } from "./PaperJobReport";
import type { JobScenarioSubmission, NormalizedJob } from "../types";
import { vi } from "vitest";
import { paperJobSample } from "../../../../../test/reportPreview.sample";

describe("Formal dossier print consistency", () => {
  it("retains matching preview/print information, full job references and first-page branding", () => {
    const preview = render(<PaperDossierReport job={paperJobSample} isPreview />);
    const printable = render(<PaperDossierReport job={paperJobSample} />);
    expect(preview.container.textContent).toBe(printable.container.textContent);
    expect(preview.container.querySelector(".report-record-meta")).toHaveTextContent(paperJobSample.jobId);
    expect(preview.container.querySelectorAll(".report-heading img")).toHaveLength(1);
    expect(printable.container.querySelectorAll(".report-page-footer")).toHaveLength(7);
  });
});

vi.mock("../../../../api/admin", () => ({
  fetchDrivers: vi.fn().mockResolvedValue([])
}));

vi.mock("../api", async importOriginal => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    reassignJob: vi.fn(),
    deleteEvidencePhoto: vi.fn(),
    markJobFinishedManually: vi.fn()
  };
});

// Synthetic contacts, addresses and coordinates; no operational customer data.
const checkinScenario: JobScenarioSubmission = {
  id: "scenario-1",
  kind: "checkin",
  timestamp: "2026-09-22T09:00:00.000Z",
  driver: "QA",
  clientName: "Sample Customer",
  clientPhone: "07700900101",
  clientEmail: "customer@example.test",
  containerNumber: "CONT-123",
  address: "",
  damageCategories: "",
  clientPresent: "Yes",
  rawRecord: {},
  photos: [
    {
      fileId: "scenario-photo-1",
      thumbUrl: "/scenario-photo.jpg",
      capturedAt: "2026-09-22T15:45:00.000Z",
      location: { lat: 51.5, lng: -0.1, accuracy: 12 },
      locationName: "10 Example Road, London"
    }
  ],
  signature: {
    fileId: "scenario-signature-1",
    thumbUrl: "/scenario-signature.jpg",
    capturedAt: "2026-09-22T15:47:00.000Z",
    location: { lat: 51.5001, lng: -0.1001, accuracy: 10 },
    locationName: "10 Example Road, London"
  }
};

const liabilityScenario: JobScenarioSubmission = {
  id: "scenario-liability",
  kind: "liability",
  timestamp: "2026-09-22T10:45:00.000Z",
  driver: "QA",
  clientName: "Sample Customer",
  clientPhone: "07700900101",
  clientEmail: "customer@example.test",
  containerNumber: "",
  address: "",
  damageCategories: "Wall mark",
  clientPresent: "Yes",
  rawRecord: {},
  photos: [
    {
      fileId: "liability-photo-1",
      thumbUrl: "/liability-photo.jpg",
      capturedAt: "2026-09-22T10:45:00.000Z",
      location: { lat: 51.5002, lng: -0.1002, accuracy: 14 },
      locationName: "Pickup address"
    }
  ],
  signature: null
};

const job = {
  jobId: "TMV-TEST123",
  calendarEventId: "calendar-1",
  bookedStart: "2026-09-22T10:00:00.000Z",
  bookedFinish: "2026-09-22T13:00:00.000Z",
  actualFinish: "2026-09-22T16:00:00.000Z",
  bookedMinutes: 180,
  delayMinutes: 0,
  delayBand: "ON_TIME",
  timingTrustworthy: true,
  customerName: "Sample Customer",
  customerEmail: "customer@example.test",
  customerPhone: "07700900101",
  pickup: "10 Example Road",
  dropoff: "20 Sample Street",
  crewSize: 2,
  driverInitials: "QA",
  driverName: "Sample Driver",
  status: "COMPLETED",
  currentState: "COMPLETED",
  workflowCompletionPct: 100,
  basePrice: 17500,
  extraChargeSelections: [],
  extraCharges: 0,
  congestionCharge: 0,
  tunnelCharge: 0,
  overtimeMinutes: 0,
  overtimeCharge: 0,
  calculatedTotalCharges: 17500,
  totalCharges: 17500,
  amountCharged: 17500,
  reconciled: true,
  paymentMethod: "Card",
  paymentStatus: "Paid",
  paidOnline: false,
  evidenceCompleteness: {
    arrival: "COMPLETED",
    vanLoaded: "MISSING",
    stopBy: "MISSING",
    emptyVan: "MISSING",
    organized: "MISSING",
    signature: "COMPLETED"
  },
  evidenceItems: [
    {
      id: "evidence-1",
      category: "Arrival",
      state: "COMPLETED",
      fileId: "arrival-file",
      thumbProxyUrl: "/arrival.jpg",
      provenance: "recorded",
      capturedAt: "2026-09-22T10:30:00.000Z",
      location: { lat: 51.5003, lng: -0.1003, accuracy: 20 },
      locationName: "London"
    }
  ],
  scenarios: [checkinScenario],
  rawTitle: "TMV test",
  rawDescription: "",
  bookingDetails: {},
  clientConfirmedName: "Sample Customer",
  signatureUrl: "/signature.jpg",
  activity: [],
  exceptions: [],
  created: "2026-09-22T09:00:00.000Z",
  updated: "2026-09-22T16:00:00.000Z"
} satisfies NormalizedJob;

describe("JobScenarioSection", () => {
  it("shows captured timestamp and location below scenario photos and signatures", () => {
    render(<JobScenarioSection scenarios={[checkinScenario]} />);

    expect(screen.getByText(/22 Sep 2026.*16:45/)).toBeInTheDocument();
    expect(screen.getAllByText("10 Example Road, London").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/22 Sep 2026.*16:47/)).toBeInTheDocument();
  });

  it("shows the checkpoint tag for job-linked scenario submissions", () => {
    render(<JobScenarioSection scenarios={[{
      ...checkinScenario,
      reportedAt: "Pickup — 10 Example Road",
      reportedAtPoint: "Pickup"
    }]} />);

    expect(screen.getByText("Pickup")).toBeInTheDocument();
  });
});

describe("PaperDossierReport", () => {
  it("uses one report title/contact header without repeating company branding and preserves report data", () => {
    const source = { ...job, pickup: "A full collection address with building and access details", dropoff: "A full delivery address with floor and entry details",
      scenarios: [checkinScenario, liabilityScenario] };
    const before = JSON.stringify(source);
    const { container } = render(<PaperDossierReport job={source} isPreview />);
    expect(screen.getAllByRole("heading", { name: "Job Completed" })).toHaveLength(1);
    expect(screen.getAllByText("020 3773 9113")).toHaveLength(1);
    expect(screen.queryByText("THE MAN VAN")).not.toBeInTheDocument();
    expect(screen.getByText(source.pickup)).toBeInTheDocument(); expect(screen.getByText(source.dropoff)).toBeInTheDocument();
    expect(screen.getAllByText("£175.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Arrival" })).toHaveAttribute("src", "/arrival.jpg");
    expect(container.querySelectorAll(".report-preview-page")).toHaveLength(4);
    expect(container.querySelectorAll(".report-document-continuation")).toHaveLength(0);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("prints evidence metadata and linked job scenario submissions", () => {
    render(<PaperDossierReport job={{
      ...job,
      scenarios: [{
        ...checkinScenario,
        reportedAt: "Pickup — 10 Example Road",
        reportedAtPoint: "Pickup"
      }]
    }} isPreview />);

    expect(screen.getByText(/22 Sep 2026.*11:30.*London/)).toBeInTheDocument();
    expect(screen.getByText("Check In (Pickup) Evidence")).toBeInTheDocument();
    expect(screen.getByText("CONT-123")).toBeInTheDocument();
    expect(screen.getByText("Reported At")).toBeInTheDocument();
    expect(screen.getByText("Pickup — 10 Example Road")).toBeInTheDocument();
    expect(screen.getByText(/22 Sep 2026.*16:45/)).toBeInTheDocument();
    expect(screen.getAllByText("10 Example Road, London").length).toBeGreaterThanOrEqual(1);
  });

  it("prints the driver's on-my-way timestamp in the job dossier preview", () => {
    render(<PaperDossierReport job={{
      ...job,
      onMyWayAt: "2026-09-22T09:45:00.000Z",
      clientSignatureAt: "2026-09-22T14:20:00.000Z",
      pickupArrivalAt: "2026-09-22T10:30:00.000Z",
      vanLoadedAt: "2026-09-22T10:48:00.000Z",
      actualFinish: "2026-09-22T16:00:00.000Z",
      trackerArrivalAt: "2026-09-22T10:12:00.000Z",
      arrivalProofDelayMinutes: 18,
      arrivalProofLate: true
    }} isPreview />);

    expect(screen.getByText("On my way")).toBeInTheDocument();
    expect(screen.getByText(/22 Sep 2026.*10:45/)).toBeInTheDocument();
    expect(screen.getByText("Customer signature time")).toBeInTheDocument();
    expect(screen.getAllByText(/22 Sep 2026.*15:20/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Proof of arrival photo time")).toBeInTheDocument();
    expect(screen.getByText("Van loaded photo time")).toBeInTheDocument();
    expect(screen.getByText("Empty van photo time")).toBeInTheDocument();
    expect(screen.getAllByText(/22 Sep 2026.*17:00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Gap between tracker arrival and proof photo")).toBeInTheDocument();
    expect(screen.getByText("18 min")).toBeInTheDocument();
  });

  it("prints the adjustment reason when amount charged mismatches total charges", () => {
    render(<PaperDossierReport job={{
      ...job,
      totalCharges: 70600,
      amountCharged: 60000,
      reconciled: false,
      totalAdjustmentNote: "Customer agreed discount with office"
    }} isPreview />);

    expect(screen.getByText("Adjustment Reason")).toBeInTheDocument();
    expect(screen.getByText("Customer agreed discount with office")).toBeInTheDocument();
  });

  it("prints evidence and scenario submissions in the order the driver submitted them", () => {
    const jobWithMidFlowLiability: NormalizedJob = {
      ...job,
      evidenceItems: [
        job.evidenceItems[0],
        {
          id: "evidence-van-loaded",
          category: "VanLoaded",
          state: "COMPLETED",
          fileId: "van-loaded-file",
          thumbProxyUrl: "/van-loaded.jpg",
          provenance: "recorded",
          capturedAt: "2026-09-22T11:15:00.000Z",
          location: { lat: 51.5004, lng: -0.1004, accuracy: 16 },
          locationName: "Loaded address"
        }
      ],
      scenarios: [liabilityScenario]
    };

    render(<PaperDossierReport job={jobWithMidFlowLiability} isPreview />);

    const arrival = screen.getByText("Arrival");
    const liability = screen.getByText("Liability Report Evidence");
    const vanLoaded = screen.getByText("VanLoaded");

    expect(arrival.compareDocumentPosition(liability) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(liability.compareDocumentPosition(vanLoaded) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("PaperJobReport", () => {
  it("has one completion heading and no repeated brand logo across evidence and final pages", () => {
    render(<PaperJobReport job={job} />);
    expect(screen.getAllByRole("heading", { name: "Job Completed" })).toHaveLength(1);
    expect(screen.queryByRole("img", { name: "The Man Van" })).not.toBeInTheDocument();
    expect(screen.getByText(job.customerEmail)).toBeInTheDocument();
    expect(screen.getAllByText("020 3773 9113")).toHaveLength(1);
  });
  it("prints the driver's on-my-way timestamp in the finished job preview", () => {
    render(<PaperJobReport job={{
      ...job,
      onMyWayAt: "2026-09-22T09:45:00.000Z",
      clientSignatureAt: "2026-09-22T14:20:00.000Z",
      pickupArrivalAt: "2026-09-22T10:30:00.000Z",
      vanLoadedAt: "2026-09-22T10:48:00.000Z",
      actualFinish: "2026-09-22T16:00:00.000Z",
      trackerArrivalAt: "2026-09-22T10:12:00.000Z",
      arrivalProofDelayMinutes: 18,
      arrivalProofLate: true
    }} />);

    expect(screen.getByText("On my way")).toBeInTheDocument();
    expect(screen.getByText(/22 Sep 2026.*10:45/)).toBeInTheDocument();
    expect(screen.getByText("Customer signature time")).toBeInTheDocument();
    expect(screen.getAllByText(/22 Sep 2026.*15:20/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Proof of arrival photo time")).toBeInTheDocument();
    expect(screen.getByText("Van loaded photo time")).toBeInTheDocument();
    expect(screen.getByText("Empty van photo time")).toBeInTheDocument();
    expect(screen.getAllByText(/22 Sep 2026.*17:00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Gap between tracker arrival and proof photo")).toBeInTheDocument();
    expect(screen.getByText("18 min")).toBeInTheDocument();
  });
});

describe("JobDetailDrawer", () => {
  it("shows the driver's on-my-way timestamp in active job details", () => {
    render(
      <JobDetailDrawer
        job={{
          ...job,
          onMyWayAt: "2026-09-22T09:45:00.000Z",
          clientSignatureAt: "2026-09-22T14:20:00.000Z",
          pickupArrivalAt: "2026-09-22T10:30:00.000Z",
          vanLoadedAt: "2026-09-22T10:48:00.000Z",
          trackerArrivalAt: "2026-09-22T10:12:00.000Z",
          arrivalProofDelayMinutes: 18,
          arrivalProofLate: true
        }}
        isOpen
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Timeline & evidence" }));
    expect(screen.getByText("On the way")).toBeInTheDocument();
    expect(screen.getByText(/22 Sep 2026.*10:45/)).toBeInTheDocument();
    expect(screen.getByText("Customer signature")).toBeInTheDocument();
    expect(screen.getByText(/22 Sep 2026.*15:20/)).toBeInTheDocument();
    expect(screen.getByText("Arrival proof accepted")).toBeInTheDocument();
    expect(screen.getByText("Van loaded proof")).toBeInTheDocument();
    expect(screen.getByText("Job finish")).toBeInTheDocument();
    expect(screen.getByText("Arrival-to-proof gap: 18 min.")).toBeInTheDocument();
  });
});
