import { describe, it, expect } from 'vitest';
import { computeCoastDistance, continentalityFactor } from '../coastline.js';

describe('Coastline 海岸距离场', () => {
  const W = 64, H = 64;
  const seaLevel = 0.45;

  describe('computeCoastDistance 海岸距离计算', () => {
    it('陆地内部距离为正', () => {
      // 创建简单高程：中间为陆地，边缘为海洋
      const elevation = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cx = Math.abs(x - W / 2);
          const cy = Math.abs(y - H / 2);
          const dist = Math.sqrt(cx * cx + cy * cy);
          elevation[y * W + x] = dist < 20 ? 0.6 : 0.3;
        }
      }

      const coastDist = computeCoastDistance(W, H, elevation, seaLevel);
      const centerIdx = Math.floor(H / 2) * W + Math.floor(W / 2);
      expect(coastDist[centerIdx]).toBeGreaterThan(0);
    });

    it('海洋区域距离为负', () => {
      const elevation = new Float32Array(W * H);
      // 左半陆地，右半海洋 - 确保存在海岸线
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          elevation[y * W + x] = x < W / 2 ? 0.6 : 0.3;
        }
      }
      const coastDist = computeCoastDistance(W, H, elevation, seaLevel);
      expect(coastDist[W - 1]).toBeLessThan(0);
      expect(coastDist[W * H - 1]).toBeLessThan(0);
    });

    it('海岸线附近距离接近零', () => {
      // 创建阶梯地形：左半陆地，右半海洋
      const elevation = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          elevation[y * W + x] = x < W / 2 ? 0.6 : 0.3;
        }
      }

      const coastDist = computeCoastDistance(W, H, elevation, seaLevel);
      const midIdx = Math.floor(H / 2) * W + Math.floor(W / 2 - 1);
      const absDist = Math.abs(coastDist[midIdx]);
      expect(absDist).toBeLessThan(5);
    });

    it('距离场连续性', () => {
      const elevation = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cx = Math.abs(x - W / 2);
          const cy = Math.abs(y - H / 2);
          const dist = Math.sqrt(cx * cx + cy * cy);
          elevation[y * W + x] = dist < 15 ? 0.6 : 0.3;
        }
      }

      const coastDist = computeCoastDistance(W, H, elevation, seaLevel);

      // 检查相邻像素距离差不超过阈值
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          const diff = Math.abs(coastDist[idx] - coastDist[idx + 1]);
          expect(diff).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('continentalityFactor 大陆度因子', () => {
    it('内陆大陆度高', () => {
      const coastDist = new Float32Array(W * H);
      coastDist.fill(50);
      const factor = continentalityFactor(coastDist, 50);
      const idx = Math.floor(H / 2) * W + Math.floor(W / 2);
      expect(factor[idx]).toBeGreaterThan(0.5);
    });

    it('沿海大陆度低', () => {
      const coastDist = new Float32Array(W * H);
      coastDist.fill(5);
      const factor = continentalityFactor(coastDist, 50);
      const idx = Math.floor(H / 2) * W + Math.floor(W / 2);
      expect(factor[idx]).toBeLessThan(0.3);
    });

    it('海洋大陆度为零', () => {
      const coastDist = new Float32Array(W * H);
      coastDist.fill(-20);
      const factor = continentalityFactor(coastDist, 50);
      expect(factor[0]).toBe(0);
    });
  });
});