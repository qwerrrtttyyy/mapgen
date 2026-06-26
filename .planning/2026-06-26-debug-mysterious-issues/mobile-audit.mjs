// Mobile audit: test at common mobile breakpoints, capture screenshots and DOM state

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

const breakpoints = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-12', width: 390, height: 844 },
  { name: 'pixel-5', width: 393, height: 851 },
  { name: 'ipad-mini', width: 768, height: 1024 },
];

for (const bp of breakpoints) {
  const page = await browser.newPage({
    viewport: { width: bp.width, height: bp.height },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Stage 1: launcher
  const launcherState = await page.evaluate(() => {
    const content = document.querySelector('.launcher-content');
    const cs = content ? getComputedStyle(content) : null;
    const rect = content ? content.getBoundingClientRect() : null;
    return {
      contentExists: !!content,
      contentOpacity: cs?.opacity,
      contentW: rect?.width,
      contentH: rect?.height,
      contentLeft: rect?.left,
      contentTop: rect?.top,
      contentOverflow: cs?.overflow,
      bodyW: document.body.clientWidth,
      bodyH: document.body.clientHeight,
    };
  });

  await page.screenshot({ path: `mobile-${bp.name}-1-launcher.png` });

  // Check launcher-content children overflow
  const launcherOverflow = await page.evaluate(() => {
    const content = document.querySelector('.launcher-content');
    if (!content) return null;
    return {
      scrollHeight: content.scrollHeight,
      clientHeight: content.clientHeight,
      scrollWidth: content.scrollWidth,
      clientWidth: content.clientWidth,
      overflowingV: content.scrollHeight > content.clientHeight,
      overflowingH: content.scrollWidth > content.clientWidth,
    };
  });

  // Click start
  await page.evaluate(() => {
    const b = document.querySelector('.launcher-start, #launcher-start');
    if (b) b.click();
  });
  await page.waitForTimeout(5000);

  // Stage 2: after generate
  const mapState = await page.evaluate(() => {
    const canvas = document.getElementById('glCanvas');
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const menuToggle = document.getElementById('menu-toggle');
    const cs = drawer ? getComputedStyle(drawer) : null;
    return {
      canvasW: canvas?.width,
      canvasH: canvas?.height,
      canvasRectW: canvas?.getBoundingClientRect().width,
      canvasRectH: canvas?.getBoundingClientRect().height,
      drawerOpen: drawer?.classList.contains('open'),
      drawerTransform: cs?.transform,
      backdropDisplay: backdrop ? getComputedStyle(backdrop).visibility : null,
      menuToggleDisplay: menuToggle ? getComputedStyle(menuToggle).display : null,
    };
  });

  await page.screenshot({ path: `mobile-${bp.name}-2-map.png` });

  // Try opening drawer
  await page.evaluate(() => {
    const b = document.getElementById('menu-toggle');
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  const drawerOpenState = await page.evaluate(() => {
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    return {
      drawerOpen: drawer?.classList.contains('open'),
      drawerTransform: drawer ? getComputedStyle(drawer).transform : null,
      backdropOpen: backdrop?.classList.contains('open'),
    };
  });
  await page.screenshot({ path: `mobile-${bp.name}-3-drawer.png` });

  // Analyze map screenshot
  function analyze(file) {
    try {
      const buf = fs.readFileSync(file);
      const png = PNG.sync.read(buf);
      let red=0, sea=0, green=0, black=0, other=0;
      const N = 7;
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
    } catch (e) { return { error: e.message }; }
  }

  console.log(`\n=== ${bp.name} (${bp.width}x${bp.height}) ===`);
  console.log('Launcher:', JSON.stringify(launcherState));
  console.log('Launcher overflow:', JSON.stringify(launcherOverflow));
  console.log('Map state:', JSON.stringify(mapState));
  console.log('Drawer open state:', JSON.stringify(drawerOpenState));
  console.log('Errors:', errors.length ? errors.join('; ') : '(none)');
  console.log('Map screenshot analyze:', JSON.stringify(analyze(`mobile-${bp.name}-2-map.png`)));

  await page.close();
}

await browser.close();
