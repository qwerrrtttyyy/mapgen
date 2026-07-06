import { describe, it, expect } from 'vitest';
import { computeSlope } from '../slope.js';

describe('Slope 坡度计算', () => {
  const W = 64, H = 64;

  describe('computeSlope 坡度场', () => {
    it('平坦区域坡度为零', () => {
      const elevation = new Float32Array(W * H).fill(0.5);
      const slope = computeSlope(W, H, elevation);

      expect(slope.every(s => s === 0)).toBe(true);
    });

    it('陡峭区域坡度高', () => {
      // 创建阶梯地形
      const elevation = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          elevation[y * W + x] = x < W / 2 ? 0.8 : 0.2;
        }
      }

      const slope = computeSlope(W, H, elevation);
      const midIdx = Math.floor(H / 2) * W + Math.floor(W / 2);

      // 边界处坡度应较高
      expect(slope[midIdx]).toBeGreaterThan(0.3);
    });

    it('平滑过渡坡度中等', () => {
      // 创建渐进坡度
      const elevation = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          elevation[y * W + x] = x / W;
        }
      }

      const slope = computeSlope(W, H, elevation);

      // 中等坡度区域
      for (let y = 0; y < H; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          expect(slope[idx]).toBeGreaterThan(0);
          expect(slope[idx]).toBeLessThan(0.5);
        }
      }
    });

    it('山峰区域坡度高', () => {
      const elevation = new Float32Array(W * H);
      const center = Math.floor(H / 2) * W + Math.floor(W / 2);

      // 创建山峰
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = x - W / 2;
          const dy = y - H / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          elevation[y * W + x] = Math.max(0.2, 0.8 - dist * 0.02);
        }
      }

      const slope = computeSlope(W, H, elevation);

      // 山峰周围坡度应高
      const aroundPeak = center - W - 1;
      expect(slope[aroundPeak]).toBeGreaterThan(0.01);
    });

    it('边界处理正确', () => {
      const elevation = new Float32Array(W * H).fill(0.5);
      elevation[0] = 0.8; // 左上角异常值

      const slope = computeSlope(W, H, elevation);

      // 边界应有有效值（不崩溃）
      expect(slope[0]).toBeDefined();
      expect(typeof slope[0]).toBe('number');
    });
  });
});