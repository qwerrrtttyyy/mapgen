import type { MapData } from '@mapgen/core';
import { hashSeed, generateElevation, hydraulicErosion, generateLakes, generateRivers, computeClimate, analyzeRegions } from '@mapgen/core';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import { P5Renderer } from './renderer/p5renderer.js';
import type { RenderParams } from './renderer/renderParams.js';
import { CheckpointManager } from './checkpoint.js';
import { Launcher } from './launcher/launcher.js';
import { logger } from './core/logger.js';
import { state, patchParams, toMapParams, type UIParams } from './core/appState.js';
import { bus } from './core/eventBus.js';
import { generate as generateMapAction, setParam, clearSelection } from './core/actions.js';
import { ParamPanel } from './ui/paramPanel.js';
import { ProgressView } from './ui/progressView.js';
import { Toolbar } from './ui/toolbar.js';
import { CheckpointPanel } from './ui/checkpointPanel.js';
import { Shortcuts } from './ui/shortcuts.js';
import { ContextMenu } from './ui/contextMenu.js';
import { MapInteraction } from './map/mapInteraction.js';

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

function buildRenderParams(): RenderParams {
  const rp: RenderParams = {};
  for (const [jsKey, uname] of Object.entries(RENDER_PARAM_MAP)) {
    const key = jsKey as keyof UIParams;
    const val = state.params[key];
    if (typeof val === 'number' || typeof val === 'boolean' || Array.isArray(val)) {
      (rp as Record<string, number | boolean | number[]>)[uname] = val;
    }
  }
  return rp;
}

function render(): void {
  if (!renderer) return;
  if (renderer instanceof WebGLRenderer) {
    renderer.render(buildRenderParams());
  } else if (renderer instanceof P5Renderer) {
    renderer.render();
  } else {
    renderer.render();
  }
}

function scheduleRender(): void {
  if (renderTimeout !== null) return;
  renderTimeout = window.requestAnimationFrame(() => {
    renderTimeout = null;
    render();
  });
}

function handleResize(): void {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!container || !canvas || !renderer) return;
  const rect = container.getBoundingClientRect();
  renderer.resize(Math.floor(rect.width), Math.floor(rect.height));
  render();
}

function partialRegenerate(phase: string): void {
  const md = state.mapData;
  if (!md) return;
  const { width, height, plates } = md;
  const params = state.params;
  const size = width * height;
  const seed = hashSeed(params.seedStr);

  // Extract raw arrays from packed textures
  const extractChannel = (tex: Float32Array, channel: number): Float32Array => {
    const arr = new Float32Array(size);
    for (let i = 0; i < size; i++) arr[i] = tex[i * 4 + channel];
    return arr;
  };

  let elevation = extractChannel(md.elevTex, 0);
  const slope = extractChannel(md.elevTex, 1);
  const ridge = extractChannel(md.elevTex, 2);
  const ridgeMask = extractChannel(md.elevTex, 3);
  let moisture = extractChannel(md.moistTex, 0);

  // Extract plateId from plateTex
  const plateCount = params.plateCount;
  const plateId = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    plateId[i] = Math.round(md.plateTex[i * 4] * plateCount);
  }

  if (phase === 'elevation') {
    // Re-generate elevation from existing plates
    const elevationResult = generateElevation(
      width, height, seed, plateId, plates,
      new Float32Array(size), // boundary - not stored, use zero
      params.noiseType, params.fbmType, params.octaves,
      params.lacunarity, params.persistence, params.seaLevel,
      params.mountainFold, params.coastDetail
    );
    elevation = elevationResult.elevation;
    // Fall through to erosion, climate, rivers — elevation regen requires all downstream
    if (params.erosionIterations > 0 && params.erosionStrength > 0) {
      elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength);
    }
    const climateResult = computeClimate(width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine);
    const lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);
    const riverCount = Math.floor(width * height * 0.0005);
    const riverResult = generateRivers(width, height, elevation, climateResult.moisture, params.seaLevel, riverCount, seed);
    const regions = analyzeRegions(width, height, elevation, climateResult.moisture, climateResult.temperature, plateId, params.seaLevel, seed);

    // Re-pack all textures
    repackAllTextures(md, elevation, elevationResult.slope, elevationResult.ridge, elevationResult.ridgeMask,
      climateResult.moisture, climateResult.rainfall, climateResult.temperature, climateResult.tempZone,
      riverResult.riverMask, riverResult.riverWidth, riverResult.riverDepth, lakes, plateId);
    md.rivers = riverResult.rivers;
    md.regions = regions;
    md.seed = seed;
  } else if (phase === 'erosion') {
    if (params.erosionIterations > 0 && params.erosionStrength > 0) {
      elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength);
    }
    // Re-pack elevTex
    for (let i = 0; i < size; i++) {
      const i4 = i * 4;
      md.elevTex[i4] = elevation[i];
      md.elevTex[i4 + 1] = slope[i];
      md.elevTex[i4 + 2] = ridge[i];
      md.elevTex[i4 + 3] = ridgeMask[i];
    }
    // Re-run downstream
    const climateResult = computeClimate(width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine);
    moisture = climateResult.moisture;
    const lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);
    const riverCount = Math.floor(width * height * 0.0005);
    const riverResult = generateRivers(width, height, elevation, moisture, params.seaLevel, riverCount, seed);
    const regions = analyzeRegions(width, height, elevation, moisture, climateResult.temperature, plateId, params.seaLevel, seed);
    repackMoistTempRiver(md, climateResult.moisture, climateResult.rainfall, climateResult.temperature, climateResult.tempZone,
      riverResult.riverMask, riverResult.riverWidth, riverResult.riverDepth, lakes);
    md.rivers = riverResult.rivers;
    md.regions = regions;
    md.seed = seed;
  } else if (phase === 'climate') {
    const climateResult = computeClimate(width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine);
    repackMoistTemp(md, climateResult.moisture, climateResult.rainfall, climateResult.temperature, climateResult.tempZone);
  } else if (phase === 'rivers') {
    const lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);
    const riverCount = Math.floor(width * height * 0.0005);
    const riverResult = generateRivers(width, height, elevation, moisture, params.seaLevel, riverCount, seed);
    const regions = analyzeRegions(width, height, elevation, moisture, extractChannel(md.moistTex, 2), plateId, params.seaLevel, seed);
    for (let i = 0; i < size; i++) {
      const i4 = i * 4;
      md.riverTex[i4] = riverResult.riverMask[i];
      md.riverTex[i4 + 1] = riverResult.riverWidth[i];
      md.riverTex[i4 + 2] = riverResult.riverDepth[i];
      md.riverTex[i4 + 3] = lakes[i];
    }
    md.rivers = riverResult.rivers;
    md.regions = regions;
    md.seed = seed;
  }

  bus.emit('generating.completed', { mapData: md });
}

function repackAllTextures(
  md: MapData, elevation: Float32Array, slope: Float32Array, ridge: Float32Array, ridgeMask: Float32Array,
  moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array,
  riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array,
  plateId: Float32Array
): void {
  const size = md.width * md.height;
  const invPlateCount = 1 / state.params.plateCount;
  const inv4 = 0.25;
  const inv13 = 1 / 15;
  const seaLevel = state.params.seaLevel;
  const snowLine = state.params.snowLine;

  function classifyBiome(elev: number, temp: number, moist: number): number {
    if (elev <= seaLevel) return 0;
    if (temp < snowLine && elev > 0.6) return 1;
    if (elev > 0.7) return 2;
    if (temp < -0.3) return 3;
    if (temp < 0.1) return moist > 0.3 ? 4 : 5;
    if (temp < 0.35) return moist > 0.5 ? 6 : 5;
    if (temp < 0.55) {
      if (moist > 0.7) return 7;
      if (moist > 0.5) return 8;
      if (moist > 0.3) return 9;
      return 10;
    }
    if (moist > 0.7) return 11;
    if (moist > 0.45) return 12;
    if (moist > 0.2) return 13;
    return 14;
  }

  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const elev = elevation[i];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * inv4;
    const pid = plateId[i] | 0;

    md.plateTex[i4 + 2] = 0; // boundary not regenerated
    md.plateTex[i4 + 3] = 0; // plateDist not regenerated
    md.elevTex[i4] = elev;
    md.elevTex[i4 + 1] = slope[i];
    md.elevTex[i4 + 2] = ridge[i];
    md.elevTex[i4 + 3] = ridgeMask[i];
    md.moistTex[i4] = moist;
    md.moistTex[i4 + 1] = rainfall[i];
    md.moistTex[i4 + 2] = temp;
    md.moistTex[i4 + 3] = tz;
    md.riverTex[i4] = riverMask[i];
    md.riverTex[i4 + 1] = riverWidth[i];
    md.riverTex[i4 + 2] = riverDepth[i];
    md.riverTex[i4 + 3] = lakes[i];
    md.tempTex[i4] = temp;
    md.tempTex[i4 + 1] = tz;
    md.tempTex[i4 + 2] = classifyBiome(elev, temp, moist) * inv13;
    md.tempTex[i4 + 3] = 0;
  }
}

function repackMoistTempRiver(
  md: MapData, moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array,
  riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array
): void {
  const size = md.width * md.height;
  const inv4 = 0.25;
  const inv13 = 1 / 15;
  const seaLevel = state.params.seaLevel;
  const snowLine = state.params.snowLine;

  function classifyBiome(elev: number, temp: number, moist: number): number {
    if (elev <= seaLevel) return 0;
    if (temp < snowLine && elev > 0.6) return 1;
    if (elev > 0.7) return 2;
    if (temp < -0.3) return 3;
    if (temp < 0.1) return moist > 0.3 ? 4 : 5;
    if (temp < 0.35) return moist > 0.5 ? 6 : 5;
    if (temp < 0.55) {
      if (moist > 0.7) return 7;
      if (moist > 0.5) return 8;
      if (moist > 0.3) return 9;
      return 10;
    }
    if (moist > 0.7) return 11;
    if (moist > 0.45) return 12;
    if (moist > 0.2) return 13;
    return 14;
  }

  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const elev = md.elevTex[i4];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * inv4;
    md.moistTex[i4] = moist;
    md.moistTex[i4 + 1] = rainfall[i];
    md.moistTex[i4 + 2] = temp;
    md.moistTex[i4 + 3] = tz;
    md.riverTex[i4] = riverMask[i];
    md.riverTex[i4 + 1] = riverWidth[i];
    md.riverTex[i4 + 2] = riverDepth[i];
    md.riverTex[i4 + 3] = lakes[i];
    md.tempTex[i4] = temp;
    md.tempTex[i4 + 1] = tz;
    md.tempTex[i4 + 2] = classifyBiome(elev, temp, moist) * inv13;
    md.tempTex[i4 + 3] = 0;
  }
}

function repackMoistTemp(
  md: MapData, moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array
): void {
  const size = md.width * md.height;
  const inv4 = 0.25;
  const inv13 = 1 / 15;
  const seaLevel = state.params.seaLevel;
  const snowLine = state.params.snowLine;

  function classifyBiome(elev: number, temp: number, moist: number): number {
    if (elev <= seaLevel) return 0;
    if (temp < snowLine && elev > 0.6) return 1;
    if (elev > 0.7) return 2;
    if (temp < -0.3) return 3;
    if (temp < 0.1) return moist > 0.3 ? 4 : 5;
    if (temp < 0.35) return moist > 0.5 ? 6 : 5;
    if (temp < 0.55) {
      if (moist > 0.7) return 7;
      if (moist > 0.5) return 8;
      if (moist > 0.3) return 9;
      return 10;
    }
    if (moist > 0.7) return 11;
    if (moist > 0.45) return 12;
    if (moist > 0.2) return 13;
    return 14;
  }

  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const elev = md.elevTex[i4];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * inv4;
    md.moistTex[i4] = moist;
    md.moistTex[i4 + 1] = rainfall[i];
    md.moistTex[i4 + 2] = temp;
    md.moistTex[i4 + 3] = tz;
    md.tempTex[i4] = temp;
    md.tempTex[i4 + 1] = tz;
    md.tempTex[i4 + 2] = classifyBiome(elev, temp, moist) * inv13;
    md.tempTex[i4 + 3] = 0;
  }
}

function bindMobileDrawer(): void {
  const menuToggle = document.getElementById('menu-toggle');
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  function toggleDrawer(open?: boolean) {
    if (!drawer || !backdrop) return;
    const shouldOpen = open !== undefined ? open : !drawer.classList.contains('open');
    drawer.classList.toggle('open', shouldOpen);
    backdrop.classList.toggle('open', shouldOpen);
  }

  menuToggle?.addEventListener('click', () => toggleDrawer());
  backdrop?.addEventListener('click', () => toggleDrawer(false));

  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    if (e.target && (e.target as HTMLElement).closest('canvas')) return;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!drawer) return;
    if (e.target && (e.target as HTMLElement).closest('canvas')) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0 && touchStartX < 50) toggleDrawer(true);
      else if (diffX < 0 && drawer.classList.contains('open')) toggleDrawer(false);
    }
  }, { passive: true });
}

function bindGlobalEvents(canvas: HTMLCanvasElement): void {
  bus.on('render.request', scheduleRender);
  bus.on('generate.request', () => generateMapAction());
  bus.on('generating.completed', ({ mapData }: { mapData: MapData }) => {
    renderer?.uploadMapData(mapData);
    mapInteraction?.setMapData(mapData);
    render();
    // 触发重新入场动画：用 reflow 重新启动 CSS keyframe
    canvas.classList.remove('map-fade-in');
    void canvas.offsetWidth;
    canvas.classList.add('map-fade-in');
    checkpointMgr && bus.emit('checkpoint.updated');
  });
  bus.on('selection.changed', ({ plates }: { plates: number[]; regions: number[] }) => {
    if (renderer instanceof WebGLRenderer) renderer.updateSelectMask(plates);
    // Canvas2D 无选择高亮，保持静默
    scheduleRender();
  });
  bus.on('trail.update', (data: { width: number; height: number; pixels: Uint8Array }) => {
    if (renderer instanceof WebGLRenderer) renderer.updateTrailTex(data);
    scheduleRender();
  });
  bus.on('regenerate.phase', (phase: string) => {
    partialRegenerate(phase);
  });
  bus.on('selection.clear', () => clearSelection());
  bus.on('randomSeed.request', () => {
    const seed = String(Math.floor(Math.random() * 99999));
    setParam('seedStr', seed);
    const el = document.getElementById('seedStr') as HTMLInputElement | null;
    if (el) el.value = seed;
    generateMapAction();
  });
  bus.on('export.request', () => {
    const c = document.getElementById('glCanvas') as HTMLCanvasElement | null;
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

  bus.on('checkpoint.save.request', async () => {
    if (!checkpointMgr || !state.mapData) return;
    const name = prompt('输入检查点名称:', '检查点 ' + new Date().toLocaleTimeString('zh-CN'));
    if (!name) return;
    await checkpointMgr.save(name, 'full', state.mapData, state.params);
    bus.emit('checkpoint.updated');
  });
  bus.on('checkpoint.restore.request', async (id: number) => {
    if (!checkpointMgr) return;
    const ckpt = await checkpointMgr.restore(id);
    if (!ckpt) return;
    const restored = checkpointMgr.restoreMapData(ckpt);
    if (!restored) {
      bus.emit('generating.failed', '检查点格式不兼容');
      return;
    }
    const params = ckpt.data.params as Record<string, unknown>;
    Object.entries(params).forEach(([key, value]) => {
      const k = key as keyof UIParams;
      patchParams({ [k]: value } as Partial<UIParams>);
      const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
      if (el) {
        if (el.type === 'checkbox') (el as HTMLInputElement).checked = Boolean(value);
        else if (el.type === 'color' && Array.isArray(value)) {
          const [r, g, b] = value as number[];
          const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
          el.value = '#' + toHex(r) + toHex(g) + toHex(b);
        } else el.value = String(value);
      }
    });
    state.mapData = restored;
    bus.emit('generating.completed', { mapData: restored });
  });
}

async function initRenderer(canvas: HTMLCanvasElement, launcher?: Launcher | null): Promise<void> {
  try {
    const r = new WebGLRenderer(canvas);
    const res = await fetch('shaders/fs-map.frag');
    if (!res.ok) throw new Error('Shader fetch failed');
    launcher?.setProgress(0.4, '编译着色器...');
    await r.initShaders(await res.text());
    renderer = r;
  } catch (e) {
    logger.warn('WebGL2 unavailable, trying p5.js:', (e as Error).message);
    try {
      const p5r = new P5Renderer(canvas);
      await p5r.init();
      renderer = p5r;
      logger.info('p5.js renderer initialized');
    } catch (e2) {
      logger.warn('p5.js unavailable, using Canvas2D:', (e2 as Error).message);
      renderer = new Canvas2DRenderer(canvas);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!canvas || !app) {
    logger.error('#app or #glCanvas not found');
    return;
  }

  const showLauncher = Launcher.shouldShow();
  let launcher: Launcher | null = null;
  let launchPromise: Promise<unknown> | null = null;

  if (showLauncher) {
    launcher = new Launcher(document.body, {
      title: 'Material Map Generator',
      version: 'v0.0.1 — Monorepo',
    });
    await launcher.show();
    launchPromise = launcher.waitForLaunch();
    launcher.setProgress(0.1, '加载渲染器...');
  } else {
    launchPromise = Promise.resolve();
  }

  await initRenderer(canvas, launcher);

  launcher?.setProgress(0.7, '加载检查点...');
  checkpointMgr = new CheckpointManager();
  await checkpointMgr.load();

  const paramPanel = new ParamPanel();
  paramPanel.applyDefaults();
  paramPanel.bind();

  new ProgressView().bind();
  new Toolbar().bind();
  new Shortcuts().bind();
  new ContextMenu().bind();
  const checkpointPanel = new CheckpointPanel();
  checkpointPanel.bind(checkpointMgr);

  bindMobileDrawer();
  bindGlobalEvents(canvas);

  handleResize();
  window.addEventListener('resize', handleResize);

  mapInteraction = new MapInteraction(canvas);

  launcher?.setProgress(0.9, '准备生成地图...');

  if (launcher) {
    app.classList.add('launcher-done');
    await launchPromise;
    await launcher.hide();
    launcher.destroy();
  } else {
    await launchPromise;
  }

  checkpointPanel.refresh();
  // 无论是否经过启动器，都需要首次生成地图
  bus.emit('render.request');
  generateMapAction();
});
