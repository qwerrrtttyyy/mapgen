export type NoiseType = 'perlin' | 'simplex' | 'value' | 'worley';
export type FbmType = 'standard' | 'ridged' | 'billowy' | 'warped';
export type GenMode = 'procedural' | 'blank';

/** Maximum allowed map resolution (width or height) in pixels. */
export const MAX_RESOLUTION = 4096;

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
  mode?: GenMode;
  enableOceanCurrents?: boolean;
  enableIceSheet?: boolean;
  enableMonsoon?: boolean;
  enableContinentality?: boolean;
  enableHadleyEnhancement?: boolean;
  enableAdvancedBiomes?: boolean;
  enableWatershed?: boolean;
  enableVolcanism?: boolean;
  enableSeasons?: boolean;
  cancelSignal?: { aborted: boolean };
}
