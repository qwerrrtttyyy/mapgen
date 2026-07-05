export interface Region {
    id: number;
    name: string;
    type: string;
    area: number;
    population: number;
    centerX: number;
    centerY: number;
    avgElevation: number;
    avgMoisture: number;
    avgTemperature: number;
    plateId: number;
    color: number[];
    selected: boolean;
}
export interface ClimateData {
    temperature: Float32Array;
    tempZone: Float32Array;
    moisture: Float32Array;
    rainfall: Float32Array;
}
export declare function analyzeRegions(width: number, height: number, elevation: Float32Array, moisture: Float32Array, temperature: Float32Array, plateId: Float32Array, seaLevel: number, _seed: number): Region[];
/** 行星级气候增强选项（全部可选，缺省=关闭，向后兼容）。 */
export interface ClimateEnhanceOptions {
    /** 海岸距离场（陆地正）—— 大陆度修正 */
    coastDist?: Float32Array;
    /** 洋流温度增量（暖+/寒-）—— 沿岸温度修正 */
    currentTempDelta?: Float32Array;
    /** 开启大陆度修正（内陆偏冷） */
    enableContinentality?: boolean;
    /** 开启洋流沿岸温度修正 */
    enableOceanCurrents?: boolean;
    /** 开启 Hadley cell 强化（ITCZ 增湿 + 副热带高压沙漠带减湿） */
    enableHadleyEnhancement?: boolean;
    /** 开启季风（热带沿海陆地增湿） */
    enableMonsoon?: boolean;
}
export declare function computeClimate(width: number, height: number, elevation: Float32Array, seaLevel: number, tempOffset: number, snowLine: number, windDirectionX?: number, windDirectionY?: number, rainStrength?: number, enhance?: ClimateEnhanceOptions): ClimateData;
