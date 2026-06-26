// Laser smoke test: toggle laser on, trigger render, verify u_laserActive=1
// and laser color appears near laser start point.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Hook drawArrays
await page.evaluate(() => {
  const orig = WebGL2RenderingContext.prototype.drawArrays;
  window.__cap = [];
  window.__armed = false;
  WebGL2RenderingContext.prototype.drawArrays = function(...a) {
    const r = orig.apply(this, a);
    if (window.__armed && this.canvas && this.canvas.width > 1) {
      const gl = this;
      const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      const locLa = gl.getUniformLocation(prog, 'u_laserActive');
      const locLs = gl.getUniformLocation(prog, 'u_laserStart');
      const locLe = gl.getUniformLocation(prog, 'u_laserEnd');
      // Sample 7x7 around center
      const grid = [];
      const cx = Math.floor(this.canvas.width/2), cy = Math.floor(this.canvas.height/2);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const p = new Uint8Array(4);
          gl.readPixels(cx+dx, cy+dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
          grid.push(Array.from(p));
        }
      }
      const red = grid.filter(([r,g,b]) => r > 200 && g > 40 && g < 130 && b < 90).length;
      window.__cap.push({
        laserActive: locLa ? gl.getUniform(prog, locLa) : null,
        laserStart: locLs ? gl.getUniform(prog, locLs) : null,
        laserEnd: locLe ? gl.getUniform(prog, locLe) : null,
        redCount: red,
        glError: gl.getError(),
      });
      window.__armed = false;
    }
    return r;
  };
});

// Close launcher + generate
await page.evaluate(() => {
  const btn = document.querySelector('.launcher-start, #launcher-start, button[data-action="start"]');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
  const g = document.getElementById('btn-generate') || document.querySelector('[data-action="generate"]');
  if (g) g.click();
});
await new Promise(r => setTimeout(r, 3000));

// Set laserActive=true and laserStart/laserEnd to cross the center, then trigger render
await page.evaluate(() => {
  // Use the app's binding: set checkbox + dispatch change
  const cb = document.getElementById('laserActive');
  if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
});
await new Promise(r => setTimeout(r, 500));

// Arm hook + trigger a render by clicking generate (re-renders)
await page.evaluate(() => { window.__armed = true; });
await page.evaluate(() => {
  const g = document.getElementById('btn-generate') || document.querySelector('[data-action="generate"]');
  if (g) g.click();
});
await new Promise(r => setTimeout(r, 2500));

const caps = await page.evaluate(() => window.__cap);
console.log('=== LASER SMOKE TEST ===');
console.log('captures:', caps.length);
for (const c of caps) {
  console.log(`  laserActive=${c.laserActive} laserStart=${JSON.stringify(c.laserStart)} laserEnd=${JSON.stringify(c.laserEnd)} redCount=${c.redCount}/49 glError=${c.glError}`);
}
const last = caps[caps.length - 1];
if (last) {
  console.log(`\n  laser toggle works: ${last.laserActive === 1 ? 'YES (u_laserActive=1)' : 'NO'}`);
}

// Now capture ACTUAL pixel values in a 5x5 grid around center with laser ON
await page.evaluate(() => { window.__armed = true; window.__pixGrid = null;
  const orig = WebGL2RenderingContext.prototype.drawArrays;
  // re-hook to capture grid
});
// Trigger another render
await page.evaluate(() => {
  const g = document.getElementById('btn-generate');
  if (g) g.click();
});
await new Promise(r => setTimeout(r, 2000));
const grid = await page.evaluate(() => {
  const c = document.getElementById('glCanvas');
  const gl = c.getContext('webgl2');
  const out = [];
  const cx = Math.floor(c.width/2), cy = Math.floor(c.height/2);
  // read a fresh frame: trigger readPixels on the default framebuffer
  // (the last draw already happened; readPixels reads current back buffer)
  for (let dy = -2; dy <= 2; dy++) {
    const row = [];
    for (let dx = -2; dx <= 2; dx++) {
      const p = new Uint8Array(4);
      gl.readPixels(cx+dx, cy+dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      row.push(Array.from(p));
    }
    out.push(row);
  }
  return out;
});
console.log('\n=== ACTUAL CENTER 5x5 PIXELS (laser ON, start=end=[0,0]) ===');
for (const row of grid) {
  console.log('  ' + row.map(p => `[${p[0]},${p[1]},${p[2]}]`).join(' '));
}

await browser.close();
