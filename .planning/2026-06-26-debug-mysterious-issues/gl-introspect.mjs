#!/usr/bin/env node
// GL 状态自省：读取实际 uniform 值、纹理绑定、sampler-unit 映射
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

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

// 启动器
await page.evaluate(() => {
  const overlay = document.getElementById('launcher-overlay');
  const btns = overlay.querySelectorAll('button');
  for (const b of btns) {
    if (b.textContent && /启动/.test(b.textContent)) { b.click(); return; }
  }
});
await new Promise((r) => setTimeout(r, 4000));

// 自省 GL 状态
const glState = await page.evaluate(() => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) return { error: 'no canvas' };
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'no webgl2 context' };

  // 1. 检查 canvas 实际尺寸和 drawingBuffer 尺寸
  const canvasSize = { w: canvas.width, h: canvas.height, dbW: gl.drawingBufferWidth, dbH: gl.drawingBufferHeight };

  // 2. 找到 WebGLRenderer 实例（它没有挂到 window，需通过其他方式）
  // 通过 monkey-patch WebGLRenderingContext.prototype.getParameter 等方式获取不到 instance
  // 但我们可以重新查询当前 program 的 active uniforms
  // 拿不到 program，只能从 currentProgram 读
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  if (!program) return { canvasSize, error: 'no current program' };

  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  const uniforms = [];
  for (let i = 0; i < numUniforms; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const loc = gl.getUniformLocation(program, info.name);
    if (!loc) continue;
    let value = null;
    try {
      value = gl.getUniform(program, loc);
    } catch (e) {
      value = 'err: ' + e.message;
    }
    uniforms.push({
      name: info.name,
      type: info.type,  // 35676=SAMPLER_2D, 5124=INT, 5126=FLOAT, 35664=VEC2, 35665=VEC3
      size: info.size,
      value: Array.isArray(value) ? value.slice(0, 8) : value,
    });
  }

  // 3. 检查纹理绑定 - 检查 unit 0-7
  const texBindings = [];
  for (let unit = 0; unit < 8; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    const tex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    texBindings.push({
      unit,
      tex: tex ? 'bound' : 'null',
      // 检查纹理参数
      width: tex ? gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WIDTH) : null,
    });
  }
  // 复原 active texture
  gl.activeTexture(gl.TEXTURE0);

  // 4. 检查 viewport
  const viewport = gl.getParameter(gl.VIEWPORT);

  // 5. 检查 clear color
  const clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);

  // 6. 检查 current program info
  const programInfo = {
    linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
    activeUniforms: numUniforms,
    activeAttributes: gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES),
  };

  // 7. 通过 readPixels 读取实际 canvas 中心像素（在 fresh render 后立即读）
  // 先 force render
  // 实际上 preserveDrawingBuffer=false 时 readPixels 仍然有效（在 frame 内）
  const centerPixel = new Uint8Array(4);
  gl.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, centerPixel);

  // 读多个点
  const samples = [];
  const points = [
    [canvas.width/2, canvas.height/2],
    [canvas.width/4, canvas.height/4],
    [canvas.width*3/4, canvas.height*3/4],
    [canvas.width/2, canvas.height/4],
    [10, 10],
  ];
  for (const [x, y] of points) {
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    samples.push({ x, y, rgba: Array.from(px) });
  }

  // 8. extensions
  const extensions = {
    colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
    textureFloatLinear: !!gl.getExtension('OES_texture_float_linear'),
    debugRendererInfo: !!gl.getExtension('WEBGL_debug_renderer_info'),
  };
  let renderer = 'unknown';
  const dr = gl.getExtension('WEBGL_debug_renderer_info');
  if (dr) {
    renderer = gl.getParameter(dr.UNMASKED_RENDERER_WEBGL);
  }

  return {
    canvasSize,
    programInfo,
    uniforms,
    texBindings,
    viewport,
    clearColor: Array.from(clearColor).slice(0, 4),
    centerPixel: Array.from(centerPixel),
    samples,
    extensions,
    renderer,
  };
});

console.log('=== GL State Introspection ===');
console.log('Renderer:', glState.renderer);
console.log('Canvas size:', glState.canvasSize);
console.log('Viewport:', glState.viewport);
console.log('Clear color:', glState.clearColor);
console.log('Extensions:', glState.extensions);
console.log('Program info:', glState.programInfo);
console.log('\n--- Texture bindings ---');
glState.texBindings.forEach(t => console.log(`  unit ${t.unit}: ${t.tex}`));
console.log('\n--- Active uniforms ---');
const samplerType = 35676;
glState.uniforms.forEach(u => {
  const typeName = u.type === 35676 ? 'SAMPLER_2D' : u.type === 5124 ? 'INT' : u.type === 5126 ? 'FLOAT' : u.type === 35664 ? 'VEC2' : u.type === 35665 ? 'VEC3' : u.type === 35666 ? 'VEC4' : `type(${u.type})`;
  console.log(`  ${u.name} (${typeName}) = ${JSON.stringify(u.value)}`);
});
console.log('\n--- Pixel samples (from readPixels) ---');
glState.samples.forEach(s => console.log(`  (${s.x}, ${s.y}): rgba = [${s.rgba}]`));

await browser.close();
