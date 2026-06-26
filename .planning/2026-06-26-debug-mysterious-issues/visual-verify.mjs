// Visual verification: take screenshots at key stages and analyze canvas pixels
// via toDataURL to confirm what the user actually sees (not just readPixels).

import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleMsgs = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleMsgs.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Screenshot 1: launcher visible
await page.screenshot({ path: 'visual-01-launcher.png' });
console.log('Shot 1: launcher saved');

// Click launcher start
await page.evaluate(() => {
  const b = document.querySelector('.launcher-start, #launcher-start');
  if (b) b.click();
});
await page.waitForTimeout(6000);

// Screenshot 2: after generate (should show map)
await page.screenshot({ path: 'visual-02-after-generate.png' });

// Get canvas toDataURL to see actual rendered content
const canvasData = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return null;
  // Sample via 2D context readback — toDataURL captures the GL canvas content
  const dataUrl = canvas.toDataURL('image/png');
  // Also check computed style
  const style = getComputedStyle(canvas);
  return {
    dataUrlPrefix: dataUrl.substring(0, 50),
    dataUrlLength: dataUrl.length,
    canvasW: canvas.width,
    canvasH: canvas.height,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    width: style.width,
    height: style.height,
    parentDisplay: getComputedStyle(canvas.parentElement).display,
    parentVisibility: getComputedStyle(canvas.parentElement).visibility,
    appClass: document.getElementById('app').className,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
});

console.log('\n=== Canvas state after generate ===');
console.log(JSON.stringify(canvasData, null, 2));

// Check if canvas-container has the launcher-done animation still running
const animState = await page.evaluate(() => {
  const c = document.getElementById('canvas-container');
  if (!c) return null;
  const cs = getComputedStyle(c);
  return {
    animationName: cs.animationName,
    animationDuration: cs.animationDuration,
    animationPlayState: cs.animationPlayState,
    opacity: cs.opacity,
    transform: cs.transform,
  };
});
console.log('\n=== canvas-container animation state ===');
console.log(JSON.stringify(animState, null, 2));

// Check glCanvas animation
const canvasAnim = await page.evaluate(() => {
  const c = document.getElementById('glCanvas');
  if (!c) return null;
  const cs = getComputedStyle(c);
  return {
    animationName: cs.animationName,
    animationPlayState: cs.animationPlayState,
    opacity: cs.opacity,
    transform: cs.transform,
    classList: Array.from(c.classList),
  };
});
console.log('\n=== glCanvas animation state ===');
console.log(JSON.stringify(canvasAnim, null, 2));

// Read pixels via GL to compare with screenshot
const glPixels = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return null;
  const gl = canvas.getContext('webgl2');
  if (!gl) return 'no gl';
  const W = canvas.width, H = canvas.height;
  const grid = [];
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(gx/4*(W-1)), Math.floor(gy/4*(H-1)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      grid.push(Array.from(p));
    }
  }
  return grid;
});
console.log('\n=== GL readPixels 5x5 (after generate) ===');
if (glPixels) {
  for (let gy = 4; gy >= 0; gy--) {
    let row = '  ';
    for (let gx = 0; gx < 5; gx++) {
      const p = glPixels[gy*5+gx];
      row += `[${String(p[0]).padStart(3)},${String(p[1]).padStart(3)},${String(p[2]).padStart(3)}] `;
    }
    console.log(row);
  }
}

console.log('\n=== Console errors ===');
console.log(consoleMsgs.filter(m => m.includes('error') || m.includes('PAGEERROR')).join('\n') || '(none)');

await browser.close();
