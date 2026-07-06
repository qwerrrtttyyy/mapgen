export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate, type BoundaryType } from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export { analyzeRegions, computeClimate, type Region, type ClimateData, type ClimateEnhanceOptions } from './regions.js';
export { generateNames, regenerateNames, type NameManifest, type NameablePlate, type NameableRegion, type NamedPlate, type NamedRegion, type PlateKind, type TerrainType } from './naming.js';
export { detectTerrainRegions, type DetectedRegion, type TerrainDetectOptions, CommandStack, type Command, applyBrushStroke, applyVectorMountain, applyVectorPolygon, movePlate, recomputePlateGeometry, type BrushTarget, type VectorTarget } from './editor.js';
export { computeSlope } from './slope.js';
export { classifyBiome, extractChannel, extractPlateId, packAllTextures, packClimateRiverTextures, packElevTex, packCurrentTex, packIceTex, packBiomeTex, packWatershedTex, packVolcanismTex, packSeasonTex, type TexturePackParams } from './texturePack.js';
export { runDownstreamPipeline, applyDownstreamToMapData, type DownstreamInput, type DownstreamResult } from './downstream.js';
export { computeCoastDistance, continentalityFactor } from './coastline.js';
export { computeOceanCurrents, type OceanCurrentInput, type OceanCurrentResult } from './oceanCurrents.js';
export { computeIceSheet, type IceInput, type IceResult } from './ice.js';
export { computeDetailPatch, detectDetailPeaks, type ViewportRegion, type DetailPatch, type DetailPeak } from './lazyGen.js';
export { classifyBiomes, biomeNormalize, getBiomeInfo, type BiomeId, type BiomeInfo, type BiomeClassifyInput, type BiomeResult, BIOME_INFO, BIOME_COUNT } from './biomes.js';
export { computeWatershed, type WatershedInput, type WatershedResult } from './watershed.js';
export { computeVolcanism, type VolcanismInput, type VolcanismResult, type VolcanoSite, type Hotspot } from './volcanism.js';
export { computeSeasonalVariation, decodeSeasonDelta, type Season, type SeasonInput, type SeasonResult } from './seasons.js';
export { debug, setupDebugGlobal, getDebug, type DebugState, type DebugMetrics, type DebugTiming } from './debug.js';
export { t, getPreferredLocale, createTranslator, translations, type Locale } from './i18n/index.js';
export { LRUCache, TerrainCache, terrainCacheKey, memoize, type CacheOptions } from './cache.js';

import { hashSeed } from './noise.js';
import { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate } from './tectonic.js';
import { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
import { generateRivers, type River } from './rivers.js';
import { analyzeRegions, computeClimate, type Region } from './regions.js';
import { generateNames, type NameablePlate, type NameableRegion, type NameManifest } from './naming.js';
import { detectTerrainRegions } from './editor.js';
import { classifyBiome } from './texturePack.js';
import { computeCoastDistance } from './coastline.js';
import { computeOceanCurrents } from './oceanCurrents.js';
import { computeIceSheet } from './ice.js';
import { computeSlope } from './slope.js';
import { classifyBiomes, getBiomeInfo } from './biomes.js';
import { computeWatershed } from './watershed.js';
import { computeVolcanism, type VolcanoSite, type Hotspot } from './volcanism.js';
import { computeSeasonalVariation } from './seasons.js';
import type { NoiseType, FbmType } from './noise.js';
import {
  runTectonicStage,
  runElevationStage,
  runClimateStage,
  runRiverStage,
  runRegionStage,
  runPackingStage,
} from './pipeline/index.js';

const ASPECT_MAP: Record<string, number> = { '1:1': 1, '4:3': 4/3, '16:9': 16/9, '2:1': 2, '3:2': 3/2 };

export interface MapParams {
  seedStr: string;
  mapAspect?: string;
  mapSize?: number;
  mapWidth?: number;
  mapHeight?: number;
  plateCount: number;
  landmass: number;
  noiseType: NoiseType;
  fbmType: FbmType;
  octaves: number;
  lacunarity: number;
  persistence: number;
  seaLevel: number;
  mountainFold: number;
  coastDetail: number;
  erosionIterations: number;
  erosionStrength: number;
  lakeDensity: number;
  riverCount?: number;
  tempOffset: number;
  snowLine: number;
  rainStrength?: number;
  windDirX?: number;
  windDirY?: number;
  /** 生成模式：procedural=噪声+构造驱动；blank=空白海域待手绘（AC-10.1） */
  mode?: 'procedural' | 'blank';
  // ── 世界式生成开关（默认全开，可单独关闭）──
  /** 洋流系统（风驱动+Ekman+西边界强化，影响沿岸温度） */
  enableOceanCurrents?: boolean;
  /** 动态冰盖+冰川侵蚀（极地高海拔冰盖、U 型谷） */
  enableIceSheet?: boolean;
  /** 季风（热带沿海陆地增湿） */
  enableMonsoon?: boolean;
  /** 大陆度修正（内陆偏冷） */
  enableContinentality?: boolean;
  /** Hadley cell 强化（ITCZ 增湿 + 副热带高压沙漠带） */
  enableHadleyEnhancement?: boolean;
  // ── v2 复杂度增强开关 ──
  /** Köppen-Geiger 32 类生物群系分类（替换简单 15 类） */
  enableAdvancedBiomes?: boolean;
  /** 流域分析（排水盆地、Strahler 河序、大陆分水岭） */
  enableWatershed?: boolean;
  /** 热点火山系统（火山链、火山弧、概率场、破火山口） */
  enableVolcanism?: boolean;
  /** 季节性气候变差（4 季温度/降水 delta） */
  enableSeasons?: boolean;
}

export interface MapData {
  width: number;
  height: number;
  plateTex: Float32Array;
  elevTex: Float32Array;
  moistTex: Float32Array;
  riverTex: Float32Array;
  tempTex: Float32Array;
  /** 洋流纹理 RGBA: R=vx G=vy B=tempDelta(暖+/寒-) A=speed */
  currentTex?: Float32Array;
  /** 冰盖纹理 RGBA: R=landIce G=seaIce B=glacierVx A=glacierVy */
  iceTex?: Float32Array;
  /** 海岸距离场（陆地正、海洋负），不入纹理，供气候/地形区使用 */
  coastDist?: Float32Array;
  /** 生物群系纹理 RGBA: R=biomeId/31 G=isLand B=koppenBand A=streamOrder/7 */
  biomeTex?: Float32Array;
  /** 流域纹理 RGBA: R=basinId/65535 G=isDivide B=streamOrder/7 A=flowDir/255 */
  watershedTex?: Float32Array;
  /** 火山纹理 RGBA: R=volcanoProb G=calderaMask B=hotspotStrength A=volcanoSite */
  volcanismTex?: Float32Array;
  /** 季节纹理 RGBA: R=夏温度delta G=冬温度delta B=夏降水delta A=冬降水delta */
  seasonTex?: Float32Array;
  /** 火山位置列表（用于命名/可视化） */
  volcanoSites?: VolcanoSite[];
  /** 热点列表 */
  hotspots?: Hotspot[];
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  seed: number;
}

export type ProgressCallback = (progress: number, phaseName: string) => void;

export function generateMap(params: MapParams, onProgress?: ProgressCallback): { mapData: MapData; checkpoints: Record<string, unknown> } {
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
  const elevation = runElevationStage(width, height, seed, params, tectonic);

  advance('erosion');
  advance('coastline');
  advance('currents');
  advance('climate');
  advance('ice');
  const climate = runClimateStage(width, height, seed, params, tectonic, elevation);

  advance('biomes');
  advance('watershed');
  advance('volcanism');
  advance('seasons');
  advance('lakes');
  advance('rivers');
  const riverState = runRiverStage(width, height, seed, params, tectonic, climate);

  advance('regions');
  advance('naming');
  const regionState = runRegionStage(width, height, seed, params, tectonic, climate, riverState);

  advance('packing');
  const mapData = runPackingStage(width, height, seed, params, tectonic, climate, riverState, regionState);

  return {
    mapData,
    checkpoints: {
      tectonic: {
        plates: tectonic.plates,
        plateId: new Float32Array(tectonic.plateId),
        plateDist: new Float32Array(tectonic.plateDist),
        boundary: new Float32Array(tectonic.boundary),
      },
      elevation: {
        elevation: new Float32Array(climate.elevation),
        slope: new Float32Array(climate.slope),
        ridge: new Float32Array(elevation.ridge),
        ridgeMask: new Float32Array(elevation.ridgeMask),
      },
      erosion: { elevation: new Float32Array(climate.elevation) },
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
