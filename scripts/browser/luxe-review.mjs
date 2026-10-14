/**
 * Premium UI presentation checks against the original operational frontend.
 * All API responses are the existing sanitized fixture; no operational writes
 * or external calls are permitted. Contrast samples the rendered background,
 * including gradients and glass, with the foreground text temporarily hidden.
 *
 * TMV_BASE_URL=http://localhost:3013 node scripts/browser/luxe-review.mjs
 * Optional TMV_LUXE_MODE=all|matrix|workflows|contrast|wide
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { browser, base, createFixturePage, errors, mutations, unhandled, repositoryRoot } from './capture.mjs';

const baseline = process.env.TMV_BASELINE_URL || 'http://localhost:3014';
const out = process.env.TMV_LUXE_OUTPUT || path.join(repositoryRoot, 'docs/screenshots/luxe');
const mode = process.env.TMV_LUXE_MODE || 'all';
const results = { matrix: [], workflows: [], wide: [], contrast: [], papers: [], sanitizedFixture: true, base, baseline };
await fs.mkdir(out, { recursive: true });
const report = 'section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11';
const job = page => page.locator('main').getByRole('button').filter({ hasText: 'DEMO-001' }).first();
const views = [
  { name: 'overview', query: 'section=overview', ready: async page => { await page.getByRole('radio', { name: 'Overview', exact: true }).click(); await page.getByText('Gross Revenue', { exact: true }).waitFor(); } },
  { name: 'jobs', query: 'section=jobs', ready: page => page.locator('main').getByRole('button').filter({ hasText: /DEMO-\d{3}/ }).first().waitFor() },
  { name: 'drivers', query: 'section=drivers', ready: page => page.locator('main').getByText('Sample Driver', { exact: true }).first().waitFor() },
  { name: 'vehicles', query: 'section=van', ready: page => page.locator('main').getByText('demo@example.test', { exact: true }).first().waitFor() },
  { name: 'evidence', query: 'section=liabilities&liabilityTab=checkin', ready: page => page.locator('main').getByText('Sample Customer One', { exact: true }).waitFor() },
  { name: 'alerts', query: 'section=notifications', ready: page => page.locator('main').getByText('Sample Customer Four', { exact: true }).first().waitFor() },
  { name: 'settings', query: 'section=configurations', ready: page => page.locator('main input[type="number"]').first().waitFor() },
  { name: 'live-fleet', query: 'section=livefleet', ready: page => page.locator('main').getByText('Driver: Sample Driver', { exact: true }).first().waitFor() },
  ...[['jobs', 'Jobs'], ['performance', 'Performance & Timings'], ['payments', 'Payments'], ['comparison', 'Comparison'], ['tunnels', 'Tunnel Charges'], ['congestion', 'Congestion Charges']].map(([key, label]) => ({
    name: 'report-' + key, query: report + '&reportTab=' + key,
    ready: async page => { await page.getByRole('tab', { name: label, exact: true }).waitFor(); if (['tunnels', 'congestion'].includes(key)) await page.getByText('Loading movement and charge details...', { exact: true }).waitFor({ state: 'hidden' }); },
  })),
];
async function create(theme = 'light', width = 1366, origin = base, motion = 'reduce') {
  const value = await createFixturePage(width, width === 390 ? 844 : 1000, origin);
  value.page.setDefaultTimeout(30000);
  value.page.setDefaultNavigationTimeout(60000);
  await value.page.emulateMedia({ reducedMotion: motion });
  await value.context.addInitScript(next => localStorage.setItem('tmv:dashboard-theme', next), theme);
  return value;
}
async function load(page, view = views[0], origin = base) {
  await page.goto(origin + '/admin?' + view.query, { waitUntil: 'domcontentloaded' });
  await view.ready(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
}
async function test(name, fn, { theme = 'light', width = 1366, motion = 'reduce' } = {}) {
  if (process.env.TMV_LUXE_WORKFLOW_FILTER && !name.toLowerCase().includes(process.env.TMV_LUXE_WORKFLOW_FILTER.toLowerCase())) return;
  const { context, page } = await create(theme, width, base, motion);
  try { await fn(page, context); results.workflows.push({ name, theme, width, motion, passed: true }); await fs.rm(path.join(out, 'failed-' + name.replace(/[^a-z0-9]+/gi, '-') + '-' + theme + '-' + width + '.png'), { force: true }); console.log('PASS ' + name + ' ' + theme + ' ' + width); }
  catch (error) { results.workflows.push({ name, theme, width, motion, passed: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message); await page.screenshot({ path: path.join(out, 'failed-' + name.replace(/[^a-z0-9]+/gi, '-') + '-' + theme + '-' + width + '.png') }).catch(() => {}); }
  finally { await context.close(); }
}
async function fixedBounds(locator) {
  return locator.evaluate(el => {
    let fixed = el;
    while (fixed && getComputedStyle(fixed).position !== 'fixed') fixed = fixed.parentElement;
    if (!fixed) return null;
    const r = fixed.getBoundingClientRect();
    const ancestors = []; for (let e = fixed.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.transform !== 'none' || s.backdropFilter !== 'none' || s.filter !== 'none') ancestors.push({ tag: e.tagName, className: String(e.className), transform: s.transform, backdropFilter: s.backdropFilter, filter: s.filter }); }
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight, ancestors };
  });
}
function assertViewport(bounds) {
  assert.ok(bounds, 'fixed overlay exists');
  for (const [key, expected] of [['left', 0], ['top', 0], ['right', bounds.width], ['bottom', bounds.height]]) assert.ok(Math.abs(bounds[key] - expected) <= 1, key + ': ' + bounds[key] + ' expected ' + expected);
}
async function openJob(page) {
  const search = page.locator('main input[type="text"]').first(); await search.fill('DEMO-001'); await job(page).waitFor();
  await job(page).click(); await page.getByRole('button', { name: 'Close Drawer' }).waitFor();
}
async function dossier(page) { await openJob(page); await page.getByRole('button', { name: 'Download PDF', exact: true }).click(); await page.getByRole('dialog', { name: 'Report preview' }).waitFor(); await page.locator('.report-preview-page').first().waitFor(); }
async function paperSnapshot(page) {
  return page.locator('.report-preview-page').evaluateAll(els => els.map(el => ({ text: el.innerText, background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color })));
}
async function submissionPreview(page) {
  const row = page.locator('main tbody tr').filter({ hasText: 'Sample Customer One' }).first();
  await row.getByText('Sample Customer One', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview PDF', exact: true }).click();
  await page.locator('.report-preview-page').first().waitFor();
}
if (mode === 'matrix') {
  const matrixViews = [...views,
    { name: 'driver-breakdown', query: 'section=overview', ready: page => page.locator('main').getByRole('heading', { name: 'Driver Breakdown', exact: true }).waitFor() },
    { name: 'job-detail', query: 'section=jobs', ready: async page => { await views[1].ready(page); await openJob(page); } },
    { name: 'pdf-preview', query: 'section=jobs', ready: async page => { await views[1].ready(page); await dossier(page); } },
    { name: 'submission-preview', query: 'section=liabilities&liabilityTab=checkin', ready: async page => { await views.find(v => v.name === 'evidence').ready(page); await submissionPreview(page); } },
  ];
  for (const theme of (process.env.TMV_LUXE_THEMES || 'light,dark').split(',')) for (const width of (process.env.TMV_LUXE_WIDTHS || '390,768,1366').split(',').map(Number)) {
    // Reusing a context/page lets Vite's large unchanged operational modules use
    // the browser cache. Every view still remounts through a fresh navigation.
    const { context, page } = await create(theme, width);
    try {
      for (const view of matrixViews.filter(v => !process.env.TMV_LUXE_VIEWS || process.env.TMV_LUXE_VIEWS.split(',').includes(v.name))) {
        try {
          await load(page, view);
          const state = await page.evaluate(() => ({ theme: document.documentElement.dataset.dashboardTheme, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clippedHeadings: [...document.querySelectorAll('main h1,main h2,main h3')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.left < -.5 || r.right > innerWidth + .5); }).map(el => el.textContent) }));
          assert.equal(state.theme, theme); assert.equal(state.width, state.scrollWidth); assert.deepEqual(state.clippedHeadings, []);
          if (view.name === 'job-detail') assertViewport(await fixedBounds(page.getByRole('button', { name: 'Close Drawer' })));
          if (view.name === 'pdf-preview') assertViewport(await fixedBounds(page.getByRole('dialog', { name: 'Report preview' })));
          const directory = path.join(out, 'after'); await fs.mkdir(directory, { recursive: true });
          const file = view.name + '-' + theme + '-' + width;
          await page.screenshot({ path: path.join(directory, file + '.png'), fullPage: true });
          await page.screenshot({ path: path.join(directory, file + '-viewport.png') });
          results.matrix.push({ name: view.name, theme, ...state, passed: true }); console.log('PASS matrix ' + file);
        } catch (error) {
          results.matrix.push({ name: view.name, theme, width, passed: false, error: error.message }); console.log('FAIL matrix ' + view.name + ' ' + theme + ' ' + width + ': ' + error.message);
          await page.screenshot({ path: path.join(out, 'failed-matrix-' + view.name + '-' + theme + '-' + width + '.png') }).catch(() => {});
        }
      }
    } finally { await context.close(); }
  }
}
if (['all', 'workflows'].includes(mode)) {
  for (const theme of ['light', 'dark']) {
    await test('Motion enabled entrances settle visibly without persistent content transforms', async page => {
      await load(page);
      const first = await page.locator('.ui-only-overview-metric').evaluateAll(els => els.map(el => ({ name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration })));
      assert.equal(first.length, 4);
      assert.ok(first.every(row => row.name !== 'none' && parseFloat(row.duration) > 0), 'metric entrance animation defined');
      const frame = await page.locator('.ui-only-overview-metric').first().evaluate(el => {
        el.style.animation = 'none'; void el.offsetHeight; el.style.removeProperty('animation');
        const animation = el.getAnimations()[0];
        if (!animation) return null;
        animation.pause(); animation.currentTime = 70;
        const s = getComputedStyle(el); const at70ms = { opacity: Number(s.opacity), transform: s.transform };
        animation.currentTime = 1000; animation.play(); return at70ms;
      });
      assert.ok(frame && frame.opacity > 0 && frame.opacity < 1 && frame.transform !== 'none', 'actual intermediate animation frame is rendered');
      await page.waitForTimeout(800);
      const settled = await page.locator('.ui-only-overview-metric').evaluateAll(els => els.map(el => ({ opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform })));
      assert.ok(settled.every(row => row.opacity === '1' && row.transform === 'none'), 'finished metrics visible; no persistent transformed containing block');
      await page.screenshot({ path: path.join(out, 'overview-' + theme + '-1366-motion.png') });
      await load(page, views.find(view => view.name === 'report-performance'));
      const panel = page.locator('.rpt-page > [role="tabpanel"]');
      assert.notEqual(await panel.evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.waitForTimeout(450);
      assert.equal(await panel.evaluate(el => getComputedStyle(el).opacity), '1');
    }, { theme, motion: 'no-preference' });
    await test('Reduced motion keeps metrics and report content static and visible', async page => {
      await load(page);
      const state = await page.locator('.ui-only-overview-metric').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { name: s.animationName, duration: parseFloat(s.animationDuration), opacity: s.opacity, transform: s.transform }; }));
      assert.ok(state.every(row => row.opacity === '1' && row.transform === 'none' && (row.name === 'none' || row.duration <= .00001)));
      await load(page, views.find(view => view.name === 'report-performance'));
      assert.equal(await page.locator('.rpt-page > [role="tabpanel"]').evaluate(el => getComputedStyle(el).animationName), 'none');
    }, { theme });
    await test('Reduced transparency uses opaque glass fallback', async (page, context) => {
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await load(page);
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches), true);
      const state = await page.locator('.aurora-header,.ui-only-overview-metric,.ui-only-overview-filters > div,.ui-only-overview-tabs,.ui-only-overview-revenue,.ui-only-overview-drivers').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { className: el.className, background: s.backgroundColor, backdrop: s.backdropFilter }; }));
      assert.ok(state.length >= 8);
      for (const row of state) { assert.equal(row.backdrop, 'none', row.className + ' disables backdrop'); assert.ok(!row.background.startsWith('rgba(') || row.background.endsWith(', 1)'), row.className + ' opaque: ' + row.background); }
      await page.screenshot({ path: path.join(out, 'overview-' + theme + '-1366-opaque.png') });
      await load(page, views.find(view => view.name === 'report-payments'));
      assert.equal(await page.locator('.rpt-toolbar').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    }, { theme });
    for (const width of [390, 768, 1366, 1920]) {
      await test('Job and PDF overlays stay anchored to the entire viewport', async page => {
        await load(page, views[1]);
        await openJob(page);
        assertViewport(await fixedBounds(page.getByRole('button', { name: 'Close Drawer' })));
        await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Report preview' }); await dialog.waitFor();
        assertViewport(await fixedBounds(dialog));
        await page.locator('.report-preview-page').first().waitFor();
        const papers = await paperSnapshot(page);
        for (const paper of papers) { assert.equal(paper.background, 'rgb(255, 255, 255)'); assert.equal(paper.color, 'rgb(17, 22, 32)'); }
        results.papers.push({ theme, width, pages: papers.length, overlay: await fixedBounds(dialog) });
      }, { theme, width, motion: 'no-preference' });
    }
    await test('Keyboard focus, account popup and notification popup remain visible above glass', async page => {
      await load(page);
      const themeControl = page.getByRole('combobox', { name: 'Dashboard theme' });
      await themeControl.focus();
      const focus = await themeControl.evaluate(el => { const s = getComputedStyle(el); const p = getComputedStyle(el.parentElement); return { focused: el === document.activeElement, outline: s.outlineStyle, shadow: s.boxShadow, parentShadow: p.boxShadow }; });
      assert.equal(focus.focused, true); assert.ok(focus.outline !== 'none' || focus.shadow !== 'none' || focus.parentShadow !== 'none', 'visible focus styling');
      const account = page.getByRole('button', { name: 'Account menu' }); await account.focus(); await page.keyboard.press('Enter');
      const popup = page.locator('.aurora-account-menu'); await popup.waitFor();
      const bounds = await popup.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1366 && bounds.y + bounds.height <= 1000);
      assert.equal(await popup.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 20)); }), true, 'popup above content');
      await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' });
      const bell = page.getByRole('button', { name: 'Notifications', exact: true }); await bell.focus(); await page.keyboard.press('Enter');
      const menu = page.getByRole('menu'); await menu.waitFor();
      assert.equal(await menu.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 25)); }), true, 'notification dropdown above content');
      await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' });
    }, { theme });
    for (const width of [390, 1366]) await test('Job action dropdown paints above neighboring glass cards', async page => {
      await load(page, views[1]);
      const actions = page.locator('main').getByRole('button', { name: /^Actions for job / }).first();
      await actions.scrollIntoViewIfNeeded(); await actions.hover(); await actions.click();
      const option = page.getByRole('button', { name: 'Reassign driver', exact: true }); await option.waitFor();
      assert.equal(await option.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), true, 'menu action is on top and clickable');
      await page.waitForTimeout(220); // let the existing hover feedback return to its resting frame
      assert.equal(await actions.evaluate(el => getComputedStyle(el.closest('article')).transform), 'none', 'open-menu card stops hover transform');
      await page.screenshot({ path: path.join(out, 'jobs-' + theme + '-' + width + '-actions.png') });
      assert.equal(mutations.length, 0);
    }, { theme, width, motion: 'no-preference' });
  }
  await test('Preview and print text stay identical to the uploaded original', async page => {
    const old = await create('light', 1366, baseline);
    try {
      for (const [kind, view] of [['dossier', views[1]], ['submission', views.find(v => v.name === 'evidence')]]) {
        const open = async (p, origin) => {
          await load(p, view, origin);
          if (kind === 'dossier') await dossier(p);
          else await submissionPreview(p);
        };
        await open(page, base); await open(old.page, baseline);
        const current = await paperSnapshot(page), original = await paperSnapshot(old.page);
        assert.deepEqual(current, original, kind + ' original paper contents and colors');
        await page.evaluate(() => document.body.classList.add('printing-report'));
        await old.page.evaluate(() => document.body.classList.add('printing-report'));
        await page.emulateMedia({ media: 'print' }); await old.page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('#tmv-print-portal').innerText(), await old.page.locator('#tmv-print-portal').innerText(), kind + ' printed text matches original');
        results.papers.push({ kind, pages: current.length, previewTextMatchesOriginal: true, printTextMatchesOriginal: true });
        await page.pdf({ path: path.join(out, kind + '-luxe-original-text.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: 'screen' }); await old.page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => document.body.classList.remove('printing-report')); await old.page.evaluate(() => document.body.classList.remove('printing-report'));
      }
    } finally { await old.context.close(); }
  });
}
if (['all', 'wide'].includes(mode)) for (const theme of ['light', 'dark']) for (const name of ['overview', 'jobs', 'report-performance', 'report-payments', 'report-comparison']) {
  const { context, page } = await create(theme, 1920);
  try {
    await load(page, views.find(v => v.name === name));
    const data = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clippedHeadings: [...document.querySelectorAll('main h1,main h2,main h3')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -.5 || r.right > innerWidth + .5); }).map(el => el.textContent) }));
    assert.equal(data.width, data.scrollWidth); assert.deepEqual(data.clippedHeadings, []);
    await page.screenshot({ path: path.join(out, name + '-' + theme + '-1920.png'), fullPage: true });
    await page.screenshot({ path: path.join(out, name + '-' + theme + '-1920-viewport.png') });
    results.wide.push({ name, theme, ...data, passed: true }); console.log('PASS wide ' + name + ' ' + theme);
  } catch (error) { results.wide.push({ name, theme, passed: false, error: error.message }); console.log('FAIL wide ' + name + ': ' + error.message); }
  finally { await context.close(); }
}

const luminance = c => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
async function contrast(page, name, theme, position = 'top') {
  const runs = await page.evaluate(() => {
    const tags = 'h1,h2,h3,p,span,a,button,td,th,label,summary,small,time,select,text,tspan,strong,b,div,kbd';
    const data = [];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const colorContext = canvas.getContext('2d', { willReadFrequently: true });
    for (const el of document.querySelectorAll(tags)) {
      const textNodes = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (!textNodes.length || el.closest('[disabled],[aria-disabled="true"]')) continue;
      const style = getComputedStyle(el); if (style.visibility !== 'visible' || Number(style.opacity) === 0) continue;
      const foreground = el.tagName.toLowerCase() === 'text' || el.tagName.toLowerCase() === 'tspan' ? style.fill : style.color;
      colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = foreground; colorContext.fillRect(0, 0, 1, 1);
      const rgba = [...colorContext.getImageData(0, 0, 1, 1).data]; const fg = [rgba[0], rgba[1], rgba[2], rgba[3] / 255];
      if (!fg[3] || foreground === 'none') continue;
      for (const node of textNodes) {
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rawRect of range.getClientRects()) {
          // A DOM Range includes unpainted text beyond an ellipsis. Clip it to
          // its actual overflow boxes so a neighboring status dot isn't sampled
          // as though it were the background of that text.
          let left = rawRect.left, right = rawRect.right, top = rawRect.top, bottom = rawRect.bottom;
          for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
            const css = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
            if (/hidden|clip|auto|scroll/.test(css.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
            if (/hidden|clip|auto|scroll/.test(css.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
          }
          const rect = { left, right, top, bottom, width: right - left, height: bottom - top };
          if (rect.width < 2 || rect.height < 2 || rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) continue;
          const fontSize = parseFloat(style.fontSize), fontWeight = Number(style.fontWeight);
          const points = [.1, .3, .5, .7, .9].map(n => [Math.floor(rect.left + rect.width * n), Math.floor(rect.top + rect.height * .5)]).filter(([x, y]) => {
            const painted = document.elementFromPoint(x, y);
            return painted && (el.contains(painted) || style.pointerEvents === 'none' && painted.contains(el));
          });
          if (!points.length) continue; // e.g. scrolled figures underneath a sticky command bar
          data.push({ text: node.textContent.trim().slice(0, 100), selector: el.tagName.toLowerCase() + '.' + String(el.className), fg, color: style.color, fontSize, fontWeight, required: fontSize >= 24 || fontSize >= 18.66 && fontWeight >= 700 ? 3 : 4.5, points });
        }
      }
    }
    return data;
  });
  const file = path.join(out, name + '-' + theme + '-' + position + '-contrast-background.png');
  await page.screenshot({ path: file, style: 'html *{-webkit-text-fill-color:transparent!important;text-shadow:none!important}svg text,svg tspan{fill-opacity:0!important}' });
  const pixels = JSON.parse(execFileSync('python', ['-c', 'import json,sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");print(json.dumps([[im.getpixel(tuple(p)) for p in r] for r in json.load(sys.stdin)]))', file], { input: JSON.stringify(runs.map(run => run.points)), encoding: 'utf8' }));
  const measured = runs.map((run, i) => {
    const ratios = pixels[i].map(bg => { const alpha = run.fg[3] ?? 1; const fg = run.fg.slice(0, 3).map((value, n) => value * alpha + bg[n] * (1 - alpha)); const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
    const { points, ...rest } = run; return { ...rest, minimum: Math.round(Math.min(...ratios) * 100) / 100, backgroundSamples: pixels[i] };
  });
  const failures = measured.filter(run => run.minimum + .01 < run.required);
  if (!failures.length) await fs.rm(file);
  const entry = { name, theme, position, checked: measured.length, minimum: Math.min(...measured.map(r => r.minimum)), failures, passed: !failures.length };
  results.contrast.push(entry); console.log(`${entry.passed ? 'PASS' : 'FAIL'} contrast ${name} ${theme} ${position}: ${entry.checked} visible runs, ${failures.length} failures, minimum ${entry.minimum}`);
}
if (['all', 'contrast'].includes(mode)) for (const theme of (process.env.TMV_LUXE_THEMES || 'light,dark').split(',')) {
  const { context, page } = await create(theme);
  try {
   for (const view of views.filter(v => !process.env.TMV_LUXE_VIEWS || process.env.TMV_LUXE_VIEWS.split(',').includes(v.name))) {
    try {
    if (page.url() === 'about:blank') await load(page, view);
    else {
      // Exercise the application's existing popstate router between records,
      // preserving the same initialized theme and avoiding repeated dev-module
      // compilation. This uses the same mechanism as its labeled back links.
      await page.evaluate(query => { history.replaceState({}, '', '/admin?' + query); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }, view.query);
      await view.ready(page); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(180);
    }
    await contrast(page, view.name, theme);
    if (view.name === 'overview' || ['report-performance', 'report-payments', 'report-comparison'].includes(view.name)) {
      await page.evaluate(() => {
        const pageScroll = document.scrollingElement;
        if (pageScroll.scrollHeight > pageScroll.clientHeight) { window.scrollTo(0, 640); return; }
        const main = document.querySelector('main'); let scroll = main.parentElement;
        while (scroll && (scroll.scrollHeight <= scroll.clientHeight || !/auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
        if (scroll) scroll.scrollTop = 640;
      });
      await page.waitForTimeout(80);
      await contrast(page, view.name, theme, 'scrolled');
    }
    } catch (error) { results.contrast.push({ name: view.name, theme, passed: false, error: error.message }); console.log('FAIL contrast ' + view.name + ': ' + error.message); }
   }
  } finally { await context.close(); }
}
results.runtimeErrors = errors; results.unhandledApiPaths = unhandled; results.mutations = mutations;
results.contrastMethod = 'Visible direct text-node runs clipped to actual overflow boxes; covered text excluded by hit-testing. Computed foreground converted by browser canvas; up to five rendered background pixels per line captured with screenshot-only glyph masking, preserving color/currentColor and layout. Includes gradients and translucent/backdrop surfaces. WCAG AA 4.5 normal / 3 large; disabled controls excluded.';
await fs.writeFile(path.join(out, 'luxe-results-' + mode + (process.env.TMV_LUXE_SUFFIX || '') + '.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ matrix: results.matrix.length, workflows: results.workflows.length, wide: results.wide.length, contrastPairs: results.contrast.length, textRuns: results.contrast.reduce((n, row) => n + (row.checked || 0), 0), failed: [...results.matrix, ...results.workflows, ...results.wide, ...results.contrast].filter(row => !row.passed).length, runtimeErrors: errors, unhandled, mutations }, null, 2));
await browser.close();
if ([...results.matrix, ...results.workflows, ...results.wide, ...results.contrast].some(row => !row.passed) || errors.length || unhandled.length || mutations.length) process.exitCode = 1;
