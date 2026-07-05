export interface WatershedInput {
    width: number;
    height: number;
    elevation: Float32Array;
    seaLevel: number;
    /** 河流遮罩 [0,1]（用于 Strahler 河序仅对河道计算） */
    riverMask?: Float32Array;
    /** 湖泊遮罩（湖泊视为局部汇，水流进入湖泊后视为终端） */
    lakeMask?: Float32Array;
    /** 仅生成 basinId 时跳过 Strahler 计算（性能优化） */
    skipStreamOrder?: boolean;
    /** 盆地最小面积阈值（像素数 < 此值的盆地合并到邻居） */
    minBasinArea?: number;
}
export interface WatershedResult {
    /** 流向（D8 编码：1=E,2=SE,4=S,8=SW,16=W,32=NW,64=N,128=NE，0=终端/海洋） */
    flowDir: Uint8Array;
    /** 排水盆地编号（同盆地像素同号，海洋为 -1） */
    basinId: Int32Array;
    /** 盆地数量 */
    basinCount: number;
    /** Strahler 河流分级 [0,7]（仅 riverMask > 阈值的像素） */
    streamOrder: Uint8Array;
    /** 大陆分水岭标记（1=分水岭像素，0=否） */
    isDivide: Uint8Array;
    /** 每个盆地的出口坐标（海岸交点） */
    basinOutlets: Array<{
        basinId: number;
        x: number;
        y: number;
    }>;
    /** 每个盆地的面积（像素数） */
    basinAreas: Int32Array;
}
/** 流域分析主入口 */
export declare function computeWatershed(input: WatershedInput): WatershedResult;
