/**
 * 多源 BFS 计算带符号海岸距离场。
 * 海岸定义：陆地像素与海洋像素 4-邻接的边界像素（陆地侧与海洋侧都标记为 0）。
 *
 * @param width       地图宽度
 * @param height      地图高度
 * @param elevation   高程场
 * @param seaLevel    海平面
 * @returns coastDist 陆地为正（向内陆增大），海洋为负（向远海减小），海岸为 0
 */
export declare function computeCoastDistance(width: number, height: number, elevation: Float32Array, seaLevel: number): Float32Array;
/**
 * 大陆度系数 [0, 1]：0=海岸，1=内陆深处。
 * 用于温度修正（内陆冬冷夏热，简化为整体偏冷 + 极端温差）。
 * @param coastDist 海岸距离场（陆地正）
 * @param maxDist   归一化距离阈值（典型 ~30 像素）
 */
export declare function continentalityFactor(coastDist: Float32Array, maxDist: number): Float32Array;
