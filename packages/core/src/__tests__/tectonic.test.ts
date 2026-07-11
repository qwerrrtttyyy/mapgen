import { describe, it, expect } from 'vitest';
import { computeBoundaryTypes, generatePlates } from '../tectonic.js';
import type { Plate } from '../tectonic.js';

const W = 32,
  H = 32;

function makePlate(id: number, x: number, y: number, vx: number, vy: number): Plate {
  return {
    id,
    x,
    y,
    vx,
    vy,
    type: 'continent' as const,
    color: [0.5, 0.5, 0.5],
    area: 0,
    boundary: 0,
    growth: 0,
    elevation: 0.3,
    moisture: 0.5,
    temperature: 0.5,
    name: `P${id}`,
    selected: false,
  };
}

/** 构造左右两板块：左板块占 x<W/2，右板块占 x>=W/2。返回 plateId（边界在中线附近）。 */
function splitPlateId(): Float32Array {
  const plateId = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) plateId[y * W + x] = x < W / 2 ? 0 : 1;
  return plateId;
}

describe('computeBoundaryTypes 边界类型符号判定（Bug-A 回归）', () => {
  it('两板块相向运动 → 汇聚边界 (type=1)', () => {
    // 板块0在左(x=0.25)向右(vx=+0.02)；板块1在右(x=0.75)向左(vx=-0.02) → 汇聚
    const plates = [makePlate(0, 0.25, 0.5, 0.02, 0), makePlate(1, 0.75, 0.5, -0.02, 0)];
    const plateId = splitPlateId();
    const { boundaryType, boundaryIntensity } = computeBoundaryTypes(W, H, plateId, plates);
    // 取中线边界像素 (x=W/2-1 与 x=W/2 交界处)
    const midY = H >> 1;
    const leftEdge = midY * W + (W / 2 - 1);
    const rightEdge = midY * W + W / 2;
    // 至少一边被判为汇聚(1)
    const isConv = boundaryType[leftEdge] === 1 || boundaryType[rightEdge] === 1;
    expect(isConv).toBe(true);
    // 强度应为正
    expect(boundaryIntensity[leftEdge]).toBeGreaterThan(0);
  });

  it('两板块背向运动 → 离散边界 (type=2)', () => {
    // 板块0在左向左(vx=-0.02)；板块1在右向右(vx=+0.02) → 离散
    const plates = [makePlate(0, 0.25, 0.5, -0.02, 0), makePlate(1, 0.75, 0.5, 0.02, 0)];
    const plateId = splitPlateId();
    const { boundaryType, boundaryIntensity } = computeBoundaryTypes(W, H, plateId, plates);
    const midY = H >> 1;
    const leftEdge = midY * W + (W / 2 - 1);
    const rightEdge = midY * W + W / 2;
    const isDiv = boundaryType[leftEdge] === 2 || boundaryType[rightEdge] === 2;
    expect(isDiv).toBe(true);
    expect(boundaryIntensity[leftEdge]).toBeGreaterThan(0);
  });

  it('两板块同速同向 → 转换边界 (type=3) 或无边界', () => {
    // 同速同向 → relSpeed≈0 → type=0 (无边界)
    const plates = [makePlate(0, 0.25, 0.5, 0.01, 0), makePlate(1, 0.75, 0.5, 0.01, 0)];
    const plateId = splitPlateId();
    const { boundaryType } = computeBoundaryTypes(W, H, plateId, plates);
    const midY = H >> 1;
    const leftEdge = midY * W + (W / 2 - 1);
    // relSpeed < 1e-6 → type=0
    expect(boundaryType[leftEdge] === 0 || boundaryType[leftEdge] === 3).toBe(true);
  });
});

describe('generatePlates 种子可重现性（P0-1 回归）', () => {
  // 回归测试：原实现使用 Math.random() 为板块生成 elevation/moisture/temperature，
  // 导致同一种子在不同运行中生成不同地图。修复后用 PRNG 替代，必须保证确定性。

  it('相同 seed 产生完全相同的板块属性', () => {
    const a = generatePlates(12345, 8, 256, 256, 0.5);
    const b = generatePlates(12345, 8, 256, 256, 0.5);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].elevation).toBe(b[i].elevation);
      expect(a[i].moisture).toBe(b[i].moisture);
      expect(a[i].temperature).toBe(b[i].temperature);
      // 几何属性本来就确定性（依赖 noise）
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
    }
  });

  it('不同 seed 产生不同的板块属性', () => {
    const a = generatePlates(12345, 8, 256, 256, 0.5);
    const b = generatePlates(99999, 8, 256, 256, 0.5);
    let differs = false;
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].elevation !== b[i].elevation ||
        a[i].moisture !== b[i].moisture ||
        a[i].temperature !== b[i].temperature
      ) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('大陆板块 elevation 在 [0.3, 0.7)，海洋板块在 [-0.6, -0.3)', () => {
    const plates = generatePlates(42, 10, 128, 128, 0.6); // 6 大陆 + 4 海洋
    for (const p of plates) {
      if (p.type === 'continent') {
        expect(p.elevation).toBeGreaterThanOrEqual(0.3);
        expect(p.elevation).toBeLessThan(0.7);
      } else {
        expect(p.elevation).toBeGreaterThanOrEqual(-0.6);
        expect(p.elevation).toBeLessThan(-0.3);
      }
    }
  });
});
