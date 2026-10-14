import { existsSync } from 'node:fs';
import path from 'node:path';

// Reuse an installed browser on Windows/macOS as well as the cloud's Chromium.
export function browserLaunchOptions({ platform = process.platform, env = process.env, exists = existsSync, bundledPath } = {}) {
  const args = platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
  if (env.TMV_CHROMIUM_PATH) {
    if (!exists(env.TMV_CHROMIUM_PATH)) throw new Error('TMV_CHROMIUM_PATH does not point to an installed browser.');
    return { executablePath: env.TMV_CHROMIUM_PATH, headless: true, args };
  }
  const candidates = platform === 'win32'
    ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).flatMap(root => [
      path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ])
    : platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/opt/google/chrome/chrome'];
  const executablePath = [...candidates, bundledPath].filter(Boolean).find(exists);
  if (!executablePath) throw new Error('No supported browser found. Install Chrome or Edge, or run: npm --prefix scripts/browser exec -- playwright install chromium');
  return { executablePath, headless: true, args };
}
