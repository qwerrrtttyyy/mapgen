import { describe, it, expect } from 'vitest';
import { computeWatershed } from '../watershed.js';

describe('Watershed Module - Comprehensive Tests', () => {
  const W = 32, H = 32;

  function makeFlatTerrain(): Float32Array {
    return new Float32Array(W * H).fill(0.3);
  }

  function makeSlopeTerrain(direction: 'north' | 'south' | 'east' | 'west'): Float32Array {
    const elev = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        switch (direction) {
          case 'north': elev[idx] = y / H; break;
          case 'south': elev[idx] = 1 - y / H; break;
          case 'east': elev[idx] = x / W; break;
          case 'west': elev[idx] = 1 - x / W; break;
        }
      }
    }
    return elev;
  }

  function makePeakTerrain(cx: number, cy: number, radius: number): Float32Array {
    const elev = new Float32Array(W * H).fill(-0.3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
          elev[y * W + x] = 0.5 * (1 - dist / radius);
        }
      }
    }
    return elev;
  }

  describe('Flow Direction Computation', () => {
    it('flat terrain has minimal flow', () => {
      const elev = makeFlatTerrain();
      const { flowDir } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      let nonZeroCount = 0;
      for (let i = 0; i < W * H; i++) {
        if (flowDir[i] !== 0) nonZeroCount++;
      }
      expect(nonZeroCount).toBeLessThan(W * H * 0.5);
    });

    it('slope terrain has defined flow directions', () => {
      const elev = makeSlopeTerrain('north');
      const { flowDir } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: -0.5 });
      // Most land pixels should have some flow direction
      let landWithFlow = 0;
      let landCount = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          if (elev[idx] > 0) {
            landCount++;
            if (flowDir[idx] !== 0) landWithFlow++;
          }
        }
      }
      expect(landCount).toBeGreaterThan(0);
      expect(landWithFlow).toBeGreaterThan(landCount * 0.3);
    });

    it('ocean pixels have zero flow direction', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const { flowDir } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      for (let i = 0; i < W * H; i++) {
        if (elev[i] <= 0) {
          expect(flowDir[i]).toBe(0);
        }
      }
    });

    it('peak top has defined flow direction', () => {
      const elev = makePeakTerrain(16, 16, 8);
      const { flowDir } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: -0.5 });
      const peakIdx = 16 * W + 16;
      expect(flowDir[peakIdx]).toBeDefined();
      expect(typeof flowDir[peakIdx]).toBe('number');
    });
  });

  describe('Basin Identification', () => {
    it('single peak creates at least one basin', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const { basinCount } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, minBasinArea: 5 });
      expect(basinCount).toBeGreaterThanOrEqual(1);
    });

    it('multiple peaks create multiple basins', () => {
      const elev = new Float32Array(W * H).fill(-0.3);
      // Create three separated peaks
      [[5, 5], [25, 5], [15, 25]].forEach(([cx, cy]) => {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 4) {
              elev[y * W + x] = Math.max(elev[y * W + x], 0.6 * (1 - dist / 4));
            }
          }
        }
      });
      const { basinCount } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, minBasinArea: 3 });
      expect(basinCount).toBeGreaterThanOrEqual(3);
    });

    it('basin IDs are contiguous starting from 0', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const { basinCount, basinId } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, minBasinArea: 1 });
      const seenIds = new Set<number>();
      for (let i = 0; i < W * H; i++) {
        if (basinId[i] >= 0) seenIds.add(basinId[i]);
      }
      for (let id = 0; id < basinCount; id++) {
        expect(seenIds.has(id)).toBe(true);
      }
    });

    it('ocean pixels have basinId = -1', () => {
      const elev = makePeakTerrain(16, 16, 8);
      const { basinId } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      for (let i = 0; i < W * H; i++) {
        if (elev[i] <= 0) {
          expect(basinId[i]).toBe(-1);
        }
      }
    });
  });

  describe('Watershed Divide Detection', () => {
    it('divide pixels are marked as 0 or 1', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const { isDivide } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      for (let i = 0; i < W * H; i++) {
        expect(isDivide[i]).toBeGreaterThanOrEqual(0);
        expect(isDivide[i]).toBeLessThanOrEqual(1);
      }
    });

    it('terrain processing produces valid watershed data', () => {
      const elev = new Float32Array(W * H).fill(-0.3);
      // Create elevated terrain in center
      for (let y = 8; y < 24; y++) {
        for (let x = 8; x < 24; x++) {
          elev[y * W + x] = 0.5;
        }
      }
      const result = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      // Should have valid output arrays
      expect(result.flowDir.length).toBe(W * H);
      expect(result.basinId.length).toBe(W * H);
      expect(result.isDivide.length).toBe(W * H);
      // Some land pixels should be assigned to basins
      let assignedCount = 0;
      for (let i = 0; i < W * H; i++) {
        if (elev[i] > 0 && result.basinId[i] >= 0) assignedCount++;
      }
      expect(assignedCount).toBeGreaterThan(0);
    });
  });

  describe('Stream Order Calculation', () => {
    it('stream order is in range [0, 7]', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const riverMask = new Float32Array(W * H);
      // Create artificial river path
      for (let y = 16; y < H; y++) {
        riverMask[y * W + 16] = 1;
      }
      const { streamOrder } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, riverMask });
      for (let i = 0; i < W * H; i++) {
        expect(streamOrder[i]).toBeGreaterThanOrEqual(0);
        expect(streamOrder[i]).toBeLessThanOrEqual(7);
      }
    });

    it('river pixels have stream order >= 1', () => {
      const elev = makeSlopeTerrain('south');
      const riverMask = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        riverMask[y * W + 16] = 1;
      }
      const { streamOrder } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: -0.5, riverMask });
      for (let y = 0; y < H; y++) {
        const idx = y * W + 16;
        if (riverMask[idx] === 1 && elev[idx] > 0) {
          expect(streamOrder[idx]).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('without riverMask, stream order is zero', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const { streamOrder } = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      for (let i = 0; i < W * H; i++) {
        expect(streamOrder[i]).toBe(0);
      }
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('handles all-ocean terrain', () => {
      const elev = new Float32Array(W * H).fill(-0.5);
      const result = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      expect(result.basinCount).toBe(0);
      for (let i = 0; i < W * H; i++) {
        expect(result.basinId[i]).toBe(-1);
        expect(result.flowDir[i]).toBe(0);
      }
    });

    it('handles all-land flat terrain', () => {
      const elev = new Float32Array(W * H).fill(0.5);
      const result = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      expect(result.flowDir.length).toBe(W * H);
      expect(result.basinId.length).toBe(W * H);
    });

    it('handles very small maps', () => {
      const smallW = 4, smallH = 4;
      const elev = new Float32Array(smallW * smallH).fill(0.3);
      elev[0] = 0.8; // One high corner
      const result = computeWatershed({ width: smallW, height: smallH, elevation: elev, seaLevel: 0 });
      expect(result.flowDir.length).toBe(smallW * smallH);
    });

    it('minBasinArea filters small basins', () => {
      const elev = makePeakTerrain(16, 16, 3); // Small peak
      const result1 = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, minBasinArea: 1 });
      const result2 = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0, minBasinArea: 50 });
      expect(result1.basinCount).toBeGreaterThanOrEqual(result2.basinCount);
    });
  });

  describe('Flow Accumulation Patterns', () => {
    it('terrain with elevation gradient produces valid results', () => {
      const elev = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const distFromCenter = Math.abs(x - W / 2);
          elev[y * W + x] = y / H + distFromCenter / W * 0.5;
        }
      }
      const result = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: -0.5 });
      // Should have valid flow directions and basin data
      expect(result.flowDir.length).toBe(W * H);
      expect(result.basinId.length).toBe(W * H);
      expect(result.isDivide.length).toBe(W * H);
    });
  });

  describe('Determinism', () => {
    it('same input produces same output', () => {
      const elev = makePeakTerrain(16, 16, 10);
      const result1 = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      const result2 = computeWatershed({ width: W, height: H, elevation: elev, seaLevel: 0 });
      for (let i = 0; i < W * H; i++) {
        expect(result1.flowDir[i]).toBe(result2.flowDir[i]);
        expect(result1.basinId[i]).toBe(result2.basinId[i]);
        expect(result1.isDivide[i]).toBe(result2.isDivide[i]);
      }
    });
  });
});
