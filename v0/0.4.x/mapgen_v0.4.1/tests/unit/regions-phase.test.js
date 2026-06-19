import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RegionsPhase } from '../../engine/phases/regions-phase.js';

describe('RegionsPhase', () => {
  describe('constructor()', () => {
    it('should create phase with correct name and weight', () => {
      const phase = new RegionsPhase();
      
      assert.strictEqual(phase.name, 'regions');
      assert.strictEqual(phase.weight, 5);
    });
  });

  describe('validate()', () => {
    it('should validate context with required data', () => {
      const phase = new RegionsPhase();
      const context = {
        params: { regionCount: 10 },
        data: {
          heightMap: new Float32Array(64 * 64),
          lakeMap: new Uint8Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, true);
    });

    it('should reject context without heightMap', () => {
      const phase = new RegionsPhase();
      const context = {
        params: { regionCount: 10 },
        data: {},
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without lakeMap', () => {
      const phase = new RegionsPhase();
      const context = {
        params: { regionCount: 10 },
        data: {
          heightMap: new Float32Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without params', () => {
      const phase = new RegionsPhase();
      const context = {
        data: {
          heightMap: new Float32Array(64 * 64),
          lakeMap: new Uint8Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });
  });

  describe('execute()', () => {
    it('should generate regions', async () => {
      const phase = new RegionsPhase();
      const heightMap = new Float32Array(64 * 64);
      const lakeMap = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        lakeMap[i] = Math.random() > 0.95 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          regionCount: 5,
        },
        data: { heightMap, lakeMap },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result);
      assert.ok(result.regionMap);
      assert.ok(result.regions);
      assert.strictEqual(result.regionMap.length, 64 * 64);
    });

    it('should store results in context', async () => {
      const phase = new RegionsPhase();
      const heightMap = new Float32Array(64 * 64);
      const lakeMap = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        lakeMap[i] = Math.random() > 0.95 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          regionCount: 5,
        },
        data: { heightMap, lakeMap },
        emit: () => {},
      };
      
      await phase.execute(context);
      
      assert.ok(context.data.regionMap);
      assert.ok(context.data.regions);
    });

    it('should generate correct number of regions', async () => {
      const phase = new RegionsPhase();
      const heightMap = new Float32Array(64 * 64);
      const lakeMap = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        lakeMap[i] = 0;
      }

      const regionCount = 7;
      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          regionCount,
        },
        data: { heightMap, lakeMap },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.strictEqual(result.regions.length, regionCount);
    });

    it('should handle lakes correctly', async () => {
      const phase = new RegionsPhase();
      const heightMap = new Float32Array(64 * 64);
      const lakeMap = new Uint8Array(64 * 64);
      
      // 创建一些湖泊
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        lakeMap[i] = i % 100 === 0 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          regionCount: 5,
        },
        data: { heightMap, lakeMap },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      // 检查湖泊是否被标记为 -1
      let lakeCount = 0;
      for (let i = 0; i < result.regionMap.length; i++) {
        if (result.regionMap[i] === -1) {
          lakeCount++;
        }
      }
      
      assert.ok(lakeCount > 0);
    });
  });
});
