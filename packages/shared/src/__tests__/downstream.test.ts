import { describe, it, expect } from 'vitest';
import { runDownstreamPipeline, applyDownstreamToMapData } from '../downstream.js';
import type { DownstreamInput } from '../downstream.js';

describe('Downstream 下游管线', () => {
  const W = 32, H = 32;
  const size = W * H;

  describe('runDownstreamPipeline 管线执行', () => {
    it('默认全部启用', () => {
      const input: DownstreamInput = {
        width: W,
        height: H,
        elevation: new Float32Array(size).fill(0.5),
        seaLevel: 0.45,
        temperature: new Float32Array(size).fill(0.5),
        rainfall: new Float32Array(size).fill(0.5),
        moisture: new Float32Array(size).fill(0.5),
        coastDist: new Float32Array(size).fill(10),
        riverMask: new Float32Array(size).fill(0),
        lakeMask: new Float32Array(size).fill(0),
        landIce: new Float32Array(size).fill(0),
        seaIce: new Float32Array(size).fill(0),
        seed: 42,
      };

      const result = runDownstreamPipeline(input);

      // 检查所有产物存在
      expect(result.coastDist).toBeDefined();
      expect(result.currentVx).toBeDefined();
      expect(result.currentVy).toBeDefined();
      expect(result.biomeId).toBeDefined();
      expect(result.basinId).toBeDefined();
      expect(result.volcanoProb).toBeDefined();
      expect(result.seasonTex).toBeDefined();
    });

    it('独立关闭子系统', () => {
      const input: DownstreamInput = {
        width: W,
        height: H,
        elevation: new Float32Array(size).fill(0.5),
        seaLevel: 0.45,
        temperature: new Float32Array(size).fill(0.5),
        rainfall: new Float32Array(size).fill(0.5),
        moisture: new Float32Array(size).fill(0.5),
        coastDist: new Float32Array(size).fill(10),
        riverMask: new Float32Array(size).fill(0),
        lakeMask: new Float32Array(size).fill(0),
        landIce: new Float32Array(size).fill(0),
        seaIce: new Float32Array(size).fill(0),
        seed: 42,
        enableOceanCurrents: false,
        enableIceSheet: false,
        enableBiomes: false,
        enableWatershed: false,
        enableVolcanism: false,
        enableSeasons: false,
      };

      const result = runDownstreamPipeline(input);

      // 关闭的子系统应返回零数组
      expect(result.currentVx.every(v => v === 0)).toBe(true);
      expect(result.landIce.every(v => v === 0)).toBe(true);
      expect(result.biomeId.every(v => v === 0)).toBe(true);
    });

    it('产物尺寸正确', () => {
      const input: DownstreamInput = {
        width: W,
        height: H,
        elevation: new Float32Array(size).fill(0.5),
        seaLevel: 0.45,
        temperature: new Float32Array(size).fill(0.5),
        rainfall: new Float32Array(size).fill(0.5),
        moisture: new Float32Array(size).fill(0.5),
        coastDist: new Float32Array(size).fill(10),
        riverMask: new Float32Array(size).fill(0),
        lakeMask: new Float32Array(size).fill(0),
        landIce: new Float32Array(size).fill(0),
        seaIce: new Float32Array(size).fill(0),
        seed: 42,
      };

      const result = runDownstreamPipeline(input);

      expect(result.coastDist.length).toBe(size);
      expect(result.currentVx.length).toBe(size);
      expect(result.currentVy.length).toBe(size);
      expect(result.biomeId.length).toBe(size);
      expect(result.volcanoProb.length).toBe(size);
    });
  });

  describe('applyDownstreamToMapData 应用到地图数据', () => {
    it('纹理打包正确', () => {
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
      };

      const result = applyDownstreamToMapData(W, H, downstreamResult, {
        enableAdvancedBiomes: true,
        enableWatershed: true,
        enableVolcanism: true,
        enableSeasons: true,
        seaLevel: 0.45,
        snowLine: 0.5,
      });

      expect(result.currentTex.length).toBe(size * 4);
      expect(result.iceTex.length).toBe(size * 4);
      expect(result.biomeTex.length).toBe(size * 4);
      expect(result.volcanismTex.length).toBe(size * 4);
    });
  });
});