import type { MapData } from './index.js';
/** 15 种生物群系分类（与 tempTex 通道 B 编码一致）。 */
export declare function classifyBiome(elev: number, temp: number, moist: number, seaLevel: number, snowLine: number): number;
/** 从 RGBA 打包纹理提取单通道。 */
export declare function extractChannel(tex: Float32Array, channel: number, size: number): Float32Array;
/** 从 plateTex 通道 R 还原 plateId（乘回 plateCount）。 */
export declare function extractPlateId(plateTex: Float32Array, plateCount: number, size: number): Float32Array;
export interface TexturePackParams {
    seaLevel: number;
    snowLine: number;
    plateCount: number;
}
/**
 * 全量重打包：高程+气候+河流+温度（plateTex 的 plateId/boundary 保留不动，仅清零 plateDist 通道）。
 * 用于 elevation / editor-elevation 等完整下游重算分支。
 */
export declare function packAllTextures(md: MapData, elevation: Float32Array, slope: Float32Array, ridge: Float32Array, ridgeMask: Float32Array, moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array, riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array, p: TexturePackParams): void;
/**
 * 局部重打包：仅气候+河流+温度（高程/板块纹理不动）。
 * 用于 erosion / climate / rivers 分支——高程已就地写入 elevTex，此处只刷新下游纹理。
 */
export declare function packClimateRiverTextures(md: MapData, moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array, riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array, p: TexturePackParams): void;
/** 仅重写 elevTex（侵蚀/编辑改高程后，slope 需调用方传入重算值）。 */
export declare function packElevTex(md: MapData, elevation: Float32Array, slope: Float32Array, ridge: Float32Array, ridgeMask: Float32Array): void;
/**
 * 打包洋流纹理 RGBA: R=vx G=vy B=tempDelta A=speed。
 * 流速 [-1,1] 映射到 [0,1]；tempDelta 同理；speed 直接 clamp。
 * 若 md.currentTex 不存在则按需创建。
 */
export declare function packCurrentTex(md: MapData, vx: Float32Array, vy: Float32Array, tempDelta: Float32Array, speed: Float32Array): void;
/**
 * 打包冰盖纹理 RGBA: R=landIce G=seaIce B=glacierVx A=glacierVy。
 * 冰厚 [0,1] 直接存储；流向 [-1,1] 映射到 [0,1]。
 * 若 md.iceTex 不存在则按需创建。
 */
export declare function packIceTex(md: MapData, landIce: Float32Array, seaIce: Float32Array, glacierVx: Float32Array, glacierVy: Float32Array): void;
/**
 * v2: 打包生物群系纹理 RGBA: R=biomeId/31 G=isLand B=koppenBand A=streamOrder/7。
 * 若 md.biomeTex 不存在则按需创建。
 */
export declare function packBiomeTex(md: MapData, biomeId: Uint8Array, streamOrder: Uint8Array): void;
/**
 * v2: 打包流域纹理 RGBA: R=basinId/65535 G=isDivide B=streamOrder/7 A=0。
 * 若 md.watershedTex 不存在则按需创建。
 */
export declare function packWatershedTex(md: MapData, basinId: Int32Array, isDivide: Uint8Array, streamOrder: Uint8Array): void;
/**
 * v2: 打包火山纹理 RGBA: R=volcanoProb G=calderaMask/2 B=hotspotStrength A=0。
 * 若 md.volcanismTex 不存在则按需创建。
 */
export declare function packVolcanismTex(md: MapData, volcanoProb: Float32Array, calderaMask: Uint8Array, hotspotStrength: number): void;
/**
 * v2: 打包季节纹理 RGBA: R=夏温度delta G=冬温度delta B=夏降水delta A=冬降水delta。
 * delta 范围 [-1,1] → [0,1]。若 md.seasonTex 不存在则按需创建。
 */
export declare function packSeasonTex(md: MapData, summerTempDelta: Float32Array, winterTempDelta: Float32Array, summerRainDelta: Float32Array, winterRainDelta: Float32Array): void;
