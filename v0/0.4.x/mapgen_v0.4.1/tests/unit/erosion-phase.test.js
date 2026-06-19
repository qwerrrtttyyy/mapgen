import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ErosionPhase } from '../../engine/phases/erosion-phase.js';

describe('ErosionPhase', () => {
  describe('constructor()', () => {
    it('should create phase with correct name and weight', () => {
      const phase = new ErosionPhase();
      
      assert.strictEqual(phase.name, 'erosion');
      assert.strictEqual(phase.weight, 3);
    });
  });

  describe('validate()', () => {
    it('should validate context with required data', () => {
      const phase = new ErosionPhase();
      const context = {
        params: { iterations: 10 },
        data: {
          plateMap: new Float32Array(64 * 64),
          plateDist: new Float32Array(64 * 64),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, true);
    });

    it('should reject context without plateMap', () => {
      const phase = new ErosionPhase();
      const context = {
        params: { iterations: 10 },
        data: {},
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });
  });

  describe('execute()', () => {
    it('should run erosion simulation', async () => {
      const phase = new ErosionPhase();
      const plateMap = new Float32Array(64 * 64);
      const plateDist = new Float32Array(64 * 64);
      
      for (let i = 0; i < 64 * 64; i++) {
        plateMap[i] = i % 10;
        plateDist[i] = Math.random();
      }

      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
          iterations: 10,
        },
        data: { plateMap, plateDist },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result);
      assert.ok(result.heightMap);
      assert.strictEqual(result.heightMap.length, 64 * 64);
    });
  });
});
