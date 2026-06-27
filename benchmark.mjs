import { generateMap } from './packages/shared/dist/index.js';
import puppeteer from 'puppeteer-core';

const BROWSER_PATH = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const URL = 'http://localhost:3000/';

async function benchmarkGeneration() {
  const sizes = [128, 256, 384, 512];
  const results = {};

  for (const size of sizes) {
    const params = {
      seedStr: 'benchmark',
      mapAspect: '1:1',
      mapSize: size,
      plateCount: 8,
      landmass: 0.4,
      noiseType: 'perlin',
      fbmType: 'standard',
      octaves: 5,
      lacunarity: 2.0,
      persistence: 0.5,
      seaLevel: 0.45,
      mountainFold: 0.3,
      coastDetail: 0.5,
      erosionIterations: 50,
      erosionStrength: 1.0,
      lakeDensity: 0.02,
      tempOffset: 0,
      snowLine: 0.5,
    };

    const runs = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      generateMap(params);
      const t1 = performance.now();
      runs.push(t1 - t0);
    }
    runs.sort((a, b) => a - b);
    results[size] = {
      runs,
      median: runs[1],
      min: runs[0],
      max: runs[2],
    };
  }

  return results;
}

async function benchmarkBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: BROWSER_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Skip launcher: first load to set origin, then set localStorage and reload
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('mapgen:skipLauncher', '1');
  });

  const loadStart = performance.now();
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  const loadEnd = performance.now();

  // Wait for first generation to complete
  await page.waitForFunction(() => {
    const el = document.getElementById('progress-container');
    return el && el.style.display === 'none';
  }, { timeout: 60000 });

  const firstGenEnd = performance.now();

  // Measure FPS by tracking requestAnimationFrame for 3 seconds
  const fpsResult = await page.evaluate(async () => {
    return new Promise(resolve => {
      let count = 0;
      const duration = 3000;
      const start = performance.now();
      function frame() {
        count++;
        if (performance.now() - start < duration) {
          requestAnimationFrame(frame);
        } else {
          const elapsed = performance.now() - start;
          resolve({ frames: count, fps: (count * 1000 / elapsed).toFixed(2), elapsed: elapsed.toFixed(2) });
        }
      }
      requestAnimationFrame(frame);
    });
  });

  await browser.close();

  return {
    loadTime: (loadEnd - loadStart).toFixed(2),
    firstGenTime: (firstGenEnd - loadStart).toFixed(2),
    fps: fpsResult,
  };
}

async function main() {
  const genResults = await benchmarkGeneration();
  const browserResults = await benchmarkBrowser();

  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
    },
    generation: genResults,
    browser: browserResults,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
