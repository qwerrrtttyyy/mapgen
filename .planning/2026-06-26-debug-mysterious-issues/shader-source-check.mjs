#!/usr/bin/env node
// 验证 GL program 里实际编译的 shader source 是否含 debug 行
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

// 用 cache-busting 加载页面
await page.goto('http://localhost:3000/?_=debug' + Date.now(), { waitUntil: 'networkidle0' });
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

// 检查 shader source
const shaderInfo = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return { error: 'no canvas' };
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'no webgl2' };

  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  if (!program) return { error: 'no current program' };

  // 获取 attached shaders
  const shaders = gl.getAttachedShaders(program);
  if (!shaders) return { error: 'cannot get shaders' };

  const result = [];
  for (const s of shaders) {
    const type = gl.getShaderParameter(s, gl.SHADER_TYPE);
    const compiled = gl.getShaderParameter(s, gl.COMPILE_STATUS);
    const source = gl.getShaderSource(s);
    const log = gl.getShaderInfoLog(s);
    result.push({
      type: type === gl.VERTEX_SHADER ? 'VERTEX' : type === gl.FRAGMENT_SHADER ? 'FRAGMENT' : 'UNKNOWN',
      compiled,
      log: log || '(empty)',
      sourceLast200: source ? source.slice(-200) : null,
      sourceContainsDebug: source ? source.includes('fragColor = vec4(1.0, 0.0, 0.0, 1.0)') : false,
    });
  }

  // 也检查 program link status
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  const programLog = gl.getProgramInfoLog(program);

  return {
    linked,
    programLog: programLog || '(empty)',
    shaders: result,
  };
});

console.log('=== Shader Source Check ===');
console.log('Program linked:', shaderInfo.linked);
console.log('Program log:', shaderInfo.programLog);
console.log('\nShaders:');
shaderInfo.shaders.forEach((s, i) => {
  console.log(`\n  [${i}] ${s.type}`);
  console.log(`    compiled: ${s.compiled}`);
  console.log(`    log: ${s.log}`);
  console.log(`    contains debug line: ${s.sourceContainsDebug}`);
  console.log(`    source last 200 chars:\n      ${s.sourceLast200}`);
});

await browser.close();
