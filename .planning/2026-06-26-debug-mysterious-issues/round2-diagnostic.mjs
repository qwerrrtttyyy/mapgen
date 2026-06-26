#!/usr/bin/env node
// Round 2 诊断：用户报告"还是会出现诡异问题"，需重新收集证据
// 捕获：console / pageerror / requestfailed / GL warnings / 多状态截图 / 交互后状态

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/workspace/.planning/2026-06-26-debug-mysterious-issues/round2';
fs.mkdirSync(OUT, { recursive: true });

const events = {
  console: [],
  pageerror: [],
  requestfailed: [],
  warning: [],
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl2',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  events.console.push({ type, text });
  if (type === 'warning' || type === 'error') {
    events.warning.push({ type, text });
  }
});
page.on('pageerror', (err) => events.pageerror.push(err.message));
page.on('requestfailed', (req) =>
  events.requestfailed.push({ url: req.url(), failure: req.failure()?.errorText })
);

console.log('[1] Navigating to http://localhost:3000/');
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

await page.screenshot({ path: path.join(OUT, '01-initial.png') });

// 检查启动器
const launcherState = await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  return {
    launcherVisible: overlay ? getComputedStyle(overlay).display !== 'none' : false,
    launcherExists: !!overlay,
    bodyClass: document.body.className,
  };
});
console.log('[2] Launcher state:', launcherState);

// 如果启动器存在，找 start 按钮并点击
const startBtn = await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  if (!overlay) return null;
  const btns = overlay.querySelectorAll('button');
  for (const b of btns) {
    if (b.textContent && /start|开始|启动|enter|进入/i.test(b.textContent)) {
      return { text: b.textContent.trim(), id: b.id, cls: b.className };
    }
  }
  return null;
});

if (startBtn) {
  console.log('[3] Clicking start button:', startBtn.text);
  await page.evaluate(() => {
    const overlay = document.getElementById('launcher-overlay');
    const btns = overlay.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && /start|开始|启动|enter|进入/i.test(b.textContent)) {
        b.click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 4000));
} else {
  console.log('[3] No start button found');
}

await page.screenshot({ path: path.join(OUT, '02-after-launcher.png') });

// 检查生成状态
const genState = await page.evaluate(() => {
  const progress = document.getElementById('progress') || document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text') || document.getElementById('progressText');
  const canvas = document.getElementById('canvas') || document.querySelector('canvas');
  return {
    progressDisplay: progress ? getComputedStyle(progress).display : 'no-progress-elem',
    progressText: progressText ? progressText.textContent : 'no-progress-text',
    canvasW: canvas ? canvas.width : 0,
    canvasH: canvas ? canvas.height : 0,
  };
});
console.log('[4] Generation state:', genState);

// 取画布中心像素
const centerPixel = await page.evaluate(() => {
  const canvas = document.getElementById('canvas') || document.querySelector('canvas');
  if (!canvas) return null;
  try {
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('2d');
    if (!ctx) return null;
    // 用 screenshot 不可靠，这里返回 canvas size
    return { w: canvas.width, h: canvas.height, hasContext: true };
  } catch (e) {
    return { error: e.message };
  }
});

// 主动触发"生成地图"按钮
const genBtn = await page.evaluate(() => {
  const btn = document.getElementById('btn-generate') || document.getElementById('btn-gen');
  if (!btn) {
    const all = Array.from(document.querySelectorAll('button'));
    const found = all.find((b) => /生成|generate/i.test(b.textContent || ''));
    return found ? { text: found.textContent.trim(), id: found.id } : null;
  }
  return { text: btn.textContent.trim(), id: btn.id };
});
console.log('[5] Generate button:', genBtn);

if (genBtn) {
  await page.evaluate(() => {
    const btn = document.getElementById('btn-generate') || document.getElementById('btn-gen');
    if (btn) { btn.click(); return; }
    const all = Array.from(document.querySelectorAll('button'));
    const found = all.find((b) => /生成|generate/i.test(b.textContent || ''));
    if (found) found.click();
  });
  await new Promise((r) => setTimeout(r, 5000));
}

await page.screenshot({ path: path.join(OUT, '03-after-generate.png') });

const stateAfterGen = await page.evaluate(() => {
  const progressText = document.getElementById('progress-text') || document.getElementById('progressText');
  const canvas = document.getElementById('canvas') || document.querySelector('canvas');
  return {
    progressText: progressText ? progressText.textContent : 'none',
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'no-canvas',
  };
});
console.log('[6] State after generate:', stateAfterGen);

// 测试激光开关
const laserToggle = await page.evaluate(() => {
  const cb = document.getElementById('laserActive') || document.querySelector('input[name="laserActive"]');
  return cb ? { id: cb.id, checked: cb.checked } : null;
});
console.log('[7] Laser toggle:', laserToggle);

if (laserToggle && !laserToggle.checked) {
  await page.evaluate(() => {
    const cb = document.getElementById('laserActive');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await new Promise((r) => setTimeout(r, 1500));
}

// 在画布上拖拽模拟激光
const canvasBox = await page.evaluate(() => {
  const c = document.getElementById('canvas') || document.querySelector('canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

if (canvasBox) {
  const x1 = canvasBox.x + canvasBox.w * 0.3;
  const y1 = canvasBox.y + canvasBox.h * 0.4;
  const x2 = canvasBox.x + canvasBox.w * 0.7;
  const y2 = canvasBox.y + canvasBox.h * 0.6;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1500));
}

await page.screenshot({ path: path.join(OUT, '04-after-laser.png') });

// 切换样式
const styleSel = await page.evaluate(() => {
  const sel = document.getElementById('style') || document.getElementById('renderStyle');
  return sel ? { id: sel.id, value: sel.value, options: Array.from(sel.options).map((o) => o.value) } : null;
});
console.log('[8] Style selector:', styleSel);

if (styleSel && styleSel.options.length > 1) {
  // 切到第二个样式
  await page.evaluate(() => {
    const sel = document.getElementById('style') || document.getElementById('renderStyle');
    if (sel && sel.options.length > 1) {
      sel.value = sel.options[1].value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, '05-after-style-change.png') });
}

// 切换回 terrain 并测试 seaLevel 滑块
await page.evaluate(() => {
  const sel = document.getElementById('style') || document.getElementById('renderStyle');
  if (sel) {
    sel.value = '0';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await new Promise((r) => setTimeout(r, 1000));

const seaLevelSlider = await page.evaluate(() => {
  const s = document.getElementById('seaLevel') || document.querySelector('input[name="seaLevel"]');
  return s ? { id: s.id, value: s.value, min: s.min, max: s.max } : null;
});
console.log('[9] SeaLevel slider:', seaLevelSlider);

if (seaLevelSlider) {
  await page.evaluate(() => {
    const s = document.getElementById('seaLevel');
    if (s) {
      s.value = '0.6';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '06-after-sealevel-change.png') });
}

// 移动端视口
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(OUT, '07-mobile-view.png') });

// 还原桌面
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 1000));

// 收集所有警告和错误
const allWarnings = events.warning.filter((w) =>
  !/Failed to load resource|favicon|404/i.test(w.text)
);

fs.writeFileSync(
  path.join(OUT, 'events.json'),
  JSON.stringify({
    summary: {
      totalConsole: events.console.length,
      totalPageerror: events.pageerror.length,
      totalRequestfailed: events.requestfailed.length,
      totalWarnings: events.warning.length,
      filteredWarnings: allWarnings.length,
    },
    pageerrors: events.pageerror,
    requestfailed: events.requestfailed,
    warnings: events.warning,
    consoleErrors: events.console.filter((c) => c.type === 'error'),
    allConsole: events.console,
  }, null, 2)
);

console.log('\n=== Diagnostic Summary ===');
console.log('Total console messages:', events.console.length);
console.log('Page errors:', events.pageerror.length);
console.log('Request failures:', events.requestfailed.length);
console.log('Warnings (raw):', events.warning.length);
console.log('Warnings (filtered):', allWarnings.length);
if (events.pageerror.length) {
  console.log('\nPage errors:');
  events.pageerror.forEach((e) => console.log('  -', e));
}
if (allWarnings.length) {
  console.log('\nFiltered warnings:');
  allWarnings.forEach((w) => console.log(`  [${w.type}]`, w.text));
}

await browser.close();
console.log('\nOutput dir:', OUT);
