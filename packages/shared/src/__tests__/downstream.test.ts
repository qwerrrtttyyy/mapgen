import { describe, it, expect } from 'vitest';
import { runDownstreamPipeline, applyDownstreamToMapData } from '../downstream.js';
import type { DownstreamInput } from '../downstream.js';

describe('Downstream 下游管线', () => {
  const W = 32, H = 32;
  const size = W * H;

  const baseInput = {
    width: W,
    height: H,
    elevation: new Float32Array(size).fill(0.5),
    plateId: new Float32Array(size).fill(0),
    seaLevel: 0.45,
    tempOffset: 0,
    snowLine: 0.5,
    windDirX: 1,
    windDirY: 0,
    rainStrength: 1,
    lakeDensity: 0.02,
    riverCount: 5,
    seed: 42,
  };

  describe('runDownstreamPipeline 管线执行', () => {
    it('默认全部启用', () => {
      const result = runDownstreamPipeline(baseInput);

      // 检查核心产物存在
      expect(result.coastDist).toBeDefined();
      expect(result.moisture).toBeDefined();
      expect(result.rainfall).toBeDefined();
      expect(result.temperature).toBeDefined();
      expect(result.rivers).toBeDefined();
      expect(result.regions).toBeDefined();
    });

    it('独立关闭子系统', () => {
      const input = {
        ...baseInput,
        enableOceanCurrents: false,
        enableIceSheet: false,
        enableAdvancedBiomes: false,
        enableWatershed: false,
        enableVolcanism: false,
        enableSeasons: false,
      };

      const result = runDownstreamPipeline(input);

      // 关闭的子系统应为 undefined
      expect(result.biomes).toBeUndefined();
      expect(result.watershed).toBeUndefined();
      expect(result.volcanism).toBeUndefined();
      expect(result.seasons).toBeUndefined();
    });

    it('产物尺寸正确', () => {
      const result = runDownstreamPipeline(baseInput);

      expect(result.coastDist.length).toBe(size);
      expect(result.moisture.length).toBe(size);
      expect(result.temperature.length).toBe(size);
    });
  });

  describe('applyDownstreamToMapData 应用到地图数据', () => {
    it('纹理打包正确', () => {
      const mockMapData = {
        width: W,
        height: H,
        elevTex: new Float32Array(size * 4),
        plateTex: new Float32Array(size * 4),
        moistTex: new Float32Array(size * 4),
        tempTex: new Float32Array(size * 4),
        riverTex: new Float32Array(size * 4),
        plates: [],
        regions: [],
        rivers: [],
        names: { plates: [], regions: [] },
        seed: 0,
      } as never;

      const downstreamResult = {
        coastDist: new Float32Array(size).fill(10),
        currentVx: new Float32Array(size).fill(0.5),
        currentVy: new Float32Array(size).fill(0),
        currentTempDelta: new Float32Array(size).fill(0),
        currentSpeed: new Float32Array(size).fill(1),
        landIce: new Float32Array(size).fill(0.3),
        seaIce: new Float32Array(size).fill(0),
        glacierVx: new Float32Array(size).fill(0),
        glacierVy: new Float32Array(size).fill(0),
        biomeId: new Uint8Array(size).fill(5),
        biomeNormalized: new Float32Array(size).fill(0.5),
        basinId: new Int32Array(size).fill(1),
        isDivide: new Uint8Array(size).fill(0),
        streamOrder: new Uint8Array(size).fill(2),
        volcanoProb: new Float32Array(size).fill(0.1),
        calderaMask: new Uint8Array(size).fill(0),
        volcanoSites: [],
        hotspots: [],
        seasonTex: new Float32Array(size * 4).fill(0),
        rivers: [],
        regions: [],
      } as never;

      applyDownstreamToMapData(mockMapData, downstreamResult, 42);

      expect(mockMapData.coastDist).toBeDefined();
      expect(mockMapData.seed).toBe(42);
    });
  });
});