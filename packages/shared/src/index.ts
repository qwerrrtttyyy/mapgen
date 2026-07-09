// ── Re-exports (保持向后兼容) ────────────────────────────────────────────────
export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export {
  generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes,
  type Plate, type BoundaryType,
} from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export {
  analyzeRegions, computeClimate, type Region, type ClimateData, type ClimateEnhanceOptions,
} from './regions.js';
export {
  generateNames, regenerateNames, type NameManifest, type NameablePlate, type NameableRegion,
  type NamedPlate, type NamedRegion, type PlateKind, type TerrainType,
} from './naming.js';
export {
  detectTerrainRegions, type DetectedRegion, type TerrainDetectOptions,
  CommandStack, type Command, applyBrushStroke, applyVectorMountain, applyVectorPolygon,
  movePlate, recomputePlateGeometry, type BrushTarget, type VectorTarget,
  applySmoothBrush,
  applyNoiseBrush,
  applySetElevationBrush,
  applyRiverDraw,
  applyLakeDraw,
  type FalloffMode,
  type BrushShape,
  type NoiseBrushParams,
} from './editor.js';
export { computeSlope } from './slope.js';
export {
  classifyBiome, extractChannel, extractPlateId, packAllTextures, packClimateRiverTextures,
  packElevTex, packCurrentTex, packIceTex, packBiomeTex, packWatershedTex,
  packVolcanismTex, packSeasonTex, type TexturePackParams,
} from './texturePack.js';
export {
  runDownstreamPipeline, applyDownstreamToMapData, type DownstreamInput, type DownstreamResult,
} from './downstream.js';
export { computeCoastDistance, continentalityFactor } from './coastline.js';
export { computeOceanCurrents, type OceanCurrentInput, type OceanCurrentResult } from './oceanCurrents.js';
export { computeIceSheet, type IceInput, type IceResult } from './ice.js';
export {
  computeDetailPatch, detectDetailPeaks, type ViewportRegion, type DetailPatch, type DetailPeak,
} from './lazyGen.js';
export {
  classifyBiomes, biomeNormalize, getBiomeInfo, type BiomeId, type BiomeInfo,
  type BiomeClassifyInput, type BiomeResult, BIOME_INFO, BIOME_COUNT,
} from './biomes.js';
export { computeWatershed, type WatershedInput, type WatershedResult } from './watershed.js';
export {
  computeVolcanism, type VolcanismInput, type VolcanismResult, type VolcanoSite, type Hotspot,
} from './volcanism.js';
export {
  computeSeasonalVariation, decodeSeasonDelta, type Season, type SeasonInput, type SeasonResult,
} from './seasons.js';
export { debug, setupDebugGlobal, getDebug, type DebugState, type DebugMetrics, type DebugTiming } from './debug.js';
export { t, getPreferredLocale, createTranslator, translations, type Locale } from './i18n/index.js';
export { LRUCache, TerrainCache, terrainCacheKey, memoize, type CacheOptions } from './cache.js';

// ── Pipeline stages (新增导出) ───────────────────────────────────────────────
export {
  runTectonicStage, type TectonicState,
  runElevationStage, type ElevationState,
  runClimateStage, type ClimateState,
  runRiverStage, type RiverState,
  runRegionStage, type RegionState,
  runPackingStage,
} from './pipeline/index.js';

// ── 类型统一：从 types.ts 导出（单一来源） ──────────────────────────────────
export type { MapParams, MapData, ProgressCallback } from './types.js';

// ── Event Service & Plugin System ─────────────────────────────────────────
export {
  initEventService,
  registerPlugin,
  unregisterPlugin,
  getEventServiceStatus,
  emitGenerateBefore,
  emitGenerateAfter,
  emitStageBefore,
  emitStageAfter,
  emitPipelineError,
  type GenerateContext,
  type StageContext,
} from './eventService.js';
export {
  pluginRegistry,
  type Plugin,
  type PluginEventName,
  type PluginRegistry,
} from './plugin.js';

// ── 内部导入 ────────────────────────────────────────────────────────────────
import { hashSeed } from './noise.js';
import type { MapParams, MapData, ProgressCallback } from './types.js';
import { runTectonicStage } from './pipeline/tectonicStage.js';
import { runElevationStage } from './pipeline/elevationStage.js';
import { runClimateStage } from './pipeline/climateStage.js';
import { runRiverStage } from './pipeline/riverStage.js';
import { runRegionStage } from './pipeline/regionStage.js';
import { runPackingStage } from './pipeline/packingStage.js';
import {
  initEventService,
  emitGenerateBefore,
  emitGenerateAfter,
  emitStageBefore,
  emitStageAfter,
  emitPipelineError,
} from './eventService.js';

const ASPECT_MAP: Record<string, number> = {
  '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '2:1': 2, '3:2': 3 / 2,
};

const PHASE_WEIGHTS: Record<string, number> = {
  tectonic: 8, elevation: 22, erosion: 16, coastline: 4, currents: 5,
  climate: 9, ice: 6, biomes: 3, watershed: 4, volcanism: 3, seasons: 3,
  lakes: 3, rivers: 7, regions: 4, naming: 2, packing: 1,
};
const TOTAL_WEIGHT = Object.values(PHASE_WEIGHTS).reduce((s, w) => s + w, 0);

function resolveDimensions(params: MapParams): { width: number; height: number } {
  if (params.mapWidth && params.mapHeight) {
    return { width: params.mapWidth, height: params.mapHeight };
  }
  const aspect = ASPECT_MAP[params.mapAspect || '1:1'] || 1;
  const width = params.mapSize || 512;
  const height = Math.round(width / aspect);
  return { width, height };
}

/** 地图生成入口（委托 pipeline stages，支持事件钩子） */
export function generateMap(
  params: MapParams,
  onProgress?: ProgressCallback
): { mapData: MapData; checkpoints: Record<string, unknown> } {
  // 初始化事件服务（幂等）
  initEventService();

  // 参数校验钩子（同步 transform 链）
  const validatedParams = runParamValidation(params);

  const seed = hashSeed(validatedParams.seedStr);
  const { width, height } = resolveDimensions(validatedParams);

  let progress = 0;
  function advance(phaseName: string): void {
    const w = PHASE_WEIGHTS[phaseName];
    if (w) progress += w / TOTAL_WEIGHT;
    if (onProgress) onProgress(progress, phaseName);
  }

  // 触发 generate:before（同步快路径，异步钩子不阻塞）
  const genCtx = { params: validatedParams, width, height, seed };
  runAsyncHookSafe('onGenerateBefore', genCtx);

  // 1. 板块构造
  advance('tectonic');
  runStageHookSafe('onStageBefore', 'tectonic', validatedParams);
  const tectonic = runTectonicStage(width, height, seed, validatedParams);
  runStageHookSafe('onStageAfter', 'tectonic', validatedParams, tectonic);
  const checkpointTectonic = {
    plates: tectonic.plates,
    plateId: new Float32Array(tectonic.plateId),
    plateDist: new Float32Array(tectonic.plateDist),
    boundary: new Float32Array(tectonic.boundary),
  };

  // 2. 高程生成
  advance('elevation');
  runStageHookSafe('onStageBefore', 'elevation', validatedParams);
  let elevState;
  try {
    elevState = runElevationStage(width, height, seed, validatedParams, tectonic);
  } catch (err) {
    runPipelineErrorSafe('elevation', validatedParams, err as Error);
    throw err;
  }
  runStageHookSafe('onStageAfter', 'elevation', validatedParams, elevState);
  const checkpointElevation = {
    elevation: new Float32Array(elevState.elevation),
    slope: new Float32Array(elevState.slope),
    ridge: new Float32Array(elevState.ridge),
    ridgeMask: new Float32Array(elevState.ridgeMask),
  };

  // 侵蚀 checkpoint
  advance('erosion');
  const checkpointErosion = { elevation: new Float32Array(elevState.elevation) };

  // 3. 气候（含海岸线、洋流、冰盖）
  advance('coastline');
  advance('currents');
  advance('climate');
  advance('ice');
  runStageHookSafe('onStageBefore', 'climate', validatedParams);
  let climate;
  try {
    climate = runClimateStage(width, height, seed, validatedParams, tectonic, elevState);
  } catch (err) {
    runPipelineErrorSafe('climate', validatedParams, err as Error);
    throw err;
  }
  runStageHookSafe('onStageAfter', 'climate', validatedParams, climate);

  // 4. 河流（含湖泊、生物群系、流域、火山、季节）
  advance('biomes');
  advance('watershed');
  advance('volcanism');
  advance('seasons');
  advance('lakes');
  advance('rivers');
  runStageHookSafe('onStageBefore', 'rivers', validatedParams);
  let riverState;
  try {
    riverState = runRiverStage(width, height, seed, validatedParams, tectonic, climate);
  } catch (err) {
    runPipelineErrorSafe('rivers', validatedParams, err as Error);
    throw err;
  }
  runStageHookSafe('onStageAfter', 'rivers', validatedParams, riverState);

  // 5. 区域分析 + 命名
  advance('regions');
  advance('naming');
  runStageHookSafe('onStageBefore', 'regions', validatedParams);
  let regionState;
  try {
    regionState = runRegionStage(width, height, seed, validatedParams, tectonic, climate, riverState);
  } catch (err) {
    runPipelineErrorSafe('regions', validatedParams, err as Error);
    throw err;
  }
  runStageHookSafe('onStageAfter', 'regions', validatedParams, regionState);

  // 6. 纹理打包
  advance('packing');
  runStageHookSafe('onStageBefore', 'packing', validatedParams);
  let mapData;
  try {
    mapData = runPackingStage(width, height, seed, validatedParams, tectonic, climate, riverState, regionState);
  } catch (err) {
    runPipelineErrorSafe('packing', validatedParams, err as Error);
    throw err;
  }
  runStageHookSafe('onStageAfter', 'packing', validatedParams, mapData);

  // 最终 MapData 变换钩子（同步 transform 链）
  mapData = runMapDataTransform(mapData);

  // 触发 generate:after
  genCtx.mapData = mapData;
  runAsyncHookSafe('onGenerateAfter', genCtx);

  return {
    mapData,
    checkpoints: {
      tectonic: checkpointTectonic,
      elevation: checkpointElevation,
      erosion: checkpointErosion,
      climate: {
        temperature: new Float32Array(climate.temperature),
        tempZone: new Float32Array(climate.tempZone),
        moisture: new Float32Array(climate.moisture),
        rainfall: new Float32Array(climate.rainfall),
      },
      rivers: {
        rivers: riverState.rivers,
        riverMask: new Float32Array(riverState.riverMask),
        riverWidth: new Float32Array(riverState.riverWidth),
        riverDepth: new Float32Array(riverState.riverDepth),
        lakes: new Float32Array(riverState.lakes),
      },
    },
  };
}

// ── Internal hook helpers ──────────────────────────────────────────────────

function runParamValidation(params: MapParams): MapParams {
  // 纯同步 transform 链，不调用 async 钩子
  const { pluginRegistry } = require('./plugin.js') as typeof import('./plugin.js');
  let current = params;
  for (const plugin of pluginRegistry.getAll()) {
    if (typeof plugin.onParamsValidate === 'function') {
      try {
        const result = plugin.onParamsValidate(current);
        if (result !== undefined && result !== null) {
          current = result;
        }
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" params validation error:`, err);
      }
    }
  }
  return current;
}

function runMapDataTransform(mapData: MapData): MapData {
  const { pluginRegistry } = require('./plugin.js') as typeof import('./plugin.js');
  let current = mapData;
  for (const plugin of pluginRegistry.getAll()) {
    if (typeof plugin.onMapDataTransform === 'function') {
      try {
        const result = plugin.onMapDataTransform(current);
        if (result !== undefined && result !== null) {
          current = result;
        }
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" mapData transform error:`, err);
      }
    }
  }
  return current;
}

function runStageHookSafe(
  hook: 'onStageBefore' | 'onStageAfter',
  stageName: string,
  params: MapParams,
  stageState?: unknown
): void {
  const { pluginRegistry } = require('./plugin.js') as typeof import('./plugin.js');
  const ctx = { stageName, params, state: stageState };
  for (const plugin of pluginRegistry.getAll()) {
    const handler = plugin[hook];
    if (typeof handler === 'function') {
      try {
        handler.call(plugin, ctx);
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" ${hook} error:`, err);
      }
    }
  }
}

function runPipelineErrorSafe(stageName: string, params: MapParams, error: Error): void {
  const { pluginRegistry } = require('./plugin.js') as typeof import('./plugin.js');
  const ctx = { stageName, params, error };
  for (const plugin of pluginRegistry.getAll()) {
    if (typeof plugin.onPipelineError === 'function') {
      try {
        plugin.onPipelineError.call(plugin, ctx);
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" onPipelineError error:`, err);
      }
    }
  }
}

function runAsyncHookSafe(hook: 'onGenerateBefore' | 'onGenerateAfter', ctx: unknown): void {
  // 异步钩子 fire-and-forget，不阻塞 pipeline
  const { pluginRegistry } = require('./plugin.js') as typeof import('./plugin.js');
  for (const plugin of pluginRegistry.getAll()) {
    const handler = plugin[hook];
    if (typeof handler === 'function') {
      try {
        const result = handler.call(plugin, ctx);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(err => {
            console.error(`[EventService] Plugin "${plugin.name}" async ${hook} error:`, err);
          });
        }
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" ${hook} error:`, err);
      }
    }
  }
}
