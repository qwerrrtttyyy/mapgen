import { describe, it, expect } from 'vitest';
import {
  packAllTextures,
  packClimateRiverTextures,
  packElevTex,
  classifyBiome,
} from '../texturePack.js';

describe('TexturePack 纹理打包', () => {
  const W = 32, H = 32;
  const size = W * H;

  describe('packElevTex 高程纹理打包', () => {
    it('RGBA 通道正确', () => {
      const elevation = new Float32Array(size).fill(0.6);
      const slope = new Float32Array(size).fill(0.1);
      const ridge = new Float32Array(size).fill(0.5);
      const ridgeMask = new Float32Array(size).fill(0.8);

      const elevTex = packElevTex(elevation, slope, ridge, ridgeMask);

      for (let i = 0; i < size; i++) {
        const i4 = i * 4;
        expect(elevTex[i4 + 0]).toBeCloseTo(0.6, 5);
        expect(elevTex[i4 + 1]).toBeCloseTo(0.1, 5);
        expect(elevTex[i4 + 2]).toBeCloseTo(0.5, 5);
        expect(elevTex[i4 + 3]).toBeCloseTo(0.8, 5);
      }
    });

    it('尺寸正确', () => {
      const elevation = new Float32Array(size);
      const slope = new Float32Array(size);
      const ridge = new Float32Array(size);
      const ridgeMask = new Float32Array(size);

      const elevTex = packElevTex(elevation, slope, ridge, ridgeMask);

      expect(elevTex.length).toBe(size * 4);
    });
  });

  describe('classifyBiome 生物群系分类', () => {
    it('海洋生物群系', () => {
      const biome = classifyBiome(0.3, 0.5, 0.7, 0.45, 0.5);
      expect(biome).toBeLessThan(0.1); // 海洋
    });

    it('山脉生物群系', () => {
      const biome = classifyBiome(0.85, 0.3, 0.4, 0.45, 0.5);
      expect(biome).toBeGreaterThan(0.5); // 山地
    });

    it('沙漠生物群系', () => {
      const biome = classifyBiome(0.5, 0.6, 0.1, 0.45, 0.5);
      expect(biome).toBeGreaterThan(0.3); // 干燥区域
    });

    it('森林生物群系', () => {
      const biome = classifyBiome(0.55, 0.4, 0.7, 0.45, 0.5);
      expect(biome).toBeGreaterThan(0.4); // 湿润区域
    });

    it('雪线以上生物群系', () => {
      const biome = classifyBiome(0.75, 0.2, 0.5, 0.45, 0.5);
      expect(biome).toBeGreaterThan(0.6); // 高海拔
    });
  });

  describe('packClimateRiverTextures 气候河流纹理', () => {
    it('纹理打包完整', () => {
      const temperature = new Float32Array(size).fill(0.5);
      const tempZone = new Float32Array(size).fill(2);
      const moisture = new Float32Array(size).fill(0.6);
      const rainfall = new Float32Array(size).fill(0.7);
      const riverMask = new Float32Array(size).fill(0.1);
      const riverWidth = new Float32Array(size).fill(0.2);
      const riverDepth = new Float32Array(size).fill(0.3);
      const lakeMask = new Float32Array(size).fill(0.4);

      const { moistTex, riverTex } = packClimateRiverTextures(
        temperature, tempZone, moisture, rainfall,
        riverMask, riverWidth, riverDepth, lakeMask,
        0.45, 0.5
      );

      expect(moistTex.length).toBe(size * 4);
      expect(riverTex.length).toBe(size * 4);
    });

    it('通道分配正确', () => {
      const temperature = new Float32Array(size).fill(0.6);
      const tempZone = new Float32Array(size).fill(3);
      const moisture = new Float32Array(size).fill(0.7);
      const rainfall = new Float32Array(size).fill(0.8);

      const { moistTex } = packClimateRiverTextures(
        temperature, tempZone, moisture, rainfall,
        new Float32Array(size), new Float32Array(size),
        new Float32Array(size), new Float32Array(size),
        0.45, 0.5
      );

      const i4 = 0;
      expect(moistTex[i4 + 0]).toBeCloseTo(0.7, 5); // moisture
      expect(moistTex[i4 + 1]).toBeCloseTo(0.8, 5); // rainfall
      expect(moistTex[i4 + 2]).toBeCloseTo(0.6, 5); // temperature
    });
  });

  describe('packAllTextures 全纹理打包', () => {
    it('完整打包所有纹理', () => {
      const params = {
        width: W,
        height: H,
        elevation: new Float32Array(size).fill(0.5),
        slope: new Float32Array(size).fill(0.1),
        ridge: new Float32Array(size).fill(0.2),
        ridgeMask: new Float32Array(size).fill(0),
        temperature: new Float32Array(size).fill(0.5),
        tempZone: new Float32Array(size).fill(2),
        moisture: new Float32Array(size).fill(0.6),
        rainfall: new Float32Array(size).fill(0.7),
        riverMask: new Float32Array(size).fill(0),
        riverWidth: new Float32Array(size).fill(0),
        riverDepth: new Float32Array(size).fill(0),
        lakeMask: new Float32Array(size).fill(0),
        plateId: new Float32Array(size).fill(0),
        plateTypeArr: new Uint8Array(size).fill(1),
        boundary: new Float32Array(size).fill(0),
        plateDist: new Float32Array(size).fill(0.5),
        currentVx: new Float32Array(size).fill(0),
        currentVy: new Float32Array(size).fill(0),
        currentTempDelta: new Float32Array(size).fill(0),
        currentSpeed: new Float32Array(size).fill(0),
        landIce: new Float32Array(size).fill(0),
        seaIce: new Float32Array(size).fill(0),
        glacierVx: new Float32Array(size).fill(0),
        glacierVy: new Float32Array(size).fill(0),
        biomeId: new Uint8Array(size).fill(0),
        biomeNormalized: new Float32Array(size).fill(0),
        basinId: new Int32Array(size).fill(-1),
        isDivide: new Uint8Array(size).fill(0),
        streamOrder: new Uint8Array(size).fill(0),
        volcanoProb: new Float32Array(size).fill(0),
        calderaMask: new Uint8Array(size).fill(0),
        volcanoSites: [],
        hotspots: [],
        seasonTex: new Float32Array(size * 4).fill(0),
        seaLevel: 0.45,
        snowLine: 0.5,
        plateCount: 4,
        enableAdvancedBiomes: false,
        enableWatershed: false,
        enableVolcanism: false,
        enableSeasons: false,
      };

      const result = packAllTextures(params);

      expect(result.plateTex).toBeDefined();
      expect(result.elevTex).toBeDefined();
      expect(result.moistTex).toBeDefined();
      expect(result.riverTex).toBeDefined();
      expect(result.tempTex).toBeDefined();
      expect(result.currentTex).toBeDefined();
      expect(result.iceTex).toBeDefined();
    });
  });
});