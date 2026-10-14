# Local preview verification — 14 October 2026

The Windows user's `localhost:3004` could not reach a server running on the cloud computer. A local launcher now installs frozen dependencies, starts the real app with the isolated sample API, and opens the browser after both services are ready. No production routing, authentication or application dependencies were changed.

Performed checks:

- Six Node tests passed for Windows Chrome/Edge paths, paths with spaces, explicit overrides, missing browser errors and bundled Chromium fallback.
- The generated ZIP passed CRC validation and excludes `node_modules`, environment files, Git metadata and the original archive.
- Extracted the ZIP to a clean folder with spaces in its path and installed both dependency packages from their lockfiles.
- Started the extracted app on separate test ports. Its health endpoint identified sample data; an operational POST returned 405.
- In Chromium, loaded Overview, searched Jobs for DEMO-009, and opened that exact record with no runtime errors. Inspected the screenshot for rendered styling and readable content.
- Statically reviewed Windows batch quoting, dependency cache checks and automatic browser opening. Windows execution was not performed in the Linux cloud environment.

The default preview remains a dated, clearly labeled 13 October 2026 sample snapshot. Settings writes affect memory only. Live jobs, messages, prices and records are untouched. Keep the launcher terminal open while using the browser.

For download distribution, personal-looking values in four existing test fixtures were replaced with sample names, example-domain email addresses, reserved test phone numbers and synthetic locations. The four affected test files passed all 18 tests. A review of the updated source and bundled screenshot found no remaining concrete credential or personal-data findings. The original archive and operational application code were untouched by this cleanup.
