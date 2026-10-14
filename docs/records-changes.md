# Drivers, vehicles, evidence and liability

The full PDF audit was read alongside the extracted frontend. These changes use the current React, React Query, Tailwind, Luxon, Lucide and shared UI components. No backend source is supplied by this checkout. No production APIs, records or personal data were used for validation.

## Verified definitions and preserved behavior

- Driver `active` controls app account access; it does not establish online status, motion or availability. Directory membership comes from account-backed roster rows and does not depend on the performance date range. The existing Driver Breakdown is reused under Performance summary.
- Vehicle MOT, tax and insurance dates are stored deadlines. Overdue means before today's London calendar date. Due soon uses the existing 30-day notice window. Current means outside that window; it is not legal certification. Current vehicle snapshots are requested without historical date filters.
- Service mileage uses the configured service interval, the latest recorded service baseline/override and the latest recorded odometer. Missing current odometer is unavailable, rather than an assumed zero distance. The existing 500-mile service warning threshold remains unchanged.
- Evidence photo count is known only when a photos array is supplied. A present empty array is a known zero. Signatures recognize the supported file/thumbnail/URL shapes. A missing signature is Not recorded; Not required appears only when an explicit `signatureRequired: false` is supplied. No new consent rule is inferred.
- Reported incidents remain separate from review/verification/resolution. Supplied review states are rendered; absent review data is explicitly not recorded. No fake review-save action was added to scenario submissions.
- Existing CSV endpoints, individual PDF print/preview, document folders, evidence photos/signatures and original stored scenario fields remain accessible. New page CSV exports have exact scope, identities, selected date range, timezone and coverage notes and use the existing CSV formula/structure sanitizer.
- Original driver save/password behavior, offline tracker preservation, account deactivation/reactivation and guarded permanent deletion remain available. Original vehicle notes, insurance/date fields, service interval, baseline override and record deletion payloads are preserved.

## Audit checklist

| Audit recommendation | Screen/component | Implemented change | Verification | Status |
| --- | --- | --- | --- | --- |
| Separate directory from performance and move Driver Breakdown | DriversPage / DriverSettlement | Directory and Performance summary; performance dates only in that view | Directory/roster tests; screenshots | Complete |
| Driver identity, account access, assigned vehicle and clear actions | DriversPage | Responsive compact rows; explicit View profile / View report; no unsupported current-work assertion | Directory tests; desktop/mobile visual review | Complete |
| Move contacts/editing into profile | DriversPage / AddDriverModal | Contact details in focused profile; clear Edit profile; account management disclosure | Profile/edit tests; screenshots | Complete |
| Clarify Account active | DriversPage / AddDriverModal | App access label and separate explanatory copy | Account filter test | Complete |
| Structured form, required labels, validation and retained content on failure | AddDriverModal | Identity/contact, vehicle/tracker, access groups; associated fields; inline errors | Required-field/save-failure tests | Complete |
| Retain tracker selection and original password behavior | AddDriverModal | Existing offline option preserved; blank password omitted | Offline tracker/password test | Complete |
| Keep permanent deletion exceptional and preserve history | DriversPage | Deactivate first; delete inside nested exceptional disclosure, explicit original consequence | Source/API preservation review | Partial: backend identity retention dependency below |
| Consistent duration/early formatting and no-jobs state | Performance summary | Directory no longer presents unsupported daily measurements; existing aggregate reused | Shared formatter/report tests by root/reports agent | Complete in shared report implementation |
| Four evidence views with one toolbar/layout | LiabilityPage / ScenariosPage / SubmissionPageTemplate | Check-in, Checkout, Parking, Incidents / liability; shared filters and responsive records | Four-view/legacy/keyboard/filter tests | Complete |
| Organize evidence around exact job and customer | ScenariosPage | Exact stored job ID opens canonical JobDetailDrawer locally, preserving filters/page | Exact linked-job/context test | Complete |
| Keep check-in/out reachable from same job | Canonical JobDetailDrawer | Evidence list opens the same canonical detail; that detail retains scenario evidence | Exact linked-job test; shared job visual review | Complete |
| Signature status and storage reference terminology | ScenariosPage / SubmissionDetailDrawer | Signature status read-only; Storage container reference retained | Signature payload tests; source review | Complete |
| Distinct evidence, consent/review/outcome | Evidence rows/detail | Known photos/signature/review facts; no completeness, verification or resolution invention | Evidence helper tests | Complete within available contract |
| Focused photos/document previews | SubmissionDetailDrawer | Shared dialog behavior, per-record PDF/photo preview; linked job and document-folder actions | Existing PDF preview tests; keyboard semantics | Complete |
| Empty count 1–0 of 0 and clear/expand action | SubmissionPageTemplate / ScenariosPage | Zero count; no empty pagination; explicit empty/no-match states | Zero-record test | Complete |
| Parking pagination aligned with backend | ParkingLiabilityPage / ScenariosPage | Removed second client slice of an already paginated response | Page 2 parking regression | Complete |
| Do not advertise page search as all-record search | Shared evidence toolbar | Search this page; result count and pagination explicitly scoped | UI/copy review | Complete; full-range search needs backend search contract |
| Registration-first Vehicles | VanMileagePage | Current assignment rows lead with registration; contact data moved off list | Vehicle regression; screenshots | Complete |
| Actual expiry states instead of Recorded | VehicleDateCell / vehicleDates | London date states and notice basis | Dates/DST tests; overdue visual review | Complete |
| Current expiry facts independent of historical records | VanMileagePage | Unfiltered current query; separate drawer history query | Current-vs-historical regression | Complete |
| Single vehicle action and focused drawer tabs | VanDriverModal | Dates & service, Fuel, Record history; compact statuses; removed empty photo wall | Screenshot review and refinement | Complete |
| Unknown uploads neutral; current odometer not assumed zero | ServicePreview / RecordPreview | Unavailable calculation, neutral missing-record states, actual evidence retained | Missing odometer regression | Complete |
| Loading/error/partial states preserve usable data | Records pages | Recoverable errors; no error-derived zero counts; prior data retained on failed refresh | State tests and source review | Complete |
| Scoped exports with identities, date range, timezone and notes | recordExports / records pages | New explicit loaded-page/current snapshot/history exports; original server export secondary | Export metadata/zero/missing/sanitization tests | Complete for new scoped exports; original endpoint scope unverified |
| Accessible responsive records and dialog return | Shared Modal/useDialogFocus / records pages | Associated fields, explicit buttons, mobile rows, Escape/focus restoration | Shared dialog tests; 390/1366 screenshots | Complete, with broader width checks by QA |
| Preserve driver list context and position on return | DriversPage / report navigation | Scoped URL directory search/account/tab state and session scroll storage; safe driverReturn shared helper | Driver navigation tests; report/QA integration | Complete |

## Concrete backend dependencies

1. Permanent driver deletion currently removes the account name/contact identity and leaves historical job initials. This was explicitly stated by the original implementation. Preserving historical identity through deletion needs a backend archive/tombstone or immutable job identity snapshot. Deactivation preserves identity today; the exceptional deletion action clearly states the original consequence.
2. Scenario APIs do not expose a verified authenticated review-write contract. Reported/verified/resolved cannot be invented. A separate review record with reason and auditor/timestamp would be needed for scenario decision saving.
3. The existing scenario and vehicle CSV endpoints are called without filter parameters. Their full scope/timezone cannot be verified from this frontend. They remain accessible with an explicit scope notice; the new frontend page/history CSVs have known scope and coverage metadata.
4. Evidence search currently filters the server-loaded page because the available scenario list contract has no search parameter. The UI names this scope honestly. A full-range indexed search endpoint is needed to extend that search reliably.
5. The vehicle endpoint returns driver-centric assignment records, rather than a canonical vehicle registry. The UI therefore counts vehicle assignments and preserves all returned identities. Deduplicating registrations without backend assignment history could silently discard evidence and is deliberately avoided.

## Validation actually performed

- Type check passed after the record changes (`npm run typecheck`).
- Targeted records tests passed: 27 tests across seven files (latest run 23:43 UTC): directory/access/report navigation, form validation/save failure/offline tracker, all evidence views/legacy routes/filter retention/keyboard/zero records/server pagination/exact job return, date/DST/signature semantics, PDF preview, current vehicle facts vs historical records, and scoped export metadata/missing-vs-zero/sanitization.
- Inspected screenshots personally at 390px and 1366px: Drivers directory/profile, Vehicles list/detail, Evidence & Liability. Fixed mismatched driver header columns, oversized empty receipt placeholder, technical export wording and a table-clipped row menu. QA captures additional 768px/wide screens and report performance views separately.
- Before/after artifacts are in `docs/screenshots/before` and `docs/screenshots/after` and use sanitized synthetic local records.
- No supported invite/reset API was found; the existing explicit password field was preserved rather than adding an invitation button that cannot work.
