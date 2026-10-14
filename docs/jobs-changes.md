# Jobs and canonical job details

Audit basis: complete `TMV_Dashboard_UI_UX_Audit.pdf`, particularly pages 7–8, 24–26 and the acceptance/handoff requirements. Implementation uses the existing React, React Query, Tailwind and Lucide stack. The frontend API boundaries are `/api/admin/jobs`, `/api/admin/jobs/:id`, existing assignment/completion/evidence endpoints, and the existing export endpoint. Authentication, pricing, stored evidence and mutations are preserved; no production requests or messages were sent during this work.

## Findings and verified definitions

| Field | Display / basis | Treatment |
| --- | --- | --- |
| `amountCharged` | Amount charged, integer GBP pence returned by the job API | Primary list amount when present; never renamed receipts or debt. Known zero renders £0.00. |
| `totalCharges` | Recorded total charge | Fallback primary charge only when amount charged is absent; separate row in charge details. |
| `calculatedTotalCharges` | Calculated charge | Displayed separately; not silently substituted as a recorded payment. |
| `driverJobSummary.amountCollectedPence` | Driver-reported receipts for schema v2, driver-reported amount for legacy data | Frontend mock summary handler excludes Invoice in v2. Legacy backend behavior cannot be independently verified and is not represented as received money. |
| `paymentBreakdown` | Recorded method allocations | No receipt or outstanding total is inferred from these rows. Invoice allocations are explicitly not receipt evidence. |
| `paymentStatus` | API payment status | Distinct from job completion; absent status stays not recorded. |
| `evidenceCompleteness` | API-provided evidence states | MISSING, PROCESSING and FAILED remain visible; a completed job can have incomplete evidence. Missing completeness fields do not establish complete coverage. |
| `driverViewedAt` | Driver app view timestamp | Explained as app interaction, independent of assignment acceptance and message read status. Removed unsupported Sent (SMS) inferred from driver name. |
| `timeBilling.scheduledMinutes` | Calendar scheduled time from the saved snapshot | Separate from billing allocation. Never called “Original Calendar duration.” |
| `timeBilling.allocatedMinutes` | Billing allocation from the saved snapshot | No minimum-billing business rule is invented. |
| `actualStart` / `pickupArrivalAt`, `actualFinish` | Accepted arrival evidence / recorded workflow finish | Labels distinguish these from tracker observations and Calendar schedule. |
| `bookedMinutes` without a billing snapshot | Recorded Calendar scheduled time | Historic values are preserved; the 90-minute narrative versus 120-minute legacy value requires backend/import-rule verification. Original description remains accessible. |
| `reconciled`, `managerReviewStatus` | Existing recorded flags/status | No fake Resolve action or invented customer outstanding/remittance. |

## Completed checklist

| Audit recommendation | Screen/component | Change | Verification | Status |
| --- | --- | --- | --- | --- |
| Compact list default with optional cards | `JobsPage` | Eight compact columns including selection and open/actions; stacked mobile rows; persisted optional card preference | Unit test and QA desktop/mobile screenshots | Complete |
| Honest structured job information | Jobs list / job details | Customer, route, crew and Calendar time replace imported shorthand; imported title/description in disclosure | Unit tests and visual review | Complete |
| Independent operational statuses | List and `JobDetailDrawer` | Job, payment, evidence, submission, viewed and review status remain independent | Semantic utility + drawer tests | Complete |
| Canonical progressive detail | `JobDetailDrawer` | Details, Timeline & evidence, Charges & payment, Activity; shared from Jobs, fleet, reports and evidence | Unit tests; QA workflows | Complete |
| Accurate time bases | `JobTimeBreakdown` and timeline | Calendar scheduled time, billing allocation, recorded working time and calculated overtime are separate | Existing + extended time tests | Complete |
| Preserve return context | Jobs / route state | Date, driver, status, search, server sort, page, view and saved list scroll; external return control uses shared validated navigation utilities | URL tests; QA report/fleet workflows | Complete |
| Correct cold exact-job deep links | Jobs | Full detail fetch by selected ID, bounded loading/error/retry; StrictMode effect replay fixed | New StrictMode deep-link test | Complete |
| Preserve operational actions safely | Jobs / drawer | Single/bulk reassignment, bulk deletion, manual completion reason and consequences; destructive actions secondary; retry partial reassignment skips completed items | Capability comparison; actions not executed against production | Complete |
| Preserve evidence and signature access | Drawer / shared thumbnails | Original photo deletion, capture/upload source and location; focused previews; signature and evidence folder links | Nested preview keyboard/error test | Complete |
| Accessible overlays | Shared focus hook / photo / PDF / job / action dialogs | Semantic dialogs, focus trap, topmost Escape, restoration, scroll lock; keyboard tabs and image controls | Keyboard tests + QA browser focus checks | Complete |
| Accurate zero/empty/error states | Jobs / utility functions | Missing amounts not zero, no 1–0 pagination, retained data during refetch, recoverable exact-record error | Unit tests | Complete |
| Preserve exports and state their scope | Jobs CSV / PDF preview / print | Filtered server export retained including driver/sort; selected CSV preserves original columns and selects records across pages; dates, timezone and scope added; PDF missing money/signature remains missing | Unit tests and print regression tests; local preview | Complete, server metadata dependency below |

## Remaining concrete dependencies

- Backend/import implementation is absent from this checkout. The minimum/rounding rule behind historical `bookedMinutes` and the exact accounting definition of legacy `amountCollectedPence` cannot be verified. Calculations and saved values are preserved, with source labels and uncertainty exposed.
- The existing `/api/admin/jobs/export.csv` endpoint controls the complete filtered export’s header and coverage notes. Its frontend query includes the actual selected dates, search, driver, status and sort; backend metadata cannot be verified without that service. Selected-record CSV and current-job PDF explicitly include scope/timezone and missing-data labels.
- No authenticated auditable review-decision endpoint was found in the available frontend contract. Existing recorded review status is shown; no fake stored review action was added.

## Checks performed

- Jobs, job detail, time breakdown, presentation and print/export tests: **37 passed** across six files (35 on the combined run, plus two new focused regressions).
- QA inspected Jobs at 1366px and 390px; this agent inspected desktop and mobile viewport screenshots plus the mobile job drawer, then refined drawer identity/footer density without shrinking text.
- Additional targeted regressions cover nested-preview route unmount restoring scroll lock and refresh preserving the current list position.
- Full project type-check passed. Browser workflows and final screenshots are reconciled by the root task’s validation record.
