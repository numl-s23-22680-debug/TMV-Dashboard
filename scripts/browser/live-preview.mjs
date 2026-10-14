import http from 'node:http';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.TMV_PREVIEW_PORT || 3004);
const fixturePort = Number(process.env.TMV_FIXTURE_PORT || 8091);
if (![port, fixturePort].every(value => Number.isInteger(value) && value > 1024 && value < 65536) || port === fixturePort) throw new Error('Choose distinct valid development ports.');
process.env.VITE_MOCK_API = 'false';
const appRoot = path.join(repositoryRoot, 'web');
process.chdir(appRoot);
const { createServer } = await import('../../web/node_modules/vite/dist/node/index.js');
// Start the sample preview on the last seven days so the supplied dated daily
// series can be inspected. The real application's default remains Today.
const appPath = '/admin?section=overview&from=2026-10-07&to=2026-10-13';
const previewMiddleware = (req, res, next) => {
  if (req.url !== '/' && req.url !== '/preview') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TMV · Live UI preview</title><style>html,body{margin:0;height:100%;font:14px system-ui;background:#f6f8fc;color:#182438}body{display:flex;flex-direction:column}.notice{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;background:#fff7e8;border-bottom:1px solid #ead9b9;font-size:13px}.notice strong{color:#805111}.notice span{color:#645231}.notice a{margin-left:auto;color:#254faa;font-weight:600}iframe{width:100%;flex:1;border:0;min-height:0}</style></head><body><div class="notice" role="status"><strong>Interactive UI preview</strong><span>Sample snapshot: 13 Oct 2026 · Live operations disabled · Hot reload</span><a href="${appPath}" target="_blank" rel="noopener">Open full dashboard</a></div><iframe title="The Man Van operations dashboard" src="${appPath}"></iframe></body></html>`);
};
const vite = await createServer({
  root: appRoot,
  plugins: [{
    name: 'tmv-sample-preview-wrapper',
    configureServer(server) { server.middlewares.use(previewMiddleware); },
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'script', injectTo: 'head-prepend', children: `
        // The sample fixtures are a dated snapshot, not live operational records.
        const originalDate = window.Date;
        const sampleStart = originalDate.parse('2026-10-13T11:00:00.000Z');
        const elapsedStart = performance.now();
        const sampleNow = () => sampleStart + performance.now() - elapsedStart;
        window.Date = new Proxy(originalDate, {
          construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [sampleNow()], newTarget); },
          apply() { return new originalDate(sampleNow()).toString(); },
          get(target, key) { return key === 'now' ? sampleNow : Reflect.get(target, key); }
        });
      ` }],
    },
  }],
  server: {
    host: '0.0.0.0', port, strictPort: true,
    fs: { allow: [appRoot, realpathSync(path.join(appRoot, 'node_modules'))] },
    proxy: { '/api': { target: `http://127.0.0.1:${fixturePort}`, changeOrigin: true }, '/healthz': { target: `http://127.0.0.1:${fixturePort}` } },
  },
});
await vite.listen();

// Existing browser fixtures are loaded from the actual application source.
// They are isolated here: production auth/API code is never changed.
process.env.TMV_BASE_URL = `http://localhost:${port}`;
const { apiFixture, browser } = await import('./capture.mjs');
await browser.close();
const api = http.createServer(async (req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"sampleData":true}'); return; }
  let body = '';
  try {
    for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) throw new Error('Preview request too large'); }
    await apiFixture({
      request: () => ({ url: () => `http://localhost:${port}${req.url}`, method: () => req.method, postData: () => body || null, postDataJSON: () => JSON.parse(body || '{}') }),
      fulfill: async ({ status = 200, json, body: text, contentType, headers = {} }) => {
        res.writeHead(status, { 'Content-Type': contentType || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-TMV-Preview': 'sample-data', ...headers });
        res.end(json !== undefined ? JSON.stringify(json) : text || '');
      },
    });
  } catch (error) {
    if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'application/json' });
    if (!res.writableEnded) res.end(JSON.stringify({ error: { message: error.message || 'Preview request failed' } }));
  }
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(fixturePort, '127.0.0.1', resolve); });
console.log(`Live updated dashboard preview is running on port ${port}.`);
console.log('Uses sample records; API writes are blocked except in-memory test settings.');
const previewUrl = `http://localhost:${port}/preview`;
console.log(`On the computer running this server, open ${previewUrl}`);
console.log('Keep this terminal open. Press Ctrl+C to stop the preview.');
// Open only after both services are ready. The URL is generated from a validated
// numeric port, so no user-supplied command text enters the Windows shell.
if (process.env.TMV_OPEN_BROWSER === '1') {
  const opener = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${previewUrl}"`], { windowsVerbatimArguments: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [previewUrl], { stdio: 'ignore' });
  opener.on('error', () => console.log(`Browser could not be opened automatically. Open ${previewUrl} manually.`));
  opener.on('exit', code => { if (code) console.log(`Browser could not be opened automatically. Open ${previewUrl} manually.`); });
  opener.unref();
}
let closing = false;
async function close() { if (closing) return; closing = true; api.close(); await vite.close(); process.exit(0); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
