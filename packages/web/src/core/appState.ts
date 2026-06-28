import type { MapData, MapParams } from '@mapgen/core';

export type NoiseType = 'perlin' | 'simplex' | 'value' | 'worley';
export type FbmType = 'standard' | 'ridged' | 'billowy' | 'warped';
export type GenMode = 'procedural' | 'blank';

export interface UIParams {
  seedStr: string;
  mapSize: number;
  mapAspect: string;
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
  riverCount: number;
  rainStrength: number;
  windDirX: number;
  windDirY: number;
  mode: GenMode;
  style: number;
  showBoundaries: boolean;
  boundaryWidth: number;
  boundaryColor: number[];
  showRivers: boolean;
  showContours: boolean;
  contourInterval: number;
  showTerrain: boolean;
  showSelection: boolean;
  showClimate: boolean;
  showGrid: boolean;
  showElevScale: boolean;
  lightAngle: number;
  pointLightEnabled: boolean;
  pointLightPos: number[];
  pointLightIntensity: number;
  pointLightColor: number[];
  glowEnabled: boolean;
  laserActive: boolean;
  laserStart: number[];
  laserEnd: number[];
  laserWidth: number;
  laserSelection: boolean;
  laserColor: number[];
  trailEnabled: boolean;
  cursorActive: boolean;
  cursorPos: number[];
  cursorSize: number;
}

export interface AppState {
  params: UIParams;
  mapData: MapData | null;
  checkpoints: Record<string, unknown> | null;
  isGenerating: boolean;
  selectedPlates: Set<number>;
  selectedRegions: Set<number>;
  hoveredIndex: number;
  error: string | null;
}

export function createDefaultParams(): UIParams {
  return {
    seedStr: String(Math.floor(Math.random() * 99999)),
    mapSize: 256,
    mapAspect: '1:1',
    plateCount: 8,
    landmass: 0.4,
    noiseType: 'perlin',
    fbmType: 'standard',
    octaves: 5,
    lacunarity: 2.0,
    persistence: 0.5,
    seaLevel: 0.45,
    erosionStrength: 1.0,
    erosionIterations: 50,
    mountainFold: 0.3,
    tempOffset: 0,
    snowLine: 0.5,
    coastDetail: 0.5,
    lakeDensity: 0.02,
    riverCount: 20,
    rainStrength: 1.0,
    windDirX: 1.0,
    windDirY: 0,
    mode: 'procedural',
    style: 0,
    showBoundaries: true,
    boundaryWidth: 0.8,
    boundaryColor: [1, 0.3, 0.2],
    showRivers: true,
    showContours: false,
    contourInterval: 0.05,
    showTerrain: true,
    showSelection: true,
    showClimate: false,
    showGrid: false,
    showElevScale: false,
    lightAngle: 0.8,
    pointLightEnabled: false,
    pointLightPos: [0.5, 0.5],
    pointLightIntensity: 0.5,
    pointLightColor: [1.0, 0.8, 0.6],
    glowEnabled: false,
    laserActive: false,
    laserStart: [0.0, 0.0],
    laserEnd: [0.0, 0.0],
    laserWidth: 0.003,
    laserSelection: true,
    laserColor: [1.0, 0.32, 0.22],
    trailEnabled: false,
    cursorActive: false,
    cursorPos: [0.5, 0.5],
    cursorSize: 12.0,
  };
}

export function toMapParams(state: UIParams): MapParams {
  return {
    seedStr: state.seedStr,
    mapAspect: state.mapAspect,
    mapSize: state.mapSize,
    plateCount: state.plateCount,
    landmass: state.landmass,
    noiseType: state.noiseType,
    fbmType: state.fbmType,
    octaves: state.octaves,
    lacunarity: state.lacunarity,
    persistence: state.persistence,
    seaLevel: state.seaLevel,
    mountainFold: state.mountainFold,
    coastDetail: state.coastDetail,
    erosionIterations: state.erosionIterations,
    erosionStrength: state.erosionStrength,
    lakeDensity: state.lakeDensity,
    tempOffset: state.tempOffset,
    snowLine: state.snowLine,
    riverCount: state.riverCount,
    rainStrength: state.rainStrength,
    windDirX: state.windDirX,
    windDirY: state.windDirY,
    mode: state.mode,
  };
}

export function createInitialState(): AppState {
  return {
    params: createDefaultParams(),
    mapData: null,
    checkpoints: null,
    isGenerating: false,
    selectedPlates: new Set(),
    selectedRegions: new Set(),
    hoveredIndex: -1,
    error: null,
  };
}

export let state = createInitialState();

export function resetState(): void {
  state = createInitialState();
}

export function patchParams(patch: Partial<UIParams>): void {
  Object.assign(state.params, patch);
}
