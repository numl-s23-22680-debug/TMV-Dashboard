# TMV Aurora handoff — 14 October 2026

The current application now uses a cohesive violet-led Aurora design across Overview, Jobs, Drivers, Live Fleet, Vehicles, Evidence & Liability, Alerts and Settings. This implements the latest visual brief on top of the original PDF audit's functional corrections. Production authentication, API contracts, billing rules, messages, exports, historical identities and record workflows remain unchanged.

## Implemented experience

- A branded, grouped sidebar retains all eight destinations, compatible URLs, compact/mobile navigation and the user's sidebar preference.
- A command header provides honest Jump to page search, London context, operational alerts, account actions and Light/Midnight/System themes. The preference persists locally, follows the system when unset, synchronizes across tabs and reaches dialogs; it is removed from the document when the dashboard unmounts.
- Overview now shows Total jobs, In progress, Completed and Final charges. The interactive status ring and keyboard-operable legend open exact scoped job filters. The attention panel counts unique affected jobs, preserves partial/error states and opens exact records.
- Final charges aggregate existing stored charge fields in integer pence across all returned workflow statuses. Partial totals show Known subtotal and coverage; absent charges are unknown, genuine recorded zero remains zero, unsafe sums are unavailable. These values are not receipts, bank balances or customer debt.
- Activity supports Trends, Distribution and a booked-date heatmap, plus Day/Week/Month grouping and readable data tables. Missing days remain gaps. Heatmap zero requires complete job-record coverage and valid booked timestamps; its day action opens the matching London date filter. Billed revenue remains a separately labelled summary-API measure.
- Driver reports retain Summary, Jobs & timings, Payments and Road charges. Refined metric cards, driver identity, tabs, rounded gradient bars, themed tooltips and per-point coverage preserve reconciliation, independent statuses and financial meanings.
- Shared surfaces, fields, filters, tables, badges, empty/error states and dialogs use theme tokens. Responsive controls, readable metadata, 44px phone actions, contained heatmap scrolling and reduced-motion handling replace decorative complexity.

## Design system and main files

| File | Responsibility |
| --- | --- |
| `web/src/screens/admin/dashboard/aurora.css` | Light/midnight RGB tokens, surfaces, sidebar/header, buttons, tables, filters, status treatments, portal and print styles |
| `web/src/screens/admin/dashboard/hooks/useDashboardTheme.ts` | Theme preference, system fallback, storage synchronization and document cleanup |
| `web/src/screens/admin/dashboard/Layout.tsx` | Shell, grouped navigation, command header, account/alert controls and theme selection |
| `web/src/screens/admin/dashboard/components/OperationsUI.tsx` | Existing shared headers, metrics with visualization slots, coverage and recoverable states |
| `web/src/screens/admin/dashboard/components/AuroraCharts.tsx` | Reusable SVG status composition and radial language with accessible labels/legends |
| `web/src/screens/admin/dashboard/utils/auroraAnalytics.ts` | Validated status composition, unknown-preserving daily/grouped data, booked-day coverage and stored-charge aggregation |
| `web/src/screens/admin/dashboard/pages/OverviewPage.tsx` | Operational composition, interactions, source/error handling and scoped navigation |
| `web/src/screens/admin/dashboard/styles/aurora-overview.css` | Overview layout, charts and mobile refinement |
| `web/src/screens/admin/dashboard/components/DriverPerformanceCharts.tsx` | Existing real-data report trends, metric choice, gradient bars and coverage tooltips |
| `web/src/screens/admin/dashboard/components/DriverReportView.tsx`, `driverReport.css`, `road-fleet.css` | Report identity, tabs, metric tones and consistent report/road surfaces |
| `DateRangePicker.tsx`, `AdminFilterBar.tsx`, `StatusBadge.tsx` | Shared date presets, scoped filters, independent readable statuses |
| `scripts/browser/aurora-review.mjs` | Sanitized theme/responsive/interaction/contrast verification |
| `scripts/package-preview.py`, `start-dashboard.cmd` | Reproducible portable package and local Windows launcher |

The application stays on React, Vite, TanStack Query, Recharts, Lucide and the existing local font ecosystem. Application package declarations and lockfile are unchanged. No new animation framework or chart dependency was added.

## Checks actually performed

| Check | Result |
| --- | --- |
| Full Vitest suite | **97 files / 477 tests passed** |
| TypeScript | Passed |
| Production/PWA build after final visual fixes | Passed; existing large-chunk warnings remain |
| Existing browser workflows | **24/24 passed** |
| Aurora browser workflows | **13/13 passed** |
| Main responsive matrix | **112/112 passed**: eight screens × six widths × two themes, plus four report tabs at desktop/mobile widths |
| Populated sample-week Overview | Four additional captures passed; reviewed charts, null gaps and labels |
| Rendered contrast | **1,966 visible text runs / 26 view-theme pairs**, no AA failures, minimum 4.88:1; includes direct metric values and scrolled SVG labels |
| Runtime errors / unhandled fixture endpoints | None in the final browser runs |
| Browser executable detection | Six tests passed for Windows Chrome/Edge paths, overrides and fallback |
| Large financial figure at 390px | Full £360,000.00 value remained visible without rounding, clipping or tiny text |
| Fresh portable ZIP | Extracted to a folder with spaces, installed both packages from lockfiles, started the preview and verified week scope, Midnight, exact status/job navigation and blocked operational POSTs with no runtime errors |

Visual review used 390, 768, 1024, 1366, 1440 and 1920px. Actual screenshots were inspected and refined for dark primary controls, avatars, evidence tabs, metric surfaces, disclosure colours, date-field alignment, mobile text size and touch targets. Print surfaces were checked independently of Midnight. The grouped sidebar intentionally places Live Fleet in Operations before Drivers; the existing navigation-order test now matches that hierarchy. The command-palette regression assertion was scoped to its dialog so native theme options are not mistaken for search results.

No lint command/configuration exists in the supplied project. Map tiles and external services were deliberately blocked during sanitized browser checks, so these runs verify fleet list/navigation and map states rather than live provider availability. Contrast sampling and representative keyboard checks are not a formal full-application accessibility certification. Windows batch execution was not performed in the Linux cloud; the extracted package and actual frontend are smoke-tested separately.

## Screenshots and requirements

- [Before Aurora, desktop Overview](screenshots/aurora-before/overview-1366.png)
- [Aurora Light, populated sample week](screenshots/aurora/overview-week-light-1366.png)
- [Midnight Aurora, populated sample week](screenshots/aurora/overview-week-dark-1366.png)
- [Mobile Light](screenshots/aurora/overview-week-light-390.png)
- [Mobile Midnight](screenshots/aurora/overview-week-dark-390.png)
- [All 39 Aurora brief sections](aurora-checklist.md)
- [Original PDF audit reconciliation](audit-checklist.md)

Full local evidence is under `docs/screenshots/aurora`; the portable ZIP includes selected desktop/mobile examples and baseline captures. Preview records are synthetic and visibly labelled. Operational writes are blocked; supported settings changes affect fixture memory only. No production deployment, message sending, reassignment or live-price/record mutation occurred.

## Remaining data dependencies

The backend source is absent. The summary API's daily count date basis is not independently verified, so it is labelled reported daily workload rather than booked or completion dates. The heatmap uses actual job `bookedStart` fields instead. Previous-period comparisons, hourly intensity, authoritative fleet availability, performance scores, customer debt/remittance ledgers, review-decision persistence, incident resolution states and historical tariff effective dates need explicit data/rules. Native booking and automatic dispatch remain future scope. None is represented by invented values or an unfinished navigation destination.

Run the local preview by extracting the ZIP and double-clicking `start-dashboard.cmd` with Node.js 24 installed. It opens the 7–13 October sample week; the production dashboard still defaults to Today. Keep the terminal open and use the header theme selector to switch appearances.
