// 地图生成引擎核心类型

export type NoiseType = 'simplex' | 'perlin' | 'value' | 'worley';
export type FbmType = 'standard' | 'ridged' | 'billowy' | 'warped';
export type MapAspect = '1:1' | '4:3' | '16:9' | '2:1' | '3:2';

export interface Plate {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'continent' | 'ocean';
  color: [number, number, number];
  area: number;
  boundary: number;
  growth: number;
  elevation: number;
  moisture: number;
  temperature: number;
  name: string;
  selected: boolean;
}

export interface Region {
  id: number;
  name: string;
  type: string;
  area: number;
  population: number;
  centerX: number;
  centerY: number;
  avgElevation: number;
  avgMoisture: number;
  avgTemperature: number;
  plateId: number;
  color: [number, number, number];
  selected: boolean;
}

export interface RiverSegment {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface River {
  id: number;
  segments: RiverSegment[];
  length: number;
  sourceX: number;
  sourceY: number;
  mouthX: number;
  mouthY: number;
}

export interface MapData {
  width: number;
  height: number;
  plateTex: Float32Array;    // RGBA: plateId, type, boundary, growth
  elevTex: Float32Array;     // RGBA: elevation, slope, ridge, ridgeMask
  moistTex: Float32Array;    // RGBA: moisture, rainfall, temp, tempVar
  riverTex: Float32Array;    // RGBA: riverMask, riverWidth, riverDepth, lakeMask
  tempTex: Float32Array;     // RGBA: temperature, tempZone, biome, biomeBlend
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  seed: number;
}

export interface GenerationParams {
  seedStr: string;
  mapSize: number;
  mapAspect: MapAspect;
  plateCount: number;
  landmass: number;
  noiseType: NoiseType;
  fbmType: FbmType;
  octaves: number;
  lacunarity: number;
  persistence: number;
  seaLevel: number;
  erosionStrength: number;
  erosionIterations: number;
  mountainFold: number;
  tempOffset: number;
  snowLine: number;
  coastDetail: number;
  lakeDensity: number;
}

export interface DetailParams {
  detailRiverWidth: number;
  detailRiverCurve: number;
  detailCoastJagged: number;
  detailRidgeDensity: number;
  detailRainfallOffset: number;
  detailTempGradient: number;
  detailBiomeBlend: number;
}

export interface RenderParams {
  style: number;
  showBoundaries: boolean;
  boundaryWidth: number;
  boundaryColor: [number, number, number];
  showNames: boolean;
  showRivers: boolean;
  showContours: boolean;
  contourInterval: number;
  showTerrain: boolean;
  showSelection: boolean;
  showClimate: boolean;
  showGrid: boolean;
  showElevScale: boolean;
  showRegionNames: boolean;
  geoLabels: boolean;
  lightAngle: number;
  pointLightEnabled: boolean;
  pointLightPos: [number, number];
  pointLightIntensity: number;
  pointLightColor: [number, number, number];
  glowEnabled: boolean;
}

export interface InteractionState {
  laserActive: boolean;
  trailEnabled: boolean;
  laserSmooth: boolean;
  cursorActive: boolean;
}

export interface LabelState {
  customPlateNames: Record<number, string>;
  customRegionNames: Record<number, string>;
}

export interface MapState extends GenerationParams, DetailParams, RenderParams, InteractionState, LabelState {
  _needsRegen: boolean;
  _isGenerating: boolean;
  perfEnabled: boolean;
}

export type Theme = 'classic' | 'modern';
export type Lang = 'zh' | 'en';
