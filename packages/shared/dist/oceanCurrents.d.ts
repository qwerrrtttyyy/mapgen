export interface OceanCurrentResult {
    /** 流速 x 分量（像素/单位时间，向右为正） */
    vx: Float32Array;
    /** 流速 y 分量（向下为正；本库约定 y=0 南极、y=H 北极） */
    vy: Float32Array;
    /** 暖流+/寒流- 温度增量，仅沿岸有效 */
    tempDelta: Float32Array;
    /** 流速模长 */
    speed: Float32Array;
}
export interface OceanCurrentInput {
    width: number;
    height: number;
    elevation: Float32Array;
    seaLevel: number;
    /** 海岸距离场（陆地正、海洋负）—— 来自 coastline.ts */
    coastDist: Float32Array;
    /** 全局风场偏置（叠加到三环风带上） */
    windDirX: number;
    windDirY: number;
    /** 风场强度系数（默认 1） */
    rainStrength?: number;
    seed: number;
}
/**
 * 计算洋流场。
 * 约定：y=0 为南极（lat=-1）、y=H 为北极（lat=+1）—— 与 regions.ts 一致。
 */
export declare function computeOceanCurrents(input: OceanCurrentInput): OceanCurrentResult;
