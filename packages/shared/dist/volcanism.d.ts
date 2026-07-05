import type { Plate } from './tectonic.js';
export interface VolcanismInput {
    width: number;
    height: number;
    elevation: Float32Array;
    seaLevel: number;
    /** 板块 ID 场（每像素所属板块） */
    plateId: Float32Array;
    /** 板块列表（含漂移方向） */
    plates: Plate[];
    /** 构造边界（boundary[i]>0 表示 i 是边界像素） */
    boundary: Float32Array;
    /** 边界类型（1=汇聚,2=离散,3=转换） */
    boundaryType?: Float32Array;
    /** 热点数量（建议 1~5） */
    hotspotCount?: number;
    /** 火山概率场强度系数（0=关闭, 1=标准, 2=狂暴） */
    intensity?: number;
    seed: number;
}
export interface VolcanoSite {
    x: number;
    y: number;
    /** 火山类型：hotspot/arc/ridge/rift */
    kind: 'hotspot' | 'arc' | 'ridge' | 'rift';
    /** 喷发强度 [0,1]（影响是否形成破火山口） */
    strength: number;
    /** 关联热点 ID（仅 kind=hotspot） */
    hotspotId?: number;
}
export interface Hotspot {
    id: number;
    x: number;
    y: number;
    /** 热点强度（决定火山链规模） */
    strength: number;
}
export interface VolcanismResult {
    /** 每像素火山概率 [0,1]（叠加热点+板缘+洋脊） */
    volcanoProb: Float32Array;
    /** 热点列表 */
    hotspots: Hotspot[];
    /** 检测出的具体火山位置（峰值） */
    volcanoSites: VolcanoSite[];
    /** 破火山口标记（1=破火山口环形凹陷） */
    calderaMask: Uint8Array;
}
/**
 * 计算火山概率场并检测火山位置。
 *
 * 算法：
 * 1. 热点：在地幔柱固定位置（高斯衰减），向板块漂移方向延伸成火山链
 * 2. 板缘：汇聚边界为火山弧（高概率带），离散边界为洋中脊（中等概率）
 * 3. 局部极大值检测：概率 + 海拔双阈值 → 具体火山位置
 * 4. 破火山口：大火山位置周围环形凹陷
 */
export declare function computeVolcanism(input: VolcanismInput): VolcanismResult;
