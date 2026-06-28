export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate, type BoundaryType } from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export { analyzeRegions, computeClimate, type Region, type ClimateData } from './regions.js';
export { generateNames, type NameManifest, type NameablePlate, type NameableRegion, type NamedPlate, type NamedRegion, type PlateKind, type TerrainType } from './naming.js';
export { detectTerrainRegions, type DetectedRegion, CommandStack, type Command, applyBrushStroke, applyVectorMountain, applyVectorPolygon, movePlate, recomputePlateGeometry, type BrushTarget, type VectorTarget } from './editor.js';

import { hashSeed } from './noise.js';
import { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate } from './tectonic.js';
import { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
import { generateRivers, type River } from './rivers.js';
import { analyzeRegions, computeClimate, type Region } from './regions.js';
import { generateNames, type NameablePlate, type NameableRegion, type NameManifest } from './naming.js';
import { detectTerrainRegions } from './editor.js';
import type { NoiseType, FbmType } from './noise.js';

const ASPECT_MAP: Record<string, number> = { '1:1': 1, '4:3': 4/3, '16:9': 16/9, '2:1': 2, '3:2': 3/2 };

export interface MapParams {
  seedStr: string;
  mapAspect: string;
  mapSize: number;
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
}

export interface MapData {
  width: number;
  height: number;
  plateTex: Float32Array;
  elevTex: Float32Array;
  moistTex: Float32Array;
  riverTex: Float32Array;
  tempTex: Float32Array;
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  seed: number;
}

export type ProgressCallback = (progress: number, phaseName: string) => void;

export function generateMap(params: MapParams, onProgress?: ProgressCallback): { mapData: MapData; checkpoints: Record<string, unknown> } {
  const seed = hashSeed(params.seedStr);
  const aspect = ASPECT_MAP[params.mapAspect] || 1;
  const width = params.mapSize;
  const height = Math.round(params.mapSize / aspect);

  const phases = [
    { name: 'tectonic', weight: 10 },
    { name: 'elevation', weight: 30 },
    { name: 'erosion', weight: 25 },
    { name: 'climate', weight: 10 },
    { name: 'lakes', weight: 5 },
    { name: 'rivers', weight: 10 },
    { name: 'regions', weight: 5 },
    { name: 'naming', weight: 3 },
    { name: 'packing', weight: 2 },
  ];
  const totalWeight = phases.reduce((s, p) => s + p.weight, 0);
  let progress = 0;
  const phaseMap = new Map(phases.map(p => [p.name, p.weight / totalWeight]));

  function advance(phaseName: string) {
    const w = phaseMap.get(phaseName);
    if (w) progress += w;
    if (onProgress) onProgress(progress, phaseName);
  }

  const size0 = width * height;
  const isBlank = params.mode === 'blank';

  let plates: Plate[];
  let plateId: Float32Array;
  let plateDist: Float32Array;
  let boundary: Float32Array;
  let tectonicForce: Float32Array;
  let elevation: Float32Array;
  let slope: Float32Array;
  let ridge: Float32Array;
  let ridgeMask: Float32Array;
  let checkpointTectonic: { plates: Plate[]; plateId: Float32Array; plateDist: Float32Array; boundary: Float32Array };
  let checkpointElevation: { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array };
  let checkpointErosion: { elevation: Float32Array };

  if (isBlank) {
    // 空白模式：全海域，N 个海洋板块，平坦海底，等待手绘（AC-10.1）
    advance('tectonic');
    plates = generatePlates(seed, params.plateCount, width, height, 0).map(p => ({ ...p, type: 'ocean' as const }));
    const assigned = assignPlates(width, height, plates);
    plateId = assigned.plateId;
    plateDist = assigned.plateDist;
    boundary = computeBoundaries(width, height, plateId);
    const bt = computeBoundaryTypes(width, height, plateId, plates);
    tectonicForce = new Float32Array(size0); // 无构造力 → 无山脉
    for (let i = 0; i < boundary.length; i++) {
      if (boundary[i] > 0) boundary[i] = Math.min(1, 0.5 + bt.boundaryIntensity[i] * 0.3);
    }
    checkpointTectonic = { plates, plateId: new Float32Array(plateId), plateDist: new Float32Array(plateDist), boundary: new Float32Array(boundary) };

    advance('elevation');
    elevation = new Float32Array(size0).fill(params.seaLevel - 0.3);
    slope = new Float32Array(size0);
    ridge = new Float32Array(size0);
    ridgeMask = new Float32Array(size0);
    checkpointElevation = { elevation: new Float32Array(elevation), slope: new Float32Array(slope), ridge: new Float32Array(ridge), ridgeMask: new Float32Array(ridgeMask) };

    advance('erosion');
    checkpointErosion = { elevation: new Float32Array(elevation) };
  } else {
    advance('tectonic');
    plates = generatePlates(seed, params.plateCount, width, height, params.landmass);
    const assigned = assignPlates(width, height, plates);
    plateId = assigned.plateId;
    plateDist = assigned.plateDist;
    boundary = computeBoundaries(width, height, plateId);
    const { boundaryType, boundaryIntensity } = computeBoundaryTypes(width, height, plateId, plates);
    tectonicForce = new Float32Array(size0);
    for (let i = 0; i < size0; i++) {
      if (boundary[i] === 0) continue;
      if (boundaryType[i] === 1) tectonicForce[i] = boundaryIntensity[i];
      else if (boundaryType[i] === 2) tectonicForce[i] = -boundaryIntensity[i];
      else if (boundaryType[i] === 3) tectonicForce[i] = boundaryIntensity[i] * 0.3;
    }
    for (let i = 0; i < boundary.length; i++) {
      if (boundary[i] > 0) boundary[i] = Math.min(1, 0.5 + boundaryIntensity[i] * 0.3);
    }
    checkpointTectonic = { plates, plateId: new Float32Array(plateId), plateDist: new Float32Array(plateDist), boundary: new Float32Array(boundary) };

    advance('elevation');
    const elevResult = generateElevation(
      width, height, seed, plateId, plates, plateDist, tectonicForce,
      params.noiseType, params.fbmType, params.octaves,
      params.lacunarity, params.persistence, params.seaLevel,
      params.mountainFold, params.coastDetail
    );
    elevation = elevResult.elevation;
    slope = elevResult.slope;
    ridge = elevResult.ridge;
    ridgeMask = elevResult.ridgeMask;
    checkpointElevation = { elevation: new Float32Array(elevation), slope: new Float32Array(slope), ridge: new Float32Array(ridge), ridgeMask: new Float32Array(ridgeMask) };

    advance('erosion');
    if (params.erosionIterations > 0 && params.erosionStrength > 0) {
      elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength, 0.01);
    }
    checkpointErosion = { elevation: new Float32Array(elevation) };
  }

  advance('climate');
  // blank 模式：全海域，无陆地 → 气候/湖泊/河流无意义，跳过计算（避免无谓遍历）
  let temperature: Float32Array, tempZone: Float32Array, moisture: Float32Array, rainfall: Float32Array;
  let lakes: Float32Array;
  let rivers: River[];
  let riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array;
  if (isBlank) {
    temperature = new Float32Array(size0);
    tempZone = new Float32Array(size0);
    moisture = new Float32Array(size0).fill(1); // 全海 → 高湿
    rainfall = new Float32Array(size0);
    lakes = new Float32Array(size0);
    rivers = [];
    riverMask = new Float32Array(size0);
    riverWidth = new Float32Array(size0);
    riverDepth = new Float32Array(size0);
  } else {
    const climate = computeClimate(
      width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine,
      params.windDirX ?? 1, params.windDirY ?? 0, params.rainStrength ?? 1
    );
    temperature = climate.temperature; tempZone = climate.tempZone;
    moisture = climate.moisture; rainfall = climate.rainfall;
    advance('lakes');
    lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);
    advance('rivers');
    const riverCount = params.riverCount ?? Math.floor(width * height * 0.0005);
    const riverResult = generateRivers(
      width, height, elevation, moisture, params.seaLevel, riverCount, seed
    );
    rivers = riverResult.rivers; riverMask = riverResult.riverMask;
    riverWidth = riverResult.riverWidth; riverDepth = riverResult.riverDepth;
  }
  const checkpointClimate = { temperature: new Float32Array(temperature), tempZone: new Float32Array(tempZone), moisture: new Float32Array(moisture), rainfall: new Float32Array(rainfall) };
  const checkpointRivers = { rivers, riverMask: new Float32Array(riverMask), riverWidth: new Float32Array(riverWidth), riverDepth: new Float32Array(riverDepth), lakes: new Float32Array(lakes) };

  advance('regions');
  const regions = analyzeRegions(width, height, elevation, moisture, temperature, plateId, params.seaLevel, seed);

  advance('naming');
  // 计算每个板块的质心（用于命名方位词 + 名称叠加层定位）
  const plateSumX = new Float64Array(plates.length);
  const plateSumY = new Float64Array(plates.length);
  const plateCount = new Float64Array(plates.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pid = plateId[y * width + x] | 0;
      plateSumX[pid] += x;
      plateSumY[pid] += y;
      plateCount[pid]++;
    }
  }
  const nameablePlates: NameablePlate[] = plates.map((p, i) => ({
    plateId: i,
    type: p.type === 'continent' ? 'continent' : 'ocean',
    centroid: plateCount[i] > 0
      ? [plateSumX[i] / plateCount[i], plateSumY[i] / plateCount[i]]
      : [width * 0.5, height * 0.5],
  }));
  // 检测地形区连通域并命名
  const detectedRegions = detectTerrainRegions(
    width, height, elevation, slope, moisture, params.seaLevel, params.snowLine
  );
  const nameableRegions: NameableRegion[] = detectedRegions.map(r => ({
    key: r.key,
    type: r.type,
    centroid: r.centroid,
    area: r.area,
  }));
  const names = generateNames(seed, width, height, nameablePlates, nameableRegions);

  advance('packing');
  const size = width * height;
  const plateTex = new Float32Array(size * 4);
  const elevTex = new Float32Array(size * 4);
  const moistTex = new Float32Array(size * 4);
  const riverTex = new Float32Array(size * 4);
  const tempTex = new Float32Array(size * 4);

  const plateTypeArr = new Uint8Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateTypeArr[i] = plates[i].type === 'continent' ? 1 : 0;
  }

  const invPlateCount = 1 / params.plateCount;
  const inv4 = 0.25;
  const inv13 = 1 / 15;
  const seaLevel = params.seaLevel;
  const snowLine = params.snowLine;

  function classifyBiome(elev: number, temp: number, moist: number): number {
    if (elev <= seaLevel) return 0;
    if (temp < snowLine && elev > 0.6) return 1;
    if (elev > 0.7) return 2;

    // Whittaker biome classification based on temperature and precipitation
    if (temp < -0.3) return 3;                          // ice cap
    if (temp < 0.1) {
      if (moist > 0.3) return 4;                         // tundra
      return 5;                                          // cold desert
    }
    if (temp < 0.35) {
      if (moist > 0.5) return 6;                         // taiga
      return 5;                                          // cold desert
    }
    if (temp < 0.55) {
      if (moist > 0.7) return 7;                         // temperate rainforest
      if (moist > 0.5) return 8;                         // temperate forest
      if (moist > 0.3) return 9;                         // woodland/shrubland
      return 10;                                         // temperate grassland
    }
    // temp >= 0.55
    if (moist > 0.7) return 11;                          // tropical rainforest
    if (moist > 0.45) return 12;                         // tropical seasonal forest
    if (moist > 0.2) return 13;                          // savanna
    return 14;                                           // hot desert
  }

  for (let i = 0; i < size; i++) {
    const pid = plateId[i] | 0;
    const i4 = i * 4;
    const elev = elevation[i];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * inv4;

    plateTex[i4 + 0] = pid * invPlateCount;
    plateTex[i4 + 1] = plateTypeArr[pid];
    plateTex[i4 + 2] = boundary[i];
    plateTex[i4 + 3] = plateDist[i];
    elevTex[i4 + 0] = elev;
    elevTex[i4 + 1] = slope[i];
    elevTex[i4 + 2] = ridge[i];
    elevTex[i4 + 3] = ridgeMask[i];
    moistTex[i4 + 0] = moist;
    moistTex[i4 + 1] = rainfall[i];
    moistTex[i4 + 2] = temp;
    moistTex[i4 + 3] = tz;
    riverTex[i4 + 0] = riverMask[i];
    riverTex[i4 + 1] = riverWidth[i];
    riverTex[i4 + 2] = riverDepth[i];
    riverTex[i4 + 3] = lakes[i];

    const biome = classifyBiome(elev, temp, moist);
    tempTex[i4 + 0] = temp;
    tempTex[i4 + 1] = tz;
    tempTex[i4 + 2] = biome * inv13;
    tempTex[i4 + 3] = 0;
  }

  const mapData: MapData = {
    width, height,
    plateTex, elevTex, moistTex, riverTex, tempTex,
    plates, regions, rivers, names, seed,
  };

  return {
    mapData,
    checkpoints: {
      tectonic: checkpointTectonic,
      elevation: checkpointElevation,
      erosion: checkpointErosion,
      climate: checkpointClimate,
      rivers: checkpointRivers,
    },
  };
}
