// Deep black-screen diagnostic: hook drawArrays, track uniform values, and check
// whether render() is actually being called after generate completes.

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

const consoleMsgs = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleMsgs.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Install drawArrays hook BEFORE clicking launcher start
await page.evaluate(() => {
  const glProto = WebGL2RenderingContext.prototype;
  const origDraw = glProto.drawArrays;
  const origClear = glProto.clear;
  window.__drawCount = 0;
  window.__snapshots = [];
  window.__clearCount = 0;

  const wantNames = new Set([
    'u_style', 'u_seaLevel', 'u_showTerrain', 'u_showBoundaries', 'u_showSelection',
    'u_plateTotal', 'u_moistureTex', 'u_plateTex', 'u_elevTex', 'u_laserActive',
    'u_selectedCount', 'u_resolution',
  ]);

  function snapshot(gl, kind) {
    if (window.__drawCount >= 8) return;
    const prog = gl.getParameter(gl.CURRENT_PROGRAM);
    const snap = { kind, drawIndex: window.__drawCount, uniforms: {}, canvasW: gl.canvas.width, canvasH: gl.canvas.height };
    if (prog) {
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
    } else {
      snap.uniforms = 'NO PROGRAM';
    }
    // Sample center + corners
    const W = gl.canvas.width, H = gl.canvas.height;
    snap.pixels = [];
    const pts = [[Math.floor(W/2), Math.floor(H/2)], [0,0], [W-1,0], [0,H-1], [W-1,H-1]];
    for (const [x, y] of pts) {
      const p = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      snap.pixels.push({ x, y, rgba: Array.from(p) });
    }
    snap.glError = gl.getError();
    window.__snapshots.push(snap);
    window.__drawCount++;
  }

  glProto.drawArrays = function(...args) {
    const ret = origDraw.apply(this, args);
    if (this.canvas && this.canvas.width > 1) snapshot(this, 'drawArrays');
    return ret;
  };
  console.log('[HOOK] drawArrays hook installed');
});

// Click launcher start
await page.evaluate(() => {
  const b = document.querySelector('.launcher-start, #launcher-start');
  if (b) b.click();
});
await page.waitForTimeout(8000);

const result = await page.evaluate(() => ({
  snapshots: window.__snapshots,
  drawCount: window.__drawCount,
  clearCount: window.__clearCount,
  progressText: document.getElementById('progress-text')?.textContent,
  progressDisplay: getComputedStyle(document.getElementById('progress-container')).display,
  genBtnDisabled: document.getElementById('btn-generate')?.disabled,
  isGenerating: window.__app?.state?.isGenerating,
}));

console.log('=== CONSOLE (' + consoleMsgs.length + ') ===');
console.log(consoleMsgs.slice(-15).join('\n'));
console.log('\n=== STATE ===');
console.log('drawCount:', result.drawCount, 'progressText:', result.progressText, 'progressDisplay:', result.progressDisplay, 'genBtnDisabled:', result.genBtnDisabled);

console.log('\n=== SNAPSHOTS ===');
for (const s of result.snapshots) {
  console.log(`\n--- ${s.kind} #${s.drawIndex} (${s.canvasW}x${s.canvasH}) glError=${s.glError} ---`);
  console.log('Uniforms:', JSON.stringify(s.uniforms));
  console.log('Pixels:');
  for (const p of s.pixels) {
    console.log(`  (${p.x},${p.y}) = [${p.rgba.join(',')}]`);
  }
}

// Also test: manually trigger a render via the bus and see if drawArrays fires
await page.evaluate(() => { window.__drawCount = 0; window.__snapshots = []; });
const manualRender = await page.evaluate(() => {
  // Try to find the render trigger
  const btn = document.getElementById('btn-generate');
  if (btn && !btn.disabled) { btn.click(); return 'clicked generate'; }
  return 'genBtn disabled or missing';
});
await page.waitForTimeout(5000);

const result2 = await page.evaluate(() => ({
  snapshots: window.__snapshots,
  drawCount: window.__drawCount,
  progressText: document.getElementById('progress-text')?.textContent,
}));

console.log('\n=== AFTER MANUAL GENERATE (' + manualRender + ') ===');
console.log('drawCount:', result2.drawCount, 'progressText:', result2.progressText);
for (const s of result2.snapshots) {
  console.log(`  ${s.kind} #${s.drawIndex} glError=${s.glError} center=${JSON.stringify(s.pixels[0].rgba)}`);
  console.log('    uniforms:', JSON.stringify(s.uniforms));
}

await browser.close();
