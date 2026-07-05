import { type River } from './rivers.js';
import { type Region } from './regions.js';
import { type OceanCurrentResult } from './oceanCurrents.js';
import { type IceResult } from './ice.js';
import { type BiomeResult } from './biomes.js';
import { type WatershedResult } from './watershed.js';
import { type VolcanismResult } from './volcanism.js';
import { type SeasonResult } from './seasons.js';
import type { MapData } from './index.js';
import type { Plate } from './tectonic.js';
export interface DownstreamInput {
    width: number;
    height: number;
    elevation: Float32Array;
    plateId: Float32Array;
    seaLevel: number;
    tempOffset: number;
    snowLine: number;
    windDirX: number;
    windDirY: number;
    rainStrength: number;
    lakeDensity: number;
    riverCount: number;
    seed: number;
    enableOceanCurrents?: boolean;
    enableIceSheet?: boolean;
    enableMonsoon?: boolean;
    enableContinentality?: boolean;
    enableHadleyEnhancement?: boolean;
    /** v2 新增开关 */
    enableAdvancedBiomes?: boolean;
    enableWatershed?: boolean;
    enableVolcanism?: boolean;
    enableSeasons?: boolean;
    plates?: Plate[];
    boundary?: Float32Array;
    boundaryType?: Float32Array;
}
export interface DownstreamResult {
    moisture: Float32Array;
    rainfall: Float32Array;
    temperature: Float32Array;
    tempZone: Float32Array;
    riverMask: Float32Array;
    riverWidth: Float32Array;
    riverDepth: Float32Array;
    lakes: Float32Array;
    rivers: River[];
    regions: Region[];
    coastDist: Float32Array;
    currents: OceanCurrentResult;
    ice: IceResult;
    /** 冰川侵蚀后的高程（若 enableIceSheet 关闭则等于输入 elevation） */
    elevationAfter: Float32Array;
    /** 冰川侵蚀后的坡度（需重算） */
    slopeAfter: Float32Array;
    /** Köppen-Geiger 生物群系分类（开关关闭时为空） */
    biomes?: BiomeResult;
    /** 流域分析（开关关闭时为空） */
    watershed?: WatershedResult;
    /** 火山系统（开关关闭时为空） */
    volcanism?: VolcanismResult;
    /** 季节性气候变差（开关关闭时为空） */
    seasons?: SeasonResult;
}
/**
 * 运行 coast → currents → climate → ice → biomes → lakes → rivers → watershed
 *      → regions → volcanism → seasons 完整下游链。
 * 所有 partialRegenerate 分支（elevation/erosion/climate/editor-elevation）共用此入口。
 * 冰川侵蚀会就地改写 elevationAfter（不影响输入 elevation）。
 */
export declare function runDownstreamPipeline(input: DownstreamInput): DownstreamResult;
/** 将下游结果写回 MapData 的河流/区域/海岸/洋流/冰盖字段（纹理打包由调用方用 texturePack 处理）。 */
export declare function applyDownstreamToMapData(md: MapData, result: DownstreamResult, seed: number): void;
