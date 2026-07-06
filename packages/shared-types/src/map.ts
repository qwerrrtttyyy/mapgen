export interface Plate {
  id: number;
  type: 'continent' | 'ocean';
  centroid: [number, number];
  drift: [number, number];
}

export interface Region {
  id: number;
  type: string;
  centroid: [number, number];
  area: number;
}

export interface RiverSegment {
  x: number;
  y: number;
  width: number;
}

export interface River {
  id: number;
  segments: RiverSegment[];
}

export interface NameManifest {
  plates: string[];
  regions: string[];
  volcanoes: string[];
}

export interface VolcanoSite {
  x: number;
  y: number;
  name: string;
  probability: number;
}

export interface Hotspot {
  x: number;
  y: number;
  strength: number;
}

export interface MapData {
  width: number;
  height: number;
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
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  seed: number;
}

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
