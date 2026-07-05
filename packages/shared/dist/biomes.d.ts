/** 32 类生物群系 ID 与名称（与 fs-map.frag BIOME_COLORS 对齐） */
export type BiomeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31;
export declare const BIOME_COUNT = 32;
/** 生物群系元数据：名称（zh-CN）、所属气候带、是否陆地 */
export interface BiomeInfo {
    id: number;
    name: string;
    /** A/B/C/D/E 五大气候带代号 */
    koppen: 'A' | 'B' | 'C' | 'D' | 'E' | 'M' | 'X';
    /** 是否陆地生物群系 */
    isLand: boolean;
}
export declare const BIOME_INFO: BiomeInfo[];
export interface BiomeClassifyInput {
    /** 归一化高程 [-1, 1] */
    elevation: Float32Array;
    /** 归一化温度 [-1, 1]（赤道 +1、极地 -1） */
    temperature: Float32Array;
    /** 归一化降水 [0, 1] */
    rainfall: Float32Array;
    /** 归一化湿度 [0, 1]（持水量） */
    moisture: Float32Array;
    /** 海平面 */
    seaLevel: number;
    /** 雪线温度阈值（snowLine 以下且高海拔 → 冰） */
    snowLine: number;
    /** 海岸距离场（陆地正）—— 用于红树林/盐沼 */
    coastDist?: Float32Array;
    /** 河流遮罩 [0,1] —— 用于河岸林地 */
    riverMask?: Float32Array;
    /** 湖泊遮罩 [0,1] */
    lakeMask?: Float32Array;
    /** 陆地冰厚 [0,1] */
    landIce?: Float32Array;
    /** 海冰厚 [0,1] */
    seaIce?: Float32Array;
    /** 高山带阈值（陆地海拔高于此值视为高山气候带，默认 0.7） */
    alpineThreshold?: number;
}
export interface BiomeResult {
    /** 每像素生物群系 ID [0, 31] */
    biomeId: Uint8Array;
    /** 归一化值 [0,1]，可直接打入 tempTex 通道 B */
    biomeNormalized: Float32Array;
}
/**
 * Köppen-Geiger 简化分类。
 *
 * 温度归一化映射：
 *   T ≥ 0.55 ≈ 18°C（热带阈值）
 *   T ≥ 0.10 ≈ 10°C（温带/寒带阈值）
 *   T ≥ -0.30 ≈ 0°C（极地/寒带阈值）
 *   T < -0.30 ≈ 极地冰盖
 *
 * 降水归一化映射：
 *   0~0.15 干旱（B 带）
 *   0.15~0.40 半干旱
 *   0.40~0.70 中等
 *   0.70~1.0 湿润
 *
 * 决策优先级（每像素）：
 *   1. 海洋 → 深海/浅海
 *   2. 海冰 → 海冰
 *   3. 湖泊 → 湖泊
 *   4. 陆地冰厚大 → 冰川
 *   5. 河岸/三角洲/红树林/盐沼 特殊生态
 *   6. 高山带（海拔 > 阈值）→ 高山群系
 *   7. Köppen 主分类
 */
export declare function classifyBiomes(input: BiomeClassifyInput): BiomeResult;
/** 由 biomeId 返回归一化值（用于纹理打包） */
export declare function biomeNormalize(id: number): number;
/** 由 biomeId 获取元数据 */
export declare function getBiomeInfo(id: number): BiomeInfo;
