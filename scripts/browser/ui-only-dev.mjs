// Local test server; it never edits the uploaded Vite configuration or API code.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appRoot = process.env.TMV_UI_BASELINE === '1'
  ? '/workspace/tmv-ui-only-baseline/web' : path.join(repository, 'web');
const port = Number(process.env.TMV_UI_PORT || (process.env.TMV_UI_BASELINE === '1' ? 3014 : 3013));
if (!Number.isInteger(port) || port < 1025 || port > 65535) throw new Error('Invalid development port.');
process.env.VITE_MOCK_API = 'false';
process.chdir(appRoot);
const { createServer } = await import('../../web/node_modules/vite/dist/node/index.js');
const server = await createServer({ root: appRoot, server: {
  host: '127.0.0.1', port, strictPort: true,
  fs: { allow: [appRoot, realpathSync(path.join(appRoot, 'node_modules'))] },
} });
await server.listen();
console.log(`UI-only ${process.env.TMV_UI_BASELINE === '1' ? 'baseline' : 'updated'} test server on port ${port}.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await server.close(); process.exit(0);
});
