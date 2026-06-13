#!/usr/bin/env node
/**
 * Material Map Generator v0.3.12-preview -- Local Server
 * Run: node server.js
 * Platform: Windows / macOS / Linux / Android (Termux)
 *
 * Multi-file architecture (v0.3.12+):
 *   server.js        — HTTP server (this file)
 *   public/          — Static files (index.html, style.css, shaders/)
 *   src/             — JavaScript modules (main.js, config.js)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT   = parseInt(process.env.MAPGEN_PORT, 10) || 8765;
const HOST   = process.env.MAPGEN_HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');

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
    '.ico':  'image/x-icon',
};

/* ── helpers ── */
function mime(file) {
    return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function readFile(file) {
    try { return fs.readFileSync(path.join(PUBLIC, file)); } catch { return null; }
}

/* ── HTTP server ── */
const server = http.createServer(function(req, res) {
    const urlPath = req.url.split('?')[0];

    /* /health — health check */
    if (urlPath === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '0.3.12-preview' }));
        return;
    }

    /* /api/version — version info */
    if (urlPath === '/api/version') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ version: '0.3.12-preview', arch: 'multi-file' }));
        return;
    }

    /* static files */
    const safePath = urlPath.replace(/\.\./g, '');
    let file = readFile(safePath);

    if (!file) {
        /* fallback to index.html for SPA routing */
        file = readFile('/index.html');
        if (!file) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
        };
        const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
        if (acceptGzip) {
            zlib.gzip(file, function(err, buf) {
                if (!err) {
                    headers['Content-Encoding'] = 'gzip';
                    res.writeHead(200, headers);
                    res.end(buf);
                } else {
                    res.writeHead(200, headers);
                    res.end(file);
                }
            });
        } else {
            res.writeHead(200, headers);
            res.end(file);
        }
        return;
    }

    const headers = {
        'Content-Type': mime(safePath),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(200, headers);
    res.end(file);
});

/* ── open browser ── */
function openBrowser(url) {
    const p = os.platform();
    try {
        if (p === 'darwin') {
            execSync(`open '${url}'`, { timeout: 3000, stdio: 'ignore' });
        } else if (p === 'win32') {
            execSync(`start "" "${url}"`, { timeout: 3000, stdio: 'ignore', shell: true });
        } else {
            // Termux detection - check for termux-open command
            try {
                execSync('which termux-open', { stdio: 'pipe' });
                execSync(`termux-open '${url}'`, { timeout: 3000, stdio: 'ignore' });
                console.log('  Opened in Termux browser');
                return;
            } catch(e) {
                // Not Termux or termux-open not available
            }
            // Try common Linux openers
            try {
                execSync(`xdg-open '${url}'`, { timeout: 3000, stdio: 'ignore' });
            } catch(e) {
                console.log('  Open manually: ' + url);
                return;
            }
        }
        console.log('  Browser opened');
    } catch(e) {
        console.log('  Open manually: ' + url);
    }
}

/* ── start ── */
server.listen(PORT, HOST, function() {
    const url = `http://${HOST}:${PORT}`;
    console.log('');
    console.log('  +---------------------------------------------+');
    console.log('  |  Material Map Generator  v0.3.12-preview     |');
    console.log('  +---------------------------------------------+');
    console.log('');
    console.log('  Multi-file architecture (v0.3.12+)');
    console.log(`  ${url}`);
    console.log('  Ctrl+C to stop');
    console.log('');
    
    // Auto-open browser unless in Termux (user should manually open)
    const isTermux = process.env.TERMUX_VERSION !== undefined || 
                     os.platform() === 'android' ||
                     process.env.PREFIX?.includes('com.termux');
    
    if (!isTermux) {
        setTimeout(() => openBrowser(url), 500);
    } else {
        console.log('  Termux detected - open browser manually at the URL above');
    }
});

server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} in use. Try: MAPGEN_PORT=8766 node server.js`);
    } else {
        console.error(`Error: ${err.message}`);
    }
    process.exit(1);
});

process.on('SIGINT', function() {
    console.log('\nStopped.');
    server.close(function() { process.exit(0); });
});
