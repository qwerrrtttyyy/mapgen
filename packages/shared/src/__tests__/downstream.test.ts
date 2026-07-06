import { describe, it, expect } from 'vitest';
import { runDownstreamPipeline, applyDownstreamToMapData } from '../downstream.js';
import type { DownstreamInput, DownstreamResult } from '../downstream.js';
import type { MapData } from '../index.js';

describe('Downstream 下游管线', () => {
  const W = 32, H = 32;
  const size = W * H;

  function makeBaseInput(): DownstreamInput {
    return {
      width: W,
      height: H,
      elevation: new Float32Array(size).fill(0.5),
      plateId: new Float32Array(size).fill(0),
      seaLevel: 0.45,
      tempOffset: 0,
      snowLine: 0.5,
      windDirX: 0,
      windDirY: -1,
      rainStrength: 0.5,
      lakeDensity: 0.1,
      riverCount: 10,
      seed: 42,
    };
  }

  describe('runDownstreamPipeline 管线执行', () => {
    it('默认全部启用', () => {
      const input = makeBaseInput();
      const result = runDownstreamPipeline(input);

      expect(result.coastDist).toBeDefined();
      expect(result.currents.vx).toBeDefined();
      expect(result.currents.vy).toBeDefined();
      expect(result.biomes).toBeDefined();
      expect(result.watershed).toBeDefined();
      expect(result.seasons).toBeDefined();
    });

    it('独立关闭子系统', () => {
      const input: DownstreamInput = {
        ...makeBaseInput(),
        enableOceanCurrents: false,
        enableIceSheet: false,
        enableAdvancedBiomes: false,
        enableWatershed: false,
        enableVolcanism: false,
        enableSeasons: false,
      };

      const result = runDownstreamPipeline(input);

      expect(result.currents.vx.every(v => v === 0)).toBe(true);
      expect(result.ice.landIce.every(v => v === 0)).toBe(true);
      expect(result.biomes).toBeUndefined();
    });

    it('产物尺寸正确', () => {
      const input = makeBaseInput();
      const result = runDownstreamPipeline(input);

      expect(result.coastDist.length).toBe(size);
      expect(result.currents.vx.length).toBe(size);
      expect(result.currents.vy.length).toBe(size);
      expect(result.biomes!.biomeId.length).toBe(size);
    });
  });

  describe('applyDownstreamToMapData 应用到地图数据', () => {
    it('字段写入正确', () => {
      const result: DownstreamResult = {
        moisture: new Float32Array(size),
        rainfall: new Float32Array(size),
        temperature: new Float32Array(size),
        tempZone: new Float32Array(size),
        riverMask: new Float32Array(size),
        riverWidth: new Float32Array(size),
        riverDepth: new Float32Array(size),
        lakes: new Float32Array(size),
        rivers: [],
        regions: [],
        coastDist: new Float32Array(size).fill(10),
        currents: {
          vx: new Float32Array(size),
          vy: new Float32Array(size),
          tempDelta: new Float32Array(size),
          speed: new Float32Array(size),
        },
        ice: {
          landIce: new Float32Array(size),
          seaIce: new Float32Array(size),
          glacierVx: new Float32Array(size),
          glacierVy: new Float32Array(size),
        },
        elevationAfter: new Float32Array(size),
        slopeAfter: new Float32Array(size),
      };

      const md = {
        width: W,
        height: H,
        plateTex: new Float32Array(size),
        elevTex: new Float32Array(size),
        moistTex: new Float32Array(size),
        riverTex: new Float32Array(size),
        tempTex: new Float32Array(size),
        plates: [],
        regions: [],
        rivers: [],
        names: { plates: [], regions: [] },
        seed: 0,
      } as unknown as MapData;

      applyDownstreamToMapData(md, result, 42);

      expect(md.rivers).toEqual([]);
      expect(md.regions).toEqual([]);
      expect(md.seed).toBe(42);
      expect(md.coastDist).toBeDefined();
    });
  });
});
