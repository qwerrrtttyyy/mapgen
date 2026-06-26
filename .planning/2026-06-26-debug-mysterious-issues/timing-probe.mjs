#!/usr/bin/env node
// 像素级验证 + 生成耗时测量
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const busEvents = [];
await page.exposeFunction('recordEvent', (e) => busEvents.push({ ...e, t: Date.now() }));

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

// 注入事件探针
await page.evaluate(() => {
  const origLog = console.log;
  // 监听 bus 事件 - 通过劫持 dispatchEvent 或简单轮询 state
  window.__diag = { genStart: 0, genEnd: 0, isGen: false, progressSeen: [] };
  // 直接监听 DOM 变化
  const observer = new MutationObserver(() => {
    const pt = document.getElementById('progress-text');
    const pc = document.getElementById('progress-container');
    if (pt && pc) {
      const display = getComputedStyle(pc).display;
      if (display !== 'none') {
        window.__diag.progressSeen.push({ text: pt.textContent, t: Date.now() });
      }
    }
  });
  const pc = document.getElementById('progress-container');
  if (pc) observer.observe(pc, { attributes: true, subtree: true, childList: true, characterData: true });
});

// 点启动器
await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  const btns = overlay.querySelectorAll('button');
  for (const b of btns) {
    if (b.textContent && /启动/.test(b.textContent)) { b.click(); return; }
  }
});

// 监听 30 秒，记录 progress 状态变化
const start = Date.now();
const samples = [];
while (Date.now() - start < 30000) {
  await new Promise((r) => setTimeout(r, 500));
  const s = await page.evaluate(() => {
    const pt = document.getElementById('progress-text');
    const pc = document.getElementById('progress-container');
    const canvas = document.getElementById('glCanvas');
    return {
      t: Date.now(),
      progressText: pt?.textContent || null,
      progressDisplay: pc ? getComputedStyle(pc).display : null,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      isGenerating: window.__diag?.isGen,
    };
  });
  s.elapsed = s.t - start;
  samples.push(s);
  // 一旦进度条隐藏，再等 2s 然后退出
  if (s.progressDisplay === 'none' && samples.length > 4) {
    await new Promise((r) => setTimeout(r, 2000));
    break;
  }
}

// 像素采样 - 用 page.screenshot 然后用 canvas API 分析
await page.screenshot({ path: '/workspace/.planning/2026-06-26-debug-mysterious-issues/round2/timing-final.png' });

// 用 page.evaluate 在浏览器内分析 canvas 像素
const pixelInfo = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return { error: 'no canvas' };
  // 创建 2D canvas 复制 webgl 内容
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  // 采样中心区域 100x100
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2);
  const data = ctx.getImageData(cx - 50, cy - 50, 100, 100).data;
  // 统计独特颜色数
  const colors = new Set();
  let nonBg = 0;
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i+1]},${data[i+2]}`;
    colors.add(key);
    // 非背景色（背景深蓝 ~ (13, 13, 25)）
    if (Math.abs(data[i] - 13) + Math.abs(data[i+1] - 13) + Math.abs(data[i+2] - 25) > 30) {
      nonBg++;
    }
  }
  return {
    canvasSize: `${canvas.width}x${canvas.height}`,
    uniqueColorsInCenter: colors.size,
    nonBgPixelsInCenter: nonBg,
    totalSampled: data.length / 4,
    centerSampleColor: `rgb(${data[5000]},${data[5001]},${data[5002]})`,
  };
});

console.log('=== Timing Samples ===');
console.log('Total samples:', samples.length);
console.log('First 3:', samples.slice(0, 3));
console.log('Last 3:', samples.slice(-3));
console.log('\nKey transitions:');
let lastText = null;
samples.forEach((s, i) => {
  if (s.progressText !== lastText) {
    console.log(`  [${(s.elapsed/1000).toFixed(1)}s] text="${s.progressText}" display=${s.progressDisplay}`);
    lastText = s.progressText;
  }
});
console.log('\n=== Pixel Analysis ===');
console.log(pixelInfo);

await browser.close();
