# Safe local browser checks

This independent package leaves application dependencies unchanged. It uses the existing sanitized driver report sample to supply synthetic admin fixtures, derives synthetic jobs and driver summaries from those rows, and intercepts **every API request**. Unknown APIs return a fixture error. External destinations are blocked. Settings writes exist only in fixture memory; all other writes return 405. No real messages, assignments, prices, or records are changed.

Run from the repository root:

```sh
npm ci --prefix scripts/browser
VITE_MOCK_API=false npm --prefix web run dev -- --host 0.0.0.0 --port 3002 --strictPort
```

In another terminal:

```sh
npm --prefix scripts/browser run workflows
npm --prefix scripts/browser run contrast
npm --prefix scripts/browser run timing-status
TMV_WIDTHS=390,768,1366,1920 npm --prefix scripts/browser run capture
```

An installed Chromium, Chrome or Edge is detected automatically on Linux, Windows and macOS; set `TMV_CHROMIUM_PATH` for another installation. Set `TMV_BASE_URL` for another local frontend port. Set `TMV_PHASE=before` to write a baseline against an untouched checkout running on another port. The Vite built-in mock API must be disabled so browser route interception owns the synthetic data.

Screenshots and JSON results are written relative to this repository, under `docs/screenshots/<phase>`. `TMV_VIEWS=overview,jobs,driver-report,payments,vehicles,settings,job-detail` selects views; `TMV_WIDTHS=1366,390` selects widths; `TMV_SCREENSHOTS` overrides screenshot output. `TMV_WORKFLOW_FILTER=settings` runs a targeted subset; `TMV_WORKFLOW_OUTPUT` overrides smoke result output.

The context uses London time, a fixed synthetic date, reduced motion, and blocked service workers. Contrast checks use computed foreground and composited ancestor backgrounds for visible text, excluding disabled controls, with WCAG AA thresholds. This is a focused automated check, not a complete accessibility certification.

The workflow runner covers page search, exact job search/navigation, legacy report tabs, report return state, receipts versus invoices, missing submissions across all pages, unlinked road events, zero evidence pagination, overdue vehicle dates, exact Fleet job navigation/return, settings saved baseline and partial failure, unsaved navigation, recoverable API errors, native browser history, template typing/preview, actual scrolled list returns and sidebar preference.

## Interactive live preview

Run `npm --prefix scripts/browser run live` from the repository root after installing both `web` and `scripts/browser` dependencies. This starts the real editable Vite app on port 3004 and a private sample-data API on port 8091. Open `/preview` on port 3004 using the `localhost` hostname in your local browser, or forward the cloud port to localhost first. The existing app gates its admin route to localhost and the dashboard domain. The wrapper visibly labels the 13 Oct 2026 sample snapshot; the preview-only browser clock matches that fixture date. navigation, charts, filters and hot reload use the real application. Production endpoints are not used. Operational writes are blocked; settings edits are held in fixture memory and reset on restart. Set `TMV_PREVIEW_PORT` and `TMV_FIXTURE_PORT` to change the two ports.

A cloud session without browser or port-preview capability cannot display this server directly to the user; a loopback address in the cloud is not a remotely reachable preview link.

## Aurora light and midnight review

With the isolated live preview running, execute `TMV_BASE_URL=http://localhost:3004 npm --prefix scripts/browser run aurora`. The review covers the eight destinations at 390, 768, 1024, 1366, 1440 and 1920px in both themes, plus the four driver-report tabs at desktop/mobile widths. It also checks theme persistence/system preference, chart navigation, date scope, empty/error states, keyboard controls and rendered text contrast. Python 3 and Pillow are required for the contrast sampling tool; they are not required by the Windows dashboard launcher.

Use `TMV_AURORA_MODE=matrix`, `workflows` or `contrast` for a focused review. `TMV_VIEWS`, `TMV_WIDTHS` and `TMV_THEMES` select a subset. Results and screenshots are written to `docs/screenshots/aurora`; the original baseline remains separate.
