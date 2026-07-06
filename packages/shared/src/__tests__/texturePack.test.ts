import { describe, it, expect } from 'vitest';
import { classifyBiome, extractChannel, extractPlateId } from '../texturePack.js';

describe('TexturePack 纹理打包', () => {
  const W = 32, H = 32;
  const size = W * H;

  describe('classifyBiome 生物群系分类', () => {
    it('海洋生物群系', () => {
      const biome = classifyBiome(0.3, 0.5, 0.7, 0.45, 0.5);
      expect(biome).toBe(0);
    });

    it('雪山生物群系', () => {
      const biome = classifyBiome(0.65, 0.3, 0.4, 0.45, 0.5);
      expect(biome).toBe(1);
    });

    it('山脉生物群系', () => {
      const biome = classifyBiome(0.85, 0.5, 0.4, 0.45, 0.5);
      expect(biome).toBe(2);
    });

    it('冻原生物群系', () => {
      const biome = classifyBiome(0.5, -0.5, 0.5, 0.45, 0.5);
      expect(biome).toBe(3);
    });

    it('沙漠生物群系', () => {
      const biome = classifyBiome(0.5, 0.6, 0.1, 0.45, 0.5);
      expect(biome).toBeGreaterThan(9);
    });

    it('热带雨林生物群系', () => {
      const biome = classifyBiome(0.55, 0.6, 0.8, 0.45, 0.5);
      expect(biome).toBe(11);
    });

    it('返回值在 0-14 范围内', () => {
      for (let elev = 0; elev <= 1; elev += 0.1) {
        for (let temp = -1; temp <= 1; temp += 0.1) {
          for (let moist = 0; moist <= 1; moist += 0.1) {
            const biome = classifyBiome(elev, temp, moist, 0.45, 0.5);
            expect(biome).toBeGreaterThanOrEqual(0);
            expect(biome).toBeLessThanOrEqual(14);
            expect(Number.isInteger(biome)).toBe(true);
          }
        }
      }
    });

    it('海平面以下均为海洋', () => {
      for (let temp = -1; temp <= 1; temp += 0.2) {
        for (let moist = 0; moist <= 1; moist += 0.2) {
          expect(classifyBiome(0.3, temp, moist, 0.45, 0.5)).toBe(0);
        }
      }
    });
  });

  describe('extractChannel 通道提取', () => {
    it('正确提取 R 通道', () => {
      const tex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        tex[i * 4 + 0] = i;
        tex[i * 4 + 1] = i + 0.1;
        tex[i * 4 + 2] = i + 0.2;
        tex[i * 4 + 3] = i + 0.3;
      }
      const r = extractChannel(tex, 0, size);
      expect(r.length).toBe(size);
      expect(r[0]).toBeCloseTo(0, 5);
      expect(r[10]).toBeCloseTo(10, 5);
    });

    it('正确提取 G 通道', () => {
      const tex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        tex[i * 4 + 1] = i * 2;
      }
      const g = extractChannel(tex, 1, size);
      expect(g[5]).toBeCloseTo(10, 5);
    });

    it('正确提取 B 通道', () => {
      const tex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        tex[i * 4 + 2] = i * 3;
      }
      const b = extractChannel(tex, 2, size);
      expect(b[3]).toBeCloseTo(9, 5);
    });

    it('正确提取 A 通道', () => {
      const tex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        tex[i * 4 + 3] = i * 4;
      }
      const a = extractChannel(tex, 3, size);
      expect(a[2]).toBeCloseTo(8, 5);
    });
  });

  describe('extractPlateId 板块ID提取', () => {
    it('正确还原 plateId', () => {
      const plateCount = 8;
      const plateTex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        plateTex[i * 4] = (i % plateCount) / plateCount;
      }
      const ids = extractPlateId(plateTex, plateCount, size);
      expect(ids[0]).toBe(0);
      expect(ids[5]).toBe(5);
      expect(ids[8]).toBe(0);
    });

    it('单板块全部为 0', () => {
      const plateCount = 1;
      const plateTex = new Float32Array(size * 4).fill(0);
      const ids = extractPlateId(plateTex, plateCount, size);
      expect(ids.every(id => id === 0)).toBe(true);
    });

    it('所有板块 ID 有效', () => {
      const plateCount = 6;
      const plateTex = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        plateTex[i * 4] = (i % plateCount) / plateCount;
      }
      const ids = extractPlateId(plateTex, plateCount, size);
      for (let i = 0; i < size; i++) {
        expect(ids[i]).toBeGreaterThanOrEqual(0);
        expect(ids[i]).toBeLessThan(plateCount);
        expect(Number.isInteger(ids[i])).toBe(true);
      }
    });
  });
});