#!/usr/bin/env node
// 深度诊断：DOM 遮挡检查 + preserveDrawingBuffer 重读 + 临时替换 shader 测试
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
await new Promise((r) => setTimeout(r, 4000));

// 1. 检查 DOM 层级和遮挡
const domCheck = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return { error: 'no canvas' };
  const rect = canvas.getBoundingClientRect();
  // 检查所有覆盖 canvas 中心的元素
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const stack = document.elementsFromPoint(cx, cy);
  // canvas computed style
  const cs = getComputedStyle(canvas);
  return {
    canvasRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    canvasStyle: {
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      position: cs.position,
      width: cs.width,
      height: cs.height,
      background: cs.background,
      filter: cs.filter,
    },
    elementsAtCenter: stack.slice(0, 10).map(el => ({
      tag: el.tagName,
      id: el.id,
      cls: el.className,
      zIndex: getComputedStyle(el).zIndex,
      display: getComputedStyle(el).display,
      opacity: getComputedStyle(el).opacity,
      bg: getComputedStyle(el).backgroundColor,
    })),
    canvasComputedWidth: canvas.width,
    canvasComputedHeight: canvas.height,
    canvasStyleWidth: canvas.style.width,
    canvasStyleHeight: canvas.style.height,
  };
});

console.log('=== DOM Layering Check ===');
console.log('Canvas rect:', domCheck.canvasRect);
console.log('Canvas style:', domCheck.canvasStyle);
console.log('Canvas actual size:', domCheck.canvasComputedWidth, 'x', domCheck.canvasComputedHeight);
console.log('Canvas CSS size:', domCheck.canvasStyleWidth, domCheck.canvasStyleHeight);
console.log('\nElements at canvas center (top to bottom):');
domCheck.elementsAtCenter.forEach((e, i) => {
  console.log(`  ${i}: <${e.tag} id="${e.id}" class="${e.cls}"> z=${e.zIndex} display=${e.display} opacity=${e.opacity} bg=${e.bg}`);
});

// 2. 在渲染后立即读 pixels（保持 buffer）
const afterRender = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  // 上面会返回 existing context（不会改变 preserveDrawingBuffer）
  // 我们需要另一种方法：直接监听下一次 render

  // 实际上重新拿 context 会 invalidate 旧的 - 让我直接用现有 context 但通过 scheduleRender 触发
  // 拿不到现有 GL context，跳过

  // 改用：触发 render.request，然后在 RAF 内立即 readPixels
  return new Promise((resolve) => {
    // 监听一次 RAF
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 此时刚完成一帧 render
        // 但拿不到 GL context，无法 readPixels
        resolve({ msg: 'RAF done but cannot read GL without context ref' });
      });
    });
  });
});
console.log('\nAfter render attempt:', afterRender);

// 3. 直接修改 canvas 大小让 GL 重新初始化，并加 preserveDrawingBuffer
// 不可行，因为 WebGLRenderer 已经初始化

// 4. 用 screenshot 比较：canvas 矩形区域 vs 周围区域
// 截图后程序化分析 canvas 区域的像素
const screenshot = await page.screenshot();
fs.writeFileSync('/workspace/.planning/2026-06-26-debug-mysterious-issues/full-page.png', screenshot);

// 5. 检查 GL_RENDERER 和检查所有 GL 错误
const glDiag = await page.evaluate(() => {
  // 创建一个 TEMP canvas with preserveDrawingBuffer:true，做最小测试
  const tmp = document.createElement('canvas');
  tmp.width = 100;
  tmp.height = 100;
  const gl = tmp.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) return { error: 'no webgl2' };

  // 创建一个 super-simple shader：输出固定颜色
  const vs = `#version 300 es
    in vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const fs = `#version 300 es
    precision mediump float;
    out vec4 o;
    void main() { o = vec4(0.4, 0.6, 0.8, 1.0); }
  `;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      return { error: gl.getShaderInfoLog(s) };
    }
    return s;
  };
  const vsObj = compile(gl.VERTEX_SHADER, vs);
  const fsObj = compile(gl.FRAGMENT_SHADER, fs);
  if (vsObj.error) return { error: 'VS: ' + vsObj.error };
  if (fsObj.error) return { error: 'FS: ' + fsObj.error };
  const prog = gl.createProgram();
  gl.attachShader(prog, vsObj);
  gl.attachShader(prog, fsObj);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    return { error: 'Link: ' + gl.getProgramInfoLog(prog) };
  }
  gl.useProgram(prog);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, 100, 100);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const px = new Uint8Array(4);
  gl.readPixels(50, 50, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

  return {
    minShaderTest: 'should output vec4(0.4, 0.6, 0.8, 1.0)',
    actualPixel: Array.from(px),
    expectedPixel: [102, 153, 204, 255],
  };
});

console.log('\n=== Minimal Shader Test ===');
console.log(glDiag);

// 6. 拦截 webgl.ts 的初始化，重写后再测试
// 实际上更简单：手动调用主 canvas 的 render 并立即 read
// 通过 patch window.WebGL2RenderingContext.prototype.uniform1i 等方式 hook

// 7. 直接读主 canvas 上的像素 — 通过 hook renderer
const mainRender = await page.evaluate(() => {
  // 创建一个新 canvas，使用主 canvas 的尺寸，但用 preserveDrawingBuffer
  // 实际上不行，我们只能读现有 canvas

  // 用 page 的 screenshot 作为 ground truth
  // 主 canvas 在 (22, 22) 到 (1122, 874) 范围 (假设)
  return { msg: 'using screenshot for ground truth' };
});

await browser.close();
console.log('\n=== Full page screenshot saved to .planning/.../full-page.png ===');
