import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NoisePhase } from '../../engine/phases/noise-phase.js';

describe('NoisePhase', () => {
  describe('constructor()', () => {
    it('should create phase with correct name and weight', () => {
      const phase = new NoisePhase();
      
      assert.strictEqual(phase.name, 'noise');
      assert.strictEqual(phase.weight, 1);
    });
  });

  describe('validate()', () => {
    it('should validate context with required params', () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          seed: 12345,
          width: 256,
          height: 256,
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, true);
    });

    it('should reject context without seed', () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          width: 256,
          height: 256,
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without width', () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          seed: 12345,
          height: 256,
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without height', () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          seed: 12345,
          width: 256,
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });
  });

  describe('execute()', () => {
    it('should generate noise map', async () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
        },
        data: {},
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result);
      assert.ok(result.noiseMap);
      assert.strictEqual(result.noiseMap.length, 64 * 64);
    });

    it('should store noise engine in context', async () => {
      const phase = new NoisePhase();
      const context = {
        params: {
          seed: 12345,
          width: 64,
          height: 64,
        },
        data: {},
        emit: () => {},
      };
      
      await phase.execute(context);
      
      assert.ok(context.data.noise);
      assert.ok(context.data.noiseMap);
    });
  });
});
