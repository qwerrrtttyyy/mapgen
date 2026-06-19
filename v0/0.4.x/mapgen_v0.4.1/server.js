#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Config ─────────────────────────────────────────────── */
const CONFIG_PATH = process.env.MAPGEN_CONFIG || path.join(__dirname, 'mapgen.json');
let config = {
  port: 8765, host: '127.0.0.1', openBrowser: true,
  autoPortFallback: true, ckptDir: '.checkpoints',
};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const user = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    config = { ...config, ...user };
  }
} catch (e) { console.warn('Config parse error, using defaults:', e.message); }

config.port   = parseInt(process.env.MAPGEN_PORT, 10) || config.port;
config.host   = process.env.MAPGEN_HOST || config.host;

const PORT      = config.port;
const HOST      = config.host;
const PUBLIC    = path.join(__dirname, 'public');
const CKPT_DIR  = path.join(__dirname, config.ckptDir);

if (!fs.existsSync(CKPT_DIR)) fs.mkdirSync(CKPT_DIR, { recursive: true });

/* ── Node.js version check ──────────────────────────────── */
const [major] = process.versions.node.split('.').map(Number);
if (major < 16) {
  console.error(`Requires Node.js >= 16 (current: ${process.versions.node})`);
  process.exit(1);
}

/* ── Engine (server-side generation) ────────────────────── */
let engineModule = null;
try {
  engineModule = await import('./public/js/engine/index.js');
} catch (e) {
  console.warn('Server-side engine not available:', e.message);
}

/* ── SSE progress tracking ──────────────────────────────── */
let sseClients = [];

/* ── MIME ───────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.vert': 'x-shader/x-vertex',
  '.frag': 'x-shader/x-fragment',
  '.glsl': 'x-shader/x-fragment',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function mimeType(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function readFile(file) {
  try { return fs.readFileSync(path.join(PUBLIC, file)); } catch { return null; }
}

/* ── Helpers ────────────────────────────────────────────── */
function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
  });
}

function sendFile(res, req, pathname, file, status = 200) {
  const headers = {
    'Content-Type': mimeType(pathname),
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  };
  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
  if (acceptGzip) {
    zlib.gzip(file, (err, buf) => {
      if (!err) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(status, headers);
        res.end(buf);
      } else {
        res.writeHead(status, headers);
        res.end(file);
      }
    });
  } else {
    res.writeHead(status, headers);
    res.end(file);
  }
}

function broadcastProgress(fraction, phaseName) {
  const data = JSON.stringify({ type: 'progress', fraction, phase: phaseName });
  for (const client of sseClients) {
    client.res.write(`event: progress\ndata: ${data}\n\n`);
  }
}

/* ── Server-side generation progress callback ──────────── */
function wrapProgress(onProgress) {
  return (fraction, phaseName) => {
    broadcastProgress(fraction, phaseName);
    if (onProgress) onProgress(fraction, phaseName);
  };
}

/* ── Server ─────────────────────────────────────────────── */
function startServer(port) {
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    const method  = req.method;

    /* Health */
    if (urlPath === '/health') {
      return jsonResponse(res, {
        status: 'ok', version: '0.4.1',
        uptime: process.uptime(), node: process.versions.node,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        checkpoints: fs.readdirSync(CKPT_DIR).filter(f => f.endsWith('.json')).length,
      });
    }

    if (urlPath === '/api/version') {
      return jsonResponse(res, {
        version: '0.4.1', arch: 'client-server', checkpoints: true,
        serverGen: !!engineModule,
      });
    }

    /* SSE progress stream */
    if (urlPath === '/api/events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`event: connected\ndata: {}\n\n`);
      const client = { id: Date.now(), res };
      sseClients.push(client);
      req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== client.id);
      });
      return;
    }

    /* Generate (server-side) */
    if (urlPath === '/api/generate' && method === 'POST') {
      if (!engineModule) {
        return jsonResponse(res, { error: 'Server-side engine not loaded' }, 503);
      }
      try {
        const params = await parseBody(req);
        if (!params) return jsonResponse(res, { error: 'Invalid params' }, 400);

        const result = engineModule.generateMap(params, wrapProgress());
        broadcastProgress(1, 'complete');

        const mapData = result.mapData;
        const ckpts   = result.checkpoints;

        const response = {
          width: mapData.width,
          height: mapData.height,
          plateTex: Array.from(mapData.plateTex),
          elevTex: Array.from(mapData.elevTex),
          moistTex: Array.from(mapData.moistTex),
          riverTex: Array.from(mapData.riverTex),
          tempTex: Array.from(mapData.tempTex),
          plates: mapData.plates,
          regions: mapData.regions,
          rivers: mapData.rivers,
          seed: mapData.seed,
        };
        return jsonResponse(res, response);
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    /* Export PNG (server-side data URL) */
    if (urlPath === '/api/export' && method === 'POST') {
      if (!engineModule) {
        return jsonResponse(res, { error: 'Server-side engine not loaded' }, 503);
      }
      try {
        const body = await parseBody(req);
        if (!body || !body.mapData) return jsonResponse(res, { error: 'mapData required' }, 400);

        const w = body.mapData.width || 256;
        const h = body.mapData.height || 256;
        const elev = body.mapData.elevTex;

        const pixels = [];
        for (let i = 0; i < elev.length; i += 4) {
          const e = elev[i];
          const v = Math.max(0, Math.min(255, Math.round((e + 0.5) * 255)));
          pixels.push(v, v, v, 255);
        }

        const header = new Uint8Array([
          0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
          0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
          (w>>24)&0xFF,(w>>16)&0xFF,(w>>8)&0xFF,w&0xFF,
          (h>>24)&0xFF,(h>>16)&0xFF,(h>>8)&0xFF,h&0xFF,
          8,2,0,0,0, // 8-bit RGBA
        ]);

        const raw = Buffer.from(pixels);
        const deflated = zlib.deflateSync(raw);
        const dataUrl = 'data:image/png;base64,' +
          Buffer.concat([header, deflated]).toString('base64');

        return jsonResponse(res, { dataUrl, width: w, height: h });
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    /* Config */
    if (urlPath === '/api/config' && method === 'GET') {
      const safe = { ...config };
      return jsonResponse(res, safe);
    }

    if (urlPath === '/api/config' && method === 'PUT') {
      try {
        const body = await parseBody(req);
        if (!body) return jsonResponse(res, { error: 'Invalid config' }, 400);
        config = { ...config, ...body };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return jsonResponse(res, { ok: true, config });
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    /* Checkpoints */
    if (urlPath === '/api/checkpoints' && method === 'GET') {
      try {
        const files = fs.readdirSync(CKPT_DIR).filter(f => f.endsWith('.json'));
        const ckpts = files.map(f => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(CKPT_DIR, f), 'utf-8'));
            return {
              id: f.replace('.json', ''),
              name: data.name || f.replace('.json', ''),
              phase: data.phase || 'unknown',
              time: data.time || 0,
              seed: data.seed || 0,
              createdAt: data.createdAt || 0,
              mapWidth: data.mapWidth || 0,
              mapHeight: data.mapHeight || 0,
            };
          } catch { return null; }
        }).filter(Boolean);
        return jsonResponse(res, ckpts);
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    if (urlPath === '/api/checkpoints' && method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!body || !body.name) {
          return jsonResponse(res, { error: 'name required' }, 400);
        }
        const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
        const ckpt = {
          id, name: body.name, phase: body.phase || 'full',
          time: body.time || 0, seed: body.seed || 0,
          mapWidth: body.mapWidth || 0, mapHeight: body.mapHeight || 0,
          createdAt: Date.now(),
          data: body.data || null,
        };
        fs.writeFileSync(path.join(CKPT_DIR, id + '.json'), JSON.stringify(ckpt), 'utf-8');
        return jsonResponse(res, { id, name: ckpt.name, phase: ckpt.phase }, 201);
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    const ckptMatch = urlPath.match(/^\/api\/checkpoints\/([^.]+)(?:\.json)?$/);
    if (ckptMatch && method === 'GET') {
      try {
        const ckptPath = path.join(CKPT_DIR, ckptMatch[1] + '.json');
        if (!fs.existsSync(ckptPath)) {
          return jsonResponse(res, { error: 'not found' }, 404);
        }
        const data = fs.readFileSync(ckptPath, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    if (ckptMatch && method === 'DELETE') {
      try {
        const ckptPath = path.join(CKPT_DIR, ckptMatch[1] + '.json');
        if (!fs.existsSync(ckptPath)) {
          return jsonResponse(res, { error: 'not found' }, 404);
        }
        fs.unlinkSync(ckptPath);
        return jsonResponse(res, { ok: true });
      } catch (err) {
        return jsonResponse(res, { error: err.message }, 500);
      }
    }

    /* Static files */
    const safePath = urlPath.replace(/\.\./g, '');
    let file = readFile(safePath);

    if (!file) {
      file = readFile('/index.html');
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      return sendFile(res, req, '/index.html', file, 200);
    }

    sendFile(res, req, safePath, file);
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log('');
    console.log('  +---------------------------------------------+');
    console.log('  |  Material Map Generator  v0.4.1              |');
    console.log(`  |  C/S Architecture${engineModule ? ' (server-gen)' : ''}            |`);
    console.log('  |  Checkpoint System Active                    |');
    if (port !== config.port) {
      console.log(`  |  Port ${config.port} in use, using ${port} instead       |`);
    }
    console.log('  +---------------------------------------------+');
    console.log('');
    console.log(`  ${url}`);
    console.log('  Ctrl+C to stop');
    console.log('');
    const isTermux = process.env.TERMUX_VERSION !== undefined ||
                     os.platform() === 'android' ||
                     (process.env.PREFIX || '').includes('com.termux');
    if (config.openBrowser && !isTermux) {
      setTimeout(() => openBrowser(url), 500);
    }
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && config.autoPortFallback && port < port + 10) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} in use. Set MAPGEN_PORT env or edit mapgen.json`);
      process.exit(1);
    } else {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

  server.on('close', () => {
    sseClients = [];
  });

  process.on('SIGINT', () => {
    console.log('\nStopped.');
    sseClients.forEach(c => c.res.end());
    sseClients = [];
    server.close(() => process.exit(0));
  });
}

function openBrowser(url) {
  const p = os.platform();
  try {
    if (p === 'darwin') {
      execSync(`open '${url}'`, { timeout: 3000, stdio: 'ignore' });
    } else if (p === 'win32') {
      execSync(`start "" "${url}"`, { timeout: 3000, stdio: 'ignore', shell: true });
    } else {
      try {
        execSync('which termux-open', { stdio: 'pipe' });
        execSync(`termux-open '${url}'`, { timeout: 3000, stdio: 'ignore' });
        return;
      } catch {}
      try {
        execSync(`xdg-open '${url}'`, { timeout: 3000, stdio: 'ignore' });
      } catch {
        console.log('  Open manually: ' + url);
      }
    }
  } catch {
    console.log('  Open manually: ' + url);
  }
}

startServer(PORT);
