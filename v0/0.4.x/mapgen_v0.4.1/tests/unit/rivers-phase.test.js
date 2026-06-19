import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RiversPhase } from '../../engine/phases/rivers-phase.js';

describe('RiversPhase', () => {
  describe('constructor()', () => {
    it('should create phase with correct name and weight', () => {
      const phase = new RiversPhase();
      
      assert.strictEqual(phase.name, 'rivers');
      assert.strictEqual(phase.weight, 4);
    });
  });

  describe('validate()', () => {
    it('should validate context with required data', () => {
      const phase = new RiversPhase();
      const context = {
        params: { riverCount: 10 },
        data: {
          heightMap: new Float32Array(64 * 64),
          boundaries: new Uint8Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, true);
    });

    it('should reject context without heightMap', () => {
      const phase = new RiversPhase();
      const context = {
        params: { riverCount: 10 },
        data: {},
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without boundaries', () => {
      const phase = new RiversPhase();
      const context = {
        params: { riverCount: 10 },
        data: {
          heightMap: new Float32Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without params', () => {
      const phase = new RiversPhase();
      const context = {
        data: {
          heightMap: new Float32Array(64 * 64),
          boundaries: new Uint8Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });
  });

  describe('execute()', () => {
    it('should generate rivers', async () => {
      const phase = new RiversPhase();
      const heightMap = new Float32Array(64 * 64);
      const boundaries = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        boundaries[i] = Math.random() > 0.9 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          riverCount: 5,
        },
        data: { heightMap, boundaries },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result);
      assert.ok(result.rivers);
      assert.ok(result.lakeMap);
      assert.ok(Array.isArray(result.rivers));
    });

    it('should store results in context', async () => {
      const phase = new RiversPhase();
      const heightMap = new Float32Array(64 * 64);
      const boundaries = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        boundaries[i] = Math.random() > 0.9 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          riverCount: 5,
        },
        data: { heightMap, boundaries },
        emit: () => {},
      };
      
      await phase.execute(context);
      
      assert.ok(context.data.rivers);
      assert.ok(context.data.lakeMap);
      assert.ok(context.data.riverMask);
      assert.ok(context.data.riverWidth);
      assert.ok(context.data.riverDepth);
    });

    it('should generate correct number of rivers', async () => {
      const phase = new RiversPhase();
      const heightMap = new Float32Array(64 * 64);
      const boundaries = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        boundaries[i] = Math.random() > 0.9 ? 1 : 0;
      }

      const riverCount = 3;
      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          riverCount,
        },
        data: { heightMap, boundaries },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      // 河流数量可能少于请求的数量（取决于地形）
      assert.ok(result.rivers.length <= riverCount);
    });

    it('should generate lakes', async () => {
      const phase = new RiversPhase();
      const heightMap = new Float32Array(64 * 64);
      const boundaries = new Uint8Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = Math.random();
        boundaries[i] = Math.random() > 0.9 ? 1 : 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          riverCount: 5,
        },
        data: { heightMap, boundaries },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result.lakeMap);
      assert.strictEqual(result.lakeMap.length, 64 * 64);
    });

    it('should handle empty terrain', async () => {
      const phase = new RiversPhase();
      const heightMap = new Float32Array(64 * 64);
      const boundaries = new Uint8Array(64 * 64);
      
      // 所有高度相同
      for (let i = 0; i < 64 * 64; i++) {
        heightMap[i] = 0.5;
        boundaries[i] = 0;
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          riverCount: 5,
        },
        data: { heightMap, boundaries },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      // 应该仍然返回结果
      assert.ok(result);
      assert.ok(Array.isArray(result.rivers));
    });
  });
});
