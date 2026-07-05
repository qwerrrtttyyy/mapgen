/**
 * 中心差分计算坡度。边界像素用自身值做外推（一阶导为 0）。
 * @param width   地图宽度（像素）
 * @param height  地图高度（像素）
 * @param elevation 高程场 [0..1]
 * @returns slope 每像素高程差的梯度模长（与 detectTerrainRegions 阈值标度一致）
 */
export declare function computeSlope(width: number, height: number, elevation: Float32Array): Float32Array;
