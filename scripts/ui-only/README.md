# TMV Glass UI-only local installer

This helper applies the seven approved presentation files to the original `web.zip` or your previous UI-only `web-new-ui.zip` on your own computer. The refreshed Glass UI changes four stylesheets from the previous UI delivery; its Layout, Overview and theme hook are preserved. It does not replace the application with the earlier sample preview. Original authentication, APIs, calculations, workflows, PDF preview, exports, dependencies, tests, and private configuration remain in the copied application.

The published UI overlay contains no original application records or environment files. The installer reads your original archive locally, leaves it untouched, and creates a new application folder and a local `web-new-ui.zip` containing your own configuration.

## Windows

1. Install Node.js 24 or newer.
2. Keep your previous local update at `C:\Users\MicroZaib\Desktop\TMV-New-UI\web-new-ui.zip`, or keep the original archive at `C:\Users\MicroZaib\Desktop\web.zip`.
3. Extract the downloaded UI overlay into a separate folder. Keep its `web` folder beside `apply-new-ui.mjs` and `ui-update.cmd`.
4. Double-click `ui-update.cmd`.

By default, the helper prefers `TMV-New-UI\web-new-ui.zip` on the Windows Desktop when it exists. Otherwise, it reads the original Desktop `web.zip`. It creates a **new** Desktop folder named `TMV-Glass-UI`, keeping your earlier `TMV-New-UI` folder intact. It stops if the new output folder already exists. Existing folders and input archives are never overwritten.

If Windows has moved your Desktop to OneDrive, or you need different paths, open a terminal in the extracted UI-overlay folder and use explicit paths:

```powershell
node .\apply-new-ui.mjs --input "C:\Users\MicroZaib\Desktop\TMV-New-UI\web-new-ui.zip" --output "C:\Users\MicroZaib\Desktop\TMV-Glass-UI"
```

To start from the original uploaded revision instead, pass `--input "C:\Users\MicroZaib\Desktop\web.zip"`. Quoted paths containing spaces are supported. Choose a fresh output folder for each attempt. The source archive must match the complete Layout/Overview pair from either the original uploaded revision or the previous UI-only delivery. Mixed pairs and unrelated revisions are rejected to protect existing changes.

## Build and run locally

Nothing is installed or started automatically. Open a terminal in the new `TMV-Glass-UI\web` folder, then run:

```powershell
npm ci
npm run build
npm run dev -- --host localhost --port 3004
```

Open `http://localhost:3004` and keep the terminal open. Your original backend must be reachable for authentication and operational data. The installer omits the old generated `dist` folder from the **new copy**, so a fresh build is required. The original ZIP retains its original compiled files.

The new `web-new-ui.zip` contains your original private configuration. Keep that locally generated archive private. Only the small public UI overlay is suitable for public download.

## Integrity checks

The installer accepts exactly seven files under the overlay's `web` folder, verifies one complete supported Layout/Overview SHA-256 pair, rejects unsafe ZIP paths, links, duplicate/case-conflicting paths and oversized archives, and refuses to replace an existing output folder. An original archive must not already contain the five new presentation files. A previous UI archive must contain all five as regular files. Starting from the original changes two presentation components and adds five presentation files; upgrading the previous UI refreshes the four stylesheets. All other source/configuration bytes remain unchanged.

Windows uses built-in PowerShell and .NET ZIP support without changing execution policy. Linux/macOS uses Python 3's standard-library ZIP support. No application dependencies are added.

To run the installer tests against a local original ZIP on Linux:

```bash
TMV_TEST_ORIGINAL_ZIP="/path/to/original/web.zip" node --test scripts/ui-only/apply-new-ui.test.mjs
```

The tests use temporary folders and remove their private output copies after completion.
