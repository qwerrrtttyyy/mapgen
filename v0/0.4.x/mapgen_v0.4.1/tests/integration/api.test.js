import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SERVER_PATH = path.join(PROJECT_ROOT, 'server.js');

function getTestPort(offset = 0) {
  let port = 19201 + ((Date.now() + offset * 233) % 10000);
  if (port < 1024) port += 10000;
  return port;
}

function spawnServer(port) {
  const proc = spawn('node', [SERVER_PATH], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MAPGEN_PORT: String(port), MAPGEN_HOST: '127.0.0.1' },
  });
  return proc;
}

function getProcPort(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout reading server log')), 10000);
    const onData = (data) => {
      const match = data.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        proc.stdout.removeListener('data', onData);
        resolve(parseInt(match[1], 10));
      }
    };
    proc.stdout.on('data', onData);
  });
}

function waitForServerPort(port, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://127.0.0.1:${port}/health`, res => {
        res.resume();
        resolve(port);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`No response from port ${port} within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 250);
        }
      });
    };
    setTimeout(check, 600);
  });
}

async function killServer(proc) {
  if (proc && !proc.killed) {
    try { proc.kill('SIGINT'); } catch {}
    await new Promise(r => setTimeout(r, 600));
  }
}

describe('API routes', () => {
  let serverProc = null;
  let actualPort = null;
  let basePort = null;

  before(async () => {
    basePort = getTestPort(0);
    serverProc = spawnServer(basePort);
    // Server might override port; get actual from log
    actualPort = await getProcPort(serverProc);
    await waitForServerPort(actualPort);
  });

  after(async () => {
    await killServer(serverProc);
  });

  function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: actualPort,
        path: urlPath,
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      const req = http.request(opts, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it('/health returns 200 with required fields', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(typeof res.body.version === 'string');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(typeof res.body.node === 'string');
    assert.ok(typeof res.body.memory === 'string');
    assert.ok(typeof res.body.checkpoints === 'number');
  });

  it('/api/version returns 200 and correct struct', async () => {
    const res = await request('GET', '/api/version');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.version === 'string');
    assert.strictEqual(res.body.arch, 'client-server');
    assert.strictEqual(typeof res.body.checkpoints, 'boolean');
    assert.strictEqual(typeof res.body.serverGen, 'boolean');
  });

  it('/api/config GET returns 200 with fields', async () => {
    const res = await request('GET', '/api/config');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.port === 'number');
    assert.ok(typeof res.body.host === 'string');
    assert.strictEqual(typeof res.body.openBrowser, 'boolean');
    assert.strictEqual(typeof res.body.autoPortFallback, 'boolean');
    assert.strictEqual(typeof res.body.ckptDir, 'string');
  });

it('/api/config PUT updates and returns ok', async () => {
  const res = await request('PUT', '/api/config', { mountainFold: 0.75 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.config.mountainFold, 0.75);
});

it('/api/generate returns map data for valid params', async () => {
  const res = await request('POST', '/api/generate', {
    seedStr: 'test', mapSize: 128, plateCount: 4, landmass: 0.4,
    noiseType: 'perlin', fbmType: 'standard', octaves: 3, lacunarity: 2,
    persistence: 0.5, seaLevel: 0.45, erosionStrength: 1, erosionIterations: 10,
    mountainFold: 0.3, tempOffset: 0, snowLine: 0.5, coastDetail: 0.5, lakeDensity: 0.02,
    mapAspect: '1:1'
  });
  assert.strictEqual(res.status, 200);
  assert.ok(typeof res.body.width === 'number');
  assert.ok(Array.isArray(res.body.elevTex));
  assert.ok(Array.isArray(res.body.plates));
});

it('/api/export returns dataUrl for valid map data', async () => {
  const genRes = await request('POST', '/api/generate', {
    seedStr: 'export-test', mapSize: 64, plateCount: 3, landmass: 0.4,
    noiseType: 'perlin', fbmType: 'standard', octaves: 2, lacunarity: 2,
    persistence: 0.5, seaLevel: 0.45, erosionStrength: 0.5, erosionIterations: 5,
    mountainFold: 0.3, tempOffset: 0, snowLine: 0.5, coastDetail: 0.5, lakeDensity: 0.01,
    mapAspect: '1:1'
  });
  assert.strictEqual(genRes.status, 200);
  const expRes = await request('POST', '/api/export', { mapData: { elevTex: genRes.body.elevTex, width: 64, height: 64 } });
  assert.strictEqual(expRes.status, 200);
  assert.ok(typeof expRes.body.dataUrl === 'string');
  assert.ok(expRes.body.dataUrl.startsWith('data:image/png;base64,'));
});

it('/api/generate accepts empty params with defaults', async () => {
  const res = await request('POST', '/api/generate', {});
  assert.strictEqual(res.status, 200);
  assert.ok(typeof res.body.width === 'number');
});
});
