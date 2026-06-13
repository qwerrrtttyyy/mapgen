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

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const PORT   = parseInt(process.env.MAPGEN_PORT, 10) || 8765;
const HOST   = process.env.MAPGEN_HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
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
    var urlPath = req.url.split('?')[0];

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
    var safePath = urlPath.replace(/\.\./g, '');
    var file = readFile(safePath);

    if (!file) {
        /* fallback to index.html for SPA routing */
        file = readFile('/index.html');
        if (!file) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        var headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
        };
        var acceptGzip = (req.headers['accept-encoding'] || '').indexOf('gzip') >= 0;
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

    var headers = {
        'Content-Type': mime(safePath),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(200, headers);
    res.end(file);
});

/* ── open browser ── */
function openBrowser(url) {
    var p = os.platform();
    try {
        if (p === 'darwin') {
            execSync("open '" + url + "'", { timeout: 3000, stdio: 'ignore' });
        } else if (p === 'win32') {
            execSync('start "" "' + url + '"', { timeout: 3000, stdio: 'ignore', shell: true });
        } else {
            try {
                execSync('which termux-open', { stdio: 'pipe' });
                execSync("termux-open '" + url + "'", { timeout: 3000, stdio: 'ignore' });
            } catch(e) {
                execSync("xdg-open '" + url + "'", { timeout: 3000, stdio: 'ignore' });
            }
        }
        console.log('  Browser opened');
    } catch(e) {
        console.log('  Open manually: ' + url);
    }
}

const { execSync } = require('child_process');

/* ── start ── */
server.listen(PORT, HOST, function() {
    var url = 'http://' + HOST + ':' + PORT;
    console.log('');
    console.log('  +---------------------------------------------+');
    console.log('  |  Material Map Generator  v0.3.12-preview     |');
    console.log('  +---------------------------------------------+');
    console.log('');
    console.log('  Multi-file architecture (v0.3.12+)');
    console.log('  ' + url);
    console.log('  Ctrl+C to stop');
    console.log('');
    setTimeout(function() { openBrowser(url); }, 500);
});

server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Try: MAPGEN_PORT=8766 node server.js');
    } else {
        console.error('Error: ' + err.message);
    }
    process.exit(1);
});

process.on('SIGINT', function() {
    console.log('\nStopped.');
    server.close(function() { process.exit(0); });
});
