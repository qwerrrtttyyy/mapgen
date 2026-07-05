export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export interface SeasonInput {
    width: number;
    height: number;
    elevation: Float32Array;
    seaLevel: number;
    /** 基础温度场（来自 regions.ts computeClimate，预留用于未来与基础温度耦合） */
    temperature?: Float32Array;
    /** 基础降水场（预留） */
    rainfall?: Float32Array;
    /** 海岸距离场（陆地正）—— 用于大陆度修正 */
    coastDist?: Float32Array;
}
export interface SeasonResult {
    /** 春季温度 delta（叠加到 base temperature） */
    springTemp: Float32Array;
    /** 夏季温度 delta */
    summerTemp: Float32Array;
    /** 秋季温度 delta */
    autumnTemp: Float32Array;
    /** 冬季温度 delta */
    winterTemp: Float32Array;
    /** 春季降水 delta */
    springRain: Float32Array;
    /** 夏季降水 delta */
    summerRain: Float32Array;
    /** 秋季降水 delta */
    autumnRain: Float32Array;
    /** 冬季降水 delta */
    winterRain: Float32Array;
    /** 打包为 RGBA 纹理：R=夏温度 delta G=冬温度 delta B=夏降水 delta A=冬降水 delta
     *  delta 范围 [-1,1] → [0,1]，春/秋用 (夏+冬)/2 简化（节省带宽） */
    seasonTex: Float32Array;
}
/**
 * 计算 4 季温度/降水 delta 场。
 *
 * 约定：y=0 为南极（lat=-1），y=H 为北极（lat=+1）—— 与 regions.ts 一致。
 * 北半球：夏在 y 大的方向（北极夏季暖），冬在 y 小方向
 * 南半球相反
 */
export declare function computeSeasonalVariation(input: SeasonInput): SeasonResult;
/** 在指定季节从 seasonTex 解码出温度/降水 delta（用于编辑器或叠加层） */
export declare function decodeSeasonDelta(seasonTex: Float32Array, size: number, season: Season): {
    tempDelta: Float32Array;
    rainDelta: Float32Array;
};
