// E2E verification: launcher visible → click start → map generates → map visible

import { chromium } from 'playwright';
import fs from 'fs';
import { PNG } from 'pngjs';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Stage 1: launcher should be visible (content opacity = 1)
const launcherState = await page.evaluate(() => {
  const content = document.querySelector('.launcher-content');
  if (!content) return { exists: false };
  const cs = getComputedStyle(content);
  return { exists: true, opacity: cs.opacity, transform: cs.transform };
});
console.log('=== Stage 1: Launcher visible? ===');
console.log(JSON.stringify(launcherState));
await page.screenshot({ path: 'e2e-01-launcher.png' });

// Stage 2: click start
await page.evaluate(() => {
  const b = document.querySelector('.launcher-start, #launcher-start');
  if (b) b.click();
});
await page.waitForTimeout(6000);

// Stage 3: map should be visible
const mapState = await page.evaluate(() => {
  const launcher = document.getElementById('launcher-overlay');
  const progress = document.getElementById('progress-container');
  const canvas = document.getElementById('glCanvas');
  return {
    launcherGone: !launcher,
    progressHidden: progress ? getComputedStyle(progress).display === 'none' : null,
    progressText: document.getElementById('progress-text')?.textContent,
    canvasW: canvas?.width,
    canvasH: canvas?.height,
  };
});
console.log('\n=== Stage 3: After generate ===');
console.log(JSON.stringify(mapState));
await page.screenshot({ path: 'e2e-02-map.png' });

// Analyze screenshot colors
function analyze(file) {
  const buf = fs.readFileSync(file);
  const png = PNG.sync.read(buf);
  let red=0, sea=0, green=0, black=0, other=0;
  const N = 9;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x = Math.floor(gx/(N-1) * (png.width-1));
      const y = Math.floor(gy/(N-1) * (png.height-1));
      const idx = (y * png.width + x) * 4;
      const [r,g,b] = [png.data[idx], png.data[idx+1], png.data[idx+2]];
      if (r > 200 && g > 40 && g < 130 && b < 90) red++;
      else if (b > r && b > g && b > 40) sea++;
      else if (g > r && g > b) green++;
      else if (r < 20 && g < 20 && b < 30) black++;
      else other++;
    }
  }
  return { red, sea, green, black, other };
}

console.log('\n=== Screenshot analysis ===');
console.log('Launcher screen:', analyze('e2e-01-launcher.png'));
console.log('Map screen:', analyze('e2e-02-map.png'));

console.log('\n=== Page errors ===');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
