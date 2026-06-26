// Inspect launcher visibility: check DOM, computed styles, and take screenshot
// at the moment launcher should be visible.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));

// Use DOMContentLoaded timing — check launcher state immediately after load
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait a bit for JS to run
await page.waitForTimeout(1000);

const state1 = await page.evaluate(() => {
  const launcher = document.getElementById('launcher-overlay');
  const content = launcher?.querySelector('.launcher-content');
  const startBtn = document.getElementById('launcher-start');
  if (!launcher) return { launcherExists: false };
  const ls = getComputedStyle(launcher);
  const cs = content ? getComputedStyle(content) : null;
  return {
    launcherExists: true,
    launcherClass: launcher.className,
    launcherDisplay: ls.display,
    launcherOpacity: ls.opacity,
    launcherVisibility: ls.visibility,
    launcherBg: ls.backgroundColor,
    launcherZIndex: ls.zIndex,
    contentExists: !!content,
    contentClass: content?.className,
    contentDisplay: cs?.display,
    contentOpacity: cs?.opacity,
    contentTransform: cs?.transform,
    contentBg: cs?.backgroundColor,
    contentRect: content ? (() => { const r = content.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; })() : null,
    startBtnExists: !!startBtn,
    startBtnRect: startBtn ? (() => { const r = startBtn.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; })() : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    appClass: document.getElementById('app')?.className,
  };
});
console.log('\n=== State 1 (after DOMContentLoaded + 1s) ===');
console.log(JSON.stringify(state1, null, 2));

await page.screenshot({ path: 'launcher-inspect-1.png' });

// Wait more — maybe launcher show() takes time
await page.waitForTimeout(2000);

const state2 = await page.evaluate(() => {
  const launcher = document.getElementById('launcher-overlay');
  const content = launcher?.querySelector('.launcher-content');
  if (!launcher) return { launcherExists: false };
  const ls = getComputedStyle(launcher);
  const cs = content ? getComputedStyle(content) : null;
  return {
    launcherClass: launcher.className,
    launcherDisplay: ls.display,
    launcherOpacity: ls.opacity,
    contentClass: content?.className,
    contentOpacity: cs?.opacity,
    contentTransform: cs?.transform,
    contentRect: content ? (() => { const r = content.getBoundingClientRect(); return { w: r.width, h: r.height }; })() : null,
  };
});
console.log('\n=== State 2 (after +2s more) ===');
console.log(JSON.stringify(state2, null, 2));

await page.screenshot({ path: 'launcher-inspect-2.png' });

// Check if shouldShow returned false (skip launcher)
const skipState = await page.evaluate(() => {
  return {
    skipFlag: localStorage.getItem('mapgen.skipLauncher'),
    allLocalStorage: Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)),
  };
});
console.log('\n=== Skip flag ===');
console.log(JSON.stringify(skipState, null, 2));

await browser.close();
