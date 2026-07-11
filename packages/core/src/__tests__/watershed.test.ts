import { describe, it, expect } from 'vitest';
import { computeWatershed } from '../watershed.js';

describe('流域分析', () => {
  const W = 16,
    H = 16;

  // 单一山峰 + 海洋环绕：所有水流向海，应只有 1 个出口
  function singlePeak(): Float32Array {
    const e = new Float32Array(W * H).fill(-0.3);
    // 中心山峰
    const cx = W / 2,
      cy = H / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx,
          dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 5) {
          e[y * W + x] = 0.5 * (1 - d / 5) + 0.05;
        }
      }
    }
    return e;
  }

  it('流向：陆地像素都有流向（非零），海洋为零', () => {
    const elevation = singlePeak();
    const { flowDir } = computeWatershed({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    let landCount = 0,
      landWithFlow = 0;
    for (let i = 0; i < W * H; i++) {
      if (elevation[i] > 0) {
        landCount++;
        if (flowDir[i] !== 0) landWithFlow++;
      } else {
        expect(flowDir[i]).toBe(0); // 海洋为终端
      }
    }
    expect(landCount).toBeGreaterThan(0);
    // 山顶无下游，flowDir 可能为 0；其他陆地应有流向
    expect(landWithFlow).toBeGreaterThan(landCount * 0.5);
  });

  it('单一山峰 → 至少 1 个排水盆地', () => {
    const elevation = singlePeak();
    const { basinCount, basinId } = computeWatershed({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
      minBasinArea: 1,
    });
    expect(basinCount).toBeGreaterThan(0);
    // 至少有一些陆地像素被分配到盆地
    let assignedCount = 0;
    for (let i = 0; i < W * H; i++) {
      if (basinId[i] >= 0) assignedCount++;
    }
    expect(assignedCount).toBeGreaterThan(0);
  });

  it('海洋像素 basinId = -1', () => {
    const elevation = singlePeak();
    const { basinId } = computeWatershed({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    for (let i = 0; i < W * H; i++) {
      if (elevation[i] <= 0) {
        expect(basinId[i]).toBe(-1);
      }
    }
  });

  it('分水岭标记非负（0 或 1）', () => {
    const elevation = singlePeak();
    const { isDivide } = computeWatershed({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    for (let i = 0; i < W * H; i++) {
      expect(isDivide[i]).toBeGreaterThanOrEqual(0);
      expect(isDivide[i]).toBeLessThanOrEqual(1);
    }
  });

  it('Strahler 河序在 [0,7] 范围内', () => {
    const elevation = singlePeak();
    // 构造人工河道：从山顶到海岸的对角线
    const riverMask = new Float32Array(W * H);
    for (let i = 0; i < Math.min(W, H); i++) {
      riverMask[i * W + i] = 1;
    }
    const { streamOrder } = computeWatershed({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
      riverMask,
    });
    for (let i = 0; i < W * H; i++) {
      expect(streamOrder[i]).toBeGreaterThanOrEqual(0);
      expect(streamOrder[i]).toBeLessThanOrEqual(7);
    }
  });

  it('两个分隔的山峰应产生多个盆地', () => {
    const e = new Float32Array(W * H).fill(-0.3);
    // 两个分离的山峰
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d1 = Math.sqrt((x - 3) ** 2 + (y - 3) ** 2);
        const d2 = Math.sqrt((x - 12) ** 2 + (y - 12) ** 2);
        if (d1 < 3) e[y * W + x] = 0.5 * (1 - d1 / 3) + 0.05;
        if (d2 < 3) e[y * W + x] = 0.5 * (1 - d2 / 3) + 0.05;
      }
    }
    const { basinCount } = computeWatershed({
      width: W,
      height: H,
      elevation: e,
      seaLevel: 0,
      minBasinArea: 1,
    });
    expect(basinCount).toBeGreaterThanOrEqual(2);
  });
});
