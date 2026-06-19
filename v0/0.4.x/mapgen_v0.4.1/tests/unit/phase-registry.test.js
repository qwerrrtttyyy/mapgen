import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PhaseRegistry } from '../../engine/phases/phase-registry.js';
import { NoisePhase } from '../../engine/phases/noise-phase.js';
import { TectonicPhase } from '../../engine/phases/tectonic-phase.js';
import { ErosionPhase } from '../../engine/phases/erosion-phase.js';
import { RiversPhase } from '../../engine/phases/rivers-phase.js';
import { RegionsPhase } from '../../engine/phases/regions-phase.js';

describe('PhaseRegistry', () => {
  describe('register()', () => {
    it('should register a phase', () => {
      const registry = new PhaseRegistry();
      const phase = new NoisePhase();
      
      registry.register(phase);
      
      assert.strictEqual(registry.phases.length, 1);
      assert.strictEqual(registry.phases[0].name, 'noise');
    });

    it('should reject duplicate phase names', () => {
      const registry = new PhaseRegistry();
      const phase1 = new NoisePhase();
      const phase2 = new NoisePhase();
      
      registry.register(phase1);
      
      try {
        registry.register(phase2);
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('already registered'));
      }
    });
  });

  describe('unregister()', () => {
    it('should unregister a phase by name', () => {
      const registry = new PhaseRegistry();
      const phase = new NoisePhase();
      
      registry.register(phase);
      registry.unregister('noise');
      
      assert.strictEqual(registry.phases.length, 0);
    });
  });

  describe('getPhases()', () => {
    it('should return phases sorted by weight', () => {
      const registry = new PhaseRegistry();
      registry.register(new RiversPhase()); // weight 4
      registry.register(new NoisePhase()); // weight 1
      registry.register(new TectonicPhase()); // weight 2
      
      const phases = registry.getPhases();
      
      assert.strictEqual(phases.length, 3);
      assert.strictEqual(phases[0].name, 'noise');
      assert.strictEqual(phases[1].name, 'tectonic');
      assert.strictEqual(phases[2].name, 'rivers');
    });
  });

  describe('executeAll()', () => {
    it('should execute all phases in order', async () => {
      const registry = new PhaseRegistry();
      
      // 注册所有阶段
      registry.register(new NoisePhase());
      registry.register(new TectonicPhase());
      registry.register(new ErosionPhase());
      registry.register(new RiversPhase());
      registry.register(new RegionsPhase());
      
      const context = {
        params: {
          seed: 12345,
          width: 32,
          height: 32,
          plateCount: 5,
          iterations: 10,
          riverCount: 3,
          regionCount: 4,
          landmass: 0.3,
        },
        data: {},
        emit: () => {},
      };
      
      const result = await registry.executeAll(context);
      
      assert.ok(result);
      assert.ok(result.noiseMap);
      assert.ok(result.plates);
      assert.ok(result.heightMap);
      assert.ok(result.rivers);
      assert.ok(result.regionMap);
    });
  });
});
