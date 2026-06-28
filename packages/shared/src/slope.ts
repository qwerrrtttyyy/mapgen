// 坡度计算：中心差分有限差分，量纲=每像素高程差。
// 单一实现源（erosion.ts / 编辑器 / refreshNames 共用），消除标度分叉（Bug-E 根源）。

/**
 * 中心差分计算坡度。边界像素用自身值做外推（一阶导为 0）。
 * @param width   地图宽度（像素）
 * @param height  地图高度（像素）
 * @param elevation 高程场 [0..1]
 * @returns slope 每像素高程差的梯度模长（与 detectTerrainRegions 阈值标度一致）
 */
export function computeSlope(width: number, height: number, elevation: Float32Array): Float32Array {
  const slope = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const xl = x > 0 ? elevation[idx - 1] : elevation[idx];
      const xr = x < width - 1 ? elevation[idx + 1] : elevation[idx];
      const yu = y > 0 ? elevation[idx - width] : elevation[idx];
      const yd = y < height - 1 ? elevation[idx + width] : elevation[idx];
      const dzdx = (xr - xl) * 0.5;
      const dzdy = (yd - yu) * 0.5;
      slope[idx] = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
    }
  }
  return slope;
}
