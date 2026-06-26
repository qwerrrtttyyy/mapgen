#!/usr/bin/env node
// Hook drawArrays 看是否真的被调用
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

// 在页面加载前注入 hook
await page.evaluateOnNewDocument(() => {
  window.__glCalls = { drawArrays: 0, drawElements: 0, clear: 0, useProgram: 0, errors: [] };
  // 等 WebGL2RenderingContext 可用后再 hook
  const hookGL = () => {
    if (typeof WebGL2RenderingContext === 'undefined') {
      setTimeout(hookGL, 10);
      return;
    }
    const origDraw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) {
      window.__glCalls.drawArrays++;
      const err = this.getError();
      if (err !== 0) window.__glCalls.errors.push('pre-draw err: ' + err);
      const ret = origDraw.apply(this, args);
      const err2 = this.getError();
      if (err2 !== 0) window.__glCalls.errors.push('post-draw err: ' + err2);
      return ret;
    };
    const origClear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function(...args) {
      window.__glCalls.clear++;
      return origClear.apply(this, args);
    };
    const origUse = WebGL2RenderingContext.prototype.useProgram;
    WebGL2RenderingContext.prototype.useProgram = function(...args) {
      window.__glCalls.useProgram++;
      return origUse.apply(this, args);
    };
    console.log('[HOOK] WebGL2 hooks installed');
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

// 检查 hook 计数
const counts = await page.evaluate(() => window.__glCalls);
console.log('=== GL Call Counts (after 5s) ===');
console.log(JSON.stringify(counts, null, 2));

// 主动触发一次 render.request 看是否调用 drawArrays
const beforeTrigger = await page.evaluate(() => window.__glCalls.drawArrays);
await page.evaluate(() => {
  // 触发 render.request
  // 但我们不知道 bus 的全局引用 - 用 resize 触发 handleResize → render
  window.dispatchEvent(new Event('resize'));
});
await new Promise((r) => setTimeout(r, 500));
const afterTrigger = await page.evaluate(() => window.__glCalls.drawArrays);
console.log(`\n=== After resize trigger ===`);
console.log(`drawArrays before: ${beforeTrigger}, after: ${afterTrigger}`);

await page.screenshot({ path: '/workspace/.planning/2026-06-26-debug-mysterious-issues/hooked-screenshot.png' });

// 再看一次
const finalCounts = await page.evaluate(() => window.__glCalls);
console.log('\n=== Final GL Call Counts ===');
console.log(JSON.stringify(finalCounts, null, 2));

await browser.close();
