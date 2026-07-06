import { describe, it, expect } from 'vitest';
import { labelComponents, computeComponentStats } from '../connectedComponents.js';

describe('ConnectedComponents 连通域标记', () => {
  const W = 32, H = 32;

  describe('labelComponents 连通域标记', () => {
    it('单一连通域', () => {
      const { labels, count } = labelComponents(W, H, () => true, () => true);

      expect(count).toBe(1);
      const uniqueLabels = new Set(labels.filter(l => l > 0));
      expect(uniqueLabels.size).toBe(1);
    });

    it('两个分离区域', () => {
      const mask = new Uint8Array(W * H);
      // 左半区域
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W / 2 - 5; x++) {
          mask[y * W + x] = 1;
        }
      }
      // 右半区域
      for (let y = 0; y < H; y++) {
        for (let x = W / 2 + 5; x < W; x++) {
          mask[y * W + x] = 1;
        }
      }

      const { labels, count } = labelComponents(W, H, (i) => mask[i] === 1, () => true);
      const uniqueLabels = new Set(labels.filter(l => l > 0));

      expect(count).toBe(2);
      expect(uniqueLabels.size).toBe(2);
    });

    it('四个角落区域', () => {
      const mask = new Uint8Array(W * H);
      const regionSize = 8;

      // 四个角落
      for (let y = 0; y < regionSize; y++) {
        for (let x = 0; x < regionSize; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = H - regionSize; y < H; y++) {
        for (let x = 0; x < regionSize; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = 0; y < regionSize; y++) {
        for (let x = W - regionSize; x < W; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = H - regionSize; y < H; y++) {
        for (let x = W - regionSize; x < W; x++) {
          mask[y * W + x] = 1;
        }
      }

      const { labels, count } = labelComponents(W, H, (i) => mask[i] === 1, () => true);
      const uniqueLabels = new Set(labels.filter(l => l > 0));

      expect(count).toBe(4);
      expect(uniqueLabels.size).toBe(4);
    });

    it('零值区域标签为零', () => {
      const { labels } = labelComponents(W, H, () => false, () => true);

      expect(labels.every(l => l === 0)).toBe(true);
    });

    it('连通域标签连续', () => {
      const mask = new Uint8Array(W * H);
      // 创建3个区域
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < 10; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = 11; x < 21; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = 22; x < W; x++) {
          mask[y * W + x] = 1;
        }
      }

      const { labels, count } = labelComponents(W, H, (i) => mask[i] === 1, () => true);
      const uniqueLabels = Array.from(new Set(labels.filter(l => l > 0))).sort((a, b) => a - b);

      expect(count).toBe(3);
      expect(uniqueLabels).toEqual([1, 2, 3]);
    });
  });

  describe('computeComponentStats 连通域统计', () => {
    it('计算面积', () => {
      const labels = new Int32Array(W * H);
      const startX = 5, startY = 5, width = 10, height = 10;

      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          labels[y * W + x] = 1;
        }
      }

      const stats = computeComponentStats(W, H, labels);
      const component1 = stats.get(1);

      expect(component1?.area).toBe(width * height);
    });

    it('计算质心', () => {
      const labels = new Int32Array(W * H);
      const startX = 5, startY = 5, width = 10, height = 10;

      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          labels[y * W + x] = 1;
        }
      }

      const stats = computeComponentStats(W, H, labels);
      const component1 = stats.get(1);

      expect(component1?.sumX / component1?.area).toBeCloseTo(startX + width / 2 - 0.5, 0);
      expect(component1?.sumY / component1?.area).toBeCloseTo(startY + height / 2 - 0.5, 0);
    });

    it('多连通域统计', () => {
      const labels = new Int32Array(W * H);

      // 区域1：左上角
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          labels[y * W + x] = 1;
        }
      }

      // 区域2：右下角
      for (let y = H - 5; y < H; y++) {
        for (let x = W - 5; x < W; x++) {
          labels[y * W + x] = 2;
        }
      }

      const stats = computeComponentStats(W, H, labels);

      expect(stats.size).toBe(2);
      expect(stats.get(1)?.label).toBe(1);
      expect(stats.get(2)?.label).toBe(2);
    });
  });
});
