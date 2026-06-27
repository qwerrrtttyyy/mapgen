import type { MapData } from '@mapgen/core';
import { WebGLRenderer } from './renderer/webgl.js';
import { Canvas2DRenderer } from './renderer/canvas2d.js';
import type { RenderParams } from './renderer/renderParams.js';
import { RenderLoop } from './render/renderLoop.js';
import { CheckpointManager } from './checkpoint.js';
import { Launcher } from './launcher/launcher.js';
import { logger } from './core/logger.js';
import { state, patchParams, type UIParams } from './core/appState.js';
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

let renderer: WebGLRenderer | Canvas2DRenderer | null = null;
let checkpointMgr: CheckpointManager | null = null;
let renderLoop: RenderLoop | null = null;
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
  } else {
    renderer.render();
  }
}

function scheduleRender(): void {
  renderLoop?.requestRender();
}

function handleResize(): void {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
  if (!container || !canvas || !renderer) return;
  const rect = container.getBoundingClientRect();
  renderer.resize(Math.floor(rect.width), Math.floor(rect.height));
  render();
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
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!drawer) return;
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
    // 真正的 phase 局部重算尚未实现；当前退化为完整重算
    logger.debug('Phase regeneration requested:', phase);
    generateMapAction();
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
    const a = document.createElement('a');
    a.download = 'mapgen-' + Date.now() + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
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
    launcher?.setProgress(0.5, '编译着色器...');
    await r.initShaders(await res.text());
    renderer = r;
  } catch (e) {
    logger.warn('WebGL2 unavailable, using Canvas2D:', (e as Error).message);
    renderer = new Canvas2DRenderer(canvas);
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
    launcher.setProgress(0.2, '加载渲染器...');
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
