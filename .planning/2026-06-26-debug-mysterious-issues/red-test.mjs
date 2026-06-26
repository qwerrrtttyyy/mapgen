#!/usr/bin/env node
// 测试 shader 是否真的在主 canvas 运行
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

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

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  if (overlay) {
    const btns = overlay.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && /启动/.test(b.textContent)) { b.click(); return; }
    }
  }
});
await new Promise((r) => setTimeout(r, 4000));

await page.screenshot({ path: '/workspace/.planning/2026-06-26-debug-mysterious-issues/debug-red-test.png' });

// 像素分析
const result = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return { error: 'no canvas' };
  // 通过 createImageBitmap 读取 canvas 内容
  return new Promise((resolve) => {
    createImageBitmap(canvas).then((bmp) => {
      const tmp = document.createElement('canvas');
      tmp.width = bmp.width;
      tmp.height = bmp.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      // 采样中心
      const cx = Math.floor(bmp.width / 2);
      const cy = Math.floor(bmp.height / 2);
      const data = ctx.getImageData(cx - 5, cy - 5, 10, 10).data;
      const samples = [];
      for (let i = 0; i < data.length; i += 4) {
        samples.push([data[i], data[i+1], data[i+2]]);
      }
      resolve({
        canvasSize: `${bmp.width}x${bmp.height}`,
        centerSamples: samples.slice(0, 5),
      });
    }).catch(e => resolve({ error: e.message }));
  });
});

console.log('=== Red Test Result ===');
console.log(JSON.stringify(result, null, 2));

await browser.close();
