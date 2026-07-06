export { hashSeed, createNoise, NoiseEngine, type NoiseType, type FbmType } from './noise.js';
export { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate, type BoundaryType } from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers, type River, type RiverSegment } from './rivers.js';
export { analyzeRegions, computeClimate, type Region, type ClimateData, type ClimateEnhanceOptions } from './regions.js';
export { generateNames, regenerateNames, type NameManifest, type NameablePlate, type NameableRegion, type NamedPlate, type NamedRegion, type PlateKind, type TerrainType } from './naming.js';
export { detectTerrainRegions, type DetectedRegion, type TerrainDetectOptions, CommandStack, type Command, applyBrushStroke, applyVectorMountain, applyVectorPolygon, movePlate, recomputePlateGeometry, type BrushTarget, type VectorTarget } from './editor.js';
export { computeSlope } from './slope.js';
export { classifyBiome, extractChannel, extractPlateId, packAllTextures, packClimateRiverTextures, packElevTex, packCurrentTex, packIceTex, packBiomeTex, packWatershedTex, packVolcanismTex, packSeasonTex, type TexturePackParams } from './texturePack.js';
export { runDownstreamPipeline, applyDownstreamToMapData, type DownstreamInput, type DownstreamResult } from './downstream.js';
export { computeCoastDistance, continentalityFactor } from './coastline.js';
export { computeOceanCurrents, type OceanCurrentInput, type OceanCurrentResult } from './oceanCurrents.js';
export { computeIceSheet, type IceInput, type IceResult } from './ice.js';
export { computeDetailPatch, detectDetailPeaks, type ViewportRegion, type DetailPatch, type DetailPeak } from './lazyGen.js';
export { classifyBiomes, biomeNormalize, getBiomeInfo, type BiomeId, type BiomeInfo, type BiomeClassifyInput, type BiomeResult, BIOME_INFO, BIOME_COUNT } from './biomes.js';
export { computeWatershed, type WatershedInput, type WatershedResult } from './watershed.js';
export { computeVolcanism, type VolcanismInput, type VolcanismResult, type VolcanoSite, type Hotspot } from './volcanism.js';
export { computeSeasonalVariation, decodeSeasonDelta, type Season, type SeasonInput, type SeasonResult } from './seasons.js';
export { debug, setupDebugGlobal, getDebug, type DebugState, type DebugMetrics, type DebugTiming } from './debug.js';
import { type Plate } from './tectonic.js';
import { type River } from './rivers.js';
import { type Region } from './regions.js';
import { type NameManifest } from './naming.js';
import { type VolcanoSite, type Hotspot } from './volcanism.js';
import type { NoiseType, FbmType } from './noise.js';
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
    /** 生成模式：procedural=噪声+构造驱动；blank=空白海域待手绘（AC-10.1） */
    mode?: 'procedural' | 'blank';
    /** 洋流系统（风驱动+Ekman+西边界强化，影响沿岸温度） */
    enableOceanCurrents?: boolean;
    /** 动态冰盖+冰川侵蚀（极地高海拔冰盖、U 型谷） */
    enableIceSheet?: boolean;
    /** 季风（热带沿海陆地增湿） */
    enableMonsoon?: boolean;
    /** 大陆度修正（内陆偏冷） */
    enableContinentality?: boolean;
    /** Hadley cell 强化（ITCZ 增湿 + 副热带高压沙漠带） */
    enableHadleyEnhancement?: boolean;
    /** Köppen-Geiger 32 类生物群系分类（替换简单 15 类） */
    enableAdvancedBiomes?: boolean;
    /** 流域分析（排水盆地、Strahler 河序、大陆分水岭） */
    enableWatershed?: boolean;
    /** 热点火山系统（火山链、火山弧、概率场、破火山口） */
    enableVolcanism?: boolean;
    /** 季节性气候变差（4 季温度/降水 delta） */
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
    /** 洋流纹理 RGBA: R=vx G=vy B=tempDelta(暖+/寒-) A=speed */
    currentTex?: Float32Array;
    /** 冰盖纹理 RGBA: R=landIce G=seaIce B=glacierVx A=glacierVy */
    iceTex?: Float32Array;
    /** 海岸距离场（陆地正、海洋负），不入纹理，供气候/地形区使用 */
    coastDist?: Float32Array;
    /** 生物群系纹理 RGBA: R=biomeId/31 G=isLand B=koppenBand A=streamOrder/7 */
    biomeTex?: Float32Array;
    /** 流域纹理 RGBA: R=basinId/65535 G=isDivide B=streamOrder/7 A=flowDir/255 */
    watershedTex?: Float32Array;
    /** 火山纹理 RGBA: R=volcanoProb G=calderaMask B=hotspotStrength A=volcanoSite */
    volcanismTex?: Float32Array;
    /** 季节纹理 RGBA: R=夏温度delta G=冬温度delta B=夏降水delta A=冬降水delta */
    seasonTex?: Float32Array;
    /** 火山位置列表（用于命名/可视化） */
    volcanoSites?: VolcanoSite[];
    /** 热点列表 */
    hotspots?: Hotspot[];
    plates: Plate[];
    regions: Region[];
    rivers: River[];
    names: NameManifest;
    seed: number;
}
export type ProgressCallback = (progress: number, phaseName: string) => void;
export declare function generateMap(params: MapParams, onProgress?: ProgressCallback): {
    mapData: MapData;
    checkpoints: Record<string, unknown>;
};
