#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer } from './server/index.js';
import { HTTPServer } from './server/core/http-server.js';
import { Router } from './server/core/router.js';
import { Middleware } from './server/core/middleware.js';
import { Context } from './server/core/context.js';

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

/* ── Server ─────────────────────────────────────────────── */
function startServer(port, startingPort) {
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');
    
    if (method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // Health check
    if (urlPath === '/health') {
      return jsonResponse(res, {
        status: 'ok', version: '0.4.3',
        uptime: process.uptime(), node: process.versions.node,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        checkpoints: fs.readdirSync(CKPT_DIR).filter(f => f.endsWith('.json')).length,
      });
    }

    // Version check
    if (urlPath === '/api/version') {
      return jsonResponse(res, {
        version: '0.4.3', arch: 'client-server', checkpoints: true,
        serverGen: !!engineModule,
      });
    }

    // Static files
    const decoded = decodeURIComponent(urlPath);
    const safePathNorm = path.normalize(decoded).replace(/^(\.\.(\/)?)+/, '');
    const safePathAbs = path.join(PUBLIC, safePathNorm);
    if (!safePathAbs.startsWith(PUBLIC)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden');
    }
    
    let file = readFile(safePathNorm);
    if (!file) {
      file = readFile('/index.html');
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
      return sendFile(res, req, '/index.html', file, 200);
    }

    sendFile(res, req, safePathNorm, file);
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log('');
    console.log('  +---------------------------------------------+');
    console.log('  | Material Map Generator v0.4.3               |');
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

  process.on('SIGINT', () => {
    console.log('\nStopped.');
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

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendFile(res, req, pathname, file, status = 200) {
  const ext = path.extname(pathname).toLowerCase();
  const isCompressible = ['.css', '.js', '.mjs', '.vert', '.frag', '.glsl', '.json', '.svg'].includes(ext);
  const mime = mimeType(pathname);
  const etag = '"' + require('crypto').createHash('md5').update(file).digest('hex') + '"';

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

  headers['Content-Length'] = Buffer.byteLength(file);
  res.writeHead(status, headers);
  res.end(file);
}

import http from 'http';

startServer(PORT, PORT);
