// 下游管线：climate → ice → lakes → rivers → regions 的统一编排。
// 现委托给 pipeline/*Stage（与 generateMap 共用同一套阶段实现），
// 消除原先与此重复的内联下游链。含世界式增强 v2 子系统，可通过 options 开关控制。

import type { MapParams } from './index.js';
import type { Plate } from './tectonic.js';
import { runClimateStage, type ClimateState } from './pipeline/climateStage.js';
import { runRegionStage, type RegionState } from './pipeline/regionStage.js';
import { runRiverStage, type RiverState } from './pipeline/riverStage.js';
import type { TectonicState } from './pipeline/tectonicStage.js';
import type { ElevationState } from './pipeline/elevationStage.js';
import type {
  OceanCurrentResult,
  IceResult,
  BiomeResult,
  WatershedResult,
  VolcanismResult,
  SeasonResult,
  Region,
  River,
  MapData,
} from './index.js';
import { f32 } from './pipeline/typedArrays.js';

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
  // ── 生成模式（下游管线需要读取以判断是否 blank 模式）──
  mode?: 'procedural' | 'blank';
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
 * 所有 partialRegenerate 分支（elevation/erosion/climate/editor-elevation）共用此入口，
 * 现已委托给 pipeline/*Stage，与 generateMap 共用同一实现，不再内联重复逻辑。
 * 冰川侵蚀会就地改写 elevationAfter（不影响输入 elevation）。
 */
export function runDownstreamPipeline(input: DownstreamInput): DownstreamResult {
  const { width, height, elevation, seed } = input;
  const size = width * height;

  // 由 DownstreamInput 重建 TectonicState / ElevationState。
  // 下游链只用到 plateId / plates / boundary / boundaryTypeArr，其余补零即可。
  const params = input as unknown as MapParams;
  const tectonic: TectonicState = {
    plates: input.plates ?? [],
    plateId: input.plateId,
    plateDist: f32(size),
    boundary: input.boundary ?? f32(size),
    tectonicForce: f32(size),
    boundaryTypeArr: input.boundaryType ?? f32(size),
  };
  const elevationState: ElevationState = {
    elevationPre: elevation,
    elevation,
    slope: f32(size),
    ridge: f32(size),
    ridgeMask: f32(size),
  };

  const climate: ClimateState = runClimateStage(width, height, seed, params, elevationState);
  const riverState: RiverState = runRiverStage(width, height, seed, params, tectonic, climate);
  const regionState: RegionState = runRegionStage(width, height, seed, params, tectonic, climate, riverState);

  // runClimateStage / runRiverStage 已包含全部世界式子系统（洋流、冰盖、生物群系、
  // 流域、火山、季节）。此处仅将结果组装为 DownstreamResult，
  // 并保留完整的 WatershedResult / SeasonResult 等 partial-regen 所需的富字段。
  return {
    moisture: climate.moisture,
    rainfall: climate.rainfall,
    temperature: climate.temperature,
    tempZone: climate.tempZone,
    riverMask: riverState.riverMask,
    riverWidth: riverState.riverWidth,
    riverDepth: riverState.riverDepth,
    lakes: riverState.lakes,
    rivers: riverState.rivers,
    regions: regionState.regions,
    coastDist: climate.coastDist,
    currents: {
      vx: climate.currentVx,
      vy: climate.currentVy,
      tempDelta: climate.currentTempDelta,
      speed: climate.currentSpeed,
    },
    ice: {
      landIce: climate.landIce,
      seaIce: climate.seaIce,
      glacierVx: climate.glacierVx,
      glacierVy: climate.glacierVy,
    },
    elevationAfter: climate.elevation,
    slopeAfter: climate.slope,
    biomes: riverState.biomes,
    watershed: riverState.watershed,
    volcanism: riverState.volcanism,
    seasons: riverState.seasons,
  };
}

/** 将下游结果写回 MapData 的河流/区域/海岸/洋流/冰盖字段（纹理打包由调用方用 texturePack 处理）。 */
export function applyDownstreamToMapData(
  md: MapData,
  result: DownstreamResult,
  seed: number
): void {
  md.rivers = result.rivers;
  md.regions = result.regions;
  md.seed = seed;
  md.coastDist = result.coastDist;
}
