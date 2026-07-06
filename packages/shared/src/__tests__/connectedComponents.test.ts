import { describe, it, expect } from 'vitest';
import { labelComponents, computeComponentStats } from '../connectedComponents.js';

describe('ConnectedComponents 连通域标记', () => {
  const W = 32, H = 32;

  describe('labelComponents 连通域标记', () => {
    it('单一连通域', () => {
      const mask = new Uint8Array(W * H).fill(1);
      const shouldLabel = (i: number) => mask[i] > 0;
      const areConnected = () => true;
      const { labels } = labelComponents(W, H, shouldLabel, areConnected);

      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(1);
    });

    it('两个分离区域', () => {
      const mask = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W / 2 - 5; x++) {
          mask[y * W + x] = 1;
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = W / 2 + 5; x < W; x++) {
          mask[y * W + x] = 1;
        }
      }

      const shouldLabel = (i: number) => mask[i] > 0;
      const areConnected = () => true;
      const { labels } = labelComponents(W, H, shouldLabel, areConnected);
      const uniqueLabels = new Set(Array.from(labels).filter(l => l > 0));

      expect(uniqueLabels.size).toBe(2);
    });

    it('四个角落区域', () => {
      const mask = new Uint8Array(W * H);
      const regionSize = 8;

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

      const shouldLabel = (i: number) => mask[i] > 0;
      const areConnected = () => true;
      const { labels } = labelComponents(W, H, shouldLabel, areConnected);
      const uniqueLabels = new Set(Array.from(labels).filter(l => l > 0));

      expect(uniqueLabels.size).toBe(4);
    });

    it('零值区域标签为零', () => {
      const mask = new Uint8Array(W * H).fill(0);
      const shouldLabel = (i: number) => mask[i] > 0;
      const areConnected = () => true;
      const { labels } = labelComponents(W, H, shouldLabel, areConnected);

      expect(Array.from(labels).every(l => l === 0)).toBe(true);
    });

    it('连通域标签连续', () => {
      const mask = new Uint8Array(W * H);
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

      const shouldLabel = (i: number) => mask[i] > 0;
      const areConnected = () => true;
      const { labels } = labelComponents(W, H, shouldLabel, areConnected);
      const uniqueLabels = Array.from(new Set(Array.from(labels).filter(l => l > 0))).sort((a, b) => a - b);

      expect(uniqueLabels).toEqual([1, 2, 3]);
    });
  });

  describe('computeComponentStats 连通域统计', () => {
    it('计算面积', () => {
      const labels = new Int32Array(W * H);
      const regionSize = 100;
      for (let i = 0; i < regionSize; i++) {
        labels[i] = 1;
      }

      const stats = computeComponentStats(W, H, labels);
      const component1 = stats.get(1);

      expect(component1?.area).toBe(regionSize);
    });

    it('计算质心', () => {
      const labels = new Int32Array(W * H);
      const startX = 10, startY = 10;
      const rwidth = 5, rheight = 5;

      for (let y = startY; y < startY + rheight; y++) {
        for (let x = startX; x < startX + rwidth; x++) {
          labels[y * W + x] = 1;
        }
      }

      const stats = computeComponentStats(W, H, labels);
      const component1 = stats.get(1);

      expect(component1?.sumX / component1!.area).toBeCloseTo(startX + (rwidth - 1) / 2, 1);
      expect(component1?.sumY / component1!.area).toBeCloseTo(startY + (rheight - 1) / 2, 1);
    });

    it('多连通域统计', () => {
      const labels = new Int32Array(W * H);

      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          labels[y * W + x] = 1;
        }
      }

      for (let y = H - 5; y < H; y++) {
        for (let x = W - 5; x < W; x++) {
          labels[y * W + x] = 2;
        }
      }

      const stats = computeComponentStats(W, H, labels);

      expect(stats.size).toBe(2);
      const comps = [...stats.values()].sort((a, b) => a.label - b.label);
      expect(comps[0].label).toBe(1);
      expect(comps[1].label).toBe(2);
    });
  });
});
