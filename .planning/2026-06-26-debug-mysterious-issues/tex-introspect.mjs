// Check: (1) float texture extension availability, (2) sample plateTex.a (boundary)
// at 9x9 grid points by attaching plateTex to an FBO and readPixels.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const result = await page.evaluate(() => {
  const c = document.getElementById('glCanvas');
  if (!c) return { err: 'no canvas' };
  const gl = c.getContext('webgl2');
  if (!gl) return { err: 'no webgl2' };

  const out = {};
  out.floatExt = !!gl.getExtension('EXT_color_buffer_float');
  out.floatLinearExt = !!gl.getExtension('OES_texture_float_linear');
  out.renderer = gl.getParameter(gl.RENDERER);
  out.version = gl.getParameter(gl.VERSION);

  // Find the plateTex texture: it's bound to TEXTURE0. Read it back via an FBO.
  // The app's render loop binds plateTex to TEXTURE0. We create our own FBO and
  // attach the currently-bound TEXTURE0 texture.
  const prog = gl.getParameter(gl.CURRENT_PROGRAM);
  // Re-bind textures the way render() does, by re-running the app's render via bus
  // is hard. Instead, just trigger a render.request then immediately sample.
  // Simpler: query the texture bound to TEXTURE0 right now.
  const tex0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

  // Create FBO
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  out.fboStatus = status === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : 'INCOMPLETE:' + status;

  if (status === gl.FRAMEBUFFER_COMPLETE) {
    // plateTex dimensions = mapSize x mapSize (256). Read 9x9 grid.
    const N = 9;
    out.plateTexSize = { w: 256, h: 256 }; // assumption; will verify via readPixels bounds
    out.grid = [];
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        const cx = Math.floor((gx / (N - 1)) * 255);
        const cy = Math.floor((gy / (N - 1)) * 255);
        const px = new Float32Array(4);
        gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.FLOAT, px);
        const u8 = new Uint8Array(4);
        gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, u8);
        out.grid.push({ x: cx, y: cy, float: Array.from(px), u8: Array.from(u8) });
      }
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  return out;
});

console.log('=== GL INFO ===');
console.log('renderer:', result.renderer);
console.log('version:', result.version);
console.log('EXT_color_buffer_float:', result.floatExt);
console.log('OES_texture_float_linear:', result.floatLinearExt);
console.log('FBO status:', result.fboStatus);

if (result.grid) {
  console.log('\n=== plateTex 9x9 grid (RGBA) — float readback ===');
  const N = 9;
  for (let gy = N - 1; gy >= 0; gy--) {
    let rowF = 'F: ', rowU = 'U8:';
    for (let gx = 0; gx < N; gx++) {
      const p = result.grid[gy * N + gx];
      const [r, g, b, a] = p.float.map(v => v.toFixed(3));
      rowF += ` [${r},${g},${b},${a}]`;
      const [ur, ug, ub, ua] = p.u8;
      rowU += ` [${ur},${ug},${ub},${ua}]`;
    }
    console.log(rowF);
    console.log(rowU);
  }
  // Stats on alpha (boundary)
  const alphas = result.grid.map(p => p.float[3]);
  const aHigh = alphas.filter(a => a > 0.06).length;
  console.log(`\nplateTex.a (boundary) > 0.06: ${aHigh}/${alphas.length} pixels`);
  console.log('alpha values:', alphas.map(a => a.toFixed(3)).join(', '));
}

await browser.close();
