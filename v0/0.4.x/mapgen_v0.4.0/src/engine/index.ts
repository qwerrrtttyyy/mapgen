// 地图生成引擎入口

import { MapData, GenerationParams, Plate, Region, River } from '@/types';
import { generatePlates, assignPlates, computeBoundaries } from './tectonic';
import { generateElevation, hydraulicErosion, generateLakes } from './erosion';
import { generateRivers } from './rivers';
import { analyzeRegions, computeClimate } from './regions';

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

export function generateMap(params: GenerationParams): MapData {
  const seed = hashSeed(params.seedStr);
  const aspectMap: Record<string, number> = { '1:1': 1, '4:3': 4/3, '16:9': 16/9, '2:1': 2, '3:2': 3/2 };
  const aspect = aspectMap[params.mapAspect] || 1;
  const width = params.mapSize;
  const height = Math.round(params.mapSize / aspect);

  // 1. 板块构造
  const plates = generatePlates(seed, params.plateCount, width, height, params.landmass);
  const { plateId, plateDist } = assignPlates(width, height, plates);
  const boundary = computeBoundaries(width, height, plateId);

  // 2. 高程生成
  let { elevation, slope, ridge, ridgeMask } = generateElevation(
    width, height, seed, plateId, plates, boundary,
    params.noiseType, params.fbmType, params.octaves,
    params.lacunarity, params.persistence, params.seaLevel,
    params.mountainFold, params.coastDetail
  );

  // 3. 水力侵蚀
  if (params.erosionIterations > 0 && params.erosionStrength > 0) {
    elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength);
  }

  // 4. 气候计算
  const { temperature, tempZone, moisture, rainfall } = computeClimate(
    width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine
  );

  // 5. 湖泊生成
  const lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);

  // 6. 河流生成
  const riverCount = Math.floor(width * height * 0.0005);
  const { rivers, riverMask, riverWidth, riverDepth } = generateRivers(
    width, height, elevation, moisture, params.seaLevel, riverCount, seed
  );

  // 7. 地形区分析
  const regions = analyzeRegions(width, height, elevation, moisture, temperature, plateId, params.seaLevel, seed);

  // 8. 打包纹理数据
  const size = width * height;
  const plateTex = new Float32Array(size * 4);
  const elevTex = new Float32Array(size * 4);
  const moistTex = new Float32Array(size * 4);
  const riverTex = new Float32Array(size * 4);
  const tempTex = new Float32Array(size * 4);

  // 预计算板块类型
  const plateTypeArr = new Uint8Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateTypeArr[i] = plates[i].type === 'continent' ? 1 : 0;
  }

  for (let i = 0; i < size; i++) {
    const pid = plateId[i];
    const i4 = i * 4;
    plateTex[i4 + 0] = pid / params.plateCount;
    plateTex[i4 + 1] = plateTypeArr[pid];
    plateTex[i4 + 2] = boundary[i];
    plateTex[i4 + 3] = plateDist[i];

    elevTex[i4 + 0] = elevation[i];
    elevTex[i4 + 1] = slope[i];
    elevTex[i4 + 2] = ridge[i];
    elevTex[i4 + 3] = ridgeMask[i];

    moistTex[i4 + 0] = moisture[i];
    moistTex[i4 + 1] = rainfall[i];
    moistTex[i4 + 2] = temperature[i];
    moistTex[i4 + 3] = tempZone[i] / 4;

    riverTex[i4 + 0] = riverMask[i];
    riverTex[i4 + 1] = riverWidth[i];
    riverTex[i4 + 2] = riverDepth[i];
    riverTex[i4 + 3] = lakes[i];

    // 生物群落
    const elev = elevation[i];
    const temp = temperature[i];
    const moist = moisture[i];
    let biome = 0;
    if (elev <= params.seaLevel) biome = 0;
    else if (temp < params.snowLine && elev > 0.6) biome = 1;
    else if (elev > 0.7) biome = 2;
    else if (moist < 0.2 && temp > 0.5) biome = 3;
    else if (moist > 0.7 && temp > 0.4) biome = 4;
    else if (moist > 0.5 && temp > 0.3) biome = 5;
    else if (temp < 0.2) biome = 6;
    else biome = 7;

    tempTex[i4 + 0] = temperature[i];
    tempTex[i4 + 1] = tempZone[i] / 4;
    tempTex[i4 + 2] = biome / 8;
    tempTex[i4 + 3] = 0;
  }

  return {
    width,
    height,
    plateTex,
    elevTex,
    moistTex,
    riverTex,
    tempTex,
    plates,
    regions,
    rivers,
    seed,
  };
}
