# TMV UI-only update for the uploaded web.zip

This update uses the newly uploaded application as its source of truth. It applies the Aurora visual design while retaining the upload's operational behavior, including its newer hours-only driver submission and six-tab driver reports.

## What changes

- Purple application shell, readable navigation, refined page spacing, fields, tables, and cards.
- Light, Midnight, and System theme preferences, stored separately from the driver application's theme.
- Compact, colorful presentation of the existing four Overview metrics and existing revenue chart.
- Consistent presentation of all six original report tabs, performance charts, payments, comparisons, tunnel charges, and congestion charges.
- Responsive styles and visible keyboard focus. PDF paper retains the original light styling in both themes. Screen-only fixes keep fullscreen previews at the viewport edge, job-card actions inside mobile cards, and selected segmented controls readable.

## What is preserved

The source comparison checks 364 original source, configuration, asset, and test files. Only Layout.tsx and OverviewPage.tsx have presentation changes. The other 362 are byte-identical, including all 77 original test files, API/authentication code, driver workflows, pricing/payment calculations, evidence actions, GPS integrations, report routes, exports, and PDF renderers.

The two edited files retain identical normalized non-JSX logic and original runtime JSX bindings: 48 shell bindings and 36 Overview bindings. This complements the regression tests; it does not establish external backend/provider availability.

The hours-only driver form keeps schemaVersion 3, half-hour choices, draft persistence, validation, submission protection, and failure behavior. The report keeps Jobs, Performance & Timings, Payments, Comparison, Tunnel Charges, and Congestion Charges. Its original comparison rules and stored finance definitions are unchanged.

The following PDF chain is unchanged: PdfPreviewModal, ReportPreviewCanvas, PrintPortal, PaperDossierReport, PaperJobReport, PaperScenarioReport, PaperAnalyticsReport, reportDocument.css, printReady, and driverReportDownload. Submission preview, zoom, form editing, previous/next navigation, and report-return context remain available.

## Installing the overlay

Use the original web.zip you uploaded. The download contains exactly seven application UI files, plus local installer/verification instructions. It contains no environment settings or customer fixtures.

The Windows installer combines the UI overlay with your original archive on your own computer and creates a separate updated folder/ZIP. Your original archive is retained. Existing configuration remains local. Generated dist files must be rebuilt from the updated source.

For an existing extracted project, copy the overlay's web/src contents into your matching web/src folder, allowing the two UI files to be replaced and five new files to be added. Keep the existing package files, environment settings, and all other source files. Use your existing frontend/backend startup configuration.

## Executed checks

- Uploaded baseline: 77 test files / 390 tests passed; type-check and production/PWA build passed.
- Updated source: 78 test files / 396 tests passed, including all original tests and six theme tests; type-check and production/PWA build passed.
- File hashes and TypeScript behavior/binding comparison passed; details are in ui-only-preservation.json.
- Browser checks: 16 workflows passed, including all six report tabs and their range, payments/comparison/timing filters, exact job search/open, pagination, theme persistence/system, submission zoom/back-to-form, PDF Download/Print callbacks, and failed-load retry.
- Responsive review: 108 view/theme/width combinations passed at 390, 768, and 1366 px across 18 views; ten untouched baseline captures provide comparisons.
- Chromium-generated dossier and submission PDFs have exactly matching extracted text and page counts against the untouched baseline in both themes (three-page dossier and two-page submission).
- Eight local installer tests passed against the uploaded ZIP. A real seven-file CLI smoke with spaces in paths preserved 363 original files, including the local environment configuration, and retained the original ZIP SHA-256.
- Windows launcher and PowerShell ZIP handling were statically reviewed; installer execution was tested on Linux with Python ZIP support.

## Scope and limits

This is a visual update. Financial calculations, labels, report definitions, navigation semantics, backend endpoints, authentication, and operational actions retain the uploaded implementation. Earlier functional audit changes are not substituted for the upload's newer behavior. No production deployment, live messages, prices, or records were changed during testing.

Build output retains the original nonfatal large-chunk warning. External backend, GPS provider, messaging delivery, and real production records were not exercised. Browser fixtures contain explicitly synthetic records; local print callbacks are tested without invoking external services.
