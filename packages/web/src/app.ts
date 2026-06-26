import { generateMap as clientGenerate } from '@mapgen/core';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import { CheckpointManager } from './checkpoint.js';

/* ── Config ── */
const defaultParams = {
  seedStr: String(Math.floor(Math.random() * 99999)),
  mapSize: 256,
  mapAspect: '1:1',
  plateCount: 8,
  landmass: 0.4,
  noiseType: 'perlin' as const,
  fbmType: 'standard' as const,
  octaves: 5,
  lacunarity: 2.0,
  persistence: 0.5,
  seaLevel: 0.45,
  erosionStrength: 1.0,
  erosionIterations: 50,
  mountainFold: 0.3,
  tempOffset: 0,
  snowLine: 0.5,
  coastDetail: 0.5,
  lakeDensity: 0.02,
  style: 0,
  showBoundaries: true,
  boundaryWidth: 0.8,
  boundaryColor: [1, 0.3, 0.2],
  showRivers: true,
  showContours: false,
  contourInterval: 0.05,
  showTerrain: true,
  showSelection: true,
  showClimate: false,
  showGrid: false,
  showElevScale: false,
  lightAngle: 0.8,
  pointLightEnabled: false,
  pointLightPos: [0.5, 0.5],
  pointLightIntensity: 0.5,
  pointLightColor: [1.0, 0.8, 0.6],
  glowEnabled: false,
  laserActive: false,
  trailEnabled: false,
  cursorActive: false,
};

const RENDER_PARAM_MAP: Record<string, string> = {
  style: 'u_style',
  seaLevel: 'u_seaLevel',
  lightAngle: 'u_lightAngle',
  showBoundaries: 'u_showBoundaries',
  boundaryWidth: 'u_boundaryWidth',
  boundaryColor: 'u_boundaryColor',
  showRivers: 'u_showRivers',
  showContours: 'u_showContours',
  contourInterval: 'u_contourInterval',
  showTerrain: 'u_showTerrain',
  showSelection: 'u_showSelection',
  showClimate: 'u_showClimate',
  pointLightEnabled: 'u_pointLightEnabled',
  pointLightPos: 'u_pointLightPos',
  pointLightIntensity: 'u_pointLightIntensity',
  pointLightColor: 'u_pointLightColor',
  glowEnabled: 'u_glowEnabled',
  laserActive: 'u_laserActive',
  trailEnabled: 'u_hasTrail',
  cursorActive: 'u_cursorActive',
  snowLine: 'u_snowLine',
  erosionStrength: 'u_erosionStrength',
  octaves: 'u_fbmOctaves',
  lacunarity: 'u_fbmLacunarity',
  persistence: 'u_fbmPersistence',
};

let renderer: WebGLRenderer | Canvas2DRenderer | null = null;
let checkpointMgr: CheckpointManager | null = null;
let latestMapData: any = null;
let isGenerating = false;
let renderTimeout: number | null = null;

const $ = (s: string) => document.querySelector(s);
const $$ = (s: string) => document.querySelectorAll(s);

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function readParams(): Record<string, any> {
  const p: Record<string, any> = {};
  for (const key of Object.keys(defaultParams)) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) {
      p[key] = (defaultParams as any)[key];
      continue;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'range' || el.type === 'number') p[key] = parseFloat(el.value);
      else if (el.type === 'checkbox') p[key] = el.checked;
      else if (el.type === 'color') p[key] = hexToRgb(el.value);
      else if (el.type === 'text') p[key] = el.value;
    } else if (el instanceof HTMLSelectElement) {
      p[key] = el.value;
    }
  }
  const sx = document.getElementById('pointLightPosX') as HTMLInputElement | null;
  const sy = document.getElementById('pointLightPosY') as HTMLInputElement | null;
  p.pointLightPos = [parseFloat(sx?.value ?? '0.5'), parseFloat(sy?.value ?? '0.5')];
  return p;
}

function readRenderParams(): Record<string, any> {
  const all = readParams();
  const rp: Record<string, any> = {};
  for (const [jsKey, uname] of Object.entries(RENDER_PARAM_MAP)) {
    rp[uname] = all[jsKey];
  }
  return rp;
}

const phaseLabels: Record<string, string> = {
  tectonic: '板块构造',
  elevation: '高程生成',
  erosion: '侵蚀模拟',
  climate: '气候计算',
  lakes: '湖泊生成',
  rivers: '河流生成',
  regions: '区域分析',
  packing: '纹理打包',
};

function onProgress(fraction: number, phaseName: string): void {
  const bar = $('#progress-bar') as HTMLElement | null;
  if (bar) bar.style.width = (fraction * 100) + '%';
  const txt = $('#progress-text');
  if (txt) txt.textContent = phaseLabels[phaseName] || phaseName;
}

/* ── Generate ── */
async function generate(): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;
  
  const generateBtn = $('#btn-generate') as HTMLButtonElement | null;
  if (generateBtn) generateBtn.disabled = true;
  
  const progressContainer = $('#progress-container') as HTMLElement | null;
  const progressBar = $('#progress-bar') as HTMLElement | null;
  const progressText = $('#progress-text');
  
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = '初始化...';
  
  await new Promise(r => setTimeout(r, 16));
  
  try {
    const params = readParams() as any;
    const result = clientGenerate(params, onProgress);

    latestMapData = result.mapData;
    if (renderer) {
      renderer.uploadMapData(result.mapData);
      render();
    }
    await updateCheckpointList();
  } catch (err) {
    console.error('Generation failed:', err);
    const errorText = $('#progress-text');
    if (errorText) errorText.textContent = '生成失败: ' + (err as Error).message;
  }
  
  if (progressContainer) progressContainer.style.display = 'none';
  if (generateBtn) generateBtn.disabled = false;
  
  isGenerating = false;
}

function render(): void {
  if (!renderer) return;
  if (renderer instanceof WebGLRenderer) {
    renderer.render(readRenderParams());
  } else {
    renderer.render();
  }
}

function scheduleRender(): void {
  if (renderTimeout !== null) clearTimeout(renderTimeout);
  renderTimeout = window.setTimeout(render, 50);
}

function updateDisplay(el: HTMLInputElement): void {
  const d = el.parentElement?.querySelector('.value, span:not(.label)') || el.nextElementSibling;
  if (d) d.textContent = el.value;
  
  if (el.id === 'pointLightPosX' || el.id === 'pointLightPosY') {
    const x = document.getElementById('pointLightPosX') as HTMLInputElement | null;
    const y = document.getElementById('pointLightPosY') as HTMLInputElement | null;
    const disp = document.getElementById('pointLightPosDisplay');
    if (disp && x && y) disp.textContent = `(${+x.value}, ${+y.value})`;
  }
}

function randomSeed(): void {
  const el = document.getElementById('seedStr') as HTMLInputElement | null;
  if (el) {
    el.value = String(Math.floor(Math.random() * 99999));
    generate();
  }
}

function exportPNG(): void {
  const c = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!c) return;
  const a = document.createElement('a');
  a.download = 'mapgen-' + Date.now() + '.png';
  a.href = c.toDataURL('image/png');
  a.click();
}

/* ── Checkpoints ── */
async function updateCheckpointList(): Promise<void> {
  if (!checkpointMgr) return;
  await checkpointMgr.load();
  
  const list = document.getElementById('checkpoint-list');
  if (!list) return;
  
  const sb = document.getElementById('btn-save-checkpoint') as HTMLElement | null;
  if (sb) sb.style.display = latestMapData ? 'inline-block' : 'none';
  
  list.innerHTML = '';
  for (let i = 0; i < checkpointMgr.checkpoints.length; i++) {
    const c = checkpointMgr.checkpoints[i];
    const item = document.createElement('div');
    item.className = 'checkpoint-item';
    
    const info = document.createElement('span');
    info.className = 'checkpoint-info';
    info.textContent = `${c.name} (${c.phase}) - ${new Date(c.time).toLocaleString('zh-CN')}`;
    
    const rb = document.createElement('button');
    rb.textContent = '恢复';
    rb.className = 'ck-btn-restore';
    rb.addEventListener('click', () => restoreCheckpoint(i));
    
    const db = document.createElement('button');
    db.textContent = '删除';
    db.className = 'ck-btn-delete';
    db.addEventListener('click', () => deleteCheckpoint(i));
    
    item.append(info, rb, db);
    list.appendChild(item);
  }
}

async function saveCheckpoint(): Promise<void> {
  if (!checkpointMgr || !latestMapData) return;
  const name = prompt('输入检查点名称:', '检查点 ' + new Date().toLocaleTimeString('zh-CN'));
  if (!name) return;
  await checkpointMgr.save(name, 'full', latestMapData, readParams());
  await updateCheckpointList();
}

async function restoreCheckpoint(id: number): Promise<void> {
  if (!checkpointMgr || isGenerating) return;
  isGenerating = true;
  
  const restoreProgress = $('#progress-container') as HTMLElement | null;
  const restoreText = $('#progress-text');
  
  if (restoreProgress) restoreProgress.style.display = 'block';
  if (restoreText) restoreText.textContent = '恢复检查点...';
  
  try {
    const ckpt = await checkpointMgr.restore(id);
    if (!ckpt || !ckpt.data) throw new Error('检查点数据无效');
    
    // TODO: Implement restoreFromCheckpoint in core
    // For now, just regenerate
    await generate();
  } catch (err) {
    console.error('Restore failed:', err);
    const errorText = $('#progress-text');
    if (errorText) errorText.textContent = '恢复失败';
  }
  
  if (restoreProgress) restoreProgress.style.display = 'none';
  isGenerating = false;
}

async function deleteCheckpoint(id: number): Promise<void> {
  if (!checkpointMgr) return;
  await checkpointMgr.delete(id);
  await updateCheckpointList();
}

function handleResize(): void {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!container || !canvas || !renderer) return;
  
  const rect = container.getBoundingClientRect();
  renderer.resize(Math.floor(rect.width), Math.floor(rect.height));
  render();
}

function applyDefaultParams(): void {
  for (const [key, val] of Object.entries(defaultParams)) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) continue;
    
    if (el instanceof HTMLInputElement) {
      if (el.type === 'range') {
        el.value = String(val);
        updateDisplay(el);
      } else if (el.type === 'number') {
        el.value = String(val);
      } else if (el.type === 'checkbox') {
        el.checked = !!val;
      } else if (el.type === 'color' && Array.isArray(val)) {
        el.value = rgbToHex(val[0], val[1], val[2]);
      } else if (el.type === 'text') {
        el.value = String(val);
      }
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(val);
    }
  }
  
  const seedEl = document.getElementById('seedStr') as HTMLInputElement | null;
  if (seedEl) seedEl.value = defaultParams.seedStr;
  
  const xEl = document.getElementById('pointLightPosX') as HTMLInputElement | null;
  const yEl = document.getElementById('pointLightPosY') as HTMLInputElement | null;
  if (xEl) xEl.value = String(defaultParams.pointLightPos[0]);
  if (yEl) yEl.value = String(defaultParams.pointLightPos[1]);
  
  const pd = document.getElementById('pointLightPosDisplay');
  if (pd) pd.textContent = `(${defaultParams.pointLightPos[0]}, ${defaultParams.pointLightPos[1]})`;
}

function bindUI(): void {
  $$('input[type="range"]').forEach(el => {
    el.addEventListener('input', () => {
      updateDisplay(el as HTMLInputElement);
      scheduleRender();
    });
  });
  
  $$('input[type="number"]').forEach(el => {
    el.addEventListener('input', scheduleRender);
  });
  
  $$('select').forEach(el => {
    el.addEventListener('change', generate);
  });
  
  $$('input[type="checkbox"]').forEach(el => {
    el.addEventListener('change', scheduleRender);
  });
  
  $$('input[type="color"]').forEach(el => {
    el.addEventListener('input', scheduleRender);
  });
  
  const seedEl = document.getElementById('seedStr') as HTMLInputElement | null;
  if (seedEl) seedEl.addEventListener('input', () => {
    (defaultParams as any).seedStr = seedEl.value;
  });
  
  const byId = (id: string) => document.getElementById(id);
  byId('btn-random-seed')?.addEventListener('click', randomSeed);
  byId('btn-generate')?.addEventListener('click', generate);
  byId('btn-export')?.addEventListener('click', exportPNG);
  byId('btn-save-checkpoint')?.addEventListener('click', saveCheckpoint);
}

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('#glCanvas not found');
    return;
  }
  
  try {
    renderer = new WebGLRenderer(canvas);
    const res = await fetch('shaders/fs-map.frag');
    if (!res.ok) throw new Error('Shader fetch failed');
    await renderer.initShaders(await res.text());
  } catch (e) {
    console.warn('WebGL2 unavailable, using Canvas2D:', (e as Error).message);
    renderer = new Canvas2DRenderer(canvas);
  }
  
  checkpointMgr = new CheckpointManager();
  await checkpointMgr.load();
  
  applyDefaultParams();
  bindUI();
  handleResize();
  window.addEventListener('resize', handleResize);
  
  generate();
});
