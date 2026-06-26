export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export { generatePlates, assignPlates, computeBoundaries, type Plate } from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export { analyzeRegions, computeClimate, type Region, type ClimateData } from './regions.js';

import { hashSeed } from './noise.js';
import { generatePlates, assignPlates, computeBoundaries, type Plate } from './tectonic.js';
import { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
import { generateRivers, type River } from './rivers.js';
import { analyzeRegions, computeClimate, type Region } from './regions.js';
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
  tempOffset: number;
  snowLine: number;
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
    { name: 'packing', weight: 5 },
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
  const plates = generatePlates(seed, params.plateCount, width, height, params.landmass);
  const { plateId, plateDist } = assignPlates(width, height, plates);
  const boundary = computeBoundaries(width, height, plateId);
  const checkpointTectonic = { plates, plateId: new Float32Array(plateId), plateDist: new Float32Array(plateDist), boundary: new Float32Array(boundary) };

  advance('elevation');
  let { elevation, slope, ridge, ridgeMask } = generateElevation(
    width, height, seed, plateId, plates, boundary,
    params.noiseType, params.fbmType, params.octaves,
    params.lacunarity, params.persistence, params.seaLevel,
    params.mountainFold, params.coastDetail
  );
  const checkpointElevation = { elevation: new Float32Array(elevation), slope: new Float32Array(slope), ridge: new Float32Array(ridge), ridgeMask: new Float32Array(ridgeMask) };

  advance('erosion');
  if (params.erosionIterations > 0 && params.erosionStrength > 0) {
    elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength);
  }
  const checkpointErosion = { elevation: new Float32Array(elevation) };

  advance('climate');
  const { temperature, tempZone, moisture, rainfall } = computeClimate(
    width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine
  );
  const checkpointClimate = { temperature: new Float32Array(temperature), tempZone: new Float32Array(tempZone), moisture: new Float32Array(moisture), rainfall: new Float32Array(rainfall) };

  advance('lakes');
  const lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);

  advance('rivers');
  const riverCount = Math.floor(width * height * 0.0005);
  const { rivers, riverMask, riverWidth, riverDepth } = generateRivers(
    width, height, elevation, moisture, params.seaLevel, riverCount, seed
  );
  const checkpointRivers = { rivers, riverMask: new Float32Array(riverMask), riverWidth: new Float32Array(riverWidth), riverDepth: new Float32Array(riverDepth), lakes: new Float32Array(lakes) };

  advance('regions');
  const regions = analyzeRegions(width, height, elevation, moisture, temperature, plateId, params.seaLevel, seed);

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
  const inv8 = 1 / 8;
  const seaLevel = params.seaLevel;
  const snowLine = params.snowLine;

  function classifyBiome(elev: number, temp: number, moist: number): number {
    if (elev <= seaLevel) return 0;
    if (temp < snowLine && elev > 0.6) return 1;
    if (elev > 0.7) return 2;
    if (moist < 0.2 && temp > 0.5) return 3;
    if (moist > 0.7 && temp > 0.4) return 4;
    if (moist > 0.5 && temp > 0.3) return 5;
    if (temp < 0.2) return 6;
    return 7;
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
    tempTex[i4 + 2] = biome * inv8;
    tempTex[i4 + 3] = 0;
  }

  const mapData: MapData = {
    width, height,
    plateTex, elevTex, moistTex, riverTex, tempTex,
    plates, regions, rivers, seed,
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
