import type { MapData } from '@mapgen/core';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import { P5Renderer } from './renderer/p5renderer.js';
import type { RenderParams } from './renderer/renderParams.js';
import { CheckpointManager } from './checkpoint.js';
import { logger } from './core/logger.js';
import { state, patchParams, type UIParams } from './core/appState.js';
import { bus } from './core/eventBus.js';
import { generate as generateMap, setParam, clearSelection } from './core/actions.js';
import { PRESET_GROUPS, findPreset, RENDER_STYLES } from './launcher/presets.js';
import { createSvgIcon } from './core/svgIcon.js';
import { MapInteraction } from './map/mapInteraction.js';
import { EditorController, type EditorMode, type EditorToolParams } from './editor/EditorController.js';
import { NameOverlay } from './editor/NameOverlay.js';
import { Toolbar } from './ui/toolbar.js';
import { CheckpointPanel } from './ui/checkpointPanel.js';
import { Launcher } from './launcher/launcher.js';

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
  laserStart: 'u_laserStart',
  laserEnd: 'u_laserEnd',
  laserWidth: 'u_laserWidth',
  laserSelection: 'u_laserSelection',
  laserColor: 'u_laserColor',
  trailEnabled: 'u_hasTrail',
  cursorActive: 'u_cursorActive',
  cursorPos: 'u_cursorPos',
  cursorSize: 'u_cursorSize',
  snowLine: 'u_snowLine',
  erosionStrength: 'u_erosionStrength',
  octaves: 'u_fbmOctaves',
  lacunarity: 'u_fbmLacunarity',
  persistence: 'u_fbmPersistence',
  plateCount: 'u_plateTotal',
};

let renderer: WebGLRenderer | Canvas2DRenderer | P5Renderer | null = null;
let checkpointMgr: CheckpointManager | null = null;
let renderTimeout: number | null = null;
let mapInteraction: MapInteraction | null = null;
let minimapCtx: CanvasRenderingContext2D | null = null;
let editorController: EditorController | null = null;
let toolbar: Toolbar | null = null;
let checkpointPanel: CheckpointPanel | null = null;
let nameOverlay: NameOverlay | null = null;
let launcher: Launcher | null = null;
let isDraggingSize = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartW = 0;
let dragStartH = 0;
let currentTool = 'idle';
let namesVisible = true;

function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function buildRenderParams(): RenderParams {
  const rp: RenderParams = {};
  for (const [jsKey, uname] of Object.entries(RENDER_PARAM_MAP)) {
    const key = jsKey as keyof UIParams;
    const val = state.params[key];
    if (typeof val === 'number' || typeof val === 'boolean' || Array.isArray(val)) {
      (rp as Record<string, number | boolean | number[]>)[uname] = val;
    }
  }
  rp.u_zoom = state.zoom;
  rp.u_pan = [state.panX, state.panY];
  return rp;
}

function render(): void {
  if (!renderer) return;
  if (renderer instanceof WebGLRenderer) {
    renderer.render(buildRenderParams());
  } else {
    renderer.render();
  }
  drawMinimap();
}

function scheduleRender(): void {
  if (renderTimeout !== null) return;
  renderTimeout = window.requestAnimationFrame(() => {
    renderTimeout = null;
    render();
  });
}

function formatNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

function updateSizeInfo(): void {
  const w = state.params.mapWidth;
  const h = state.params.mapHeight;
  const info = $('size-info');
  if (info) info.textContent = `${w}×${h} · ${formatNum(w * h)} 像素`;
  const wiSize = $('wi-size');
  if (wiSize) wiSize.textContent = `${w}×${h}`;
}

function setSliderVal(id: string, rawVal: number): void {
  const el = $(id) as HTMLInputElement | null;
  if (el) el.value = String(rawVal);
}

function setDispVal(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

function syncUIFromParams(): void {
  const p = state.params;
  const seedInput = $('seedStr') as HTMLInputElement | null;
  if (seedInput) seedInput.value = p.seedStr;
  const wInput = $('mapWidth') as HTMLInputElement | null;
  const hInput = $('mapHeight') as HTMLInputElement | null;
  if (wInput) wInput.value = String(p.mapWidth);
  if (hInput) hInput.value = String(p.mapHeight);
  updateSizeInfo();

  const noiseSel = $('noiseType') as HTMLSelectElement | null;
  if (noiseSel) noiseSel.value = p.noiseType;
  const fbmSel = $('fbmType') as HTMLSelectElement | null;
  if (fbmSel) fbmSel.value = p.fbmType;
  const styleSel = $('style') as HTMLSelectElement | null;
  if (styleSel) styleSel.value = String(p.style);

  setSliderVal('octaves', p.octaves);
  setDispVal('octaves-val', String(p.octaves));

  setSliderVal('lacunarity', p.lacunarity);
  setDispVal('lacunarity-val', p.lacunarity.toFixed(1));

  setSliderVal('persistence', p.persistence);
  setDispVal('persistence-val', p.persistence.toFixed(2));

  setSliderVal('plateCount', p.plateCount);
  setDispVal('plateCount-val', String(p.plateCount));

  setSliderVal('landmass', Math.round(p.landmass * 100));
  setDispVal('landmass-val', Math.round(p.landmass * 100) + '%');

  setSliderVal('mountainFold', Math.round(p.mountainFold * 100));
  setDispVal('mountainFold-val', p.mountainFold.toFixed(2));

  setSliderVal('coastDetail', Math.round(p.coastDetail * 100));
  setDispVal('coastDetail-val', p.coastDetail.toFixed(2));

  const setCheck = (id: string, val: boolean) => {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.checked = val;
  };
  setCheck('enableOceanCurrents', p.enableOceanCurrents);
  setCheck('enableIceSheet', p.enableIceSheet);
  setCheck('enableMonsoon', p.enableMonsoon);
  setCheck('enableContinentality', p.enableContinentality);
  setCheck('enableHadleyEnhancement', p.enableHadleyEnhancement);

  setSliderVal('seaLevel', Math.round(p.seaLevel * 100));
  setDispVal('seaLevel-val', p.seaLevel.toFixed(2));

  setSliderVal('erosionStrength', Math.round(p.erosionStrength * 100));
  setDispVal('erosionStrength-val', p.erosionStrength.toFixed(1));

  setSliderVal('erosionIterations', p.erosionIterations);
  setDispVal('erosionIterations-val', String(p.erosionIterations));

  setSliderVal('lakeDensity', Math.round(p.lakeDensity * 1000));
  setDispVal('lakeDensity-val', p.lakeDensity.toFixed(3));

  setSliderVal('tempOffset', Math.round(p.tempOffset * 100));
  setDispVal('tempOffset-val', p.tempOffset.toFixed(2));

  setSliderVal('snowLine', Math.round(p.snowLine * 100));
  setDispVal('snowLine-val', p.snowLine.toFixed(2));

  setSliderVal('rainStrength', Math.round(p.rainStrength * 100));
  setDispVal('rainStrength-val', p.rainStrength.toFixed(1));

  setSliderVal('windDirX', Math.round(p.windDirX * 100));
  setDispVal('windDirX-val', p.windDirX.toFixed(1));

  setSliderVal('windDirY', Math.round(p.windDirY * 100));
  setDispVal('windDirY-val', p.windDirY.toFixed(1));

  updateWindArrow();

  setSliderVal('riverCount', p.riverCount);
  setDispVal('riverCount-val', String(p.riverCount));

  setCheck('showBoundaries', p.showBoundaries);
  setSliderVal('boundaryWidth', Math.round(p.boundaryWidth * 10));
  setDispVal('boundaryWidth-val', p.boundaryWidth.toFixed(1));
  setCheck('showRivers', p.showRivers);
  setCheck('showContours', p.showContours);
  setCheck('showTerrain', p.showTerrain);
  setCheck('showSelection', p.showSelection);
  setCheck('showClimate', p.showClimate);

  setSliderVal('lightAngle', Math.round(p.lightAngle * 100));
  setDispVal('lightAngle-val', p.lightAngle.toFixed(2));
  setCheck('pointLightEnabled', p.pointLightEnabled);
  setCheck('glowEnabled', p.glowEnabled);
  setCheck('laserActive', p.laserActive);
  setCheck('laserSelection', p.laserSelection);
  setSliderVal('laserWidth', Math.round(p.laserWidth * 1000));
  setDispVal('laserWidth-val', p.laserWidth.toFixed(3));
  setCheck('cursorActive', p.cursorActive);
  setCheck('trailEnabled', p.trailEnabled);

  setSliderVal('brushRadius', 14);
  setDispVal('brushRadius-val', '14');
  setSliderVal('brushStrength', 30);
  setDispVal('brushStrength-val', '0.3');

  const wiSeed = $('wi-seed');
  if (wiSeed) wiSeed.textContent = p.seedStr;

  updateStyleDots();
  updateUndoRedo();
}

function updateWindArrow(): void {
  const arrow = $('wind-arrow');
  if (!arrow) return;
  const dx = state.params.windDirX;
  const dy = state.params.windDirY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  arrow.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
}

function updateStyleDots(): void {
  const container = $('style-dots');
  if (!container) return;
  container.innerHTML = '';
  const styles = RENDER_STYLES.slice(0, 6);
  styles.forEach((s) => {
    const dot = document.createElement('button');
    dot.className = 'sd' + (s.style === state.params.style ? ' active' : '');
    dot.appendChild(createSvgIcon(s.icon, 16));
    dot.title = s.name;
    dot.addEventListener('click', () => {
      setParam('style', s.style);
      const sel = $('style') as HTMLSelectElement | null;
      if (sel) sel.value = String(s.style);
      updateStyleDots();
      scheduleRender();
    });
    container.appendChild(dot);
  });
}

function updateUndoRedo(): void {
  const undoBtn = $('btn-undo') as HTMLButtonElement | null;
  const redoBtn = $('btn-redo') as HTMLButtonElement | null;
  if (undoBtn) undoBtn.disabled = !(editorController?.canUndo ?? false);
  if (redoBtn) redoBtn.disabled = !(editorController?.canRedo ?? false);
}

function applyZoom(): void {
  scheduleRender();
}

function setGeneratingStatus(generating: boolean, error?: string): void {
  const dot = $('status-dot');
  const text = $('status-text');
  const progOverlay = $('progress-overlay');
  if (dot) {
    dot.classList.remove('generating', 'error');
    if (generating) dot.classList.add('generating');
    else if (error) dot.classList.add('error');
  }
  if (text) {
    if (error) text.textContent = '错误';
    else if (generating) text.textContent = '生成中...';
    else text.textContent = '就绪';
  }
  if (progOverlay) {
    progOverlay.classList.toggle('show', generating);
  }
}

function setProgress(fraction: number, phase: string): void {
  const fill = $('prog-fill');
  const pct = $('prog-pct');
  const phaseEl = $('prog-phase');
  if (fill) fill.style.width = `${Math.round(fraction * 100)}%`;
  if (pct) pct.textContent = `${Math.round(fraction * 100)}%`;
  if (phaseEl) phaseEl.textContent = phase;
}

function drawMinimap(): void {
  if (!minimapCtx || !state.mapData) return;
  const md = state.mapData;
  const canvas = minimapCtx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = minimapCtx.createImageData(w, h);
  const data = imgData.data;
  const elev = md.elevTex;
  const seaLevel = state.params.seaLevel;
  const snowLine = state.params.snowLine;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x / w) * md.width);
      const sy = Math.floor((y / h) * md.height);
      const si = (sy * md.width + sx) * 4;
      const e = elev[si];
      const di = (y * w + x) * 4;

      let r: number, g: number, b: number;
      if (e < seaLevel - 0.15) { r = 20; g = 50; b = 100; }
      else if (e < seaLevel) { r = 40; g = 80; b = 140; }
      else if (e < seaLevel + 0.05) { r = 194; g = 178; b = 128; }
      else if (e < snowLine - 0.1) { r = 60; g = 120; b = 50; }
      else if (e < snowLine) { r = 100; g = 90; b = 70; }
      else { r = 240; g = 245; b = 255; }

      data[di] = r;
      data[di + 1] = g;
      data[di + 2] = b;
      data[di + 3] = 255;
    }
  }
  minimapCtx.putImageData(imgData, 0, 0);
}

function buildPresetGrid(): void {
  const grid = $('preset-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const themeGroup = PRESET_GROUPS.find(g => g.category === 'theme');
  if (!themeGroup) return;
  themeGroup.presets.forEach((preset) => {
    const card = document.createElement('button');
    card.className = 'preset-card' + (state.currentPreset === preset.id ? ' active' : '');
    const iconWrap = document.createElement('span');
    iconWrap.className = 'preset-icon';
    iconWrap.appendChild(createSvgIcon(preset.icon, 24));
    const nameEl = document.createElement('span');
    nameEl.className = 'preset-name';
    nameEl.textContent = preset.name;
    const descEl = document.createElement('span');
    descEl.className = 'preset-desc';
    descEl.textContent = preset.description;
    card.appendChild(iconWrap);
    card.appendChild(nameEl);
    card.appendChild(descEl);
    card.addEventListener('click', () => {
      applyPreset(preset.id);
    });
    grid.appendChild(card);
  });
}

function applyPreset(presetId: string): void {
  const preset = findPreset(presetId);
  if (!preset) return;
  state.currentPreset = presetId;
  const updates: Partial<UIParams> = {};
  for (const [k, v] of Object.entries(preset.params)) {
    if (k === 'noiseType' || k === 'fbmType') {
      (updates as Record<string, unknown>)[k] = v;
    } else if (typeof v === 'number') {
      (updates as Record<string, number>)[k] = v;
    } else if (typeof v === 'boolean') {
      (updates as Record<string, boolean>)[k] = v;
    }
  }
  patchParams(updates);
  syncUIFromParams();
  buildPresetGrid();
  generateMap();
}

interface SliderBinding {
  toParam: (raw: number) => number;
  fromParam?: (val: number) => number;
  toDisplay: (raw: number) => string;
  autoGen?: boolean;
}

function updateSliderFill(el: HTMLInputElement): void {
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 100;
  const val = parseFloat(el.value) || 0;
  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  el.style.setProperty('--value', `${pct}%`);
}

function bindSliderEx(id: string, paramKey: keyof UIParams, binding: SliderBinding): void {
  const el = $(id) as HTMLInputElement | null;
  const dispId = id + '-val';
  if (!el) return;
  updateSliderFill(el);
  el.addEventListener('input', () => {
    const raw = parseFloat(el.value);
    const val = binding.toParam(raw);
    setParam(paramKey, val as never);
    setDispVal(dispId, binding.toDisplay(raw));
    updateSliderFill(el);
    if (paramKey === 'windDirX' || paramKey === 'windDirY') {
      updateWindArrow();
    }
    const renderOnlyKeys = ['style', 'showBoundaries', 'boundaryWidth', 'showRivers', 'showContours', 'showTerrain', 'showSelection', 'showClimate', 'lightAngle', 'pointLightEnabled', 'glowEnabled', 'cursorSize'];
    if (renderOnlyKeys.includes(paramKey as string)) {
      scheduleRender();
    }
  });
  if (binding.autoGen) {
    el.addEventListener('change', () => generateMap());
  }
}

function bindCheckbox(id: string, paramKey: keyof UIParams, autoGen = false): void {
  const el = $(id) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener('change', () => {
    setParam(paramKey, el.checked as never);
    const renderOnlyKeys = ['showBoundaries', 'showRivers', 'showContours', 'showTerrain', 'showSelection', 'showClimate', 'pointLightEnabled', 'glowEnabled', 'laserActive', 'cursorActive', 'trailEnabled', 'laserSelection'];
    if (renderOnlyKeys.includes(paramKey as string)) {
      scheduleRender();
    }
    if (autoGen) generateMap();
  });
}

function bindSelect(id: string, paramKey: keyof UIParams, autoGen = false): void {
  const el = $(id) as HTMLSelectElement | null;
  if (!el) return;
  el.addEventListener('change', () => {
    setParam(paramKey, el.value as never);
    if (paramKey === 'style') {
      updateStyleDots();
      scheduleRender();
    }
    if (autoGen) generateMap();
  });
}

function bindSizeHandle(): void {
  const handle = $('size-handle');
  if (!handle) return;
  handle.addEventListener('mousedown', (e) => {
    isDraggingSize = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartW = state.params.mapWidth;
    dragStartH = state.params.mapHeight;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDraggingSize) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newW = Math.max(64, Math.min(2048, dragStartW + Math.round(dx / 2) * 2));
    const newH = Math.max(64, Math.min(2048, dragStartH + Math.round(dy / 2) * 2));
    if (newW !== state.params.mapWidth || newH !== state.params.mapHeight) {
      patchParams({ mapWidth: newW, mapHeight: newH });
      const wInput = $('mapWidth') as HTMLInputElement | null;
      const hInput = $('mapHeight') as HTMLInputElement | null;
      if (wInput) wInput.value = String(newW);
      if (hInput) hInput.value = String(newH);
      updateSizeInfo();
      document.querySelectorAll<HTMLButtonElement>('.sz-btn').forEach(b => b.classList.remove('active'));
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDraggingSize) {
      isDraggingSize = false;
      generateMap();
    }
  });
}

function bindEventBus(): void {
  bus.on('render.request', scheduleRender);
  bus.on('generate.request', () => generateMap());
  bus.on('generating.started', () => {
    setGeneratingStatus(true);
    setProgress(0, '初始化...');
  });
  bus.on('progress', ({ fraction, label }: { fraction: number; label: string }) => {
    setProgress(fraction, label);
  });
  bus.on('generating.completed', ({ mapData }: { mapData: MapData }) => {
    setGeneratingStatus(false);
    setProgress(1, '完成');
    renderer?.uploadMapData(mapData);
    mapInteraction?.setMapData(mapData);
    render();
    const wiStats = $('wi-stats');
    const wiStatsVal = $('wi-stats-val');
    if (wiStats && wiStatsVal) {
      wiStats.style.display = '';
      let landCount = 0;
      const elev = mapData.elevTex;
      const total = mapData.width * mapData.height;
      for (let i = 0; i < total; i++) {
        if (elev[i * 4] >= state.params.seaLevel) landCount++;
      }
      wiStatsVal.textContent = `${Math.round(landCount / total * 100)}% 陆地`;
    }
  });
  bus.on('generating.failed', (err: string) => {
    setGeneratingStatus(false, err);
    logger.error('Generation failed:', err);
  });
  bus.on('selection.changed', ({ plates }: { plates: number[]; regions: number[] }) => {
    if (renderer instanceof WebGLRenderer) renderer.updateSelectMask(plates);
    scheduleRender();
  });
  bus.on('checkpoint.save.request', async () => {
    if (!checkpointMgr || !state.mapData) return;
    const ckpt = await checkpointMgr.save(
      `检查点 ${checkpointMgr.checkpoints.length + 1}`,
      'manual',
      state.mapData,
      state.params
    );
    if (ckpt) {
      bus.emit('checkpoint.updated');
    }
  });
  bus.on('checkpoint.restore.request', async (id: number) => {
    if (!checkpointMgr) return;
    const ckpt = await checkpointMgr.restore(id);
    if (!ckpt) return;
    const restored = checkpointMgr.restoreMapData(ckpt);
    if (!restored) return;
    patchParams(ckpt.data.params as Partial<UIParams>);
    syncUIFromParams();
    state.mapData = restored;
    renderer?.uploadMapData(restored);
    mapInteraction?.setMapData(restored);
    render();
    bus.emit('generating.completed', { mapData: restored });
  });
  bus.on('editor.committed', () => {
    updateUndoRedo();
    scheduleRender();
  });
  bus.on('export.request', () => {
    const c = $('glCanvas') as HTMLCanvasElement | null;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'mapgen-' + Date.now() + '.png';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
}

async function initRenderer(canvas: HTMLCanvasElement): Promise<void> {
  try {
    const r = new WebGLRenderer(canvas);
    const res = await fetch('shaders/fs-map.frag');
    if (!res.ok) throw new Error('Shader fetch failed');
    await r.initShaders(await res.text());
    renderer = r;
  } catch (e) {
    logger.warn('WebGL2 unavailable, trying Canvas2D:', (e as Error).message);
    try {
      const p5r = new P5Renderer(canvas);
      await p5r.init();
      renderer = p5r;
    } catch {
      renderer = new Canvas2DRenderer(canvas);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = $('glCanvas') as HTMLCanvasElement | null;
  const minimap = $('minimap') as HTMLCanvasElement | null;
  if (!canvas) {
    logger.error('#glCanvas not found');
    return;
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __mapgen: unknown }).__mapgen = { state };
  }

  if (minimap) {
    minimapCtx = minimap.getContext('2d');
  }

  await initRenderer(canvas);

  checkpointMgr = new CheckpointManager();
  await checkpointMgr.load();

  editorController = new EditorController(canvas);
  nameOverlay = new NameOverlay(document.body);
  nameOverlay.bindEvents();
  toolbar = new Toolbar();
  toolbar.bind();
  checkpointPanel = new CheckpointPanel();
  checkpointPanel.bind(checkpointMgr);

  bindEventBus();
  bindSizeHandle();

  try {
    const savedTheme = localStorage.getItem('mapgen:theme');
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  } catch { /* ignore */ }

  let launched = false;
  if (Launcher.shouldShow()) {
    launcher = new Launcher(document.body);
    const result = await launcher.waitForLaunch();
    launched = true;
    result.start();
    await launcher.hide();
    launcher.destroy();
    launcher = null;
  }

  buildPresetGrid();
  syncUIFromParams();

  const panel = $('panel');
  const checkpointPopover = $('checkpoint-popover');
  $('btn-panel-toggle')?.addEventListener('click', () => {
    panel?.classList.toggle('panel-open');
  });
  $('btn-checkpoint')?.addEventListener('click', () => {
    checkpointPopover?.classList.toggle('show');
  });
  $('btn-theme')?.addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-transition');
    root.dataset.theme = next;
    window.setTimeout(() => root.classList.remove('theme-transition'), 400);
    try {
      localStorage.setItem('mapgen:theme', next);
    } catch { /* ignore */ }
  });

  document.querySelectorAll<HTMLElement>('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (!target) return;
      document.querySelectorAll<HTMLElement>('.panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll<HTMLElement>('.panel-section').forEach(s => {
        s.classList.toggle('active', s.dataset.section === target);
      });
    });
  });

  $('btn-random')?.addEventListener('click', () => {
    const seed = String(Math.floor(Math.random() * 99999));
    setParam('seedStr', seed);
    const seedInput = $('seedStr') as HTMLInputElement | null;
    if (seedInput) seedInput.value = seed;
    generateMap();
  });
  $('btn-undo')?.addEventListener('click', () => {
    editorController?.undo();
    updateUndoRedo();
  });
  $('btn-redo')?.addEventListener('click', () => {
    editorController?.redo();
    updateUndoRedo();
  });
  const toggleNamesBtn = $('btn-toggle-names');
  if (toggleNamesBtn) {
    toggleNamesBtn.classList.toggle('active', namesVisible);
    toggleNamesBtn.addEventListener('click', () => {
      namesVisible = !namesVisible;
      toggleNamesBtn.classList.toggle('active', namesVisible);
      bus.emit('overlay.toggle', namesVisible);
    });
  }
  bus.emit('overlay.toggle', namesVisible);

  $('seedStr')?.addEventListener('change', (e) => {
    setParam('seedStr', (e.target as HTMLInputElement).value);
  });

  const wInput = $('mapWidth') as HTMLInputElement | null;
  const hInput = $('mapHeight') as HTMLInputElement | null;
  const onSizeChange = () => {
    const w = parseInt(wInput?.value || '512', 10);
    const h = parseInt(hInput?.value || '512', 10);
    patchParams({ mapWidth: w, mapHeight: h });
    document.querySelectorAll('.sz-btn').forEach(b => b.classList.remove('active'));
    updateSizeInfo();
  };
  wInput?.addEventListener('change', () => { onSizeChange(); generateMap(); });
  hInput?.addEventListener('change', () => { onSizeChange(); generateMap(); });

  document.querySelectorAll<HTMLButtonElement>('.sz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.dataset.w || '512', 10);
      const h = parseInt(btn.dataset.h || '512', 10);
      document.querySelectorAll<HTMLButtonElement>('.sz-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      patchParams({ mapWidth: w, mapHeight: h });
      if (wInput) wInput.value = String(w);
      if (hInput) hInput.value = String(h);
      updateSizeInfo();
      generateMap();
    });
  });

  bindSliderEx('octaves', 'octaves', {
    toParam: raw => raw,
    toDisplay: raw => String(raw),
    autoGen: true,
  });
  bindSliderEx('lacunarity', 'lacunarity', {
    toParam: raw => raw,
    toDisplay: raw => raw.toFixed(1),
    autoGen: true,
  });
  bindSliderEx('persistence', 'persistence', {
    toParam: raw => raw,
    toDisplay: raw => raw.toFixed(2),
    autoGen: true,
  });
  bindSliderEx('plateCount', 'plateCount', {
    toParam: raw => raw,
    toDisplay: raw => String(raw),
    autoGen: true,
  });
  bindSliderEx('landmass', 'landmass', {
    toParam: raw => raw / 100,
    toDisplay: raw => raw + '%',
    autoGen: true,
  });
  bindSliderEx('mountainFold', 'mountainFold', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
    autoGen: true,
  });
  bindSliderEx('coastDetail', 'coastDetail', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
    autoGen: true,
  });

  bindCheckbox('enableOceanCurrents', 'enableOceanCurrents', true);
  bindCheckbox('enableIceSheet', 'enableIceSheet', true);
  bindCheckbox('enableMonsoon', 'enableMonsoon', true);
  bindCheckbox('enableContinentality', 'enableContinentality', true);
  bindCheckbox('enableHadleyEnhancement', 'enableHadleyEnhancement', true);

  bindSliderEx('seaLevel', 'seaLevel', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
    autoGen: true,
  });
  bindSliderEx('erosionStrength', 'erosionStrength', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(1),
    autoGen: true,
  });
  bindSliderEx('erosionIterations', 'erosionIterations', {
    toParam: raw => raw,
    toDisplay: raw => String(raw),
    autoGen: true,
  });
  bindSliderEx('lakeDensity', 'lakeDensity', {
    toParam: raw => raw / 1000,
    toDisplay: raw => (raw / 1000).toFixed(3),
    autoGen: true,
  });

  bindSliderEx('tempOffset', 'tempOffset', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
    autoGen: true,
  });
  bindSliderEx('snowLine', 'snowLine', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
    autoGen: true,
  });
  bindSliderEx('rainStrength', 'rainStrength', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(1),
    autoGen: true,
  });
  bindSliderEx('windDirX', 'windDirX', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(1),
    autoGen: true,
  });
  bindSliderEx('windDirY', 'windDirY', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(1),
    autoGen: true,
  });

  bindSliderEx('riverCount', 'riverCount', {
    toParam: raw => raw,
    toDisplay: raw => String(raw),
    autoGen: true,
  });

  bindSelect('noiseType', 'noiseType', true);
  bindSelect('fbmType', 'fbmType', true);
  bindSelect('style', 'style');

  bindCheckbox('showBoundaries', 'showBoundaries');
  bindSliderEx('boundaryWidth', 'boundaryWidth', {
    toParam: raw => raw / 10,
    toDisplay: raw => (raw / 10).toFixed(1),
  });
  bindCheckbox('showRivers', 'showRivers');
  bindCheckbox('showContours', 'showContours');
  bindCheckbox('showTerrain', 'showTerrain');
  bindCheckbox('showSelection', 'showSelection');
  bindCheckbox('showClimate', 'showClimate');
  bindSliderEx('lightAngle', 'lightAngle', {
    toParam: raw => raw / 100,
    toDisplay: raw => (raw / 100).toFixed(2),
  });
  bindCheckbox('pointLightEnabled', 'pointLightEnabled');
  bindCheckbox('glowEnabled', 'glowEnabled');
  bindCheckbox('laserActive', 'laserActive');
  bindCheckbox('laserSelection', 'laserSelection');
  bindSliderEx('laserWidth', 'laserWidth', {
    toParam: raw => raw / 1000,
    toDisplay: raw => (raw / 1000).toFixed(3),
  });
  bindCheckbox('cursorActive', 'cursorActive');
  bindCheckbox('trailEnabled', 'trailEnabled');

  document.querySelectorAll<HTMLButtonElement>('.et-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (!tool) return;
      currentTool = tool;
      document.querySelectorAll<HTMLButtonElement>('.et-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const brushCtrls = $('brush-ctrls');
      if (brushCtrls) {
        brushCtrls.style.display = tool === 'brush' ? '' : 'none';
      }
      editorController?.setMode(tool as EditorMode);
    });
  });
  const brushCtrlsEl = $('brush-ctrls') as HTMLElement | null;
  if (brushCtrlsEl) brushCtrlsEl.style.display = 'none';

  bindSliderEx('brushRadius', 'cursorSize', {
    toParam: raw => raw,
    toDisplay: raw => String(raw),
  });
  const brushRadiusEl = $('brushRadius') as HTMLInputElement | null;
  const brushStrengthEl = $('brushStrength') as HTMLInputElement | null;
  if (brushRadiusEl) updateSliderFill(brushRadiusEl);
  if (brushStrengthEl) updateSliderFill(brushStrengthEl);
  brushRadiusEl?.addEventListener('input', () => {
    const v = parseInt(brushRadiusEl.value, 10);
    editorController?.setTool({ brushRadius: v });
    updateSliderFill(brushRadiusEl);
  });
  brushStrengthEl?.addEventListener('input', () => {
    const v = parseInt(brushStrengthEl.value, 10);
    const strength = v / 100;
    setDispVal('brushStrength-val', strength.toFixed(1));
    editorController?.setTool({ brushStrength: strength });
    updateSliderFill(brushStrengthEl);
  });

  const updateZoom = () => {
    const zv = $('zoom-val');
    if (zv) zv.textContent = `${Math.round(state.zoom * 100)}%`;
    applyZoom();
    scheduleRender();
  };
  $('btn-zoom-in')?.addEventListener('click', () => { state.zoom = Math.min(4, state.zoom * 1.25); updateZoom(); });
  $('btn-zoom-out')?.addEventListener('click', () => { state.zoom = Math.max(0.25, state.zoom / 1.25); updateZoom(); });
  $('btn-zoom-reset')?.addEventListener('click', () => { state.zoom = 1; updateZoom(); });

  mapInteraction = new MapInteraction(canvas);
  mapInteraction.bindEvents();

  const handleResize = () => {
    if (!renderer) return;
    renderer.resize(window.innerWidth, window.innerHeight);
    render();
  };
  handleResize();
  window.addEventListener('resize', handleResize);

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      generateMap();
    } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      const seed = String(Math.floor(Math.random() * 99999));
      setParam('seedStr', seed);
      const seedInput = $('seedStr') as HTMLInputElement | null;
      if (seedInput) seedInput.value = seed;
      generateMap();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      panel?.classList.toggle('panel-open');
      panel?.classList.toggle('panel-closed');
    } else if (e.key === 'Escape') {
      clearSelection();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        editorController?.redo();
      } else {
        editorController?.undo();
      }
      updateUndoRedo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      editorController?.redo();
      updateUndoRedo();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const toolMap: Record<string, string> = { v: 'idle', b: 'brush', m: 'vector-line', p: 'vector-poly', d: 'drag-plate', a: 'annotate' };
      const tool = toolMap[e.key.toLowerCase()];
      if (tool) {
        const btn = document.querySelector<HTMLButtonElement>(`.et-btn[data-tool="${tool}"]`);
        btn?.click();
      }
    }
  });

  updateUndoRedo();

  if (!launched) {
    generateMap();
  }
});
