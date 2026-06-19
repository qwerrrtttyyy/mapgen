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
  console.error('Server-side engine failed to load:', e.message);
  console.error('Server-side generation (/api/generate) will be unavailable.');
  console.error('Use client-side generation by unchecking "服务端生成" in the UI.');
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

/* ── Static asset ETag cache ─────────────────────────────── */
const _etagCache = new Map();
function computeEtag(buf) {
  return '"' + crypto.createHash('md5').update(buf).digest('hex') + '"';
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
  const ext = path.extname(pathname).toLowerCase();
  const isCompressible = ['.css', '.js', '.mjs', '.vert', '.frag', '.glsl', '.json', '.svg'].includes(ext);
  const mime = mimeType(pathname);
  const etag = computeEtag(file);

  const headers = {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
  };

  // ETag + Cache-Control for static assets
  if (req.method === 'GET') {
    headers['ETag'] = etag;
    if (isCompressible) {
      headers['Cache-Control'] = 'public, max-age=86400';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }
    const noneMatch = req.headers['if-none-match'];
    if (noneMatch && noneMatch.split(',').map(s => s.trim()).includes(etag)) {
      return res.writeHead(304, headers).end();
    }
  }

  // Content-encoding negotiation: prefer brotli, fallback gzip
  let body = file;
  const ae = (req.headers['accept-encoding'] || '').toLowerCase();
  if (isCompressible) {
    try {
      if (ae.includes('br')) {
        headers['Content-Encoding'] = 'br';
        body = zlib.brotliCompressSync(file);
      } else if (ae.includes('gzip')) {
        headers['Content-Encoding'] = 'gzip';
        body = zlib.gzipSync(file);
      }
    } catch {}
  }

  headers['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(status, headers);
  res.end(body);
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
function startServer(port, startingPort) {
  const REQUEST_TIMEOUT_MS = 30000;
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    const method = req.method;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.writeHead(408, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Request timeout' }));
      }
    }, REQUEST_TIMEOUT_MS);
    const clearTimer = () => clearTimeout(timer);
    res.on('finish', clearTimer);

/* Health */
  if (urlPath === '/health') {
    clearTimeout(timer);
    return jsonResponse(res, {
        status: 'ok', version: '0.4.3',
        uptime: process.uptime(), node: process.versions.node,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        checkpoints: fs.readdirSync(CKPT_DIR).filter(f => f.endsWith('.json')).length,
      });
    }

  if (urlPath === '/api/version') {
    clearTimeout(timer);
    return jsonResponse(res, {
      version: '0.4.3', arch: 'client-server', checkpoints: true,
      serverGen: !!engineModule,
    });
  }

/* SSE progress stream */
if (urlPath === '/api/events' && method === 'GET') {
  clearTimeout(timer);
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
    clearTimeout(timer);
    return jsonResponse(res, { error: 'Server-side engine not loaded' }, 503);
  }
  try {
    const params = await parseBody(req);
    if (!params) {
      clearTimeout(timer);
      return jsonResponse(res, { error: 'Invalid params' }, 400);
    }
    
    // Map API parameters to engine parameters
    const engineParams = {
      seedStr: String(params.seed || params.seedStr || Date.now()),
      mapSize: params.width || params.mapSize || 256,
      mapAspect: params.mapAspect || '1:1',
      plateCount: params.plateCount || 8,
      landmass: params.landmass || 0.4,
      noiseType: params.noiseType || 'perlin',
      fbmType: params.fbmType || 'standard',
      octaves: params.octaves || 5,
      lacunarity: params.lacunarity || 2.0,
      persistence: params.persistence || 0.5,
      seaLevel: params.seaLevel || 0.45,
      mountainFold: params.mountainFold || 0.3,
      coastDetail: params.coastDetail || 0.5,
      erosionIterations: params.erosionIterations || 50,
      erosionStrength: params.erosionStrength || 1.0,
      lakeDensity: params.lakeDensity || 0.02,
      tempOffset: params.tempOffset || 0,
      snowLine: params.snowLine || 0.5,
    };
    
    const result = engineModule.generateMap(engineParams, wrapProgress());
    broadcastProgress(1, 'complete');
    clearTimeout(timer);

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
    clearTimeout(timer);
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

/* Protocol switcher */
  if (urlPath === '/api/protocol' && method === 'POST') {
    clearTimeout(timer);
    try {
      const body = await parseBody(req);
      if (!body || !body.mode || !['server', 'client', 'hybrid'].includes(body.mode)) {
        return jsonResponse(res, { error: 'mode must be server|client|hybrid' }, 400);
      }
      config.preferredMode = body.mode;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      return jsonResponse(res, { ok: true, mode: config.preferredMode });
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
    const etag = '"' + crypto.createHash('sha1').update(data).digest('hex').slice(0, 16) + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304);
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'ETag': etag,
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

if (urlPath === '/api/sync' && method === 'PUT') {
  try {
    const body = await parseBody(req);
    if (!body || !body.seed) {
      return jsonResponse(res, { error: 'seed required in sync body' }, 400);
    }
    const ts = Date.now().toString(36);
    const rand = crypto.randomBytes(3).toString('hex');
    const id = `${ts}-${rand}`;
    const ckpt = {
      id,
      name: body.name || 'synced-' + id,
      phase: body.phase || 'full',
      time: body.time || 0,
      seed: body.seed,
      mapWidth: body.mapWidth || body.width || 0,
      mapHeight: body.mapHeight || body.height || 0,
      createdAt: Date.now(),
      data: body.data || null,
    };
    fs.writeFileSync(path.join(CKPT_DIR, id + '.json'), JSON.stringify(ckpt), 'utf-8');
    return jsonResponse(res, { id, name: ckpt.name, phase: ckpt.phase }, 201);
  } catch (err) {
    return jsonResponse(res, { error: err.message }, 500);
  }
}

/* Static files */
/* WebSocket fallback stub (future real-time bidirectional messaging)
 * Keep the `wss` module integratable without refactoring the dispatch loop.
 * Roadmap: replace SSE with a single ws.Server; broadcastProgress writes to both.
 * const { WebSocketServer } = await import('ws');
 * const wss = new WebSocketServer({ noServer: true });
 * server.on('upgrade', (req, socket, head) => {
 *   if (req.url === '/ws') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
 * });
 * wss.on('connection', ws => { ... });
 */
const decoded = decodeURIComponent(urlPath);
const safePathNorm = path.normalize(decoded).replace(/^(\.\.(\/)?)+/, '');
const safePathAbs = path.join(PUBLIC, safePathNorm);
if (!safePathAbs.startsWith(PUBLIC)) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('403 Forbidden');
  return;
}
let file = readFile(safePathNorm);

    if (!file) {
      // For API routes, return 404
      if (urlPath.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      // For other routes, serve index.html (SPA fallback)
      file = readFile('/index.html');
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      return sendFile(res, req, '/index.html', file, 200);
    }

    sendFile(res, req, safePathNorm, file);
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log('');
    console.log('  +---------------------------------------------+');
console.log(' | Material Map Generator v0.4.3 |');
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
const isHeadless = process.env.HEADLESS === 'true' || process.env.CI === 'true';
if (config.openBrowser && !isTermux && !isHeadless) {
      setTimeout(() => openBrowser(url), 500);
    }
  });

server.on('error', err => {
  if (err.code === 'EADDRINUSE' && config.autoPortFallback && (!startingPort || port < startingPort + 10)) {
    console.warn(`Port ${port} in use, trying ${port + 1}...`);
    startServer(port + 1, startingPort || port);
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

startServer(PORT, PORT);
