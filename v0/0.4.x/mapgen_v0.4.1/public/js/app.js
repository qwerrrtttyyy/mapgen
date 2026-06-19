import { generateMap as clientGenerate, restoreFromCheckpoint } from './engine/index.js';
import { createNoise, hashSeed } from './engine/noise.js';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import { CheckpointManager, getCheckpointPhases } from './checkpoint.js';

/* ── Config ── */
const SERVER_GEN = window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost'
  ? false
  : true;
const API_BASE = '';

const defaultParams = {
  seedStr: String(Math.floor(Math.random() * 99999)),
  mapSize: 256, mapAspect: '1:1', plateCount: 8, landmass: 0.4,
  noiseType: 'perlin', fbmType: 'standard', octaves: 5, lacunarity: 2.0,
  persistence: 0.5, seaLevel: 0.45, erosionStrength: 1.0, erosionIterations: 50,
  mountainFold: 0.3, tempOffset: 0, snowLine: 0.5, coastDetail: 0.5, lakeDensity: 0.02,
  style: 0, showBoundaries: true, boundaryWidth: 0.8, boundaryColor: [1, 0.3, 0.2],
  showRivers: true, showContours: false, contourInterval: 0.05, showTerrain: true,
  showSelection: true, showClimate: false, showGrid: false, showElevScale: false,
  lightAngle: 0.8, pointLightEnabled: false, pointLightPos: [0.5, 0.5],
  pointLightIntensity: 0.5, pointLightColor: [1.0, 0.8, 0.6],
  glowEnabled: false, laserActive: false, trailEnabled: false, cursorActive: false,
  useServerGen: SERVER_GEN,
};

const RENDER_PARAM_MAP = {
  style:'u_style', seaLevel:'u_seaLevel', lightAngle:'u_lightAngle',
  showBoundaries:'u_showBoundaries', boundaryWidth:'u_boundaryWidth',
  boundaryColor:'u_boundaryColor', showRivers:'u_showRivers',
  showContours:'u_showContours', contourInterval:'u_contourInterval',
  showTerrain:'u_showTerrain', showSelection:'u_showSelection',
  showClimate:'u_showClimate', pointLightEnabled:'u_pointLightEnabled',
  pointLightPos:'u_pointLightPos', pointLightIntensity:'u_pointLightIntensity',
  pointLightColor:'u_pointLightColor', glowEnabled:'u_glowEnabled',
  laserActive:'u_laserActive', trailEnabled:'u_hasTrail',
  cursorActive:'u_cursorActive', snowLine:'u_snowLine',
  erosionStrength:'u_erosionStrength', octaves:'u_fbmOctaves',
  lacunarity:'u_fbmLacunarity', persistence:'u_fbmPersistence',
};

let renderer = null, checkpointMgr = null, latestMapData = null;
let isGenerating = false, renderTimeout = null, eventSource = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function hexToRgb(hex) {
  return [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16) / 255);
}

function rgbToHex(r, g, b) {
  const h = v => Math.round(v*255).toString(16).padStart(2,'0');
  return '#' + h(r) + h(g) + h(b);
}

function readParams() {
  const p = {};
  for (const key of Object.keys(defaultParams)) {
    const el = document.getElementById(key);
    if (!el) { p[key] = defaultParams[key]; continue; }
    if (el.type === 'range' || el.type === 'number') p[key] = parseFloat(el.value);
    else if (el.type === 'checkbox') p[key] = el.checked;
    else if (el.type === 'color') p[key] = hexToRgb(el.value);
    else if (el.tagName === 'SELECT') p[key] = el.value;
    else p[key] = el.value;
  }
  const sx = document.getElementById('pointLightPosX');
  const sy = document.getElementById('pointLightPosY');
  p.pointLightPos = [parseFloat(sx?.value ?? 0.5), parseFloat(sy?.value ?? 0.5)];
  p.useServerGen = document.getElementById('useServerGen')?.checked ?? SERVER_GEN;
  return p;
}

function readRenderParams() {
  const all = readParams(), rp = {};
  for (const [jsKey, uname] of Object.entries(RENDER_PARAM_MAP)) rp[uname] = all[jsKey];
  return rp;
}

const phaseLabels = {
  tectonic:'板块构造', elevation:'高程生成', erosion:'侵蚀模拟',
  climate:'气候计算', lakes:'湖泊生成', rivers:'河流生成',
  regions:'区域分析', packing:'纹理打包',
};

function onProgress(fraction, phaseName) {
  const bar = $('#progress-bar');
  if (bar) bar.style.width = (fraction * 100) + '%';
  const txt = $('#progress-text');
  if (txt) txt.textContent = phaseLabels[phaseName] || phaseName;
}

/* ── SSE progress ── */
function connectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  try {
    eventSource = new EventSource(API_BASE + '/api/events');
    eventSource.addEventListener('progress', e => {
      try {
        const data = JSON.parse(e.data);
        onProgress(data.fraction, data.phase);
      } catch {}
    });
    eventSource.addEventListener('connected', () => {});
    eventSource.onerror = () => {};
  } catch {}
}

/* ── Server-side generate ── */
async function serverGenerate(params) {
  connectSSE();
  const res = await fetch(API_BASE + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Server generation failed');
  }
  const data = await res.json();

  function toFloat32(arr) {
    if (!arr || !arr.length) return new Float32Array();
    return new Float32Array(arr);
  }

  return {
    mapData: {
      width: data.width,
      height: data.height,
      plateTex: toFloat32(data.plateTex),
      elevTex: toFloat32(data.elevTex),
      moistTex: toFloat32(data.moistTex),
      riverTex: toFloat32(data.riverTex),
      tempTex: toFloat32(data.tempTex),
      plates: data.plates || [],
      regions: data.regions || [],
      rivers: data.rivers || [],
      seed: data.seed || 0,
    },
  };
}

/* ── Generate ── */
async function generate() {
  if (isGenerating) return;
  isGenerating = true;
  const btn = $('#btn-generate');
  if (btn) btn.disabled = true;
  const pc = $('#progress-container');
  const bar = $('#progress-bar');
  const txt = $('#progress-text');
  if (pc) pc.style.display = 'block';
  if (bar) bar.style.width = '0%';
  if (txt) txt.textContent = '初始化...';
  await new Promise(r => setTimeout(r, 16));
  try {
    const params = readParams();
    let result;

    if (params.useServerGen) {
      result = await serverGenerate(params);
    } else {
      result = clientGenerate(params, onProgress);
    }

    latestMapData = result.mapData;
    renderer.uploadMapData(result.mapData);
    render();
    await updateCheckpointList();
  } catch (err) {
    console.error('Generation failed:', err);
    if (txt) txt.textContent = '生成失败: ' + err.message;
  }
  if (pc) pc.style.display = 'none';
  if (btn) btn.disabled = false;
  isGenerating = false;
}

function render() {
  if (!renderer) return;
  if (renderer instanceof WebGLRenderer) renderer.render(readRenderParams());
  else renderer.render();
}

function scheduleRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(render, 50);
}

function updateDisplay(el) {
  const d = el.parentElement?.querySelector('.value, span:not(.label)') || el.nextElementSibling;
  if (d) d.textContent = el.value;
  if (el.id === 'pointLightPosX' || el.id === 'pointLightPosY') {
    const x = document.getElementById('pointLightPosX');
    const y = document.getElementById('pointLightPosY');
    const disp = document.getElementById('pointLightPosDisplay');
    if (disp && x && y) disp.textContent = `(${+x.value}, ${+y.value})`;
  }
}

function randomSeed() {
  const el = document.getElementById('seedStr');
  if (el) { el.value = String(Math.floor(Math.random() * 99999)); generate(); }
}

function exportPNG() {
  const c = document.getElementById('glCanvas');
  if (!c) return;
  const a = document.createElement('a');
  a.download = 'mapgen-' + Date.now() + '.png';
  a.href = c.toDataURL('image/png');
  a.click();
}

/* ── Checkpoints ── */
async function updateCheckpointList() {
  if (!checkpointMgr) return;
  await checkpointMgr.load();
  const list = document.getElementById('checkpoint-list');
  if (!list) return;
  const sb = document.getElementById('btn-save-checkpoint');
  if (sb) sb.style.display = latestMapData ? 'inline-block' : 'none';
  list.innerHTML = '';
  for (const c of (checkpointMgr.checkpoints || [])) {
    const item = document.createElement('div');
    item.className = 'checkpoint-item';
    const info = document.createElement('span');
    info.className = 'checkpoint-info';
    info.textContent = `${c.name} (${c.phase}) - ${new Date(c.time).toLocaleString('zh-CN')}`;
    const rb = document.createElement('button');
    rb.textContent = '恢复'; rb.className = 'ck-btn-restore';
    rb.addEventListener('click', () => restoreCheckpoint(c.id));
    const db = document.createElement('button');
    db.textContent = '删除'; db.className = 'ck-btn-delete';
    db.addEventListener('click', () => deleteCheckpoint(c.id));
    item.append(info, rb, db);
    list.appendChild(item);
  }
}

async function saveCheckpoint() {
  if (!checkpointMgr || !latestMapData) return;
  const name = prompt('输入检查点名称:', '检查点 ' + new Date().toLocaleTimeString('zh-CN'));
  if (!name) return;
  await checkpointMgr.save(name, 'full', latestMapData, readParams());
  await updateCheckpointList();
}

async function restoreCheckpoint(id) {
  if (!checkpointMgr || isGenerating) return;
  isGenerating = true;
  const pc = $('#progress-container');
  const txt = $('#progress-text');
  if (pc) pc.style.display = 'block';
  if (txt) txt.textContent = '恢复检查点...';
  try {
    const ckpt = await checkpointMgr.restore(id);
    if (!ckpt || !ckpt.data) throw new Error('检查点数据无效');
    latestMapData = restoreFromCheckpoint(ckpt.data, readParams());
    renderer.uploadMapData(latestMapData);
    render();
  } catch (err) {
    console.error('Restore failed:', err);
    if (txt) txt.textContent = '恢复失败';
  }
  if (pc) pc.style.display = 'none';
  isGenerating = false;
}

async function deleteCheckpoint(id) {
  if (!checkpointMgr) return;
  await checkpointMgr.delete(id);
  await updateCheckpointList();
}

function handleResize() {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('glCanvas');
  if (!container || !canvas || !renderer) return;
  const rect = container.getBoundingClientRect();
  renderer.resize(Math.floor(rect.width), Math.floor(rect.height));
  render();
}

function applyDefaultParams() {
  for (const [key, val] of Object.entries(defaultParams)) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === 'range') { el.value = val; updateDisplay(el); }
    else if (el.type === 'number') el.value = val;
    else if (el.type === 'checkbox') el.checked = !!val;
    else if (el.type === 'color' && Array.isArray(val)) el.value = rgbToHex(val[0], val[1], val[2]);
    else if (el.tagName === 'SELECT') el.value = val;
    else if (el.type === 'text') el.value = val;
  }
  const seedEl = document.getElementById('seedStr');
  if (seedEl) seedEl.value = defaultParams.seedStr;
  const xEl = document.getElementById('pointLightPosX');
  const yEl = document.getElementById('pointLightPosY');
  if (xEl) xEl.value = defaultParams.pointLightPos[0];
  if (yEl) yEl.value = defaultParams.pointLightPos[1];
  const pd = document.getElementById('pointLightPosDisplay');
  if (pd) pd.textContent = `(${defaultParams.pointLightPos[0]}, ${defaultParams.pointLightPos[1]})`;
  const sg = document.getElementById('useServerGen');
  if (sg) sg.checked = SERVER_GEN;
}

function bindUI() {
  $$('input[type="range"]').forEach(el => {
    el.addEventListener('input', () => { updateDisplay(el); scheduleRender(); });
  });
  $$('input[type="number"]').forEach(el => {
    el.addEventListener('input', scheduleRender);
  });
  $$('select').forEach(el => {
    el.addEventListener('change', generate);
  });
  $$('input[type="checkbox"]:not(#useServerGen)').forEach(el => {
    el.addEventListener('change', scheduleRender);
  });
  $$('input[type="color"]').forEach(el => {
    el.addEventListener('input', scheduleRender);
  });
  const seedEl = document.getElementById('seedStr');
  if (seedEl) seedEl.addEventListener('input', () => { defaultParams.seedStr = seedEl.value; });
  const byId = id => document.getElementById(id);
  byId('btn-random-seed')?.addEventListener('click', randomSeed);
  byId('btn-generate')?.addEventListener('click', generate);
  byId('btn-export')?.addEventListener('click', exportPNG);
  byId('btn-save-checkpoint')?.addEventListener('click', saveCheckpoint);
  byId('useServerGen')?.addEventListener('change', generate);
}

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('glCanvas');
  if (!canvas) { console.error('#glCanvas not found'); return; }
  try {
    renderer = new WebGLRenderer(canvas);
    const res = await fetch('shaders/fs-map.frag');
    if (!res.ok) throw new Error('Shader fetch failed');
    await renderer.initShaders(await res.text());
  } catch (e) {
    console.warn('WebGL2 unavailable, using Canvas2D:', e.message);
    renderer = new Canvas2DRenderer(canvas);
  }
  if (SERVER_GEN) connectSSE();
  checkpointMgr = new CheckpointManager();
  await checkpointMgr.load();
  applyDefaultParams();
  bindUI();
  handleResize();
  window.addEventListener('resize', handleResize);
  generate();
});
