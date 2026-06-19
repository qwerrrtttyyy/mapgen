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

const PORT   = parseInt(process.env.MAPGEN_PORT, 10) || 8765;
const HOST   = process.env.MAPGEN_HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const CKPT_DIR = path.join(__dirname, '.checkpoints');

if (!fs.existsSync(CKPT_DIR)) fs.mkdirSync(CKPT_DIR, { recursive: true });

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

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  const method = req.method;

  if (urlPath === '/health') {
    return jsonResponse(res, { status: 'ok', version: '0.4.1' });
  }

  if (urlPath === '/api/version') {
    return jsonResponse(res, { version: '0.4.1', arch: 'multi-file', checkpoints: true });
  }

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
        id,
        name: body.name,
        phase: body.phase || 'full',
        time: body.time || 0,
        seed: body.seed || 0,
        mapWidth: body.mapWidth || 0,
        mapHeight: body.mapHeight || 0,
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

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  +---------------------------------------------+');
  console.log('  |  Material Map Generator  v0.4.1              |');
  console.log('  |  Checkpoint System Active                    |');
  console.log('  +---------------------------------------------+');
  console.log('');
  console.log(`  ${url}`);
  console.log('  Ctrl+C to stop');
  console.log('');
  const isTermux = process.env.TERMUX_VERSION !== undefined ||
                   os.platform() === 'android' ||
                   (process.env.PREFIX || '').includes('com.termux');
  if (!isTermux) {
    setTimeout(() => openBrowser(url), 500);
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} in use. Try: MAPGEN_PORT=8766 node server.js`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nStopped.');
  server.close(() => process.exit(0));
});
