// Laser-active probe: capture drawArrays sequence with laserActive=1
// to see exactly what happens when laser is ON but laserStart=laserEnd=[0,0].
// Based on consolidated-probe.mjs but toggles laser ON after generation.

import puppeteer from 'puppeteer-core';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

// Install hook BEFORE any generate. Capture first 10 draws.
await page.evaluate(() => {
  const glProto = WebGL2RenderingContext.prototype;
  const origDraw = glProto.drawArrays;
  window.__snapshots = [];
  window.__drawCount = 0;

  const wantNames = new Set([
    'u_laserActive', 'u_laserStart', 'u_laserEnd', 'u_laserWidth', 'u_laserColor',
    'u_style', 'u_showBoundaries', 'u_boundaryWidth', 'u_boundaryColor',
    'u_plateTotal', 'u_moistureTex', 'u_plateTex', 'u_seaLevel',
  ]);

  glProto.drawArrays = function(...args) {
    const ret = origDraw.apply(this, args);
    if (window.__drawCount < 10 && this.canvas && this.canvas.width > 1) {
      const gl = this;
      const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      const snap = { drawIndex: window.__drawCount, uniforms: {}, pixelsCenter7x7: [], pixelsFull9x9: [] };

      const numU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numU; i++) {
        const info = gl.getActiveUniform(prog, i);
        if (!info) continue;
        const name = info.name.replace(/\[0\]$/, '');
        if (!wantNames.has(name)) continue;
        const loc = gl.getUniformLocation(prog, info.name);
        if (!loc) continue;
        try { snap.uniforms[name] = gl.getUniform(prog, loc); }
        catch (e) { snap.uniforms[name] = 'ERR'; }
      }

      const W = this.canvas.width, H = this.canvas.height;
      // 7x7 around center
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const p = new Uint8Array(4);
          gl.readPixels(cx + dx, cy + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
          snap.pixelsCenter7x7.push(Array.from(p));
        }
      }
      // 9x9 full canvas (uniform sampling, like consolidated-probe)
      const N = 9;
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          const fx = Math.floor((gx / (N - 1)) * (W - 1));
          const fy = Math.floor((gy / (N - 1)) * (H - 1));
          const p = new Uint8Array(4);
          gl.readPixels(fx, fy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
          snap.pixelsFull9x9.push(Array.from(p));
        }
      }
      snap.glError = gl.getError();
      window.__snapshots.push(snap);
      window.__drawCount++;
    }
    return ret;
  };
});

// Close launcher + generate (laserActive=0)
await page.evaluate(() => {
  const b = document.querySelector('.launcher-start, #launcher-start');
  if (b) b.click();
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
  const g = document.getElementById('btn-generate');
  if (g) g.click();
});
await new Promise(r => setTimeout(r, 5000));

// Reset draw counter so next draws are captured fresh
await page.evaluate(() => { window.__drawCount = 0; window.__snapshots = []; });

// Step A: trigger a render with laserActive=0 (baseline) by clicking generate again
// Wait 8s to ensure generate completes
await page.evaluate(() => {
  const g = document.getElementById('btn-generate');
  if (g) g.click();
});
await new Promise(r => setTimeout(r, 8000));
const snapsA = await page.evaluate(() => ({ snapshots: window.__snapshots, drawCount: window.__drawCount }));

// Step B: now toggle laserActive=1 (laserStart=laserEnd=[0,0] default)
await page.evaluate(() => { window.__drawCount = 0; window.__snapshots = []; });
await page.evaluate(() => {
  const cb = document.getElementById('laserActive');
  if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
});
await new Promise(r => setTimeout(r, 1500));
const snapsB = await page.evaluate(() => ({ snapshots: window.__snapshots, drawCount: window.__drawCount }));

// Step C: also test laserActive=1 with laserStart != laserEnd
await page.evaluate(() => { window.__drawCount = 0; window.__snapshots = []; });
await page.evaluate(() => {
  const c = document.getElementById('glCanvas');
  if (c) {
    const r = c.getBoundingClientRect();
    const x1 = r.left + r.width * 0.3, y1 = r.top + r.height * 0.7;
    const x2 = r.left + r.width * 0.7, y2 = r.top + r.height * 0.3;
    c.dispatchEvent(new MouseEvent('mousedown', { clientX: x1, clientY: y1, bubbles: true }));
    c.dispatchEvent(new MouseEvent('mousemove', { clientX: x2, clientY: y2, bubbles: true }));
    c.dispatchEvent(new MouseEvent('mouseup', { clientX: x2, clientY: y2, bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 1000));
const snapsC = await page.evaluate(() => ({ snapshots: window.__snapshots, drawCount: window.__drawCount }));

function printSnaps(label, result) {
  console.log(`\n=== ${label} (draws=${result.drawCount}) ===`);
  for (const s of result.snapshots) {
    function classify(pixels) {
      let red = 0, sea = 0, green = 0, black = 0, other = 0;
      for (const p of pixels) {
        const [r, g, b] = p;
        if (r > 200 && g > 40 && g < 130 && b < 90) red++;
        else if (b > r && b > g && b > 40) sea++;
        else if (g > r && g > b) green++;
        else if (r < 20 && g < 20 && b < 30) black++;
        else other++;
      }
      return { red, sea, green, black, other };
    }
    const c = classify(s.pixelsCenter7x7);
    const f = classify(s.pixelsFull9x9);
    console.log(`  Draw #${s.drawIndex} glError=${s.glError} laserActive=${s.uniforms.u_laserActive}`);
    console.log(`    Center 7x7: red=${c.red} sea=${c.sea} green=${c.green} black=${c.black} other=${c.other}`);
    console.log(`    Full 9x9:   red=${f.red} sea=${f.sea} green=${f.green} black=${f.black} other=${f.other}`);
  }
}

console.log('=== LASER ACTIVE PROBE ===');
console.log('Console errors:', consoleErrors.length ? consoleErrors : '(none)');
printSnaps('Step A: laserActive=0 (baseline generate)', snapsA);
printSnaps('Step B: laserActive=1, start=end=[0,0]', snapsB);
printSnaps('Step C: laserActive=1, start!=end (drag)', snapsC);

await browser.close();
