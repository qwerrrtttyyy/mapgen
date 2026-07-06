import type {
  MapData as CoreMapData,
  Plate as CorePlate,
  Region as CoreRegion,
  River as CoreRiver,
  VolcanoSite as CoreVolcanoSite,
  Hotspot as CoreHotspot,
  NamedPlate as CoreNamedPlate,
  NamedRegion as CoreNamedRegion,
  NameManifest as CoreNameManifest,
} from '@mapgen/core';

export type Plate = CorePlate;
export type Region = CoreRegion;
export type River = CoreRiver;
export type VolcanoSite = CoreVolcanoSite;
export type Hotspot = CoreHotspot;
export type NamedPlate = CoreNamedPlate;
export type NamedRegion = CoreNamedRegion;
export type NameManifest = CoreNameManifest;

export type MapData = CoreMapData;

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
