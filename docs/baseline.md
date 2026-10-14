# Baseline and data definitions

Baseline captured from the untouched extracted frontend at `/workspace/tmv-runtime/web`, before redesign changes. The selected repository contains `web.zip` and the extracted React/Vite frontend; no backend source, database, credentials, or staging environment is included. API contracts are visible in frontend types and request functions. Backend calculation intent cannot be independently verified from this checkout.

## Checks actually run

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | Passed |
| Existing tests | `npm run test:run` | 77 files, 384 tests passed |
| Production build | `npm run build` | Passed; pre-existing Vite warning about chunks over 500 kB |
| Lint | — | No lint script or lint configuration is supplied |

The application uses React 18, TypeScript, Vite, Tailwind, React Query, Lucide, Recharts, Luxon, and Leaflet. The admin app is lazy-loaded at `/admin` on localhost and on the dashboard domain. Authentication remains the existing separate admin session (`/api/admin/me`); the browser harness substitutes an authenticated synthetic response only in local tests.

## Metric contract mapping

All financial amounts below are integer pence unless the field explicitly ends in `Pounds`. Dates and operational display use `Europe/London`.

| Surface / source | Meaning evidenced by the frontend contract | Limitation / safe interpretation |
| --- | --- | --- |
| Job `calculatedTotalCharges` / report `systemCalculatedPence` | System-calculated charge | A calculated charge, not a receipt |
| Job `totalCharges`, `amountCharged` / report `acceptedPence` | Stored final/accepted charge | Legacy UI calls this Driver Collected; this is misleading when invoices are uncollected |
| Report `expectedPence` | Expected charge | Preserve supplied value; do not independently recalculate pricing |
| `systemPayments.collectedPence`, `knownCollectedPence` | Recorded job-flow receipts, with unknown coverage possible | `Invoice` is kept separately by `invoicePence`; summing all payment methods includes unpaid invoices |
| `systemPayments.invoicePence` / `systemPaymentsByMethodPence.Invoice` | Uncollected invoice amount in supplied report | Does not establish driver remittance or customer debt beyond recorded invoice evidence |
| `manualDetails.amountCollectedPence`, `manualPayments` | Amount/payment methods reported by the driver in the manual submission | An absent manual submission is unknown, never £0.00 |
| `systemVsManualCollectionDifferencePence` | Difference between compatible recorded and manually reported receipts | Null when either operand is unknown |
| Legacy `paymentCards.driverCollectionPence` | Sum of accepted job charges in included sample and rendered rows | Relabel Accepted charges; not collected funds |
| Legacy `paymentCards.outstandingPence` | Accepted charges minus manual reported collection | Relabel Charge / report difference; cannot assert customer outstanding or remittance |
| `summary.systemKnownCollectionsPence` | Known receipts subtotal across selected report range | Show known subtotal if `unknownSystemCollectionJobs > 0` |
| `summary.recognizedKnownCollectionsPence` | Known recognized collection subtotal | Backend recognition rule unavailable; no new settlement label |
| Overview `revenuePounds` vs cash/card subtotals | Separate supplied aggregate fields | They may use incompatible populations/definitions; avoid implying they reconcile without backend evidence |
| `bookedStart` / `bookedFinish`, `duration.bookedMinutes` | Scheduled calendar timestamps / booked service duration | Imported raw title/description remain available |
| `allocatedMinutes` | Allocated/billing-derived duration, distinct from booking duration | Sample supplies 90 booked and 120 allocated; minimum/rounding rule cannot be independently verified here |
| `actualStart` / `actualFinish`, `workingMinutes` | Recorded operational work duration | Missing duration remains unavailable |
| `manualMinutes` | Driver-reported work duration | Missing submission remains unavailable |
| `overtimeMinutes` / overtime pence | Backend-supplied billable overtime | Existing calculation preserved |
| `arrivalDelaySource`, `timingTrustworthy` / report `arrivalSource` | GPS/proof/unavailable provenance for punctuality | Missing/unverified tracker data cannot establish lateness |
| `arrivalDelayMinutesKnown` | Cumulative known delay across report | Not an average or median |
| Movement `movingSeconds` and `coverage` | Tracker-observed movement during a scope | Separate from working time; partial/unavailable coverage cannot become zero |
| Job `status` | READY, IN_PROGRESS, COMPLETED, CANCELLED | Independent of payment, evidence, viewed, submission, review status |
| Driver `active` | Account access enabled | Does not imply online, available, moving or assigned |
| Vehicle expiry dates | Stored MOT/tax/insurance dates | Date state is as of today; stored date is not proof of compliance |
| Road `enteredAt`, `durationSeconds`, `chargeable`, `estimatedPence`, `rateBasis` | Separate zone observation, time inside, charge assessment, amount and basis | Entry is not necessarily a payable occurrence; no legal tariff changes from audit |
| Road `jobId: null` | Event without a linked job | Must remain visible for review |
| `gpsSummary.coverage`, `providerCoverage`, `truncated` | Supplied tracker coverage and history limits | No recorded event is not definitive proof of no crossing |
| Evidence `state`, scenarios/signature, report `status` | Recorded evidence and report state | Completed job or reported incident does not imply evidence verified/resolved |
| Notifications `sent`, `pending`, `failed`, `skipped`, `disabled` | Provider/submission states supported by existing contracts | No delivered/read claim without provider evidence |

## Reproduced / confirmed baseline defects

- Command palette advertises record search but filters only page/action labels. Finance navigates to a section with no rendered page.
- Opening Driver Report sets sidebar collapsed automatically, ignoring preference.
- LiveFleetPage receives a specific job ID but navigates only to Jobs.
- DriverReportView labels accepted charges as Driver Collected, including uncollected invoices; labels accepted minus manual entry as Outstanding.
- Missing manual entries can sit beside known subtotal without sufficient coverage context.
- DriverRoadAlerts filters out rows with null job ID after server pagination, so displayed rows and counts can disagree.
- Pricing saves sequentially, does not advance the saved baseline, and says changes apply immediately although save is required.
- General duration formatter preserves hundredths of minutes; driver directory can display `+-3 mins`.
- Vehicles table leads with driver contact details and marks stored dates Recorded without date state.

## Browser fixtures and screenshots

The isolated package `scripts/browser` contains Playwright, the fixture harness, capture scripts and behavioral smoke checks. Chromium is `/usr/bin/chromium`. It uses the existing sanitized `driverReport.sample.ts` fixture, derives synthetic admin jobs/driver totals from those rows, and intercepts every API route before it reaches any backend. All nonlocal external requests are aborted; writes are disabled except simulated settings saves in memory. No production records or personal data are used.

Run an untouched frontend with `VITE_MOCK_API=false npm run dev -- --host 0.0.0.0 --port 3003 --strictPort`, then `TMV_BASE_URL=http://localhost:3003 TMV_PHASE=before npm --prefix scripts/browser run capture`. For the redesigned frontend use `TMV_BASE_URL=http://localhost:3002 TMV_PHASE=after npm --prefix scripts/browser run capture`. Optional `TMV_WIDTHS=390,768,1366,1920` and `TMV_VIEWS=overview,jobs,driver-report,payments,vehicles,settings` narrow or broaden capture.

Results include full-page screenshots and `capture-results.json` recording actual viewport widths, document widths, runtime errors, unknown fixture endpoints, and intercepted mutations. Before screenshots are under `docs/screenshots/before`; after screenshots are under `docs/screenshots/after`. Screenshots are illustrative synthetic local records, not live business figures.
