import type { NoiseType, FbmType } from './noise.js';
import type { Plate } from './tectonic.js';
import type { River } from './rivers.js';
import type { Region } from './regions.js';
import type { NameManifest } from './naming.js';
import type { VolcanoSite, Hotspot } from './volcanism.js';

export interface MapParams {
  seedStr: string;
  mapAspect?: string;
  mapSize?: number;
  mapWidth?: number;
  mapHeight?: number;
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
  mode?: 'procedural' | 'blank';
  enableOceanCurrents?: boolean;
  enableIceSheet?: boolean;
  enableMonsoon?: boolean;
  enableContinentality?: boolean;
  enableHadleyEnhancement?: boolean;
  enableAdvancedBiomes?: boolean;
  enableWatershed?: boolean;
  enableVolcanism?: boolean;
  enableSeasons?: boolean;
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

export type ProgressCallback = (progress: number, phaseName: string) => void;
