import { type NoiseType, type FbmType } from './noise.js';
export interface ViewportRegion {
    /** 视野在地图坐标系中的左上角 X（像素） */
    x: number;
    y: number;
    /** 视野宽高（地图坐标像素） */
    w: number;
    h: number;
    /** 输出高分辨率网格的像素尺寸 */
    outW: number;
    outH: number;
}
export interface DetailPatch {
    width: number;
    height: number;
    /** 高分辨率高程（outW × outH） */
    elevation: Float32Array;
    /** 高分辨率坡度 */
    slope: Float32Array;
    /** 视野在地图坐标系中的范围 */
    region: ViewportRegion;
}
export interface DetailPeak {
    /** 在高分辨率网格中的位置 */
    x: number;
    y: number;
    /** 在地图坐标系中的位置 */
    mapX: number;
    mapY: number;
    elevation: number;
    /** 突出度：相对周围鞍点的高差 */
    prominence: number;
}
/**
 * 为视野区域生成高分辨率高程细节。
 * 算法：双线性上采样基础高程 + 高频 FBM 噪声叠加（仅高频 octave，不重复低频）。
 *
 * @param detailStrength 噪声叠加强度（0.02~0.08，越大细节越粗）
 * @param detailOctaves 高频 octave 起始层（默认 4，即从第 4 个 octave 开始叠加）
 */
export declare function computeDetailPatch(baseElevation: Float32Array, baseWidth: number, baseHeight: number, region: ViewportRegion, seed: number, noiseType?: NoiseType, fbmType?: FbmType, lacunarity?: number, persistence?: number, detailStrength?: number, detailOctaves?: number): DetailPatch;
/**
 * 在高分辨率网格中检测局部山峰（用于放大后标注）。
 * 局部极大值 + 突出度过滤——仅保留显著的山峰。
 *
 * @param minProminence 最小突出度（相对周围最低点的高差），默认 0.03
 * @param minSpacing 最小间距（像素），避免密集标注，默认 8
 */
export declare function detectDetailPeaks(patch: DetailPatch, seaLevel: number, minProminence?: number, minSpacing?: number): DetailPeak[];
