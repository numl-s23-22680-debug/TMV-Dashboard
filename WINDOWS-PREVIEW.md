# Run the updated dashboard on Windows

1. Install [Node.js 24 LTS](https://nodejs.org/en/download), including npm, if it is not already installed.
2. Extract the entire preview ZIP to a folder. Do not run it from inside the ZIP.
3. Double-click **start-dashboard.cmd**. The first launch installs the locked dependencies and needs internet access.
4. Wait for startup. Your browser opens **http://localhost:3004/preview** automatically. Keep the terminal window open while using the dashboard.

This runs the updated application on your own computer, so `localhost:3004` works there. The earlier cloud server runs on a different computer and cannot be reached through your Windows localhost address.

The preview uses a clearly labeled **13 October 2026 sample snapshot**, with an in-memory API. It does not connect to production operations. Operational writes are blocked; supported settings edits are simulated in memory and reset when the preview restarts. Navigation, filters, charts, job details and responsive layouts use the real application code.

The updated Aurora preview opens the **7–13 October sample week** so its dated charts can be inspected. Select Today for the daily workflow. The production dashboard still defaults to Today. Use the header's **Dashboard theme** selector for Light, Midnight or System; your choice is remembered locally.

To stop the preview, press **Ctrl+C** in its terminal window. If the browser does not open automatically, wait for the ready message and open **http://localhost:3004/preview** manually. Use `localhost` in the address because the existing application restricts its administrative route to recognized hostnames.

If startup reports that port 3004 or 8091 is already in use, close any previous preview terminal and retry. Errors remain visible in the terminal. The launcher requires Node.js 24 or newer and reinstalls dependencies when its saved lockfile fingerprint changes.

The preview server was tested in the cloud's Linux environment. The Windows launcher was statically reviewed; Windows execution must still be verified on your computer.
