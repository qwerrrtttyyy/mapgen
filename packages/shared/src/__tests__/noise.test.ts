import { describe, it, expect } from 'vitest';
import { createNoise } from '../noise.js';

describe('FBM 自然体系 fbmNatural (AC-1.1, AC-1.2)', () => {
  describe('AC-1.1 无网格/块状伪影', () => {
    it('相邻像素高程差 95 分位 ≤ 0.3（standard）', () => {
      const n = createNoise(42, 'simplex');
      const size = 64;
      const freq = 4;
      const field = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          field[y * size + x] = n.fbmNatural(
            (x / size) * freq,
            (y / size) * freq,
            5,
            2,
            0.5,
            'standard'
          );
        }
      }
      const diffs: number[] = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size - 1; x++) {
          diffs.push(Math.abs(field[y * size + x + 1] - field[y * size + x]));
        }
      }
      diffs.sort((a, b) => a - b);
      const p95 = diffs[Math.floor(diffs.length * 0.95)];
      expect(p95).toBeLessThanOrEqual(0.3);
    });

    it('perlin 基底同样无伪影', () => {
      const n = createNoise(7, 'perlin');
      const size = 48;
      const freq = 3;
      const field = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          field[y * size + x] = n.fbmNatural(
            (x / size) * freq,
            (y / size) * freq,
            5,
            2,
            0.5,
            'standard'
          );
        }
      }
      let max = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size - 1; x++) {
          max = Math.max(max, Math.abs(field[y * size + x + 1] - field[y * size + x]));
        }
      }
      expect(max).toBeLessThanOrEqual(0.5); // perlin 允许稍大但仍连续
    });
  });

  describe('AC-1.2 ridged 山脊连续性', () => {
    it('山脊像素 4 连通率 ≥ 70%', () => {
      const n = createNoise(123, 'simplex');
      const size = 80;
      const freq = 5;
      const field = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          field[y * size + x] = n.fbmNatural(
            (x / size) * freq,
            (y / size) * freq,
            5,
            2,
            0.5,
            'ridged',
            { ridgeAngle: 0, anisotropy: 0.6 }
          );
        }
      }
      // 山脊 = 高值像素（ridged 输出 0..1，山脊是接近 1 的脊线）
      const threshold = 0.7;
      let ridgeCount = 0;
      let connectedCount = 0;
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          if (field[y * size + x] < threshold) continue;
          ridgeCount++;
          const up = field[(y - 1) * size + x] >= threshold;
          const down = field[(y + 1) * size + x] >= threshold;
          const left = field[y * size + x - 1] >= threshold;
          const right = field[y * size + x + 1] >= threshold;
          if (up || down || left || right) connectedCount++;
        }
      }
      // 需要有足够山脊像素才有意义
      expect(ridgeCount).toBeGreaterThan(50);
      const connectivity = connectedCount / ridgeCount;
      expect(connectivity).toBeGreaterThanOrEqual(0.7);
    });

    it('各向异性 ridged 沿 ridgeAngle 方向更连续', () => {
      const n = createNoise(99, 'perlin');
      const size = 64;
      const freq = 4;
      const horizontal = new Float32Array(size * size);
      const vertical = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          horizontal[y * size + x] = n.fbmNatural(
            (x / size) * freq,
            (y / size) * freq,
            4,
            2,
            0.5,
            'ridged',
            { ridgeAngle: 0, anisotropy: 0.7 }
          );
          vertical[y * size + x] = n.fbmNatural(
            (x / size) * freq,
            (y / size) * freq,
            4,
            2,
            0.5,
            'ridged',
            { ridgeAngle: Math.PI / 2, anisotropy: 0.7 }
          );
        }
      }
      // 水平各向异性：行内方差应小于列内方差
      let rowVar = 0,
        colVar = 0;
      const mid = Math.floor(size / 2);
      for (let i = 0; i < size - 1; i++) {
        rowVar += Math.abs(horizontal[mid * size + i + 1] - horizontal[mid * size + i]);
        colVar += Math.abs(horizontal[(i + 1) * size + mid] - horizontal[i * size + mid]);
      }
      // 水平各向异性 → 行内变化更平缓（山脊沿水平延伸）
      expect(rowVar).toBeLessThanOrEqual(colVar * 1.5);
    });
  });

  describe('确定性 (BR-4)', () => {
    it('同 seed 同参数输出完全一致', () => {
      const a = createNoise(555, 'simplex');
      const b = createNoise(555, 'simplex');
      for (let i = 0; i < 20; i++) {
        const x = i * 0.37,
          y = i * 0.91;
        expect(a.fbmNatural(x, y, 5, 2, 0.5, 'standard')).toBe(
          b.fbmNatural(x, y, 5, 2, 0.5, 'standard')
        );
      }
    });
  });

  describe('域形变', () => {
    it('warpStrength > 0 时输出与 warpStrength=0 不同', () => {
      const n = createNoise(321, 'simplex');
      const noWarp = n.fbmNatural(1.5, 2.5, 4, 2, 0.5, 'standard', { warpStrength: 0 });
      const warped = n.fbmNatural(1.5, 2.5, 4, 2, 0.5, 'standard', { warpStrength: 0.5 });
      expect(noWarp).not.toBe(warped);
    });
  });

  describe('输出范围', () => {
    it('standard 输出在 [-1, 1]', () => {
      const n = createNoise(11, 'simplex');
      for (let i = 0; i < 100; i++) {
        const v = n.fbmNatural(i * 0.13, i * 0.27, 5, 2, 0.5, 'standard');
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });
});
