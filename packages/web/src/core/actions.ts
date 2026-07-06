import { bus } from './eventBus.js';
import { patchParams, state, toMapParams, type UIParams } from './appState.js';
import { getEngineProvider } from '../engine/factory.js';
import { deserializeMapData } from '@mapgen/shared-types';
import type { MapData } from '@mapgen/core';

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
  const provider = getEngineProvider();
  const controller = new AbortController();

  provider.generate(
    params,
    (progress) => {
      setProgress(progress.fraction, progress.phase);
    },
    controller.signal
  ).then((result) => {
    if (!result.ok) {
      state.error = result.error.message;
      bus.emit('generating.failed', result.error.message);
      return;
    }
    const mapData = deserializeMapData(result.value.mapData) as MapData;
    state.mapData = mapData;
    state.checkpoints = result.value.checkpoints ?? null;
    bus.emit('generating.completed', { mapData });
  }).catch((err: Error) => {
    state.error = err.message;
    bus.emit('generating.failed', err.message);
  }).finally(() => {
    state.isGenerating = false;
  });
}
