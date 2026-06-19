#!/usr/bin/env node
import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(label, status, detail) {
  const icon = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : status === 'fail' ? '✗' : '?';
  const color = status === 'ok' ? GREEN : status === 'warn' ? YELLOW : status === 'fail' ? RED : CYAN;
  console.log(`  ${color}${icon}${RESET} ${BOLD}${label}${RESET}${detail ? ` ${DIM}(${detail})${RESET}` : ''}`);
}

function checkNodeVersion() {
  const ver = process.version;
  const major = parseInt(ver.slice(1).split('.')[0], 10);
  const ok = major >= 18;
  log('Node.js version', ok ? 'ok' : 'fail', `${ver} (need >= 18.0.0)`);
  return ok;
}

async function checkPortAvailability(host = '127.0.0.1', port = 8765) {
  return new Promise(resolve => {
    const srv = require('net').createServer();
    srv.listen(port, host, () => {
      srv.close();
      resolve(true);
    });
    srv.on('error', () => resolve(false));
    setTimeout(() => { srv.close(); resolve(null); }, 1500);
  });
}

function checkEngineLoads() {
  try {
    const idxPath = path.join(PROJECT_ROOT, 'public/js/engine/index.js');
    const noisePath = path.join(PROJECT_ROOT, 'public/js/engine/noise.js');
    const tectonicPath = path.join(PROJECT_ROOT, 'public/js/engine/tectonic.js');
    const erosionPath = path.join(PROJECT_ROOT, 'public/js/engine/erosion.js');
    for (const f of [noisePath, tectonicPath, erosionPath, idxPath]) {
      if (!fs.existsSync(f)) {
        log(`Engine file exists: ${path.basename(f)}`, 'fail', 'missing');
        return false;
      }
    }
    const engineStats = fs.statSync(idxPath);
    log('Engine module loads', 'ok', `index.js (${engineStats.size} bytes)`);
    return true;
  } catch (e) {
    log('Engine module check', 'fail', e.message);
    return false;
  }
}

function checkFilePermissions() {
  const scripts = ['server.js', 'bin/run.sh', 'bin/setup.sh', 'bin/start.sh', 'bin/debug.js'];
  let allOk = true;
  for (const s of scripts) {
    const full = path.join(PROJECT_ROOT, s);
    const exists = fs.existsSync(full);
    if (!exists) {
      log(`File exists: ${s}`, 'fail', 'missing');
      allOk = false;
      continue;
    }
    const isExec = fs.accessSync(full, fs.constants.X_OK).then ? true : false;
    try { fs.accessSync(full, fs.constants.X_OK); }
    catch { /* not executable but exists */ }
    log(`File: ${s}`, 'ok', exists ? 'present' : 'missing');
  }
  const dirs = ['.checkpoints'];
  for (const d of dirs) {
    const full = path.join(PROJECT_ROOT, d);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      log(`Dir: ${d}`, 'ok');
    } else {
      log(`Dir: ${d}`, 'warn', 'missing or not a directory (will be auto-created)');
    }
  }
  return allOk;
}

function checkHeadlessCI() {
  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  const isHeadless = process.env.HEADLESS === 'true';
  const noDisplay = !process.env.DISPLAY && process.platform === 'linux';
  const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER === 'true';
  const isGitHub = process.env.GITHUB_ACTIONS === 'true';

  if (isCI || isHeadless || noDisplay || isDocker || isGitHub) {
    log('Headless/CI detected', 'warn',
      [isCI && 'CI=true', isHeadless && 'HEADLESS=true', noDisplay && 'no DISPLAY',
       isDocker && 'Docker', isGitHub && 'GitHub Actions'].filter(Boolean).join(', '));
    return true;
  }
  log('Display environment', 'ok', process.platform === 'linux' ? 'DISPLAY set' : 'non-Linux');
  return false;
}

function checkPackageJSON() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    log('package.json readable', 'ok', `v${pkg.version}`);
    if (typeof pkg.engines?.node === 'string') {
      log('engines.node', 'ok', pkg.engines.node);
    }
    return true;
  } catch (e) {
    log('package.json', 'fail', e.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log('');
  console.log(` ${BOLD}Material Map Generator – Debug Diagnostic${RESET}`);
  console.log(` ${DIM}${PROJECT_ROOT}${RESET}`);
  console.log('');

  const results = {
    node: checkNodeVersion(),
    engine: checkEngineLoads(),
    perms: checkFilePermissions(),
    pkg: checkPackageJSON(),
  };

  const portOk = await checkPortAvailability('127.0.0.1', 8765);
  log('Port 8765 available', portOk ? 'ok' : 'warn', portOk ? 'free' : 'in use (auto-fallback)');
  results.port = portOk;

  const headless = checkHeadlessCI();
  results.headless = headless;

  console.log('');
  const allPassed = results.node && results.engine;
  console.log(` ${allPassed ? GREEN + '✓ Diagnostic complete' : RED + '✗ Issues found'}${RESET}`);
  console.log(`   ${DIM}Run 'node --test' to verify suite${RESET}`);
  console.log('');

  return results;
}

runDiagnostics().catch(e => {
  console.error(`${RED}Diagnostic failed:${RESET}`, e.message);
  process.exit(1);
});
