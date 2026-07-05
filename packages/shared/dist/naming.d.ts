export type PlateKind = 'continent' | 'ocean';
export type TerrainType = 'mountain' | 'plain' | 'plateau' | 'basin' | 'desert' | 'forest' | 'glacier' | 'delta' | 'volcano' | 'archipelago';
export interface NameablePlate {
    plateId: number;
    type: PlateKind;
    /** 屏幕坐标质心 [x, y]（y 向下） */
    centroid: [number, number];
}
export interface NameableRegion {
    /** 唯一标识，用于改名后回写 */
    key: string;
    type: TerrainType;
    centroid: [number, number];
    area: number;
}
export interface NamedPlate {
    plateId: number;
    type: PlateKind;
    name: string;
    centroid: [number, number];
}
export interface NamedRegion {
    key: string;
    type: TerrainType;
    name: string;
    centroid: [number, number];
    area: number;
}
export interface NameManifest {
    plates: NamedPlate[];
    regions: NamedRegion[];
}
/**
 * 生成板块与地形区名称。
 * @param seed  PRNG 种子（同一地图 seed → 同一名称集，BR-4）
 * @param width 地图宽度（像素）
 * @param height 地图高度（像素）
 * @param plates 待命名的板块
 * @param regions 待命名的地形区
 */
export declare function generateNames(seed: number, width: number, height: number, plates: NameablePlate[], regions: NameableRegion[]): NameManifest;
/**
 * 编辑后刷新名称：从 MapData 纹理重算板块质心、检测地形区、生成名称，并保留旧板块名（含用户改名）。
 * 高内聚：把 plateCentroid 计算 + detectTerrainRegions + generateNames + 旧名保留 收敛到 core 层。
 *
 * @param md          MapData（读 elevTex/moistTex/plateTex，写 names）
 * @param seaLevel    海平面
 * @param snowLine    雪线
 * @param plateCount  板块数（用于 plateTex 解码）
 * @param slope       预提取的坡度场（若未提供则从 elevTex 通道1 读取）
 */
export declare function regenerateNames(md: {
    width: number;
    height: number;
    elevTex: Float32Array;
    moistTex: Float32Array;
    plateTex: Float32Array;
    plates: {
        type: string;
    }[];
    names: NameManifest;
    seed: number;
    iceTex?: Float32Array;
    coastDist?: Float32Array;
    riverTex?: Float32Array;
}, seaLevel: number, snowLine: number, plateCount: number, slope?: Float32Array): void;
