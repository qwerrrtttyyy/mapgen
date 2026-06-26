// Consolidated diagnostic: read ALL relevant GL state + pixels at the SAME moment
// (immediately after drawArrays), eliminating timing inconsistency between
// gl-introspect (read u_laserActive=0) and multi-pixel-sample (read laserColor).
//
// Goal: determine definitively whether u_laserActive is 0 or 1 during render,
// and what pixels actually come out, in one shot.

import puppeteer from 'puppeteer-core';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--enable-webgl',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

// Inject the hook BEFORE any drawArrays. We re-load with initScript-like behavior
// by evaluating before app boot — but app already booted on goto. Instead, hook now
// and trigger a fresh render via the generate flow.
await page.evaluate(() => {
  const glProto = WebGL2RenderingContext.prototype;
  const origDraw = glProto.drawArrays;
  const origUniform1f = glProto.uniform1f;
  const origUniform1i = glProto.uniform1i;

  window.__snapshots = [];
  window.__uniformLog = [];   // track every uniform1f/1i call for laserActive
  window.__drawCount = 0;

  // Track uniform sets to see what value laserActive gets
  glProto.uniform1f = function(loc, v) {
    const ret = origUniform1f.call(this, loc, v);
    return ret;
  };

  glProto.drawArrays = function(...args) {
    const ret = origDraw.apply(this, args);
    // Only snapshot first 5 draws
    if (window.__drawCount < 5 && this.canvas && this.canvas.width > 1) {
      const gl = this;
      const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      const snap = {
        drawIndex: window.__drawCount,
        canvasW: this.canvas.width,
        canvasH: this.canvas.height,
        uniforms: {},
        pixels9x9: [],
      };

      // Read key uniforms by name. We need locations; query via getActiveUniform.
      const numU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      const wantNames = new Set([
        'u_laserActive', 'u_laserStart', 'u_laserEnd', 'u_laserWidth',
        'u_laserColor', 'u_laserSelection', 'u_style', 'u_seaLevel',
        'u_showTerrain', 'u_showBoundaries', 'u_showSelection',
        'u_moistureTex', 'u_plateTex', 'u_elevTex', 'u_tempTex', 'u_riverTex',
        'u_pointLightEnabled', 'u_cursorActive', 'u_hasTrail',
        'u_selectedCount', 'u_plateTotal',
      ]);
      for (let i = 0; i < numU; i++) {
        const info = gl.getActiveUniform(prog, i);
        if (!info) continue;
        const name = info.name.replace(/\[0\]$/, '');
        if (!wantNames.has(name)) continue;
        const loc = gl.getUniformLocation(prog, info.name);
        if (!loc) continue;
        try {
          if (info.type === 35676 || info.type === 35678 || info.type === 35679 || info.type === 35680 || info.type === 35680) {
            // sampler2D = 35678; read as int
            snap.uniforms[name] = gl.getUniform(prog, loc);
          } else if (info.type === 5124 || info.type === 35670) {
            // int / bool
            snap.uniforms[name] = gl.getUniform(prog, loc);
          } else if (info.type === 5126) {
            // float
            snap.uniforms[name] = gl.getUniform(prog, loc);
          } else if (info.type === 35665) {
            // vec2
            snap.uniforms[name] = gl.getUniform(prog, loc);
          } else if (info.type === 35666) {
            // vec3
            snap.uniforms[name] = gl.getUniform(prog, loc);
          } else {
            snap.uniforms[name] = gl.getUniform(prog, loc);
          }
        } catch (e) {
          snap.uniforms[name] = 'ERR:' + e.message;
        }
      }

      // 9x9 pixel grid centered
      const W = this.canvas.width, H = this.canvas.height;
      const N = 9;
      const px = new Uint8Array(N * N * 4);
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          const cx = Math.floor((gx / (N - 1)) * (W - 1));
          const cy = Math.floor((gy / (N - 1)) * (H - 1));
          const one = new Uint8Array(4);
          gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
          snap.pixels9x9.push({ x: cx, y: cy, rgba: Array.from(one) });
        }
      }

      // GL error check
      snap.glError = gl.getError();
      window.__snapshots.push(snap);
      window.__drawCount++;
    }
    return ret;
  };
  console.log('[HOOK] drawArrays hook installed');
});

// Wait for launcher + generation to complete
await new Promise(r => setTimeout(r, 4000));

// Trigger a fresh generate to ensure we capture post-generation render
await page.evaluate(() => {
  // Close launcher if present, then trigger generate
  const startBtn = document.querySelector('.launcher-start, #launcher-start, button[data-action="start"]');
  if (startBtn) startBtn.click();
});
await new Promise(r => setTimeout(r, 1500));

// Click the generate button to force a fresh render
await page.evaluate(() => {
  const genBtn = document.getElementById('btn-generate') || document.querySelector('[data-action="generate"]');
  if (genBtn) genBtn.click();
});
await new Promise(r => setTimeout(r, 3000));

// Force an extra render.request to capture a clean snapshot
await page.evaluate(() => {
  if (window.__app && window.__app.bus) window.__app.bus.emit('render.request');
  // Try dispatching via global event bus if exposed
});
await new Promise(r => setTimeout(r, 1000));

const result = await page.evaluate(() => ({
  snapshots: window.__snapshots,
  consoleErrors: window.__consoleErrors || [],
  drawCount: window.__drawCount,
  hasCanvas: !!document.getElementById('glCanvas'),
  progressDisplay: document.getElementById('progressDisplay')?.style?.display || 'none',
  progressText: document.getElementById('progressText')?.textContent || '',
}));

console.log('=== CONSOLE ERRORS ===');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
console.log('\n=== DRAW COUNT ===', result.drawCount);
console.log('=== PROGRESS ===', result.progressDisplay, result.progressText);
console.log('\n=== SNAPSHOTS ===');
for (const s of result.snapshots) {
  console.log(`\n--- Draw #${s.drawIndex} (${s.canvasW}x${s.canvasH}) glError=${s.glError} ---`);
  console.log('Uniforms:');
  for (const [k, v] of Object.entries(s.uniforms)) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
  console.log('Pixels 9x9 (bottom-left origin):');
  const N = 9;
  // Print grid top-to-bottom (GL y=0 is bottom)
  for (let gy = N - 1; gy >= 0; gy--) {
    let row = '  ';
    for (let gx = 0; gx < N; gx++) {
      const p = s.pixels9x9[gy * N + gx];
      const [r, g, b, a] = p.rgba;
      row += `[${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)}] `;
    }
    console.log(row);
  }
  // Color classification
  let red = 0, sea = 0, green = 0, black = 0, other = 0;
  for (const p of s.pixels9x9) {
    const [r, g, b] = p.rgba;
    if (r > 200 && g > 40 && g < 120 && b < 90) red++;
    else if (b > r && b > g && b > 40) sea++;
    else if (g > r && g > b) green++;
    else if (r < 20 && g < 20 && b < 30) black++;
    else other++;
  }
  console.log(`  Distribution: red=${red} sea=${sea} green=${green} black=${black} other=${other}`);
}

await browser.close();
