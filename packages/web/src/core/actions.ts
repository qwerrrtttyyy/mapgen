import { bus } from './eventBus.js';
import { patchParams, state, toMapParams, type UIParams } from './appState.js';
import { mapGenWorker } from './mapGenWorker.js';

const phaseLabels: Record<string, string> = {
  tectonic: '板块构造',
  elevation: '高程生成',
  erosion: '侵蚀模拟',
  coastline: '海岸线',
  currents: '洋流',
  climate: '气候计算',
  ice: '冰盖',
  biomes: '生物群系',
  watershed: '流域分析',
  volcanism: '火山系统',
  seasons: '季节',
  lakes: '湖泊生成',
  rivers: '河流生成',
  regions: '区域分析',
  naming: '地名生成',
  packing: '纹理打包',
};

export function setParam<K extends keyof UIParams>(key: K, value: UIParams[K]): void {
  patchParams({ [key]: value } as Partial<UIParams>);
  bus.emit('params.changed', { key, value });
}

export function commitParams(): void {
  bus.emit('params.committed', state.params);
}

export function setProgress(fraction: number, phaseName: string): void {
  bus.emit('progress', { fraction, label: phaseLabels[phaseName] || phaseName });
}

export function selectPlate(id: number, add = false): void {
  if (add) {
    if (state.selectedPlates.has(id)) state.selectedPlates.delete(id);
    else state.selectedPlates.add(id);
  } else {
    state.selectedPlates.clear();
    state.selectedPlates.add(id);
  }
  bus.emit('selection.changed', { plates: Array.from(state.selectedPlates), regions: Array.from(state.selectedRegions) });
}

export function clearSelection(): void {
  state.selectedPlates.clear();
  state.selectedRegions.clear();
  bus.emit('selection.changed', { plates: [], regions: [] });
}

export function setHover(index: number): void {
  if (state.hoveredIndex === index) return;
  state.hoveredIndex = index;
  bus.emit('map.hover', index);
}

export function generate(): void {
  if (state.isGenerating) return;
  state.isGenerating = true;
  state.error = null;
  bus.emit('generating.started');

  const params = toMapParams(state.params);

  mapGenWorker.generate(params, (progress, phaseName) => {
    setProgress(progress, phaseName);
  }).then((result) => {
    state.mapData = result.mapData;
    state.checkpoints = result.checkpoints;
    bus.emit('generating.completed', result);
  }).catch((err: string) => {
    state.error = err;
    bus.emit('generating.failed', err);
  }).finally(() => {
    state.isGenerating = false;
  });
}
