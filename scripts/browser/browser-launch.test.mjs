import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserLaunchOptions } from './browser-launch.mjs';

test('Windows detects Chrome in a path containing spaces', () => {
  const executable = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const options = browserLaunchOptions({ platform: 'win32', env: { PROGRAMFILES: 'C:\\Program Files' }, exists: file => file === executable });
  assert.equal(options.executablePath, executable);
  assert.deepEqual(options.args, []);
});
test('Windows supports Edge and per-user Chrome installations', () => {
  for (const [env, executable] of [
    [{ 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)' }, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    [{ LOCALAPPDATA: 'C:\\Users\\Sample User\\AppData\\Local' }, 'C:\\Users\\Sample User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'],
  ]) assert.equal(browserLaunchOptions({ platform: 'win32', env, exists: file => file === executable }).executablePath, executable);
});
test('An explicit browser path has priority', () => {
  assert.equal(browserLaunchOptions({ platform: 'win32', env: { TMV_CHROMIUM_PATH: 'D:\\Chrome\\chrome.exe' }, exists: () => true }).executablePath, 'D:\\Chrome\\chrome.exe');
});
test('An invalid override reports an actionable error', () => {
  assert.throws(() => browserLaunchOptions({ env: { TMV_CHROMIUM_PATH: '/missing' }, exists: () => false }), /TMV_CHROMIUM_PATH/);
});
test('A Playwright-installed Chromium is a supported fallback', () => {
  assert.equal(browserLaunchOptions({ platform: 'win32', env: {}, bundledPath: 'C:\\Browser\\chrome.exe', exists: file => file === 'C:\\Browser\\chrome.exe' }).executablePath, 'C:\\Browser\\chrome.exe');
});
test('Missing browsers report the supported installation command', () => {
  assert.throws(() => browserLaunchOptions({ platform: 'win32', env: {}, exists: () => false }), /playwright install chromium/);
});
