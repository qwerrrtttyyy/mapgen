#!/usr/bin/env node
// HEADLESS=true node bin/headless-debug.js [url] [screenshot.png]
// Starts the mapgen server, screenshots the page via Puppeteer (headless),
// collects browser console logs, then shuts down.
// Usage:
//   node bin/headless-debug.js                        # defaults: http://127.0.0.1:8765, headless-debug.png
//   node bin/headless-debug.js http://0.0.0.0:3000 out.png
//   MAPGEN_PORT=9000 node bin/headless-debug.js

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const url = process.argv[2] ||
  `http://${process.env.MAPGEN_HOST || '127.0.0.1'}:${process.env.MAPGEN_PORT || 8765}`;
const screenshot = process.argv[3] || join(process.cwd(), 'headless-debug.png');
const timeoutMs = 15_000;

function spawnServer() {
  const args = [];
  const nodeVer = process.version;
  const major = parseInt(nodeVer.split('.')[0].slice(1), 10);
  if (major >= 18) args.push('--watch');
  const child = spawn(process.execPath, [...args, 'server.js'], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HEADLESS: 'true' },
  });
  return child;
}

async function waitForServer(url) {
  const mod = await import('node:http');
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = mod.get(url + '/health', res => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        req.destroy();
        setTimeout(tryConnect, 300);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });
}

async function run() {
  let server = null;
  const startedHere = process.argv.includes('--spawn-server');
  if (startedHere) {
    server = spawnServer();
    let serverOut = '';
    server.stdout.on('data', d => { serverOut += d.toString(); });
    server.stderr.on('data', d => { serverOut += d.toString(); });
    try { await waitForServer(url); } catch { throw new Error('Server failed to start\n' + serverOut); }
  }

  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('[headless-debug] Puppeteer not installed; skipping screenshot.');
    console.log('[headless-debug] Install with: npm install puppeteer --no-save');
    if (startedHere && server) server.kill('SIGTERM');
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => logs.push(`[browser ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
  } catch (err) {
    logs.push(`[navigate] ${err.message}`);
  }

  await delay(1000);
  await page.screenshot({ path: screenshot, fullPage: true });

  console.log(`[headless-debug] Screenshot saved: ${screenshot}`);
  if (logs.length) {
    console.log('[headless-debug] Browser logs:');
    for (const l of logs) console.log('  ' + l);
  } else {
    console.log('[headless-debug] No browser console logs.');
  }

  await browser.close();
  if (startedHere && server) server.kill('SIGTERM');
}

await run().catch(err => {
  console.error('[headless-debug] FAILED:', err.message);
  process.exit(1);
});
