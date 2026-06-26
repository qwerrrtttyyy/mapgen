// Black screen diagnostic: capture console errors, pageerrors, GL state, canvas size,
// and pixels at multiple stages (initial load, after launcher start, after generate).
// Uses playwright chromium.

import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--enable-webgl',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleMsgs = [];
const pageErrors = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Stage 1: initial load state
const stage1 = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  const launcher = document.getElementById('launcher-overlay');
  const progress = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const btnGen = document.getElementById('btn-generate');
  const container = document.getElementById('canvas-container');
  const rect = container ? container.getBoundingClientRect() : null;
  const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
  return {
    hasCanvas: !!canvas,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
    canvasRect: canvasRect ? { w: canvasRect.width, h: canvasRect.height, left: canvasRect.left, top: canvasRect.top } : null,
    containerRect: rect ? { w: rect.width, h: rect.height } : null,
    launcherExists: !!launcher,
    launcherDisplay: launcher ? getComputedStyle(launcher).display : null,
    launcherVisible: launcher ? launcher.classList.contains('launcher-visible') : null,
    progressDisplay: progress ? getComputedStyle(progress).display : null,
    progressText: progressText ? progressText.textContent : null,
    hasBtnGen: !!btnGen,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    appClass: document.getElementById('app')?.className || null,
  };
});

// Try reading pixels via WebGL directly
const stage1Pixels = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return null;
  const gl = canvas.getContext('webgl2');
  if (!gl) return 'no webgl2 context';
  const p = new Uint8Array(4);
  gl.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
  return { center: Array.from(p), glError: gl.getError(), canvasW: canvas.width, canvasH: canvas.height };
});

await page.screenshot({ path: 'black-screen-01-initial.png' });

// Stage 2: click launcher start
const clickedStart = await page.evaluate(() => {
  const b = document.querySelector('.launcher-start, #launcher-start');
  if (b) { b.click(); return true; }
  return false;
});
await page.waitForTimeout(3000);
await page.screenshot({ path: 'black-screen-02-after-launcher.png' });

const stage2 = await page.evaluate(() => {
  const progress = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const canvas = document.getElementById('glCanvas');
  const launcher = document.getElementById('launcher-overlay');
  return {
    launcherStillExists: !!launcher,
    launcherDisplay: launcher ? getComputedStyle(launcher).display : null,
    progressDisplay: progress ? getComputedStyle(progress).display : null,
    progressText: progressText ? progressText.textContent : null,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
    appClass: document.getElementById('app')?.className || null,
  };
});

// Stage 3: wait longer for generate to complete, then sample
await page.waitForTimeout(4000);
await page.screenshot({ path: 'black-screen-03-after-generate.png' });

const stage3Pixels = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return null;
  const gl = canvas.getContext('webgl2');
  if (!gl) return 'no webgl2';
  const W = canvas.width, H = canvas.height;
  const grid = [];
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(gx/4 * (W-1)), Math.floor(gy/4 * (H-1)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      grid.push(Array.from(p));
    }
  }
  return { grid, glError: gl.getError(), W, H };
});

const stage3 = await page.evaluate(() => {
  const progress = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const genBtn = document.getElementById('btn-generate');
  return {
    progressDisplay: progress ? getComputedStyle(progress).display : null,
    progressText: progressText ? progressText.textContent : null,
    genBtnDisabled: genBtn ? genBtn.disabled : null,
  };
});

console.log('=== CONSOLE MESSAGES (' + consoleMsgs.length + ') ===');
console.log(consoleMsgs.length ? consoleMsgs.slice(-40).join('\n') : '(none)');
console.log('\n=== PAGE ERRORS (' + pageErrors.length + ') ===');
console.log(pageErrors.length ? pageErrors.join('\n---\n') : '(none)');

console.log('\n=== Stage 1: Initial (after networkidle + 2s) ===');
console.log(JSON.stringify(stage1, null, 2));
console.log('Stage1 pixels:', JSON.stringify(stage1Pixels));

console.log('\n=== Stage 2: After launcher start click (clicked=' + clickedStart + ', +3s) ===');
console.log(JSON.stringify(stage2, null, 2));

console.log('\n=== Stage 3: After +4s more (total ~9s) ===');
console.log(JSON.stringify(stage3, null, 2));
console.log('Stage3 pixels (5x5 grid, GL bottom-left origin):');
if (stage3Pixels && stage3Pixels.grid) {
  for (let gy = 4; gy >= 0; gy--) {
    let row = '  ';
    for (let gx = 0; gx < 5; gx++) {
      const p = stage3Pixels.grid[gy*5+gx];
      row += `[${String(p[0]).padStart(3)},${String(p[1]).padStart(3)},${String(p[2]).padStart(3)}] `;
    }
    console.log(row);
  }
  console.log('glError:', stage3Pixels.glError, 'canvas:', stage3Pixels.W + 'x' + stage3Pixels.H);
}

await browser.close();
