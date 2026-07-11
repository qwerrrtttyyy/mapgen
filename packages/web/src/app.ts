/**
 * MapGen Studio — 主入口
 *
 * 职责：初始化渲染器、编辑器、UI 绑定、事件总线。
 * 具体 UI 逻辑已拆分到 ui/ 子模块。
 */
import type { MapData } from '@mapgen/core';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import { P5Renderer } from './renderer/p5renderer.js';
import { CheckpointManager } from './checkpoint.js';
import { logger } from './core/logger.js';
import { state, patchParams, type UIParams } from './core/appState.js';
import { bus } from './core/eventBus.js';
import { generate as generateMap, setParam, clearSelection } from './core/actions.js';
import { MapInteraction } from './map/mapInteraction.js';
import { EditorController, type EditorMode } from './editor/EditorController.js';
import { NameOverlay } from './editor/NameOverlay.js';
import { Toolbar } from './ui/toolbar.js';
import { CheckpointPanel } from './ui/checkpointPanel.js';
import { Launcher } from './launcher/launcher.js';
import { DebugPanel } from './ui/debugPanel.js';
import { exportDialog } from './export/exportDialog.js';
import { exportManager } from './export/exportManager.js';
import { buildRenderParams } from './ui/renderHelper.js';
import { drawMinimap, markMinimapDirty } from './ui/minimap.js';
import { setGeneratingStatus, setProgress } from './ui/statusBar.js';
import { buildPresetGrid, initPresetGrid } from './ui/presetGrid.js';
import {
  syncUIFromParams,
  updateSizeInfo,
  updateStyleDots,
  updateUndoRedo,
  updateWindArrow,
  setSliderVal,
  setDispVal,
  isRenderOnlyParam,
  applyZoom,
  initUiSync,
} from './ui/uiSync.js';

// ── 模块级状态 ─────────────────────────────────────
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
let debugPanel: DebugPanel | null = null;
let isDraggingSize = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartW = 0;
let dragStartH = 0;
let namesVisible = true;

function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

// ── 渲染 ──────────────────────────────────────────
function render(): void {
  if (!renderer) return;
  if (renderer instanceof WebGLRenderer) {
    renderer.render(buildRenderParams());
  } else {
    renderer.render();
  }
  drawMinimap(minimapCtx);
}

function scheduleRender(): void {
  if (renderTimeout !== null) return;
  renderTimeout = window.requestAnimationFrame(() => {
    renderTimeout = null;
    render();
  });
}

// ── 参数绑定工具 ──────────────────────────────────
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
  const el = $<HTMLInputElement>(id);
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
    if (isRenderOnlyParam(paramKey as string)) {
      scheduleRender();
    }
  });
  if (binding.autoGen) {
    el.addEventListener('change', () => generateMap());
  }
}

function bindCheckbox(id: string, paramKey: keyof UIParams, autoGen = false): void {
  const el = $<HTMLInputElement>(id);
  if (!el) return;
  el.addEventListener('change', () => {
    setParam(paramKey, el.checked as never);
    if (isRenderOnlyParam(paramKey as string)) {
      scheduleRender();
    }
    if (autoGen) generateMap();
  });
}

function bindSelect(id: string, paramKey: keyof UIParams, autoGen = false): void {
  const el = $<HTMLSelectElement>(id);
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

// ── 尺寸拖拽 ──────────────────────────────────────
function bindSizeHandle(): void {
  const handle = $('size-handle');
  if (!handle) return;
  handle.addEventListener('mousedown', e => {
    isDraggingSize = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartW = state.params.mapWidth;
    dragStartH = state.params.mapHeight;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isDraggingSize) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newW = Math.max(64, Math.min(2048, dragStartW + Math.round(dx / 2) * 2));
    const newH = Math.max(64, Math.min(2048, dragStartH + Math.round(dy / 2) * 2));
    if (newW !== state.params.mapWidth || newH !== state.params.mapHeight) {
      patchParams({ mapWidth: newW, mapHeight: newH });
      const wInput = $<HTMLInputElement>('mapWidth');
      const hInput = $<HTMLInputElement>('mapHeight');
      if (wInput) wInput.value = String(newW);
      if (hInput) hInput.value = String(newH);
      updateSizeInfo();
      document
        .querySelectorAll<HTMLButtonElement>('.sz-btn')
        .forEach(b => b.classList.remove('active'));
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDraggingSize) {
      isDraggingSize = false;
      generateMap();
    }
  });
}

// ── 事件总线 ──────────────────────────────────────
let _eventBusBound = false;

function bindEventBus(): void {
  if (_eventBusBound) return;
  _eventBusBound = true;

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
    markMinimapDirty();
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
      wiStatsVal.textContent = `${Math.round((landCount / total) * 100)}% 陆地`;
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
    try {
      if (!checkpointMgr || !state.mapData) return;
      const ckpt = await checkpointMgr.save(
        `检查点 ${checkpointMgr.checkpoints.length + 1}`,
        'manual',
        state.mapData,
        state.params
      );
      if (ckpt) bus.emit('checkpoint.updated');
    } catch (err) {
      logger.error('Checkpoint save failed:', err);
    }
  });
  bus.on('checkpoint.restore.request', async (id: number) => {
    try {
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
    } catch (err) {
      logger.error('Checkpoint restore failed:', err);
    }
  });
  bus.on('editor.committed', () => {
    updateUndoRedo();
    scheduleRender();
  });
  bus.on('export.request', () => {
    const canvas = $<HTMLCanvasElement>('glCanvas');
    if (!canvas) return;
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'mapgen-' + Date.now() + '.png';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
  bus.on('export.dialog.open', () => exportDialog.open());
}

// ── 渲染器初始化 ──────────────────────────────────
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

// ── 主初始化 ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = $<HTMLCanvasElement>('glCanvas');
  const minimap = $<HTMLCanvasElement>('minimap');
  if (!canvas) {
    logger.error('#glCanvas not found');
    return;
  }

  (window as unknown as { __mapgen: unknown }).__mapgen = { state };
  if (minimap) minimapCtx = minimap.getContext('2d');

  await initRenderer(canvas);
  exportManager.setCanvas(canvas);

  checkpointMgr = new CheckpointManager();
  await checkpointMgr.load();

  editorController = new EditorController(canvas);
  nameOverlay = new NameOverlay(document.body);
  nameOverlay.bindEvents();
  toolbar = new Toolbar();
  toolbar.bind();
  checkpointPanel = new CheckpointPanel();
  checkpointPanel.bind(checkpointMgr);
  debugPanel = new DebugPanel();
  debugPanel.bind();

  // 初始化子模块的回调依赖
  initUiSync(scheduleRender, editorController);
  initPresetGrid(syncUIFromParams, generateMap);

  buildPresetGrid();
  syncUIFromParams();
  bindEventBus();
  bindSizeHandle();

  try {
    const savedTheme = localStorage.getItem('mapgen:theme');
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  } catch { /* ignore */ }

  // ── Launcher ──
  let launched = false;
  if (Launcher.shouldShow()) {
    try {
      launcher = new Launcher(document.body);
      const result = await launcher.waitForLaunch();
      launched = true;
      result.start();
      await launcher.hide();
      launcher.destroy();
      launcher = null;
    } catch (err) {
      logger.error('Launcher failed:', err);
      launcher?.destroy();
      launcher = null;
    }
  }

  buildPresetGrid();
  syncUIFromParams();

  // ── 面板切换 ──
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
    try { localStorage.setItem('mapgen:theme', next); } catch { /* ignore */ }
  });

  // ── 选项卡切换 ──
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

  // ── 工具栏按钮 ──
  $('btn-random')?.addEventListener('click', () => {
    const seed = String(Math.floor(Math.random() * 99999));
    setParam('seedStr', seed);
    const seedInput = $<HTMLInputElement>('seedStr');
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

  // ── 种子 / 尺寸 ──
  $('seedStr')?.addEventListener('change', e => {
    setParam('seedStr', (e.target as HTMLInputElement).value);
  });

  const wInput = $<HTMLInputElement>('mapWidth');
  const hInput = $<HTMLInputElement>('mapHeight');
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

  // ── 滑块绑定 ──
  bindSliderEx('octaves', 'octaves', { toParam: raw => raw, toDisplay: raw => String(raw), autoGen: true });
  bindSliderEx('lacunarity', 'lacunarity', { toParam: raw => raw, toDisplay: raw => raw.toFixed(1), autoGen: true });
  bindSliderEx('persistence', 'persistence', { toParam: raw => raw, toDisplay: raw => raw.toFixed(2), autoGen: true });
  bindSliderEx('plateCount', 'plateCount', { toParam: raw => raw, toDisplay: raw => String(raw), autoGen: true });
  bindSliderEx('landmass', 'landmass', { toParam: raw => raw / 100, toDisplay: raw => raw + '%', autoGen: true });
  bindSliderEx('mountainFold', 'mountainFold', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2), autoGen: true });
  bindSliderEx('coastDetail', 'coastDetail', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2), autoGen: true });
  bindCheckbox('enableOceanCurrents', 'enableOceanCurrents', true);
  bindCheckbox('enableIceSheet', 'enableIceSheet', true);
  bindCheckbox('enableMonsoon', 'enableMonsoon', true);
  bindCheckbox('enableContinentality', 'enableContinentality', true);
  bindCheckbox('enableHadleyEnhancement', 'enableHadleyEnhancement', true);
  bindSliderEx('seaLevel', 'seaLevel', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2), autoGen: true });
  bindSliderEx('erosionStrength', 'erosionStrength', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(1), autoGen: true });
  bindSliderEx('erosionIterations', 'erosionIterations', { toParam: raw => raw, toDisplay: raw => String(raw), autoGen: true });
  bindSliderEx('lakeDensity', 'lakeDensity', { toParam: raw => raw / 1000, toDisplay: raw => (raw / 1000).toFixed(3), autoGen: true });
  bindSliderEx('tempOffset', 'tempOffset', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2), autoGen: true });
  bindSliderEx('snowLine', 'snowLine', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2), autoGen: true });
  bindSliderEx('rainStrength', 'rainStrength', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(1), autoGen: true });
  bindSliderEx('windDirX', 'windDirX', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(1), autoGen: true });
  bindSliderEx('windDirY', 'windDirY', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(1), autoGen: true });
  bindSliderEx('riverCount', 'riverCount', { toParam: raw => raw, toDisplay: raw => String(raw), autoGen: true });
  bindSelect('noiseType', 'noiseType', true);
  bindSelect('fbmType', 'fbmType', true);
  bindSelect('style', 'style');
  bindCheckbox('showBoundaries', 'showBoundaries');
  bindSliderEx('boundaryWidth', 'boundaryWidth', { toParam: raw => raw / 10, toDisplay: raw => (raw / 10).toFixed(1) });
  bindCheckbox('showRivers', 'showRivers');
  bindCheckbox('showContours', 'showContours');
  bindCheckbox('showTerrain', 'showTerrain');
  bindCheckbox('showSelection', 'showSelection');
  bindCheckbox('showClimate', 'showClimate');
  bindSliderEx('lightAngle', 'lightAngle', { toParam: raw => raw / 100, toDisplay: raw => (raw / 100).toFixed(2) });
  bindCheckbox('pointLightEnabled', 'pointLightEnabled');
  bindCheckbox('glowEnabled', 'glowEnabled');
  bindCheckbox('laserActive', 'laserActive');
  bindCheckbox('laserSelection', 'laserSelection');
  bindSliderEx('laserWidth', 'laserWidth', { toParam: raw => raw / 1000, toDisplay: raw => (raw / 1000).toFixed(3) });
  bindCheckbox('cursorActive', 'cursorActive');
  bindCheckbox('trailEnabled', 'trailEnabled');

  // ── 编辑器工具栏 ──
  document.querySelectorAll<HTMLButtonElement>('.et-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (!tool) return;
      document.querySelectorAll<HTMLButtonElement>('.et-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const brushCtrls = $('brush-ctrls');
      if (brushCtrls) brushCtrls.style.display = tool === 'brush' ? '' : 'none';
      editorController?.setMode(tool as EditorMode);
    });
  });
  const brushCtrlsEl = $('brush-ctrls');
  if (brushCtrlsEl) brushCtrlsEl.style.display = 'none';

  bindSliderEx('brushRadius', 'cursorSize', { toParam: raw => raw, toDisplay: raw => String(raw) });
  const brushRadiusEl = $<HTMLInputElement>('brushRadius');
  const brushStrengthEl = $<HTMLInputElement>('brushStrength');
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

  // ── 缩放 ──
  const updateZoom = () => {
    const zv = $('zoom-val');
    if (zv) zv.textContent = `${Math.round(state.zoom * 100)}%`;
    applyZoom();
    scheduleRender();
  };
  $('btn-zoom-in')?.addEventListener('click', () => { state.zoom = Math.min(4, state.zoom * 1.25); updateZoom(); });
  $('btn-zoom-out')?.addEventListener('click', () => { state.zoom = Math.max(0.25, state.zoom / 1.25); updateZoom(); });
  $('btn-zoom-reset')?.addEventListener('click', () => { state.zoom = 1; updateZoom(); });

  // ── 地图交互 ──
  mapInteraction = new MapInteraction(canvas);
  mapInteraction.bindEvents();

  const handleResize = () => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width || window.innerWidth, rect.height || window.innerHeight);
    render();
  };
  handleResize();
  window.addEventListener('resize', handleResize);

  // ── 快捷键 ──
  document.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;

    if (e.code === 'Space') {
      e.preventDefault();
      generateMap();
    } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      const seed = String(Math.floor(Math.random() * 99999));
      setParam('seedStr', seed);
      const seedInput = $<HTMLInputElement>('seedStr');
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
      if (e.shiftKey) editorController?.redo();
      else editorController?.undo();
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
  if (!launched) generateMap();
});
