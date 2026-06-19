import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TectonicPhase } from '../../engine/phases/tectonic-phase.js';

describe('TectonicPhase', () => {
  describe('constructor()', () => {
    it('should create phase with correct name and weight', () => {
      const phase = new TectonicPhase();
      
      assert.strictEqual(phase.name, 'tectonic');
      assert.strictEqual(phase.weight, 2);
    });
  });

  describe('validate()', () => {
    it('should validate context with required data', () => {
      const phase = new TectonicPhase();
      const context = {
        params: {
          plateCount: 10,
          width: 256,
          height: 256,
        },
        data: {
          noiseMap: new Float32Array(256 * 256),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, true);
    });

    it('should reject context without plateCount', () => {
      const phase = new TectonicPhase();
      const context = {
        params: {
          width: 256,
          height: 256,
        },
        data: {
          noiseMap: new Float32Array(256 * 256),
        },
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });

    it('should reject context without noiseMap', () => {
      const phase = new TectonicPhase();
      const context = {
        params: {
          plateCount: 10,
          width: 256,
          height: 256,
        },
        data: {},
      };
      
      const result = phase.validate(context);
      
      assert.strictEqual(result, false);
    });
  });

  describe('execute()', () => {
    it('should generate plates', async () => {
      const phase = new TectonicPhase();
      const context = {
        params: {
          seed: 12345,
          plateCount: 5,
          width: 64,
          height: 64,
          landmass: 0.3,
        },
        data: {
          noiseMap: new Float32Array(64 * 64),
        },
        emit: () => {},
      };
      
      const result = await phase.execute(context);
      
      assert.ok(result);
      assert.ok(result.plates);
      assert.ok(result.plateMap);
      assert.ok(result.boundaries);
    });

    it('should store results in context', async () => {
      const phase = new TectonicPhase();
      const context = {
        params: {
          seed: 12345,
          plateCount: 5,
          width: 64,
          height: 64,
          landmass: 0.3,
        },
        data: {
          noiseMap: new Float32Array(64 * 64),
        },
        emit: () => {},
      };
      
      await phase.execute(context);
      
      assert.ok(context.data.plates);
      assert.ok(context.data.plateMap);
      assert.ok(context.data.boundaries);
    });
  });
});
