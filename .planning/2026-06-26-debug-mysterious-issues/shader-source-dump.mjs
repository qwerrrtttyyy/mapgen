// Dump the ACTUAL compiled fragment shader source via getShaderSource,
// to verify whether the running shader matches the file on disk.
import puppeteer from 'puppeteer-core';

const URL = process.env.URL || 'http://localhost:3000/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

const result = await page.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  const out = { canvasCount: canvases.length, shaders: [] };
  for (const c of canvases) {
    const gl = c.getContext('webgl2');
    if (!gl) continue;
    const prog = gl.getParameter(gl.CURRENT_PROGRAM);
    if (!prog) continue;
    const shaders = gl.getAttachedShaders(prog);
    for (const s of shaders) {
      const type = gl.getShaderParameter(s, gl.SHADER_TYPE);
      const src = gl.getShaderSource(s);
      out.shaders.push({
        canvasId: c.id,
        type: type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT',
        compiled: gl.getShaderParameter(s, gl.COMPILE_STATUS),
        source: src,
      });
    }
    // Also: dump ALL active uniforms with their locations and current values
    const numU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    out.allUniforms = [];
    for (let i = 0; i < numU; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      const name = info.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(prog, info.name);
      let val;
      try { val = loc ? gl.getUniform(prog, loc) : 'no-loc'; } catch(e) { val = 'ERR'; }
      out.allUniforms.push({ name, type: info.type, size: info.size, val });
    }
    break; // first webgl canvas
  }
  return out;
});

for (const s of result.shaders) {
  console.log(`\n=== ${s.type} SHADER (canvas ${s.canvasId}, compiled=${s.compiled}) ===`);
  console.log('--- source length:', s.source.length, 'chars ---');
  // Print last 600 chars to see main() end
  console.log('--- LAST 700 CHARS ---');
  console.log(s.source.slice(-700));
  console.log('--- grep fragColor/laserColor lines ---');
  for (const line of s.source.split('\n')) {
    if (line.includes('fragColor') || line.includes('laserColor') || line.includes('DEBUG') || line.includes('return')) {
      console.log('  ' + line.trim());
    }
  }
}
console.log('\n=== ALL ACTIVE UNIFORMS ===');
for (const u of result.allUniforms) {
  console.log(`  ${u.name} (type=${u.type}, size=${u.size}) = ${JSON.stringify(u.val)}`);
}

await browser.close();
