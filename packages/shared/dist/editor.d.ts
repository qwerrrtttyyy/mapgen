import type { TerrainType } from './naming.js';
import type { Plate } from './tectonic.js';
export interface DetectedRegion {
    key: string;
    type: TerrainType;
    centroid: [number, number];
    area: number;
}
/** 世界式生成数据（可选，用于检测冰川/三角洲等地形） */
export interface TerrainDetectOptions {
    /** 陆地冰厚（来自 ice.ts）——检测冰川 */
    landIce?: Float32Array;
    /** 海岸距离场（陆地正）——检测三角洲 */
    coastDist?: Float32Array;
    /** 河流掩码——检测三角洲 */
    riverMask?: Float32Array;
    /** v2: 火山概率场 [0,1]（来自 volcanism.ts）——强化火山检测 */
    volcanoProb?: Float32Array;
    /** v2: 生物群系 ID（来自 biomes.ts）——细分地形区 */
    biomeId?: Uint8Array;
    /** v2: Strahler 河序（来自 watershed.ts）——大河河谷标注 */
    streamOrder?: Uint8Array;
    /** v2: 盆地编号（来自 watershed.ts）——大河流域标注 */
    basinId?: Int32Array;
}
/**
 * 检测地形区连通域（AC-8.2 + 世界式增强）。
 * 4 邻接连通域标记 + 碎片过滤 + 质心/面积计算 + 后处理（火山/群岛）。
 *
 * @param minArea 面积小于此值的碎片被丢弃（默认 30 像素）
 * @param options 可选世界式数据（landIce/coastDist/riverMask），启用冰川/三角洲检测
 */
export declare function detectTerrainRegions(width: number, height: number, elevation: Float32Array, slope: Float32Array, moisture: Float32Array, seaLevel: number, snowLine: number, minArea?: number, options?: TerrainDetectOptions): DetectedRegion[];
export interface Command {
    readonly kind: string;
    undo(): void;
    redo(): void;
}
/**
 * 撤销/重做栈。max=50（BR-3）。新编辑清空 redo 栈。
 */
export declare class CommandStack {
    private undoStack;
    private redoStack;
    private readonly max;
    constructor(max?: number);
    push(cmd: Command): void;
    undo(): boolean;
    redo(): boolean;
    get canUndo(): boolean;
    get canRedo(): boolean;
    get undoDepth(): number;
    get redoDepth(): number;
    clear(): void;
}
export type BrushTarget = 'raise' | 'lower' | 'sea' | 'land' | 'plate-paint';
export type VectorTarget = 'sea' | 'land' | 'lake';
/**
 * 画笔涂刷（AC-5.1, AC-5.2）。
 * 返回 Command，redo 已应用（调用方负责压栈）。
 * @param data  elevation 或 plateId 数组
 * @param target  raise/lower 调整高程；sea/land 设定陆海；plate-paint 切换板块
 */
export declare function applyBrushStroke(width: number, height: number, data: Float32Array, cx: number, cy: number, radius: number, strength: number, target: BrushTarget, opts?: {
    targetPlateId?: number;
    seaLevel?: number;
}): Command;
export declare function applyVectorMountain(width: number, height: number, elevation: Float32Array, line: number[][], width_: number, mountainHeight: number): Command;
export declare function applyVectorPolygon(width: number, height: number, elevation: Float32Array, polygon: number[][], target: VectorTarget, seaLevel?: number): Command;
/**
 * 基于当前 plateId 重算每个板块的质心、type、plateDist。
 * - 质心：板块所有像素的算术平均（像素坐标）。
 * - type：板块像素平均高程 > seaLevel → continent，否则 ocean。
 * - plateDist：每个像素到所属板块质心的欧氏距离（像素单位）。
 *
 * 用于 plate-paint / 板块拖拽后局部重算高程前，修正 generateElevation 依赖的几何量。
 */
export declare function recomputePlateGeometry(width: number, height: number, plateId: Float32Array, plates: Plate[], elevation: Float32Array, seaLevel: number): {
    plateDist: Float32Array;
    plates: Plate[];
};
export declare function movePlate(width: number, height: number, plateId: Float32Array, plateIdValue: number, dx: number, dy: number): Command;
