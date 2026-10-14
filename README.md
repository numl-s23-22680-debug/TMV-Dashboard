# The Man Van dashboard

The current editable application is in `web/`. The original `web.zip` remains unchanged as the supplied baseline; do not deploy or edit that archive as the redesigned source. No backend source is included in this repository.

For a local Windows preview, follow [WINDOWS-PREVIEW.md](WINDOWS-PREVIEW.md) and double-click `start-dashboard.cmd`. It starts the actual updated frontend with sample records and opens the browser after startup. Cloud localhost addresses are only reachable on the cloud machine; this launcher runs the server on your own computer. The portable preview ZIP excludes the original archive, environment files and installed dependencies.

The current interface is **TMV Aurora**, with Light/Midnight/System themes, grouped navigation, interactive status composition, activity trends, a booked-date heatmap and refined reports. See the [Aurora handoff](docs/aurora-handoff.md) and [39-section brief checklist](docs/aurora-checklist.md) for implementation, actual verification and data dependencies.

Use Node.js 24 and npm 11:

```sh
cd web
npm ci
npm run dev
npm run typecheck
npm run test:run -- --maxWorkers=3
npm run build
```

Admin entry: `/admin`. Authentication and administrative requests still use the existing `/api/admin` endpoints. Vite's proxy uses `BACKEND_TARGET` and defaults to the local backend on port 8090. Do not commit `.env.local` or credentials. The existing driver mock API is enabled in development; use `VITE_MOCK_API=false` when connecting to a safe local/staging backend or running the fully intercepted browser harness.

The isolated browser tooling in [scripts/browser](scripts/browser/README.md) supplies sanitized in-memory fixtures through route interception. It never adds operational totals to the application and blocks all live API writes, except simulated settings changes held in memory. It is useful for reviewing the frontend when the backend is unavailable.

See [the implementation checklist](docs/audit-checklist.md), [data definitions and baseline](docs/baseline.md), and [the handoff](docs/handoff.md) for the changes, verified checks, screenshots, and unresolved backend/business-rule questions. No production deployment is part of this work.
