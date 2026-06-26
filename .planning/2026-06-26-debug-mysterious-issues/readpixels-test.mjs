#!/usr/bin/env node
// 直接从 GL context 读像素验证 canvas 是否真的在画红色
// 用 hook 在 drawArrays 后立即 readPixels
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[PAGEERROR]', err.message));

// 注入 hook：drawArrays 后立即读 pixel
await page.evaluateOnNewDocument(() => {
  window.__lastDrawPixel = null;
  window.__drawCount = 0;
  const hookGL = () => {
    if (typeof WebGL2RenderingContext === 'undefined') {
      setTimeout(hookGL, 10);
      return;
    }
    const origDraw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) {
      const ret = origDraw.apply(this, args);
      // 立即读中心像素
      if (window.__drawCount < 5) {
        const px = new Uint8Array(4);
        try {
          this.readPixels(
            Math.floor(this.canvas.width / 2),
            Math.floor(this.canvas.height / 2),
            1, 1, this.RGBA, this.UNSIGNED_BYTE, px
          );
          window.__lastDrawPixel = Array.from(px);
          window.__drawCount++;
          console.log('[HOOK] drawArrays #' + window.__drawCount + ' center pixel:', window.__lastDrawPixel);
        } catch (e) {
          console.log('[HOOK] readPixels err:', e.message);
        }
      }
      return ret;
    };
    console.log('[HOOK] drawArrays hook installed');
  };
  hookGL();
});

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

// 启动器
await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  if (overlay) {
    const btns = overlay.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && /启动/.test(b.textContent)) { b.click(); return; }
    }
  }
});
await new Promise((r) => setTimeout(r, 5000));

const result = await page.evaluate(() => ({
  drawCount: window.__drawCount,
  lastDrawPixel: window.__lastDrawPixel,
}));
console.log('\n=== After 5s ===');
console.log(JSON.stringify(result, null, 2));

// 触发 resize 重新渲染
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await new Promise((r) => setTimeout(r, 500));

const result2 = await page.evaluate(() => ({
  drawCount: window.__drawCount,
  lastDrawPixel: window.__lastDrawPixel,
}));
console.log('\n=== After resize ===');
console.log(JSON.stringify(result2, null, 2));

// 现在改 shader 加 red debug，看 readPixels 是否返回 red
console.log('\n=== Modifying shader to red and reloading... ===');
await page.evaluate(() => {
  // fetch the original shader then patch and re-init
  // Actually we can't re-init WebGLRenderer from outside, so let's just check current pixel value
});

// 尝试 elementHandle.screenshot 看是否能捕获 WebGL
const canvasHandle = await page.$('#glCanvas');
const canvasScreenshot = await canvasHandle.screenshot();
const fs = await import('node:fs');
fs.writeFileSync('/workspace/.planning/2026-06-26-debug-mysterious-issues/canvas-element-screenshot.png', canvasScreenshot);
console.log('Canvas element screenshot saved, size:', canvasScreenshot.length, 'bytes');

await browser.close();
