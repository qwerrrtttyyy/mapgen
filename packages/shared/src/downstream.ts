// 下游管线：climate → lakes → rivers → regions 的统一编排。
// 消除 partialRegenerate 各分支的重复链（高内聚：管线的组装知识集中于此）。

import { computeClimate } from './regions.js';
import { generateLakes } from './erosion.js';
import { generateRivers, type River } from './rivers.js';
import { analyzeRegions, type Region } from './regions.js';
import type { MapData } from './index.js';

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
}

/**
 * 运行气候→湖泊→河流→区域分析完整下游链。
 * 所有 partialRegenerate 分支（elevation/erosion/climate/editor-elevation）共用此入口。
 */
export function runDownstreamPipeline(input: DownstreamInput): DownstreamResult {
  const climate = computeClimate(
    input.width, input.height, input.elevation, input.seaLevel,
    input.tempOffset, input.snowLine, input.windDirX, input.windDirY, input.rainStrength,
  );
  const lakes = generateLakes(
    input.width, input.height, input.elevation, input.seaLevel, input.lakeDensity, input.seed,
  );
  const riverResult = generateRivers(
    input.width, input.height, input.elevation, climate.moisture,
    input.seaLevel, input.riverCount, input.seed,
  );
  const regions = analyzeRegions(
    input.width, input.height, input.elevation, climate.moisture, climate.temperature,
    input.plateId, input.seaLevel, input.seed,
  );
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
  };
}

/** 将下游结果写回 MapData 的河流/区域字段（纹理打包由调用方用 texturePack 处理）。 */
export function applyDownstreamToMapData(md: MapData, result: DownstreamResult, seed: number): void {
  md.rivers = result.rivers;
  md.regions = result.regions;
  md.seed = seed;
}
