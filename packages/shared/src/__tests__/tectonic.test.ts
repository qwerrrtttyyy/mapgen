import { describe, it, expect } from 'vitest';
import { computeBoundaryTypes } from '../tectonic.js';
import type { Plate } from '../tectonic.js';

const W = 32, H = 32;

function makePlate(id: number, x: number, y: number, vx: number, vy: number): Plate {
  return {
    id, x, y, vx, vy,
    type: 'continent' as const,
    color: [0.5, 0.5, 0.5], area: 0, boundary: 0, growth: 0,
    elevation: 0.3, moisture: 0.5, temperature: 0.5, name: `P${id}`, selected: false,
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
    const rightEdge = midY * W + (W / 2);
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
    const rightEdge = midY * W + (W / 2);
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
