import { generateLakes } from '../erosion.js';
import { generateRivers } from '../rivers.js';
import { classifyBiomes, type BiomeResult } from '../biomes.js';
import { computeWatershed, type WatershedResult } from '../watershed.js';
import { computeVolcanism, type VolcanismResult } from '../volcanism.js';
import { computeSeasonalVariation, type SeasonResult } from '../seasons.js';
import type { MapParams } from '../index.js';
import type { TectonicState } from './tectonicStage.js';
import type { ClimateState } from './climateStage.js';
import type { River, VolcanoSite, Hotspot } from '../index.js';
import { f32, u8, i32 } from './typedArrays.js';

export interface RiverState {
  lakes: Float32Array;
  rivers: River[];
  riverMask: Float32Array;
  riverWidth: Float32Array;
  riverDepth: Float32Array;
  biomeId: Uint8Array;
  biomeNormalized: Float32Array;
  basinId: Int32Array;
  isDivide: Uint8Array;
  streamOrder: Uint8Array;
  volcanoProb: Float32Array;
  calderaMask: Uint8Array;
  seasonTex: Float32Array;
  volcanoSites: VolcanoSite[];
  hotspots: Hotspot[];
  /** 完整生物群系结果（供 downstream 管线直接复用，避免重复计算） */
  biomes?: BiomeResult;
  /** 完整流域分析结果（含 flowDir / basinOutlets 等打包阶段不需要的字段） */
  watershed?: WatershedResult;
  /** 完整火山系统结果 */
  volcanism?: VolcanismResult;
  /** 完整季节变差结果（含四季分列 delta） */
  seasons?: SeasonResult;
}

export function runRiverStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams,
  tectonic: TectonicState,
  climate: ClimateState
): RiverState {
  const size = width * height;
  const isBlank = params.mode === 'blank';

  let lakes = f32(size);
  let rivers: River[] = [];
  let riverMask = f32(size);
  let riverWidth = f32(size);
  let riverDepth = f32(size);
  let biomeId = u8(size);
  let biomeNormalized = f32(size);
  let basinId = i32(size).fill(-1);
  let isDivide = u8(size);
  let streamOrder = u8(size);
  let volcanoProb = f32(size);
  let calderaMask = u8(size);
  let seasonTex = f32(size * 4);
  let volcanoSites: VolcanoSite[] = [];
  let hotspots: Hotspot[] = [];

  if (isBlank) {
    return {
      lakes,
      rivers,
      riverMask,
      riverWidth,
      riverDepth,
      biomeId,
      biomeNormalized,
      basinId,
      isDivide,
      streamOrder,
      volcanoProb,
      calderaMask,
      seasonTex,
      volcanoSites,
      hotspots,
    };
  }

  lakes = generateLakes(
    width,
    height,
    climate.elevation,
    params.seaLevel,
    params.lakeDensity,
    seed
  );
  const riverCount = params.riverCount ?? Math.floor(width * height * 0.0005);
  const riverResult = generateRivers(
    width,
    height,
    climate.elevation,
    climate.moisture,
    params.seaLevel,
    riverCount,
    seed
  );
  rivers = riverResult.rivers;
  riverMask = riverResult.riverMask;
  riverWidth = riverResult.riverWidth;
  riverDepth = riverResult.riverDepth;

  let biomesResult: BiomeResult | undefined;
  if (params.enableAdvancedBiomes !== false) {
    biomesResult = classifyBiomes({
      elevation: climate.elevation,
      temperature: climate.temperature,
      rainfall: climate.rainfall,
      moisture: climate.moisture,
      seaLevel: params.seaLevel,
      snowLine: params.snowLine,
      coastDist: climate.coastDist,
      riverMask,
      lakeMask: lakes,
      landIce: climate.landIce,
      seaIce: climate.seaIce,
    });
    biomeId = biomesResult.biomeId;
    biomeNormalized = biomesResult.biomeNormalized;
  }

  let watershedResult: WatershedResult | undefined;
  if (params.enableWatershed !== false) {
    watershedResult = computeWatershed({
      width,
      height,
      elevation: climate.elevation,
      seaLevel: params.seaLevel,
      riverMask,
      lakeMask: lakes,
      minBasinArea: 30,
    });
    basinId = watershedResult.basinId;
    isDivide = watershedResult.isDivide;
    streamOrder = watershedResult.streamOrder;
  }

  let volcanismResult: VolcanismResult | undefined;
  if (params.enableVolcanism !== false) {
    volcanismResult = computeVolcanism({
      width,
      height,
      elevation: climate.elevation,
      seaLevel: params.seaLevel,
      plateId: tectonic.plateId,
      plates: tectonic.plates,
      boundary: tectonic.boundary,
      boundaryType: tectonic.boundaryTypeArr,
      hotspotCount: 3,
      intensity: 1,
      seed,
    });
    volcanoProb = volcanismResult.volcanoProb;
    calderaMask = volcanismResult.calderaMask;
    volcanoSites = volcanismResult.volcanoSites;
    hotspots = volcanismResult.hotspots;
  }

  let seasonsResult: SeasonResult | undefined;
  if (params.enableSeasons !== false) {
    seasonsResult = computeSeasonalVariation({
      width,
      height,
      elevation: climate.elevation,
      seaLevel: params.seaLevel,
      temperature: climate.temperature,
      rainfall: climate.rainfall,
      coastDist: climate.coastDist,
    });
    seasonTex = seasonsResult.seasonTex;
  }

  return {
    lakes,
    rivers,
    riverMask,
    riverWidth,
    riverDepth,
    biomeId,
    biomeNormalized,
    basinId,
    isDivide,
    streamOrder,
    volcanoProb,
    calderaMask,
    seasonTex,
    volcanoSites,
    hotspots,
    biomes: biomesResult,
    watershed: watershedResult,
    volcanism: volcanismResult,
    seasons: seasonsResult,
  };
}
