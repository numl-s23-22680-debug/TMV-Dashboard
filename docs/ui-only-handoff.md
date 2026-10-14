# TMV Aurora Glass — presentation update

This update uses the newly uploaded application as its source of truth. It applies the Aurora Glass visual design while retaining the upload's operational behavior, including its newer hours-only driver submission and six-tab driver reports.

## What changes

- Floating indigo navigation, a frosted header, and a layered violet/cobalt/cyan background in Light and Midnight.
- Colorful KPI accent rails, tinted icon halos, refined report cards and tables, and restrained glass filter bars.
- Short entrance, hover, and press feedback. Motion completes quickly; reduced-motion preferences remove it.
- Opaque alternatives for reduced transparency or unsupported glass effects. Dense financial rows and PDF paper remain readable.
- Existing 44px shell controls, keyboard focus, mobile card actions, and fullscreen record/PDF previews remain usable.

This iteration changes only four application CSS files relative to the previously delivered UI. Layout.tsx, OverviewPage.tsx, the theme hook, and every operational module are unchanged from that version. The downloadable overlay still contains seven UI files so it can also be applied to the original upload.

## What is preserved

The source comparison checks 364 original source, configuration, asset, and test files. Only Layout.tsx and OverviewPage.tsx have presentation changes. The other 362 are byte-identical, including all 77 original test files, API/authentication code, driver workflows, pricing/payment calculations, evidence actions, GPS integrations, report routes, exports, and PDF renderers.

The two edited files retain identical normalized non-JSX logic and original runtime JSX bindings: 48 shell bindings and 36 Overview bindings. This complements the regression tests; it does not establish external backend/provider availability.

The hours-only driver form keeps schemaVersion 3, half-hour choices, draft persistence, validation, submission protection, and failure behavior. The report keeps Jobs, Performance & Timings, Payments, Comparison, Tunnel Charges, and Congestion Charges. Its original comparison rules and stored finance definitions are unchanged.

The following PDF chain is unchanged: PdfPreviewModal, ReportPreviewCanvas, PrintPortal, PaperDossierReport, PaperJobReport, PaperScenarioReport, PaperAnalyticsReport, reportDocument.css, printReady, and driverReportDownload. Submission preview, zoom, form editing, previous/next navigation, and report-return context remain available.

## Installing the overlay

Use the original web.zip you uploaded or the web-new-ui.zip created by the previous UI installer. The download contains exactly seven application UI files, plus local installer/verification instructions. It contains no environment settings or customer fixtures.

The Windows installer combines the overlay with either matching archive on your own computer and creates a separate Desktop/TMV-Glass-UI folder and local web-new-ui.zip. It prefers Desktop/TMV-New-UI/web-new-ui.zip when available, then falls back to Desktop/web.zip. Your original archive is retained. Existing configuration remains local. Generated dist files must be rebuilt from the updated source.

For an existing extracted project, copy the overlay's web/src contents into your matching web/src folder. Starting from the original upload replaces two presentation components and adds five presentation files; upgrading the previous UI replaces its seven presentation files. Keep the existing package files, environment settings, and all other source files. Use your existing frontend/backend startup configuration.

## Executed checks for this release

- Type-check and final production/PWA build passed. The project has no lint script.
- Source hashes and TypeScript behavior/binding comparison passed: 362 original files byte-identical, all 77 original tests unchanged, and every operational module preserved. This refresh changes only four CSS files from the previous UI delivery.
- The full serial unit run passed 395 of 396 tests across 78 files. One unchanged driver-form test exceeded its original five-second timeout under the shared environment load. Its complete four-test file passed when rerun in isolation with a 15-second timeout; no assertions or original test files were changed. All 396 distinct tests passed across these runs. The initial parallel run was interrupted after environment-related timeouts and is not counted as a passing run.
- Browser checks passed: 108 view/theme/width combinations at 390, 768, and 1366 px, ten wide-desktop checks at 1920 px, 21 motion/accessibility/overlay checks, and 16 preserved-feature workflows. These cover original report tabs and filters, job search/open, menus, navigation context, theme persistence, failed-load retry, submission editing/zoom, and PDF Download/Print callbacks.
- Contrast passed across 36 view/theme/scroll-position checks and 2,526 visible text samples; the measured minimum was 4.75:1. Rendered backgrounds include gradients and glass. These are representative checks, not a claim that every possible state has been measured.
- PDF preview and print text/colors match the untouched upload in both themes. Fullscreen previews passed at all four widths, and dense paper content remains white and readable. Synthetic two-photo workflows and the simpler no-photo overlay fixture have different page counts; neither comparison changes the original renderer.
- Browser evidence uses synthetic records and records no runtime errors, unhandled API endpoints, or operational mutations. The result files include explicit retry provenance for slow dev-server loading and corrected screenshot sampling of clipped or occluded text.
- Twelve installer tests passed, including upgrades from the previous UI, mixed-revision rejection, and existing-output protection. Actual CLI smokes with paths containing spaces verified both source versions, original configuration, input ZIP hashes, all untouched operational bytes, and output ZIP integrity.
- Windows launcher and PowerShell ZIP handling were statically reviewed; actual installer execution was tested on Linux with Python ZIP support.

## Scope and limits

This is a visual update. Financial calculations, labels, report definitions, navigation semantics, backend endpoints, authentication, and operational actions retain the uploaded implementation. Earlier functional audit changes are not substituted for the upload's newer behavior. No production deployment, live messages, prices, or records were changed during testing.

Build output retains the original nonfatal large-chunk warning. External backend, GPS provider, messaging delivery, and real production records were not exercised. Browser fixtures contain explicitly synthetic records; local print callbacks are tested without invoking external services.
