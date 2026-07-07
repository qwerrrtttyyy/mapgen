export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export {
  generatePlates,
  assignPlates,
  computeBoundaries,
  computeBoundaryTypes,
  type Plate,
  type BoundaryType,
} from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export {
  analyzeRegions,
  computeClimate,
  type Region,
  type ClimateData,
  type ClimateEnhanceOptions,
} from './regions.js';
export {
  generateNames,
  regenerateNames,
  type NameManifest,
  type NameablePlate,
  type NameableRegion,
  type NamedPlate,
  type NamedRegion,
  type PlateKind,
  type TerrainType,
} from './naming.js';
export {
  detectTerrainRegions,
  type DetectedRegion,
  type TerrainDetectOptions,
  CommandStack,
  type Command,
  applyBrushStroke,
  applyVectorMountain,
  applyVectorPolygon,
  movePlate,
  recomputePlateGeometry,
  type BrushTarget,
  type VectorTarget,
} from './editor.js';
export { computeSlope } from './slope.js';
export {
  classifyBiome,
  extractChannel,
  extractPlateId,
  packAllTextures,
  packClimateRiverTextures,
  packElevTex,
  packCurrentTex,
  packIceTex,
  packBiomeTex,
  packWatershedTex,
  packVolcanismTex,
  packSeasonTex,
  type TexturePackParams,
} from './texturePack.js';
export {
  runDownstreamPipeline,
  applyDownstreamToMapData,
  type DownstreamInput,
  type DownstreamResult,
} from './downstream.js';
export { computeCoastDistance, continentalityFactor } from './coastline.js';
export {
  computeOceanCurrents,
  type OceanCurrentInput,
  type OceanCurrentResult,
} from './oceanCurrents.js';
export { computeIceSheet, type IceInput, type IceResult } from './ice.js';
export {
  computeDetailPatch,
  detectDetailPeaks,
  type ViewportRegion,
  type DetailPatch,
  type DetailPeak,
} from './lazyGen.js';
export {
  classifyBiomes,
  biomeNormalize,
  getBiomeInfo,
  type BiomeId,
  type BiomeInfo,
  type BiomeClassifyInput,
  type BiomeResult,
  BIOME_INFO,
  BIOME_COUNT,
} from './biomes.js';
export { computeWatershed, type WatershedInput, type WatershedResult } from './watershed.js';
export {
  computeVolcanism,
  type VolcanismInput,
  type VolcanismResult,
  type VolcanoSite,
  type Hotspot,
} from './volcanism.js';
export {
  computeSeasonalVariation,
  decodeSeasonDelta,
  type Season,
  type SeasonInput,
  type SeasonResult,
} from './seasons.js';
export {
  debug,
  setupDebugGlobal,
  getDebug,
  type DebugState,
  type DebugMetrics,
  type DebugTiming,
} from './debug.js';
export {
  t,
  getPreferredLocale,
  createTranslator,
  translations,
  type Locale,
} from './i18n/index.js';
export { LRUCache, TerrainCache, terrainCacheKey, memoize, type CacheOptions } from './cache.js';
export type { MapParams, MapData, ProgressCallback } from './types.js';
export {
  runTectonicStage,
  runElevationStage,
  runClimateStage,
  runRiverStage,
  runRegionStage,
  runPackingStage,
} from './pipeline/index.js';
export type { TectonicState } from './pipeline/tectonicStage.js';
export type { ElevationState } from './pipeline/elevationStage.js';
export type { ClimateState } from './pipeline/climateStage.js';
export type { RiverState } from './pipeline/riverStage.js';
export type { RegionState } from './pipeline/regionStage.js';

import { hashSeed } from './noise.js';
import type { MapParams, MapData, ProgressCallback } from './types.js';
import {
  runTectonicStage,
  runElevationStage,
  runClimateStage,
  runRiverStage,
  runRegionStage,
  runPackingStage,
} from './pipeline/index.js';

const ASPECT_MAP: Record<string, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '2:1': 2,
  '3:2': 3 / 2,
};

export function generateMap(
  params: MapParams,
  onProgress?: ProgressCallback
): { mapData: MapData; checkpoints: Record<string, unknown> } {
  const seed = hashSeed(params.seedStr);
  let width: number, height: number;
  if (params.mapWidth && params.mapHeight) {
    width = params.mapWidth;
    height = params.mapHeight;
  } else {
    const aspect = ASPECT_MAP[params.mapAspect || '1:1'] || 1;
    width = params.mapSize || 512;
    height = Math.round(width / aspect);
  }

  const phases = [
    { name: 'tectonic', weight: 8 },
    { name: 'elevation', weight: 22 },
    { name: 'erosion', weight: 16 },
    { name: 'coastline', weight: 4 },
    { name: 'currents', weight: 5 },
    { name: 'climate', weight: 9 },
    { name: 'ice', weight: 6 },
    { name: 'biomes', weight: 3 },
    { name: 'watershed', weight: 4 },
    { name: 'volcanism', weight: 3 },
    { name: 'seasons', weight: 3 },
    { name: 'lakes', weight: 3 },
    { name: 'rivers', weight: 7 },
    { name: 'regions', weight: 4 },
    { name: 'naming', weight: 2 },
    { name: 'packing', weight: 1 },
  ];
  const totalWeight = phases.reduce((s, p) => s + p.weight, 0);
  let progress = 0;
  const phaseMap = new Map(phases.map(p => [p.name, p.weight / totalWeight]));

  function advance(phaseName: string) {
    const w = phaseMap.get(phaseName);
    if (w) progress += w;
    if (onProgress) onProgress(progress, phaseName);
  }

  advance('tectonic');
  const tectonic = runTectonicStage(width, height, seed, params);

  advance('elevation');
  const elevationState = runElevationStage(width, height, seed, params, tectonic);

  advance('coastline');
  advance('currents');
  advance('climate');
  advance('ice');
  const climate = runClimateStage(width, height, seed, params, tectonic, elevationState);

  advance('lakes');
  advance('rivers');
  advance('biomes');
  advance('watershed');
  advance('volcanism');
  advance('seasons');
  const riverState = runRiverStage(width, height, seed, params, tectonic, climate);

  advance('regions');
  advance('naming');
  const regionState = runRegionStage(width, height, seed, params, tectonic, climate, riverState);

  advance('packing');
  const mapData = runPackingStage(
    width,
    height,
    seed,
    params,
    tectonic,
    climate,
    riverState,
    regionState
  );

  const checkpoints: Record<string, unknown> = {
    tectonic: {
      plates: tectonic.plates,
      plateId: new Float32Array(tectonic.plateId),
      plateDist: new Float32Array(tectonic.plateDist),
      boundary: new Float32Array(tectonic.boundary),
    },
    elevation: {
      elevation: new Float32Array(elevationState.elevation),
      slope: new Float32Array(elevationState.slope),
      ridge: new Float32Array(elevationState.ridge),
      ridgeMask: new Float32Array(elevationState.ridgeMask),
    },
    erosion: {
      elevation: new Float32Array(climate.elevation),
    },
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
  };

  return { mapData, checkpoints };
}
