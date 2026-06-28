import { describe, it, expect } from 'vitest';
import { computeVolcanism } from '../volcanism.js';
import { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes } from '../tectonic.js';

describe('火山系统', () => {
  const W = 32, H = 32;

  function buildTectonics(seed: number) {
    const plates = generatePlates(seed, 6, W, H, 0.5);
    const assigned = assignPlates(W, H, plates);
    const boundary = computeBoundaries(W, H, assigned.plateId);
    const { boundaryType } = computeBoundaryTypes(W, H, assigned.plateId, plates);
    return { plates, plateId: assigned.plateId, boundary, boundaryType };
  }

  it('零强度 → 空结果', () => {
    const elevation = new Float32Array(W * H).fill(-0.3);
    const t = buildTectonics(42);
    const result = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 3, intensity: 0, seed: 42,
    });
    expect(result.hotspots).toHaveLength(0);
    expect(result.volcanoSites).toHaveLength(0);
  });

  it('热点数量与 hotspotCount 一致', () => {
    const elevation = new Float32Array(W * H).fill(-0.3);
    const t = buildTectonics(42);
    const result = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 4, intensity: 1, seed: 42,
    });
    expect(result.hotspots).toHaveLength(4);
    for (const h of result.hotspots) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThan(W);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeLessThan(H);
      expect(h.strength).toBeGreaterThan(0);
      expect(h.strength).toBeLessThanOrEqual(1);
    }
  });

  it('火山概率场值在 [0,1] 范围内', () => {
    const elevation = new Float32Array(W * H).fill(-0.3);
    const t = buildTectonics(42);
    const result = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 3, intensity: 1, seed: 42,
    });
    for (let i = 0; i < W * H; i++) {
      expect(result.volcanoProb[i]).toBeGreaterThanOrEqual(0);
      expect(result.volcanoProb[i]).toBeLessThanOrEqual(1);
    }
  });

  it('强度系数 > 1 时概率场值更高（平均）', () => {
    const elevation = new Float32Array(W * H).fill(0.5); // 全陆地高海拔
    const t = buildTectonics(42);
    const low = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 3, intensity: 0.5, seed: 42,
    });
    const high = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 3, intensity: 2, seed: 42,
    });
    let lowSum = 0, highSum = 0;
    for (let i = 0; i < W * H; i++) {
      lowSum += low.volcanoProb[i];
      highSum += high.volcanoProb[i];
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('calderaMask 值为 0/1/2', () => {
    const elevation = new Float32Array(W * H).fill(0.5);
    const t = buildTectonics(42);
    const result = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 5, intensity: 1.5, seed: 42,
    });
    for (let i = 0; i < W * H; i++) {
      expect(result.calderaMask[i]).toBeGreaterThanOrEqual(0);
      expect(result.calderaMask[i]).toBeLessThanOrEqual(2);
    }
  });

  it('火山位置在地图范围内', () => {
    const elevation = new Float32Array(W * H).fill(0.5);
    const t = buildTectonics(42);
    const result = computeVolcanism({
      width: W, height: H, elevation, seaLevel: 0,
      plateId: t.plateId, plates: t.plates,
      boundary: t.boundary, boundaryType: new Float32Array(t.boundaryType),
      hotspotCount: 5, intensity: 1, seed: 42,
    });
    for (const v of result.volcanoSites) {
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThan(W);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThan(H);
      expect(['hotspot', 'arc', 'ridge', 'rift']).toContain(v.kind);
      expect(v.strength).toBeGreaterThan(0);
      expect(v.strength).toBeLessThanOrEqual(1);
    }
  });
});
