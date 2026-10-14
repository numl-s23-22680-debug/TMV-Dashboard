# TMV dashboard — UI-only overlay

This branch contains a seven-file Aurora UI overlay for the user's uploaded **web.zip**, preserving its operations, calculations, newer manual-hours form, six report tabs, PDF preview, exports, and other features.

Apply the overlay to the matching uploaded application. The tracked main archive is an older revision; this branch intentionally does not replace or republish the user's newer original archive or environment files.

The application is verified locally from the uploaded source with the overlay applied. Only Layout.tsx and OverviewPage.tsx have presentation edits; 362 other original files and all 77 original test files are unchanged. New UI files provide theme preferences and scoped screen styles.

See [the handoff](docs/ui-only-handoff.md) and [preservation results](docs/ui-only-preservation.json). Local installer helpers are under scripts/ui-only. Browser verification uses sanitized fixtures and never writes production data.
