# Driver reports: audit implementation and data definitions

The full 29-page audit was read and compared against this extracted revision. This repository contains the React frontend and API client; the driver-report backend implementation and ledger are absent. No billing calculations, prices, stored records, manual submissions, permissions or message delivery were changed.

## Verified frontend definitions

| Field | Meaning supported by the frontend contract and sanitized report fixture | UI treatment |
| --- | --- | --- |
| `finance.systemCalculatedPence` / `paymentCards.totalChargesPence` | Calculated expected job charge | Calculated charge; separate from final charge and receipts |
| `finance.acceptedPence` / `paymentCards.driverCollectionPence` | Accepted/final charge; the old UI called this Driver Collected | Accepted / final charge; includes recorded adjustments |
| `systemPayments.collectedPence` / `summary.systemKnownCollectionsPence` | Recorded receipt methods excluding uncollected Invoice and Unknown | Recorded receipts; partial values explicitly say Known subtotal |
| `systemPayments.invoicePence` / `systemPaymentsByMethodPence.Invoice` | Recorded unpaid invoice amount | Unpaid invoices / Uncollected; never added to receipt total |
| `manualPayments.collectedPence` | Driver receipt breakdown excluding invoice | Driver-reported receipts in reconciliation; absent submission remains Not submitted |
| `manualDetails.amountCollectedPence` / `manualEntriesKnownPence` | Raw submitted amount used by the existing charge/manual aggregate comparison | Driver submitted amount, with coverage; not described as remittance |
| `paymentCards.outstandingPence` | Existing accepted-charge minus submitted-amount aggregate | Existing charge / reported amount difference, with formula and limits; unknown when operands/coverage are unknown; never customer outstanding |
| `duration.workingMinutes` | Report-supplied operational job-boundary duration | Working time; separate from vehicle movement |
| `duration.bookedMinutes` | Booking duration supplied by report | Booked service time |
| `duration.allocatedMinutes` | Allocated/transformed duration supplied by report | Allocated / billing-derived time; never Original Calendar duration |
| `duration.arrivalDelayMinutes` | Report-supplied arrival delay | Punctuality shown only alongside a recorded tracker arrival and verified source; missing/stale evidence gives Unverified arrival |
| `summary.arrivalDelayMinutesKnown` | Existing sum of recorded delays | Cumulative recorded arrival delay; no invented average or median |
| `summary.discrepancies` | Report-service count of discrepancies | Items needing review, with source label; exception categories may overlap |
| `DriverSummaryItem.calculatedChargesPounds` | Calculated charge aggregate | Calculated charges, unavailable if absent; no fallback to billed revenue |
| `DriverSummaryItem.totalCollectionsPounds` | Existing collection aggregate used as receipts by the report ecosystem | Recorded receipts, unavailable if absent; no fallback to revenue |

Receipt reconciliation compares **system recorded receipts minus driver-reported receipts**, using integer pence. If either operand is unknown, or the driver submission is absent, the difference is unknown. A success state requires known compatible receipt and timing operands and is labeled Receipt & timing match. Missing or invalid timing values remain Needs verification; an independently known difference remains visible even when another field is incomplete. Existing source amounts are retained. No customer debt, cash-in-bank, acceptance, or driver settlement is inferred.

## Completed recommendation mapping

| Audit recommendation | Screen / implementation | Verification | Status |
| --- | --- | --- | --- |
| Four report tabs with legacy links (pp. 3, 9, 23) | DriverReportView + DriverReportPage: Summary / Jobs & timings / Payments / Road charges; shared legacy mapping | Page tests cover Comparison, Performance and Tunnel routing; road owner covers mappings | Complete |
| Compact identity, one aligned header, stable sidebar (pp. 4, 9) | Concise report identity and driver/export controls; labeled Drivers back; sidebar preservation owned by application shell | Type-check; parent visual review | Complete; shell coordinated |
| Retrospective report date controls (p. 4) | DateRangePicker `scope="report"`: Last 7 days / This month / Custom; London day boundaries | Date preset tests, including DST | Complete |
| Four summary metrics and one coverage notice (pp. 9, 23) | Summary has completed jobs, recorded receipts, working time, report discrepancy count | View tests enforce four metrics, incomplete receipt coverage | Complete |
| Keep useful performance charts, reduce duplication (pp. 10, 23) | One compact chart with completed jobs / receipts / working time selector; full table alternative; missing values have no bar | Chart data tests distinguish receipts from charges, unknown from zero | Complete |
| Compact job list before detailed timings (pp. 9–10) | Jobs & timings list with scheduled start, verified arrival, working duration, independent status and exceptions; selected timeline | View tests cover unverified arrival, source labels, timing selection | Complete |
| Distinguish scheduled, observed, reported and transformed time (pp. 8, 10) | Selected timeline labels evidence bases; booked vs allocated vs working vs movement vs overtime shown separately | Timeline and rounding tests | Complete; billing rule question remains |
| Canonical exact job navigation and return context (pp. 9, 24) | Job/evidence actions route through shared reportJobHref; date/driver/tab/filter/selection/pages retained in reportReturn; driverReturn restores the originating directory search/account/tab | Page navigation tests; report-local scroll capture/restore test | Complete |
| Receipts vs unpaid invoice vs charges (p. 11) | Payments overview has four metrics and a directly labeled payment-method table; no duplicate donut | View tests using £1,804 receipts + £303 unpaid invoices vs £2,107 final charges | Complete |
| Missing submission and incomplete aggregates (pp. 11, 25) | All absent submissions show Not submitted; partial totals Known subtotal; unclassified money remains visible separately | Missing, unknown, partial and known-zero tests | Complete |
| Reconciliation is a mode within Payments (pp. 12–13) | Exception-first list and aligned System / Driver / Difference comparison; missing driver panel condensed; unused methods disclosed | View tests and unknown operand tests | Complete |
| Filter reconciliation across complete selected range (p. 12) | Page loads every supported report job page before enabling filters; detects repeated/empty/missing pages; preserves partial data with retry | Page tests include job 32 beyond loaded page, page failure and ignored pagination | Complete |
| Preserve road-charge distinction and expose evidence (pp. 14–15) | Parent report combines All / Tunnel / Congestion; DriverRoadAlerts owned by road/fleet agent; selected job road evidence stays reachable | Coordinated road owner tests | Complete; backend tariff accuracy not established |
| Driver Breakdown to Performance summary, readable time and actions (pp. 6, 17) | DriverSettlement compact table, calculated charges vs receipts, whole-minute time, Data gaps, explicit View report / Reconcile; customer review requests/overtime in disclosure | Settlement tests cover sorting, exact driver filter, missing data, scope and labeled links | Complete; mounted in Drivers by records owner |
| Preserve supported exports and state scope (p. 26) | Report header export menu retains authenticated complete-range PDF and Excel endpoints; label includes selected range and London time | Export callback tests + existing download validation tests | Frontend complete; backend file contents dependency |
| Keyboard, focus, narrow-screen readability (p. 26) | Roving report tabs, visible focus, Escape on export menu, comparison focus, mobile stacked job/review/performance rows, contained supporting-table scroll | Keyboard tests; parent screenshots at representative widths | Implemented; parent visual verification |
| Loading, no records, partial data and recoverable source errors (p. 26) | No unnecessary zero pagination; complete-range loading bounded by failure state; finance retained on GPS failure; retry retains filters | Page/View error and zero-record tests | Complete |

## Concrete backend/business-rule dependencies

- The report service exposes no authenticated, auditable review-decision write operation. The UI does not offer a fake Resolve action. A future endpoint needs job/report identity, original source version, reviewer identity, decision, reason, timestamp and an append-only audit record; it must preserve original submissions and evidence.
- The frontend contract does not establish the billing rule that transforms a 90-minute booking into a 120-minute allocation. Existing values and calculations remain unchanged and their basis is labeled honestly.
- `paymentCards.outstandingPence` does not establish customer outstanding balance. A verified receivable/settlement ledger and applicable credit/refund/prepayment rules are required before displaying those concepts.
- Legacy full-range PDF/Excel file generation lives in the absent backend. Download URLs, authentication, MIME validation and cancellation are preserved. The frontend cannot guarantee that server-generated file headings, incomplete-data notes, estimate labels and timezone match the redesigned UI until the service's export templates are reviewed.
- Full-range reconciliation uses supported paginated read requests. Extremely large ranges still need a backend filtered reconciliation endpoint for efficient retrieval; the frontend never silently limits filters to the current page.

## Validation performed

`npm run test:run -- src/screens/admin/dashboard/components/DriverSettlement.test.tsx src/screens/admin/dashboard/components/DriverSettlement.loading.test.tsx src/screens/admin/dashboard/components/DriverReportView.test.tsx src/screens/admin/dashboard/pages/DriverReportPage.test.tsx src/screens/admin/dashboard/components/DriverPerformanceCharts.test.ts src/screens/admin/dashboard/components/DateRangePicker.test.tsx`

The six-file focused run passed all 44 tests. A later browser-discovered StrictMode scroll-restoration failure was corrected by consuming the saved position only after the animation frame restores it. The subsequent DriverReportPage and DriverReportView run passed all 28 tests, including the cache-preloaded StrictMode regression. Final semantic review also corrected incomplete timing comparisons being classified as matches, with targeted nullable-operand and invalid-timestamp regressions; the final DriverReportPage / DriverReportView run passed all 34 tests. `npm run typecheck` passed on the latest integrated source. Visual screenshots were captured by the parent QA harness using only sanitized fixture data and intercepted local API requests. The report owner inspected Summary at 1366px and Summary, Payments and Reconciliation at 390px; refined mobile date orientation with visible From/To labels. Repository-wide checks, final screenshots, contrast measurements and browser workflows are reported in the parent handoff.
