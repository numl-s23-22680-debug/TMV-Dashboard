import { withArrivalDistance } from "../../../../lib/trackerArrival";
import React, { useState, useEffect } from "react";
import {
  X,
  Camera,
  Copy,
  Check,
  Download,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { NormalizedJob } from "../types";
import { useDialogFocus } from "../../../../ui/useDialogFocus";
import { formatLondonDateTime } from "../utils/date";
import { htmlToPlainText } from "../../../../lib/htmlText";
import { RawBookingText } from "../../../../components/driver/RawBookingText";
import { JobScenarioSection } from "./JobScenarioSection";
import { JobTimeBreakdown } from "./JobTimeBreakdown";
import {
  jobCharge,
  jobEvidenceLabel,
  jobMoney,
  jobPaymentLabel,
  operationalDuration,
} from "../utils/jobPresentation";
import {
  fetchDrivers as fetchDriverRoster,
  type AdminDriver,
} from "../../../../api/admin";
import { JobStatusBadge } from "./StatusBadge";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { waitForPrintImages } from "../utils/printReady";
import { PhotoModal } from "./PhotoModal";
import { ReportReturnButton } from "./ReportReturnButton";
import { ThumbnailPreview } from "./ThumbnailPreview";
import { resolveDriver, formatVanReg, getAvatarColor } from "../utils/drivers";
import {
  reassignJob,
  deleteEvidencePhoto,
  markJobFinishedManually,
} from "../api";
import {
  formatCapturedTime,
  formatLocationLabel,
  mapsUrlForLocation,
} from "../../../../lib/geo";

interface Props {
  job: NormalizedJob;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful reassign so the page behind the drawer (its own jobs
   * list query) can refetch -- this drawer only owns its own local `job` state. */
  onUpdated?: () => void;
}

export function JobDetailDrawer({
  job: initialJob,
  isOpen,
  onClose,
  onUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState("details");
  const [manualFinishError, setManualFinishError] = useState<string | null>(
    null,
  );
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [job, setJob] = useState<NormalizedJob>(initialJob);
  const [copiedId, setCopiedId] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{
    title: string;
    url: string;
    driveUrl?: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [manualFinishOpen, setManualFinishOpen] = useState(false);
  const [manualFinishNote, setManualFinishNote] = useState("");
  const [manualFinishing, setManualFinishing] = useState(false);

  // Reassign Mode State -- real roster (not utils/drivers.ts's old localStorage mock)
  // and a real backend call, see handleReassign below.
  const [isReassigning, setIsReassigning] = useState(false);
  const [roster, setRoster] = useState<AdminDriver[]>([]);
  const [reassigning, setReassigning] = useState(false);

  // The Reassign dropdown only ever needs the roster (initials/fullName/vanReg) --
  // it used to pull this from /api/admin/drivers/summary, which also computes every
  // driver's per-job performance stats via the same full-dataset rebuild that made
  // the Jobs list slow before pagination (see jobs.repo.ts's listJobsPage). That
  // dataset build was the entire reason opening Reassign felt slow; the lightweight
  // /api/admin/drivers (just the roster, no stats) is what DriversPage's Add/Edit
  // Driver modal already uses for the same reason.
  function loadRoster() {
    setRosterError(null);
    setRosterLoading(true);
    fetchDriverRoster()
      .then((list) => setRoster(list.filter((d) => d.active)))
      .catch((error: Error) =>
        setRosterError(error.message || "Drivers could not be loaded."),
      )
      .finally(() => setRosterLoading(false));
  }
  useEffect(() => {
    if (isReassigning && !roster.length) loadRoster();
  }, [isReassigning]);

  // PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setJob(initialJob);
    setIsReassigning(false);
    setActiveTab("details");
  }, [initialJob]);

  const dialogRef = useDialogFocus(isOpen, () => {
    if (isReassigning) setIsReassigning(false);
    else onClose();
  });
  const manualDialogRef = useDialogFocus(
    isOpen && manualFinishOpen,
    () => setManualFinishOpen(false),
    !manualFinishing,
  );

  if (!isOpen) return null;

  const handleCopyJobId = async () => {
    try {
      await navigator.clipboard.writeText(job.jobId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast(
        "Job ID could not be copied. Select the reference to copy manually.",
      );
    }
  };

  const handlePdfDownload = () => {
    setIsPreviewOpen(true);
  };

  const handleActualDownload = () => {
    setIsGeneratingPdf(true);
    document.body.classList.add("printing-report");
    setTimeout(async () => {
      await waitForPrintImages("#tmv-print-portal, .print-content");
      window.print();
      document.body.classList.remove("printing-report");
      setIsPreviewOpen(false);
      setIsGeneratingPdf(false);
      showToast(
        `Print preview prepared for ${job.jobId}. Choose Save as PDF to export.`,
      );
    }, 400);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReassign = async (driverInitials: string) => {
    if (reassigning) return;
    setReassigning(true);
    try {
      const result = await reassignJob(job.jobId, driverInitials);
      setJob({
        ...job,
        driverName: result.driverName,
        driverInitials: result.driverInitials,
      });
      setIsReassigning(false);
      showToast(`Reassigned to ${result.driverName}`);
      onUpdated?.();
    } catch (error: any) {
      showToast(error?.message || "Couldn't reassign this job. Try again.");
    } finally {
      setReassigning(false);
    }
  };

  // Purely our own storage (Mongo + Cloudinary), no Calendar involved -- unlike
  // Reassign/Delete there's no permission dance, just a confirm and a plain delete.
  const handleDeleteEvidence = async (evidenceId: string) => {
    if (deletingPhotoId) return;
    if (!window.confirm("Delete this photo? This can't be undone.")) return;
    setDeletingPhotoId(evidenceId);
    try {
      await deleteEvidencePhoto(job.jobId, evidenceId);
      setJob({
        ...job,
        evidenceItems: job.evidenceItems.filter((e) => e.id !== evidenceId),
      });
      showToast("Photo deleted");
      onUpdated?.();
    } catch (error: any) {
      showToast(error?.message || "Couldn't delete photo. Try again.");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const canManualFinish =
    job.status !== "COMPLETED" && job.status !== "CANCELLED";
  const handleManualFinish = async () => {
    const note = manualFinishNote.trim();
    if (!note || manualFinishing) return;
    setManualFinishing(true);
    setManualFinishError(null);
    try {
      const result = await markJobFinishedManually(job.jobId, note);
      setJob(result.job);
      setManualFinishOpen(false);
      setManualFinishNote("");
      showToast("Job marked as finished");
      onUpdated?.();
    } catch (error: any) {
      setManualFinishError(
        error?.message || "Couldn't mark this job as completed.",
      );
    } finally {
      setManualFinishing(false);
    }
  };

  const charge = jobCharge(job);
  const tabs = [
    ["details", "Details"],
    ["timeline", "Timeline & evidence"],
    ["charges", "Charges & payment"],
    ["activity", "Activity"],
  ];
  const missingEvidence = job.evidenceCompleteness
    ? Object.entries(job.evidenceCompleteness).filter(
        ([, state]) => state !== "COMPLETED",
      )
    : [];
  const timeline = [
    ["Scheduled start", job.bookedStart, "Calendar schedule"],
    ["Scheduled finish", job.bookedFinish, "Calendar schedule"],
    ["On the way", job.onMyWayAt, "Driver action"],
    ["Tracker-observed arrival", job.trackerArrivalAt, "GPS observation"],
    [
      "Arrival proof accepted",
      job.pickupArrivalAt || job.actualStart,
      "Accepted arrival evidence",
    ],
    ["Van loaded proof", job.vanLoadedAt, "Driver evidence"],
    ["Job finish", job.actualFinish, "Recorded workflow finish"],
    ["Customer signature", job.clientSignatureAt, "Recorded signature"],
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-admin-ink/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-admin-ink text-white px-5 py-3 rounded-card shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-admin-status-green" />
          <span className="text-[14px] font-semibold">{toast}</span>
        </div>
      )}

      {/* Backdrop click to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-module border border-admin-line bg-white shadow-2xl outline-none"
      >
        <header className="border-b border-admin-line bg-white px-4 py-4 sm:px-6">
          <ReportReturnButton compact />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[12px] font-medium text-admin-muted">
                Job details
              </p>
              <h2
                id="job-detail-title"
                className="break-words text-[24px] font-semibold tracking-tight text-admin-ink"
              >
                {job.customerName || "Customer not recorded"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-admin-muted">
                <span className="break-all">{job.jobId}</span>
                <button
                  onClick={handleCopyJobId}
                  aria-label="Copy job reference"
                  title="Copy job reference"
                  className="flex h-8 w-8 items-center justify-center rounded-control hover:bg-admin-surface"
                >
                  {copiedId ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <JobStatusBadge status={job.status} />
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close job details"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-admin-line text-admin-muted hover:bg-admin-surface"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-admin-muted">Scheduled (London)</dt>
              <dd className="mt-1 font-medium">
                {job.bookedStart
                  ? formatLondonDateTime(job.bookedStart)
                  : "Not scheduled"}
              </dd>
            </div>
            <div>
              <dt className="text-admin-muted">Assigned driver</dt>
              <dd className="mt-1 font-medium">
                {job.driverName || "Unassigned"}
                {job.driverInitials ? ` (${job.driverInitials})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-admin-muted">{charge.basis}</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {jobMoney(charge.amount)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <span className="rounded-control border border-admin-line bg-admin-surface px-2 py-1">
              {jobPaymentLabel(job)}
            </span>
            <button
              onClick={() => setActiveTab("timeline")}
              className="rounded-control border border-admin-line bg-admin-surface px-2 py-1"
            >
              {jobEvidenceLabel(job)}
            </button>
            <span className="rounded-control border border-admin-line bg-admin-surface px-2 py-1">
              {job.driverJobSummary
                ? "Driver submission recorded"
                : "Driver submission not recorded"}
            </span>
          </div>
        </header>
        <div
          role="tablist"
          aria-label="Job detail sections"
          className="flex shrink-0 flex-wrap gap-1 border-b border-admin-line bg-white px-3 sm:px-5"
        >
          {tabs.map(([id, label], index) => (
            <button
              key={id}
              role="tab"
              id={`job-tab-${id}`}
              aria-controls={`job-panel-${id}`}
              aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (index +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          tabs.length) %
                        tabs.length;
                setActiveTab(tabs[next][0]);
                document.getElementById(`job-tab-${tabs[next][0]}`)?.focus();
              }}
              className={`min-h-11 border-b-2 px-3 text-[13px] font-medium ${activeTab === id ? "border-admin-brand text-admin-brand" : "border-transparent text-admin-muted hover:text-admin-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-admin-surface/50 p-4 text-[14px] text-admin-ink sm:p-6">
          <div
            role="tabpanel"
            id={`job-panel-${activeTab}`}
            aria-labelledby={`job-tab-${activeTab}`}
            className="space-y-5"
          >
            {activeTab === "details" && (
              <>
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">Route & service</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-[13px] text-admin-muted">Pickup</dt>
                      <dd className="mt-1 break-words font-medium">
                        {job.pickup || "Not recorded"}
                        {job.floorFrom && (
                          <span className="block text-[13px] text-admin-muted">
                            Floor: {job.floorFrom}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-admin-muted">Drop-off</dt>
                      <dd className="mt-1 break-words font-medium">
                        {job.dropoff || "Not recorded"}
                        {job.floorTo && (
                          <span className="block text-[13px] text-admin-muted">
                            Floor: {job.floorTo}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-admin-muted">Crew</dt>
                      <dd className="mt-1 font-medium">
                        {job.crewSize
                          ? `${job.crewSize} people`
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-admin-muted">
                        Calendar scheduled time
                      </dt>
                      <dd className="mt-1 font-medium">
                        {operationalDuration(
                          job.timeBilling?.scheduledMinutes ??
                            job.bookedMinutes,
                        )}
                      </dd>
                    </div>
                    {job.bookingDetails?.vanSize && (
                      <div>
                        <dt className="text-[13px] text-admin-muted">
                          Van size
                        </dt>
                        <dd className="mt-1">{job.bookingDetails.vanSize}</dd>
                      </div>
                    )}
                    {job.bookingDetails?.hireDuration && (
                      <div>
                        <dt className="text-[13px] text-admin-muted">
                          Booked service description
                        </dt>
                        <dd className="mt-1">
                          {job.bookingDetails.hireDuration}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">
                    Customer & driver
                  </h3>
                  <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-[13px] text-admin-muted">
                        Customer contact
                      </dt>
                      <dd className="mt-1 break-words">
                        {job.customerEmail || "Email not recorded"}
                        <br />
                        {job.customerPhone || "Phone not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-admin-muted">
                        Driver viewed status
                      </dt>
                      <dd className="mt-1">
                        {job.driverViewedAt
                          ? `Viewed ${formatLondonDateTime(job.driverViewedAt)}`
                          : "No driver view recorded"}
                      </dd>
                      <p className="mt-1 text-[12px] text-admin-muted">
                        A job view records app interaction. Assignment
                        acceptance and message read status are separate.
                      </p>
                    </div>
                  </dl>
                </section>
                {(job.bookingDetails?.notes ||
                  job.bookingDetails?.inventory) && (
                  <section className="rounded-card border border-admin-line bg-white p-4">
                    <h3 className="text-[18px] font-semibold">Booking notes</h3>
                    {job.bookingDetails.notes && (
                      <p className="mt-3 whitespace-pre-wrap break-words">
                        {job.bookingDetails.notes}
                      </p>
                    )}
                    {job.bookingDetails.inventory && (
                      <p className="mt-3 whitespace-pre-wrap break-words">
                        Inventory: {job.bookingDetails.inventory}
                      </p>
                    )}
                  </section>
                )}
                <details className="rounded-card border border-admin-line bg-white p-4">
                  <summary className="cursor-pointer font-semibold">
                    Original imported booking
                  </summary>
                  <p className="mt-3 text-[13px] text-admin-muted">
                    Calendar title as imported
                  </p>
                  <p className="mt-1 break-words">
                    {job.rawTitle || "Not recorded"}
                  </p>
                  {job.rawDescription && (
                    <div className="mt-4 border-t border-admin-line pt-4">
                      <RawBookingText
                        text={htmlToPlainText(job.rawDescription)}
                      />
                    </div>
                  )}
                </details>
              </>
            )}
            {activeTab === "timeline" && (
              <>
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">Timeline</h3>
                  <p className="mt-1 text-[13px] text-admin-muted">
                    London time · scheduled, driver evidence and tracker
                    observations have separate sources.
                  </p>
                  <dl className="mt-3 divide-y divide-admin-line">
                    {timeline.map(([label, timestamp, basis]) => (
                      <div
                        key={label}
                        className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr]"
                      >
                        <dt>
                          <span className="font-medium">{label}</span>
                          <span className="mt-0.5 block text-[12px] text-admin-muted">
                            {basis}
                          </span>
                        </dt>
                        <dd className="tabular-nums sm:text-right">
                          {timestamp
                            ? label === "Tracker-observed arrival"
                              ? withArrivalDistance(
                                  formatLondonDateTime(timestamp),
                                  job.trackerArrivalDistanceMeters,
                                )
                              : formatLondonDateTime(timestamp)
                            : "Not recorded"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!job.trackerArrivalAt && (
                    <p className="mt-3 rounded-control border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                      Arrival unverified
                      {job.trackerUnverifiedReason
                        ? `: ${job.trackerUnverifiedReason}`
                        : ": no tracker-observed arrival recorded."}
                    </p>
                  )}
                  {job.arrivalDelaySource && (
                    <p className="mt-3 text-[13px] text-admin-muted">
                      Punctuality source:{" "}
                      {job.arrivalDelaySource === "gps-two-fresh-reports"
                        ? "two fresh GPS reports"
                        : job.arrivalDelaySource === "proof-acceptance"
                          ? "proof acceptance (not a verified GPS arrival)"
                          : "unavailable"}
                      .
                    </p>
                  )}
                  {(job.arrivalProofLate || job.arrivalProofOverdue) && (
                    <p className="mt-2 text-[13px] text-amber-800">
                      {job.arrivalProofOverdue
                        ? "Arrival proof overdue"
                        : "Arrival-to-proof gap"}
                      :{" "}
                      {typeof job.arrivalProofDelayMinutes === "number"
                        ? `${job.arrivalProofDelayMinutes} min`
                        : "duration not recorded"}
                      .
                    </p>
                  )}
                </section>
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">Evidence status</h3>
                  <p className="mt-2 font-medium">{jobEvidenceLabel(job)}</p>
                  {missingEvidence.length > 0 && (
                    <ul className="mt-3 space-y-2 text-[13px]">
                      {missingEvidence.map(([key, state]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>
                            {(
                              {
                                arrival: "Arrival photo",
                                vanLoaded: "Van loaded photo",
                                stopBy: "Stop-by photo",
                                emptyVan: "Empty van photo",
                                organized: "Organized van photo",
                                signature: "Customer signature",
                              } as Record<string, string>
                            )[key] || key}
                          </span>
                          <span className="text-admin-muted">
                            {state === "MISSING"
                              ? "Not recorded"
                              : state === "PROCESSING"
                                ? "Processing"
                                : "Upload failed"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-[12px] text-admin-muted">
                    Job completion, evidence completeness and review are
                    independent.
                  </p>
                </section>
                {/* Photographic Evidence Grid */}
                <div className="bg-white p-5 rounded-module border border-admin-line shadow-[0_2px_10px_rgb(0,0,0,0.02)] space-y-4">
                  <h4 className="text-[12px] font-bold text-admin-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-admin-brand" /> Evidence
                    Photographs
                  </h4>

                  {job.evidenceItems?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {job.evidenceItems.map((ev, i) => {
                        const thumbUrl = ev.thumbProxyUrl || ev.driveUrl;
                        const fullUrl = ev.driveUrl || ev.thumbProxyUrl;
                        const capturedTime = ev.capturedAt
                          ? formatCapturedTime(ev.capturedAt)
                          : "";
                        const fallbackTime =
                          !capturedTime && (ev.receivedAt || ev.completedAt)
                            ? formatLondonDateTime(
                                ev.receivedAt || ev.completedAt,
                              )
                            : "";
                        // Signature (lives on job.signatureUrl, not the evidence collection)
                        // and Documents (scenario submission photos) don't have a real
                        // evidence.repo.ts row behind their synthetic id -- only the four
                        // step categories below do, so only those get a delete button.
                        const isDeletable =
                          ev.category !== "Signature" &&
                          ev.category !== "Documents";
                        return (
                          <div key={ev.id || i} className="space-y-1">
                            <div className="relative group/photo">
                              <ThumbnailPreview
                                src={thumbUrl}
                                alt={`${ev.category} photo`}
                                category={ev.category}
                                state={ev.state}
                                size="full"
                                onClick={() => {
                                  if (fullUrl) {
                                    setActivePhoto({
                                      title: `${job.jobId} - ${ev.category}`,
                                      url: fullUrl,
                                      driveUrl: ev.driveUrl,
                                    });
                                  }
                                }}
                              />
                              {isDeletable && ev.state === "COMPLETED" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEvidence(ev.id);
                                  }}
                                  disabled={deletingPhotoId === ev.id}
                                  title="Delete photo"
                                  aria-label={`Delete ${ev.category} photo`}
                                  className="absolute top-1 right-1 z-10 p-1 rounded-full bg-white/90 text-admin-status-red opacity-100 sm:opacity-0 sm:group-hover/photo:opacity-100 focus:opacity-100 hover:bg-admin-status-red hover:text-white transition shadow-sm disabled:opacity-60"
                                >
                                  {deletingPhotoId === ev.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            {/* Proof of place -- where/when the driver's device says this
                          was actually taken. Absent on older evidence. */}
                            {(capturedTime || fallbackTime || ev.location) && (
                              <div className="text-[12px] leading-tight text-admin-muted space-y-0.5">
                                {(capturedTime || fallbackTime) && (
                                  <div>
                                    {capturedTime
                                      ? `Device captured: ${capturedTime}`
                                      : `Upload recorded: ${fallbackTime}`}
                                  </div>
                                )}
                                {ev.location ? (
                                  <a
                                    href={mapsUrlForLocation(ev.location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="block truncate text-admin-brand underline underline-offset-2"
                                  >
                                    {formatLocationLabel(
                                      ev.location,
                                      ev.locationName,
                                    )}
                                  </a>
                                ) : (
                                  <div>Location not recorded</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-card border border-dashed border-admin-line bg-admin-surface p-4 text-[13px] text-admin-muted">
                      No photos captured yet.
                    </div>
                  )}
                </div>
                {(job.signatureUrl || job.driveFolderUrl) && (
                  <div className="flex flex-wrap gap-3 rounded-card border border-admin-line bg-white p-4">
                    {job.signatureUrl && (
                      <button
                        onClick={() =>
                          setActivePhoto({
                            title: `${job.jobId} · Customer signature`,
                            url: job.signatureUrl!,
                          })
                        }
                        className="min-h-10 rounded-control border border-admin-line px-3 text-[13px] font-medium text-admin-brand"
                      >
                        View customer signature
                      </button>
                    )}
                    {job.driveFolderUrl && (
                      <a
                        href={job.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center rounded-control border border-admin-line px-3 text-[13px] font-medium text-admin-brand"
                      >
                        Open evidence folder
                      </a>
                    )}
                  </div>
                )}
                <JobScenarioSection scenarios={job.scenarios || []} />
              </>
            )}
            {activeTab === "charges" && (
              <>
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">Charges</h3>
                  <dl className="mt-4 space-y-3">
                    {[
                      ["Amount charged", job.amountCharged],
                      ["Recorded total charge", job.totalCharges],
                      ["Calculated charge", job.calculatedTotalCharges],
                      ["Base price", job.basePrice],
                      ["Additional charges", job.extraCharges],
                      ["Congestion charge", job.congestionCharge],
                      ["Tunnel charge", job.tunnelCharge],
                      ["Overtime charge", job.overtimeCharge],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between gap-4"
                      >
                        <dt className="text-[13px] text-admin-muted">
                          {label}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {jobMoney(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-[12px] text-admin-muted">
                    Charges are stored job values, not evidence of received
                    payment or driver settlement.
                  </p>
                  {job.totalAdjustmentNote && (
                    <p className="mt-3 rounded-control bg-admin-surface p-3 text-[13px]">
                      Adjustment reason: {job.totalAdjustmentNote}
                    </p>
                  )}
                  {job.extraChargeBreakdown?.length ? (
                    <details className="mt-4 border-t border-admin-line pt-3">
                      <summary className="cursor-pointer text-[13px] font-medium">
                        View additional charge breakdown
                      </summary>
                      <dl className="mt-3 space-y-2">
                        {job.extraChargeBreakdown.map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-3 text-[13px]"
                          >
                            <dt>{item.label || "Additional charge"}</dt>
                            <dd>{jobMoney(item.amount)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                </section>
                <JobTimeBreakdown job={job} />
                <section className="rounded-card border border-admin-line bg-white p-4">
                  <h3 className="text-[18px] font-semibold">
                    Payment & submission
                  </h3>
                  <p className="mt-3 font-medium">{jobPaymentLabel(job)}</p>
                  <p className="mt-1 text-[13px] text-admin-muted">
                    Recorded method: {job.paymentMethod || "Not recorded"}
                  </p>
                  {job.driverJobSummary ? (
                    <dl className="mt-4 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="text-[13px] text-admin-muted">
                          {job.driverJobSummary.schemaVersion === 2
                            ? "Driver-reported receipts"
                            : "Driver-reported amount (legacy)"}
                        </dt>
                        <dd className="font-semibold">
                          {jobMoney(job.driverJobSummary.amountCollectedPence)}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="text-[13px] text-admin-muted">
                          Submitted · London time
                        </dt>
                        <dd>
                          {formatLondonDateTime(
                            job.driverJobSummary.submittedAt,
                          )}
                        </dd>
                      </div>
                      {job.driverJobSummary.noPaymentReceived && (
                        <div className="rounded-control border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                          Driver reported no payment received. Invoice amount:{" "}
                          {jobMoney(job.driverJobSummary.invoiceAmountPence)}
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="mt-4 rounded-control border border-admin-line bg-admin-surface p-3 text-[13px]">
                      No driver submission recorded. Driver-reported receipts
                      and reconciliation differences are unknown.
                    </p>
                  )}
                  {job.paymentBreakdown?.length ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[13px] font-medium">
                        View recorded payment allocations
                      </summary>
                      <p className="mt-2 text-[12px] text-admin-muted">
                        Method allocations are recorded values; an invoice
                        allocation alone does not establish a receipt.
                      </p>
                      <dl className="mt-3 space-y-2">
                        {job.paymentBreakdown.map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-3 text-[13px]"
                          >
                            <dt>
                              {item.method ||
                                item.label ||
                                "Method not recorded"}
                            </dt>
                            <dd>{jobMoney(item.amount)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                  <p className="mt-4 text-[13px] text-admin-muted">
                    Reconciliation:{" "}
                    {job.reconciled === true
                      ? "Marked reconciled"
                      : job.reconciled === false
                        ? "Not marked reconciled"
                        : "Not recorded"}
                    . Review: {job.managerReviewStatus || "Not recorded"}.
                  </p>
                  {job.managerReviewNote && (
                    <p className="mt-2 text-[13px]">
                      Review note: {job.managerReviewNote}
                    </p>
                  )}
                </section>
              </>
            )}
            {activeTab === "activity" && (
              <section className="rounded-card border border-admin-line bg-white p-4">
                <h3 className="text-[18px] font-semibold">Activity</h3>
                {job.activity?.length ? (
                  <ol className="mt-3 divide-y divide-admin-line">
                    {job.activity.map((entry, index) => (
                      <li key={index} className="py-3">
                        <p className="font-medium">{entry.action}</p>
                        <p className="mt-1 text-[12px] text-admin-muted">
                          {formatLondonDateTime(entry.timestamp)} ·{" "}
                          {entry.driver || "Actor not recorded"}
                        </p>
                        {entry.detail && (
                          <p className="mt-2 whitespace-pre-wrap text-[13px]">
                            {entry.detail}
                          </p>
                        )}
                        {(entry.fromState || entry.toState) && (
                          <p className="mt-1 text-[12px] text-admin-muted">
                            {entry.fromState || "State not recorded"} →{" "}
                            {entry.toState || "State not recorded"}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-admin-muted">
                    No activity recorded for this job.
                  </p>
                )}
                {job.exceptions?.length ? (
                  <div className="mt-5 border-t border-admin-line pt-4">
                    <h4 className="font-semibold">Recorded exceptions</h4>
                    <ul className="mt-2 space-y-3">
                      {job.exceptions.map((entry, index) => (
                        <li key={index}>
                          <p>{entry.detail || entry.type}</p>
                          <p className="mt-1 text-[12px] text-admin-muted">
                            {entry.type} ·{" "}
                            {formatLondonDateTime(entry.timestamp)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            )}
          </div>
          {/* Reassign Modal / Dropdown (Inline) */}
          {isReassigning && (
            <div className="bg-white p-4 rounded-module border border-admin-brand shadow-sm animate-in fade-in slide-in-from-top-2">
              <h4 className="text-[13px] font-bold text-admin-ink mb-3">
                Reassign driver
              </h4>
              <p className="mb-3 text-[13px] text-admin-muted">
                Choosing a driver updates the assignment and Calendar event, and
                notifies the driver.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {rosterLoading && (
                  <div
                    className="p-2 text-[14px] text-admin-muted"
                    role="status"
                  >
                    Loading drivers…
                  </div>
                )}
                {rosterError && (
                  <div role="alert" className="p-2 text-[14px] text-red-700">
                    {rosterError}{" "}
                    <button onClick={loadRoster} className="underline">
                      Retry
                    </button>
                  </div>
                )}
                {!rosterLoading && !rosterError && roster.length === 0 && (
                  <p className="p-2 text-[14px] text-admin-muted">
                    No active driver accounts available.
                  </p>
                )}
                {roster.map((d) => (
                  <button
                    key={d.initials}
                    disabled={reassigning}
                    onClick={() => handleReassign(d.initials)}
                    className="w-full flex items-center justify-between p-2 rounded-card hover:bg-admin-surface border border-transparent hover:border-admin-line transition text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${getAvatarColor(d.initials)}`}
                      >
                        {d.initials}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-admin-ink">
                          {d.fullName}
                        </div>
                        <div className="text-[11px] font-mono text-admin-muted uppercase">
                          {formatVanReg(d.vanRegistration || "")}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-admin-brand hover:underline">
                      Select
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-right">
                <button
                  onClick={() => setIsReassigning(false)}
                  className="text-label font-semibold text-fg-muted hover:text-fg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-admin-line bg-white px-4 py-3 sm:px-6">
          <button
            onClick={handlePdfDownload}
            disabled={isGeneratingPdf}
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-admin-line px-2 text-[13px] font-medium disabled:opacity-50 sm:px-3"
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isGeneratingPdf ? "Preparing…" : "Export this job"}
          </button>
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="cursor-pointer rounded-control border border-admin-line px-2 py-2.5 text-[13px] font-medium sm:px-3">
                Manage job
              </summary>
              <div className="absolute bottom-12 right-0 z-30 w-48 rounded-card border border-admin-line bg-white p-1 shadow-lg">
                <button
                  onClick={() => setIsReassigning(!isReassigning)}
                  className="min-h-10 w-full rounded-control px-3 text-left text-[13px] hover:bg-admin-surface"
                >
                  Reassign driver…
                </button>
                {canManualFinish && (
                  <button
                    onClick={() => {
                      setManualFinishError(null);
                      setManualFinishOpen(true);
                    }}
                    className="min-h-10 w-full rounded-control px-3 text-left text-[13px] text-amber-900 hover:bg-amber-50"
                  >
                    Complete manually…
                  </button>
                )}
              </div>
            </details>
            <button
              onClick={onClose}
              className="min-h-10 rounded-control bg-admin-brand px-3 text-[13px] font-semibold text-white sm:px-4"
            >
              Done
            </button>
          </div>
        </footer>
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <PhotoModal
          isOpen={true}
          onClose={() => setActivePhoto(null)}
          title={activePhoto.title}
          photoUrl={activePhoto.url}
          driveUrl={activePhoto.driveUrl}
        />
      )}

      {manualFinishOpen && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-admin-ink/40 backdrop-blur-sm p-4">
          <div
            ref={manualDialogRef}
            tabIndex={-1}
            id="manual-finish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-finish-drawer-title"
            className="bg-white rounded-module shadow-2xl w-full max-w-[460px] p-6 animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-full bg-admin-status-green-bg text-admin-status-green flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="manual-finish-drawer-title"
                  className="text-title text-fg"
                >
                  Complete job manually
                </h2>
                <p className="text-[13px] text-admin-muted mt-1">
                  {job.jobId} &bull; {job.customerName || "Not recorded"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900">
              This completes the job for scheduling and driver flow, but missing
              photos or signature will stay missing in the record.
            </div>

            <label className="block mt-5">
              <span className="text-label font-semibold text-fg">
                Admin note
              </span>
              <textarea
                value={manualFinishNote}
                onChange={(event) => setManualFinishNote(event.target.value)}
                disabled={manualFinishing}
                rows={4}
                maxLength={1000}
                placeholder="Example: Driver completed this job manually outside the app."
                className="mt-1.5 w-full rounded-card border border-admin-line bg-admin-surface px-3 py-2 text-[13px] text-admin-ink outline-none focus:border-admin-brand disabled:opacity-70"
              />
            </label>

            {manualFinishError && (
              <p role="alert" className="mt-3 text-[13px] text-red-700">
                {manualFinishError}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setManualFinishOpen(false)}
                disabled={manualFinishing}
                className="flex-1 h-11 rounded-card bg-admin-surface text-card text-fg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleManualFinish}
                disabled={!manualFinishNote.trim() || manualFinishing}
                className="flex-1 h-11 rounded-card bg-admin-status-green text-white text-[14px] font-semibold disabled:opacity-50"
              >
                {manualFinishing ? "Finishing..." : "Finish manually"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PdfPreviewModal
        job={job}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onDownload={handleActualDownload}
      />
    </div>
  );
}
