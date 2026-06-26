// Final verification: test multiple styles + laser toggle for regressions.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Install drawArrays hook to capture center pixel + uniform after each draw
await page.evaluate(() => {
  const orig = WebGL2RenderingContext.prototype.drawArrays;
  window.__cap = null;
  window.__draws = 0;
  WebGL2RenderingContext.prototype.drawArrays = function(...a) {
    const r = orig.apply(this, a);
    if (window.__cap && this.canvas && this.canvas.width > 1 && window.__draws < 200) {
      const gl = this;
      const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      const px = new Uint8Array(4);
      gl.readPixels(Math.floor(this.canvas.width/2), Math.floor(this.canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // count red vs non-red in 5x5 around center
      const grid = [];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const p = new Uint8Array(4);
          gl.readPixels(Math.floor(this.canvas.width/2)+dx, Math.floor(this.canvas.height/2)+dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
          grid.push(Array.from(p));
        }
      }
      const red = grid.filter(([r,g,b]) => r > 200 && g > 40 && g < 120 && b < 90).length;
      const loc = gl.getUniformLocation(prog, 'u_laserActive');
      const laserActive = loc ? gl.getUniform(prog, loc) : -1;
      const locStyle = gl.getUniformLocation(prog, 'u_style');
      const style = locStyle ? gl.getUniform(prog, locStyle) : -1;
      window.__cap.push({ draw: window.__draws, style, laserActive, center: Array.from(px), redCount: red, glError: gl.getError() });
      window.__draws++;
    }
    return r;
  };
});

async function captureAfter(label, action) {
  await page.evaluate(() => { window.__cap = []; window.__draws = 0; });
  await action();
  await new Promise(r => setTimeout(r, 1200));
  return page.evaluate(() => ({ label: 'tmp', caps: window.__cap }));
}

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

const styles = [
  { id: 0, name: 'terrain' },
  { id: 1, name: 'plates' },
  { id: 2, name: 'parchment' },
  { id: 5, name: 'detail' },
  { id: 6, name: 'biome' },
  { id: 9, name: 'azgaar' },
];

console.log('=== STYLE TESTS (redCount out of 25 center pixels; red should be LOW = thin boundaries only) ===');
for (const s of styles) {
  const res = await captureAfter(`style ${s.id} (${s.name})`, async () => {
    await page.evaluate((id) => {
      const sel = document.getElementById('style');
      if (sel) { sel.value = String(id); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, s.id);
  });
  // Take the last capture (most recent draw)
  const last = res.caps[res.caps.length - 1];
  if (last) {
    console.log(`  style ${s.id} ${s.name.padEnd(10)}: redCount=${last.redCount}/25  center=[${last.center.join(',')}]  glError=${last.glError}`);
  } else {
    console.log(`  style ${s.id} ${s.name}: NO DRAW captured`);
  }
}

// Test laser toggle
console.log('\n=== LASER TEST ===');
// First set style back to 0
await page.evaluate(() => {
  const sel = document.getElementById('style');
  if (sel) { sel.value = '0'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await new Promise(r => setTimeout(r, 800));

// Toggle laser on
const laserOff = await captureAfter('laser OFF (baseline)', async () => {});
const offLast = laserOff.caps[laserOff.caps.length - 1];
console.log(`  laser OFF: laserActive=${offLast?.laserActive} center=[${offLast?.center.join(',')}]`);

await page.evaluate(() => {
  // Click laser toggle checkbox/button
  const cb = document.getElementById('laserActive');
  if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  else {
    // try toolbar button
    const btn = document.getElementById('btn-laser') || document.querySelector('[data-action="laser-toggle"]');
    if (btn) btn.click();
  }
});
await new Promise(r => setTimeout(r, 800));
const laserOn = await captureAfter('laser ON', async () => {});
const onLast = laserOn.caps[laserOn.caps.length - 1];
console.log(`  laser ON:  laserActive=${onLast?.laserActive} center=[${onLast?.center.join(',')}]`);
console.log(`  laser toggle works: ${offLast?.laserActive === 0 && onLast?.laserActive === 1 ? 'YES' : 'NO'}`);

console.log('\n=== CONSOLE ERRORS ===');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
