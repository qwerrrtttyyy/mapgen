// 下游管线：climate → ice → lakes → rivers → regions 的统一编排。
// 消除 partialRegenerate 各分支的重复链（高内聚：管线的组装知识集中于此）。
// 含世界式增强 v2：coastDist + oceanCurrents + ice + biomes + watershed + volcanism + seasons，
// 可通过 options 开关控制。

import { computeClimate, type ClimateEnhanceOptions } from './regions.js';
import { generateLakes } from './erosion.js';
import { generateRivers, type River } from './rivers.js';
import { analyzeRegions, type Region } from './regions.js';
import { computeCoastDistance } from './coastline.js';
import { computeOceanCurrents, type OceanCurrentResult } from './oceanCurrents.js';
import { computeIceSheet, type IceResult } from './ice.js';
import { computeSlope } from './slope.js';
import { classifyBiomes, type BiomeResult } from './biomes.js';
import { computeWatershed, type WatershedResult } from './watershed.js';
import { computeVolcanism, type VolcanismResult } from './volcanism.js';
import { computeSeasonalVariation, type SeasonResult } from './seasons.js';
import type { MapData } from './index.js';
import type { Plate } from './tectonic.js';

export interface DownstreamInput {
  width: number;
  height: number;
  elevation: Float32Array;
  plateId: Float32Array;
  seaLevel: number;
  tempOffset: number;
  snowLine: number;
  windDirX: number;
  windDirY: number;
  rainStrength: number;
  lakeDensity: number;
  riverCount: number;
  seed: number;
  // ── 世界式生成开关（缺省全开）──
  enableOceanCurrents?: boolean;
  enableIceSheet?: boolean;
  enableMonsoon?: boolean;
  enableContinentality?: boolean;
  enableHadleyEnhancement?: boolean;
  /** v2 新增开关 */
  enableAdvancedBiomes?: boolean;
  enableWatershed?: boolean;
  enableVolcanism?: boolean;
  enableSeasons?: boolean;
  // ── 火山系统需要的板块/边界信息（可选）──
  plates?: Plate[];
  boundary?: Float32Array;
  boundaryType?: Float32Array;
}

export interface DownstreamResult {
  moisture: Float32Array;
  rainfall: Float32Array;
  temperature: Float32Array;
  tempZone: Float32Array;
  riverMask: Float32Array;
  riverWidth: Float32Array;
  riverDepth: Float32Array;
  lakes: Float32Array;
  rivers: River[];
  regions: Region[];
  // 世界式产物（开关关闭时为零数组）
  coastDist: Float32Array;
  currents: OceanCurrentResult;
  ice: IceResult;
  /** 冰川侵蚀后的高程（若 enableIceSheet 关闭则等于输入 elevation） */
  elevationAfter: Float32Array;
  /** 冰川侵蚀后的坡度（需重算） */
  slopeAfter: Float32Array;
  // ── v2 新增产物 ──
  /** Köppen-Geiger 生物群系分类（开关关闭时为空） */
  biomes?: BiomeResult;
  /** 流域分析（开关关闭时为空） */
  watershed?: WatershedResult;
  /** 火山系统（开关关闭时为空） */
  volcanism?: VolcanismResult;
  /** 季节性气候变差（开关关闭时为空） */
  seasons?: SeasonResult;
}

/**
 * 运行 coast → currents → climate → ice → biomes → lakes → rivers → watershed
 *      → regions → volcanism → seasons 完整下游链。
 * 所有 partialRegenerate 分支（elevation/erosion/climate/editor-elevation）共用此入口。
 * 冰川侵蚀会就地改写 elevationAfter（不影响输入 elevation）。
 */
export function runDownstreamPipeline(input: DownstreamInput): DownstreamResult {
  const { width, height, elevation, seaLevel } = input;
  const size = width * height;

  // 1. 海岸距离场
  const coastDist = computeCoastDistance(width, height, elevation, seaLevel);

  // 2. 洋流（开关默认开）
  const useCurrents = input.enableOceanCurrents !== false;
  const currents = useCurrents
    ? computeOceanCurrents({
        width, height, elevation, seaLevel,
        coastDist, windDirX: input.windDirX, windDirY: input.windDirY,
        rainStrength: input.rainStrength, seed: input.seed,
      })
    : {
        vx: new Float32Array(size), vy: new Float32Array(size),
        tempDelta: new Float32Array(size), speed: new Float32Array(size),
      };

  // 3. 气候（含世界式增强）
  const enhance: ClimateEnhanceOptions = {
    coastDist,
    currentTempDelta: currents.tempDelta,
    enableContinentality: input.enableContinentality !== false,
    enableOceanCurrents: input.enableOceanCurrents !== false,
    enableHadleyEnhancement: input.enableHadleyEnhancement !== false,
    enableMonsoon: input.enableMonsoon !== false,
  };
  const climate = computeClimate(
    width, height, elevation, seaLevel,
    input.tempOffset, input.snowLine, input.windDirX, input.windDirY, input.rainStrength,
    enhance,
  );

  // 4. 冰盖 + 冰川侵蚀（侵蚀改写 elevationAfter，不污染输入）
  const useIce = input.enableIceSheet !== false;
  let elevationAfter = elevation;
  let slopeAfter: Float32Array;
  let ice: IceResult;
  if (useIce) {
    // 复制 elevation 以免就地改写输入
    elevationAfter = new Float32Array(elevation);
    ice = computeIceSheet({
      width, height, elevation: elevationAfter, seaLevel,
      temperature: climate.temperature, snowLine: input.snowLine, seed: input.seed,
    });
    slopeAfter = computeSlope(width, height, elevationAfter);
  } else {
    ice = {
      landIce: new Float32Array(size), seaIce: new Float32Array(size),
      glacierVx: new Float32Array(size), glacierVy: new Float32Array(size),
    };
    slopeAfter = computeSlope(width, height, elevationAfter);
  }

  // 5. 湖泊 + 河流 + 区域（用侵蚀后高程）
  const lakes = generateLakes(width, height, elevationAfter, seaLevel, input.lakeDensity, input.seed);
  const riverResult = generateRivers(
    width, height, elevationAfter, climate.moisture, seaLevel, input.riverCount, input.seed,
  );
  const regions = analyzeRegions(
    width, height, elevationAfter, climate.moisture, climate.temperature,
    input.plateId, seaLevel, input.seed,
  );

  // ── v2 新增阶段 ──
  // 6. Köppen-Geiger 生物群系分类
  let biomes: BiomeResult | undefined;
  if (input.enableAdvancedBiomes !== false) {
    biomes = classifyBiomes({
      elevation: elevationAfter, temperature: climate.temperature,
      rainfall: climate.rainfall, moisture: climate.moisture,
      seaLevel, snowLine: input.snowLine,
      coastDist, riverMask: riverResult.riverMask, lakeMask: lakes,
      landIce: ice.landIce, seaIce: ice.seaIce,
    });
  }

  // 7. 流域分析
  let watershed: WatershedResult | undefined;
  if (input.enableWatershed !== false) {
    watershed = computeWatershed({
      width, height, elevation: elevationAfter, seaLevel,
      riverMask: riverResult.riverMask, lakeMask: lakes,
      minBasinArea: 30,
    });
  }

  // 8. 火山系统
  let volcanism: VolcanismResult | undefined;
  if (input.enableVolcanism !== false && input.plates && input.boundary) {
    volcanism = computeVolcanism({
      width, height, elevation: elevationAfter, seaLevel,
      plateId: input.plateId, plates: input.plates,
      boundary: input.boundary, boundaryType: input.boundaryType,
      hotspotCount: 3, intensity: 1, seed: input.seed,
    });
  }

  // 9. 季节性气候变差
  let seasons: SeasonResult | undefined;
  if (input.enableSeasons !== false) {
    seasons = computeSeasonalVariation({
      width, height, elevation: elevationAfter, seaLevel,
      temperature: climate.temperature, rainfall: climate.rainfall,
      coastDist,
    });
  }

  return {
    moisture: climate.moisture,
    rainfall: climate.rainfall,
    temperature: climate.temperature,
    tempZone: climate.tempZone,
    riverMask: riverResult.riverMask,
    riverWidth: riverResult.riverWidth,
    riverDepth: riverResult.riverDepth,
    lakes,
    rivers: riverResult.rivers,
    regions,
    coastDist,
    currents,
    ice,
    elevationAfter,
    slopeAfter,
    biomes,
    watershed,
    volcanism,
    seasons,
  };
}

/** 将下游结果写回 MapData 的河流/区域/海岸/洋流/冰盖字段（纹理打包由调用方用 texturePack 处理）。 */
export function applyDownstreamToMapData(md: MapData, result: DownstreamResult, seed: number): void {
  md.rivers = result.rivers;
  md.regions = result.regions;
  md.seed = seed;
  md.coastDist = result.coastDist;
}
