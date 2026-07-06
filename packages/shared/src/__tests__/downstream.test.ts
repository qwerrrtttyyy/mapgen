import { describe, it, expect } from 'vitest';
import { runDownstreamPipeline, applyDownstreamToMapData } from '../downstream.js';
import type { DownstreamInput } from '../downstream.js';
import type { MapData } from '../index.js';

describe('Downstream 下游管线', () => {
  const W = 32,
    H = 32;
  const size = W * H;

  function makeInput(overrides: Partial<DownstreamInput> = {}): DownstreamInput {
    return {
      width: W,
      height: H,
      elevation: new Float32Array(size).fill(0.5),
      plateId: new Float32Array(size),
      plates: [
        {
          id: 0,
          type: 'ocean' as const,
          centroid: [W / 2, H / 2] as [number, number],
          drift: [0, 0] as [number, number],
        },
      ],
      boundary: new Float32Array(size),
      boundaryType: new Float32Array(size),
      seaLevel: 0.45,
      tempOffset: 0,
      snowLine: 0.5,
      windDirX: 1,
      windDirY: 0,
      rainStrength: 1,
      lakeDensity: 0.02,
      riverCount: 10,
      seed: 42,
      ...overrides,
    };
  }

  describe('runDownstreamPipeline 管线执行', () => {
    it('默认全部启用', () => {
      const result = runDownstreamPipeline(makeInput());

      // 检查所有产物存在
      expect(result.coastDist).toBeDefined();
      expect(result.currents.vx).toBeDefined();
      expect(result.currents.vy).toBeDefined();
      expect(result.biomes).toBeDefined();
      expect(result.watershed).toBeDefined();
      expect(result.volcanism).toBeDefined();
      expect(result.seasons).toBeDefined();
    });

    it('独立关闭子系统', () => {
      const result = runDownstreamPipeline(
        makeInput({
          enableOceanCurrents: false,
          enableIceSheet: false,
          enableAdvancedBiomes: false,
          enableWatershed: false,
          enableVolcanism: false,
          enableSeasons: false,
        })
      );

      // 关闭的子系统应返回零数组或 undefined
      expect(result.currents.vx.every(v => v === 0)).toBe(true);
      expect(result.ice.landIce.every(v => v === 0)).toBe(true);
      expect(result.biomes).toBeUndefined();
      expect(result.watershed).toBeUndefined();
      expect(result.volcanism).toBeUndefined();
      expect(result.seasons).toBeUndefined();
    });

    it('产物尺寸正确', () => {
      const result = runDownstreamPipeline(makeInput());

      expect(result.coastDist.length).toBe(size);
      expect(result.currents.vx.length).toBe(size);
      expect(result.currents.vy.length).toBe(size);
      expect(result.biomes?.biomeId.length).toBe(size);
      expect(result.volcanism?.volcanoProb.length).toBe(size);
    });
  });

  describe('applyDownstreamToMapData 应用到地图数据', () => {
    it('写回河流、区域、海岸字段', () => {
      const md: MapData = {
        width: W,
        height: H,
        plateTex: new Float32Array(size * 4),
        elevTex: new Float32Array(size * 4),
        moistTex: new Float32Array(size * 4),
        riverTex: new Float32Array(size * 4),
        tempTex: new Float32Array(size * 4),
        plates: [],
        regions: [],
        rivers: [],
        names: { plates: [], regions: [], volcanoes: [] },
        seed: 1,
      };

      const downstreamResult = runDownstreamPipeline(makeInput());
      applyDownstreamToMapData(md, downstreamResult, 42);

      expect(md.rivers).toBe(downstreamResult.rivers);
      expect(md.regions).toBe(downstreamResult.regions);
      expect(md.seed).toBe(42);
      expect(md.coastDist).toBe(downstreamResult.coastDist);
    });
  });
});
