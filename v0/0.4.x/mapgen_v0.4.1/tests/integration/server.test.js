import http from 'http';
import { spawn } from 'child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const SERVER_PATH = '/home/a/aihtml/v0/0.4.x/mapgen_v0.4.1/server.js';
const TEST_PORTS = [19401, 19402, 19403, 19404, 19405, 19406, 19407];

function spawnServer(port) {
  const proc = spawn('node', [SERVER_PATH], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, MAPGEN_PORT: String(port), MAPGEN_HOST: '127.0.0.1', HEADLESS: 'true' },
  });
  return proc;
}

function waitForServerPort(port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://127.0.0.1:${port}/health`, res => {
        res.resume();
        resolve(port);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not respond on ${port}`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    setTimeout(check, 700);
  });
}

async function killServer(proc) {
  if (proc && !proc.killed) {
    try { proc.kill('SIGINT'); } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
}

describe('server integration', () => {
  it('server starts on a free port', async () => {
    const port = TEST_PORTS[0];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/health`, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }));
        }).on('error', reject);
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    } finally {
      await killServer(proc);
    }
  });

  it('engine module is loaded (serverGen=true)', async () => {
    const port = TEST_PORTS[1];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/api/version`, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ body: JSON.parse(d) }));
        }).on('error', reject);
      });
      assert.strictEqual(res.body.serverGen, true);
    } finally {
      await killServer(proc);
    }
  });

  it('SSE /api/events sends connected event', async () => {
    const port = TEST_PORTS[2];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const dataPromise = new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/events`, r => {
          let body = '';
          r.on('data', c => body += c);
          setTimeout(() => {
            req.destroy();
            resolve(body);
          }, 900);
        });
        req.on('error', reject);
      });
      const body = await dataPromise;
      assert.ok(body.includes('event: connected'), `expected connected, got: ${body.slice(0, 100)}`);
    } finally {
      await killServer(proc);
    }
  });

  it('static serving returns index.html (text/html)', async () => {
    const port = TEST_PORTS[3];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/`, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, body: d, type: r.headers['content-type'] }));
        }).on('error', reject);
      });
      assert.strictEqual(res.status, 200);
      assert.ok((res.type || '').includes('text/html'));
      assert.ok(res.body.includes('Material Map Generator'));
    } finally {
      await killServer(proc);
    }
  });

  it('static JS served with javascript content type', async () => {
    const port = TEST_PORTS[4];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/js/engine/noise.js`, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, type: r.headers['content-type'] }));
        }).on('error', reject);
      });
      assert.strictEqual(res.status, 200);
      assert.ok((res.type || '').includes('javascript'));
    } finally {
      await killServer(proc);
    }
  });

  it('unknown route returns 404', async () => {
    const port = TEST_PORTS[5];
    const proc = spawnServer(port);
    try {
      await waitForServerPort(port);
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/api/nonexistent`, r => {
          r.resume();
          resolve({ status: r.statusCode });
        }).on('error', reject);
      });
      assert.strictEqual(res.status, 404);
    } finally {
      await killServer(proc);
    }
  });

  it('port fallback when requested port is occupied', async () => {
    const wantedPort = TEST_PORTS[6];
    let blocker = null;
    let occupied = false;
    try {
      blocker = http.createServer();
      await new Promise(r => blocker.listen(wantedPort, '127.0.0.1', r));
      occupied = true;
      const proc = spawnServer(wantedPort);
      const fallbackPort = wantedPort + 1;
      try {
        await waitForServerPort(fallbackPort, 9000);
        const res = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${fallbackPort}/health`, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }));
          }).on('error', reject);
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
      } finally {
        await killServer(proc);
      }
    } finally {
      if (blocker) blocker.close();
    }
    if (!occupied) {
      throw new Error('Could not occupy port — fallback test skipped');
    }
  });
});
