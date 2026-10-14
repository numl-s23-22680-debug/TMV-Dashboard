# Dashboard redesign handoff

Implemented on `design/dashboard-audit`. The editable frontend is `web/`; the original archive is unchanged. Authentication and existing `/api/admin` request contracts remain in place. No production deployment, message send, live price edit, reassignment or production-record mutation was performed.

## What changed

Eight main destinations now share a neutral/white design, restrained blue actions and meaningful green/violet/amber accents. Overview starts with daily work and recorded attention, then jobs and compact data charts. Jobs defaults to a compact list with optional cards and one canonical four-section detail. Drivers separates profile management from dated performance. Driver reports use Summary, Jobs & timings, Payments and Road charges with legacy links retained. Vehicles leads with registration and current date state; Evidence & Liability keeps all four record types. Alerts leads with operational attention; Settings provides compact pricing, templates and device preferences.

Important corrections include honest Jump to page search and safe dead-route handling; preserved sidebar preference; exact Fleet jobs; unlinked road rows/counts; missing-versus-zero receipt/submission states; invoices excluded from receipts; compatible unknown reconciliation differences; clear time provenance; correct zero pagination; saved settings baseline and partial-save outcomes; unsaved route, logout and native history guards; and stable focus/scroll restoration including React StrictMode cold links. A reconciliation with matched receipts but missing timing operands now needs verification instead of claiming a match.

## Main implementation locations

- Shell, routing and shared system: `web/src/screens/admin/AdminApp.tsx`, `dashboard/Layout.tsx`, `dashboard/dashboard.css`, `components/OperationsUI.tsx`, `components/CommandPalette.tsx`, `ui/Modal.tsx`, `ui/useDialogFocus.ts`.
- Daily work: `dashboard/pages/OverviewPage.tsx`, `JobsPage.tsx`, `components/JobDetailDrawer.tsx`, `JobTimeBreakdown.tsx`, shared presentation/export helpers.
- Driver workspaces: `DriversPage.tsx`, `DriverReportPage.tsx`, `DriverReportView.tsx`, `DriverSettlement.tsx`, `DriverPerformanceCharts.tsx`, `DriverRoadAlerts.tsx`, report semantics/navigation helpers.
- Records and fleet: `VanMileagePage.tsx`, `ScenariosPage.tsx`, `SubmissionPageTemplate.tsx`, `SubmissionDetailDrawer.tsx`, `LiveFleetPage.tsx`, `LiveFleetMap.tsx`, vehicle/freshness utilities.
- Settings and attention: `PricingSettingsPage.tsx`, `MessagingPage.tsx`, `ConfigurationsPage.tsx`, `NotificationsAlertsPage.tsx`, `OperationalAttentionPanel.tsx`, shared attention and unsaved-change helpers.
- Bounded requests: `web/src/lib/fetchWithTimeout.ts`, admin API clients. Application package declarations and lockfile match the original archive.

## Validation

The final validation records cover the full test suite, TypeScript and production/PWA build, plus 24/24 browser workflows. Responsive captures include 76 view/width pairs with no page-wide overflow or runtime errors. Computed contrast checks covered 1,054 loaded visible text runs with no AA failures (lowest ratio 4.51:1). Native Back/Forward, cold exact links, and cached report scroll restoration were exercised in a real browser and targeted regressions. Final unit-suite counts are listed in the validation table below. The original baseline passed type-check, build and 384 tests across 77 files. There is no lint script or lint configuration in the supplied project. Existing large bundle warnings remain nonfatal; no framework/dependency migration was introduced.

| Final check | Actual result |
| --- | --- |
| `npm run typecheck` / build TypeScript check | Passed |
| `npm run test:run -- --maxWorkers=3` | 95 files / 455 tests passed |
| `npm run build` | Passed; PWA/service worker generated |
| Sanitized browser workflows | 24/24 passed; 8/8 final financial/context rechecks passed after the timing-semantic correction |
| Responsive capture | 76 view/width pairs at 390, 768, 1366, 1920; no page-wide overflow or runtime errors |
| Measured contrast | 1,054 loaded visible text runs; 0 AA failures; minimum 4.51:1 |
| Lint | Not configured in supplied repository |

Browser validation uses `scripts/browser` as a separate, pinned tooling package. It intercepts all API requests and blocks external destinations; settings-save tests mutate fixture memory only. Checks cover search/exact records, legacy tabs, financial missing-data/receipts, full-range filters, road events, context/scroll, vehicle dates, settings partial failure/baseline/discard/history, exports, recoverable errors and keyboard/focus. Screenshots cover 390, 768, 1366 and 1920px. See [before/after views](screenshots.md), JSON artifacts and [browser instructions](../scripts/browser/README.md).

## Remaining backend/business-rule questions

The repository contains frontend code only. These dependencies are explicit in the [completed checklist](audit-checklist.md) and area handoffs; none is replaced by fabricated data or a fake resolution action.

1. Confirm server billed-summary definitions, billing allocation/minimum/rounding, legacy payment-field meanings, and whether rate edits affect active/historical jobs. Existing supplied calculations and pricing behavior are preserved; the UI exposes separate bases.
2. An auditable report decision/outcome endpoint is absent from the available report contract. Incident verification/resolution and an actual remittance/customer ledger also need explicit backend data. Original evidence remains intact.
3. Road events do not provide event-level reported fees, confirmed settlement or authoritative historical tariff effective dates. Job-level reported totals and estimates stay distinct; no legal schedule was changed.
4. Permanent driver-account deletion cannot guarantee historical name retention without a backend tombstoned identity. Deactivation remains the safe existing option and deletion consequences are visible.
5. Existing server-generated PDF/XLSX/legacy CSV contents and their complete-range coverage/metadata need backend validation. Client exports and frontend download contracts are tested; no claim is made that unseen server documents match redesigned labels.

Area detail: [data definitions and baseline](baseline.md), [Jobs](jobs-changes.md), [reports](report-changes.md), [road/fleet](road-fleet-changes.md), [records](records-changes.md), [settings/alerts](settings-alerts-changes.md). This is verified frontend implementation, not a production-readiness claim.

[Source inventory](change-inventory.md) separates modified archive files from new helpers/tests.
