/**
 * @module shared-types/map
 * 核心数据类型定义（无外部依赖，shared-types 为最底层包）
 * 注意：这些类型是 shared/src 中同名类型的简化版本，用于序列化/传输。
 * 运行时类型以 shared/src 为准。
 */

// ── 基础地理实体 ──

export type PlateKind = 'continent' | 'ocean';

export type TerrainType =
  | 'mountain'
  | 'plain'
  | 'plateau'
  | 'basin'
  | 'desert'
  | 'forest'
  | 'glacier'
  | 'delta'
  | 'volcano'
  | 'archipelago';

/** 板块（与 shared/src/tectonic.ts Plate 兼容） */
export interface Plate {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: PlateKind;
  color: number[];
  area: number;
  boundary: number;
  growth: number;
  elevation: number;
  moisture: number;
  temperature: number;
  name: string;
  selected: boolean;
}

/** 区域（与 shared/src/regions.ts Region 兼容） */
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
  color: number[];
  selected: boolean;
}

/** 河流段 */
export interface RiverSegment {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** 河流（与 shared/src/rivers.ts River 兼容） */
export interface River {
  id: number;
  segments: RiverSegment[];
  length: number;
  sourceX: number;
  sourceY: number;
  mouthX: number;
  mouthY: number;
}

/** 火山位置（与 shared/src/volcanism.ts VolcanoSite 兼容） */
export interface VolcanoSite {
  x: number;
  y: number;
  kind: 'hotspot' | 'arc' | 'ridge' | 'rift';
  strength: number;
  hotspotId?: number;
}

/** 热点（与 shared/src/volcanism.ts Hotspot 兼容） */
export interface Hotspot {
  id: number;
  x: number;
  y: number;
  strength: number;
}

/** 命名板块（与 shared/src/naming.ts NamedPlate 兼容） */
export interface NamedPlate {
  plateId: number;
  type: PlateKind;
  name: string;
  centroid: [number, number];
}

/** 命名区域（与 shared/src/naming.ts NamedRegion 兼容） */
export interface NamedRegion {
  key: string;
  type: TerrainType;
  name: string;
  centroid: [number, number];
  area: number;
}

/** 命名结果（与 shared/src/naming.ts NameManifest 兼容） */
export interface NameManifest {
  plates: NamedPlate[];
  regions: NamedRegion[];
}

// ── 地图数据 ──

/**
 * 完整地图数据（运行时格式，纹理为 Float32Array）
 */
export interface MapData {
  width: number;
  height: number;
  seed: number;
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  plateTex: Float32Array;
  elevTex: Float32Array;
  moistTex: Float32Array;
  riverTex: Float32Array;
  tempTex: Float32Array;
  currentTex?: Float32Array;
  iceTex?: Float32Array;
  coastDist?: Float32Array;
  biomeTex?: Float32Array;
  watershedTex?: Float32Array;
  volcanismTex?: Float32Array;
  seasonTex?: Float32Array;
  volcanoSites?: VolcanoSite[];
  hotspots?: Hotspot[];
}

/**
 * 序列化地图数据（传输格式，纹理为 base64 字符串）
 */
export interface SerializedMapData {
  width: number;
  height: number;
  seed: number;
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  textures: {
    plateTex: string;
    elevTex: string;
    moistTex: string;
    riverTex: string;
    tempTex: string;
    currentTex?: string;
    iceTex?: string;
    coastDist?: string;
    biomeTex?: string;
    watershedTex?: string;
    volcanismTex?: string;
    seasonTex?: string;
  };
  volcanoSites?: VolcanoSite[];
  hotspots?: Hotspot[];
}
