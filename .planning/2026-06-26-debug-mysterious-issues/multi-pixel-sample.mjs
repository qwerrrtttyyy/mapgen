#!/usr/bin/env node
// 多点采样实际渲染像素，判断 shader 是否真的渲染地形
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

// Hook drawArrays 后采样多个点
await page.evaluateOnNewDocument(() => {
  window.__samples = null;
  let sampled = false;
  const hookGL = () => {
    if (typeof WebGL2RenderingContext === 'undefined') {
      setTimeout(hookGL, 10);
      return;
    }
    const origDraw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) {
      const ret = origDraw.apply(this, args);
      // 在第 5 次 draw 后采样（等渲染稳定）
      if (!sampled && window.__drawCount >= 4) {
        sampled = true;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const samples = [];
        // 9x9 网格采样
        for (let yi = 0; yi < 9; yi++) {
          const row = [];
          for (let xi = 0; xi < 9; xi++) {
            const x = Math.floor((xi + 0.5) / 9 * w);
            const y = Math.floor((yi + 0.5) / 9 * h);
            const px = new Uint8Array(4);
            this.readPixels(x, y, 1, 1, this.RGBA, this.UNSIGNED_BYTE, px);
            row.push([px[0], px[1], px[2]]);
          }
          samples.push(row);
        }
        window.__samples = samples;
        console.log('[HOOK] samples collected');
      }
      window.__drawCount = (window.__drawCount || 0) + 1;
      return ret;
    };
    console.log('[HOOK] installed');
  };
  hookGL();
});

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
await new Promise((r) => setTimeout(r, 5000));

const samples = await page.evaluate(() => window.__samples);
if (!samples) {
  console.log('No samples collected, trying resize...');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await new Promise((r) => setTimeout(r, 1000));
}
const samplesFinal = await page.evaluate(() => window.__samples);

console.log('=== Rendered Pixel Grid (9x9) ===');
console.log('Each cell is RGB at that position');
console.log('');
if (samplesFinal) {
  for (const row of samplesFinal) {
    const line = row.map(c => {
      const [r, g, b] = c;
      // 标记颜色类型
      let tag = '   ';
      if (r > 200 && g > 200 && b > 200) tag = 'SNW'; // snow
      else if (r > 200 && g > 100 && b < 100) tag = 'RED';
      else if (b > r && b > g && b > 80) tag = 'SEA';
      else if (g > r && g > b) tag = 'GRN';
      else if (r > 150 && g > 100 && b < 100) tag = 'SND';
      else if (r < 30 && g < 30 && b < 30) tag = 'BLK';
      else tag = '   ';
      return `${tag}${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}`;
    }).join(' | ');
    console.log(line);
  }
} else {
  console.log('No samples collected');
}

// 统计颜色分布
if (samplesFinal) {
  const allColors = samplesFinal.flat();
  const blackCount = allColors.filter(c => c[0] < 30 && c[1] < 30 && c[2] < 30).length;
  const seaCount = allColors.filter(c => c[2] > c[0] && c[2] > c[1] && c[2] > 80).length;
  const greenCount = allColors.filter(c => c[1] > c[0] && c[1] > c[2]).length;
  const redCount = allColors.filter(c => c[0] > 150 && c[1] < 100 && c[2] < 100).length;
  console.log(`\nColor distribution (out of ${allColors.length} samples):`);
  console.log(`  Black: ${blackCount}`);
  console.log(`  Sea (blue): ${seaCount}`);
  console.log(`  Green: ${greenCount}`);
  console.log(`  Red: ${redCount}`);
}

await browser.close();
