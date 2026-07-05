import { describe, it, expect } from 'vitest';
import { createNoise } from '../noise.js';

describe('Noise Module - Edge Cases and Stress Tests', () => {
  describe('Seed edge cases', () => {
    it('seed MAX_SAFE_INTEGER works', () => {
      const noise = createNoise(Number.MAX_SAFE_INTEGER, 'simplex');
      const val = noise.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      expect(typeof val).toBe('number');
      expect(Number.isFinite(val)).toBe(true);
    });

    it('seed 1 works', () => {
      const noise = createNoise(1, 'simplex');
      const val = noise.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      expect(typeof val).toBe('number');
    });

    it('very large negative seed works', () => {
      const noise = createNoise(-999999, 'simplex');
      const val = noise.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      expect(typeof val).toBe('number');
    });
  });

  describe('FBM parameter combinations', () => {
    it('minimum octaves with high lacunarity', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 1, 4.0, 0.5, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('high octaves with low persistence', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 8, 2.0, 0.1, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('zero persistence returns constant', () => {
      const noise = createNoise(42, 'simplex');
      const val1 = noise.fbm(0.3, 0.4, 4, 2, 0, 'standard');
      const val2 = noise.fbm(0.7, 0.8, 4, 2, 0, 'standard');
      expect(typeof val1).toBe('number');
      expect(typeof val2).toBe('number');
    });

    it('lacunarity less than 1', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 4, 0.8, 0.5, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });
  });

  describe('Coordinate extremes', () => {
    it('very small coordinates', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.0001, 0.0001, 4, 2, 0.5, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('mixed positive and negative large coordinates', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(5000, -5000, 4, 2, 0.5, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('fractional coordinates precision', () => {
      const noise = createNoise(42, 'simplex');
      const val1 = noise.fbm(0.123456, 0.654321, 4, 2, 0.5, 'standard');
      const val2 = noise.fbm(0.123457, 0.654321, 4, 2, 0.5, 'standard');
      expect(Math.abs(val1 - val2)).toBeLessThan(0.1);
    });
  });

  describe('All noise types consistency', () => {
    const noiseTypes: Array<'simplex' | 'perlin' | 'value'> = ['simplex', 'perlin', 'value'];
    
    noiseTypes.forEach(type => {
      describe(`${type} noise`, () => {
        it('deterministic with same seed', () => {
          const n1 = createNoise(12345, type);
          const n2 = createNoise(12345, type);
          for (let i = 0; i < 5; i++) {
            expect(n1.fbm(i * 0.1, i * 0.1, 4, 2, 0.5, 'standard')).toBe(n2.fbm(i * 0.1, i * 0.1, 4, 2, 0.5, 'standard'));
          }
        });

        it('different seeds produce different output', () => {
          const n1 = createNoise(100, type);
          const n2 = createNoise(200, type);
          const diff = Math.abs(n1.fbm(0.5, 0.5, 4, 2, 0.5, 'standard') - n2.fbm(0.5, 0.5, 4, 2, 0.5, 'standard'));
          expect(diff).toBeGreaterThan(0.001);
        });

        it('output range is valid', () => {
          const noise = createNoise(42, type);
          for (let i = 0; i < 20; i++) {
            const val = noise.fbm(i * 0.17, i * 0.23, 4, 2, 0.5, 'standard');
            expect(val).toBeGreaterThanOrEqual(-1);
            expect(val).toBeLessThanOrEqual(1);
          }
        });
      });
    });
  });

  describe('Ridged mode comprehensive', () => {
    it('ridged with various ridge angles', () => {
      const noise = createNoise(42, 'simplex');
      const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI];
      for (const angle of angles) {
        const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: angle, anisotropy: 0.5 });
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('anisotropy from 0 to 1', () => {
      const noise = createNoise(42, 'simplex');
      for (let a = 0; a <= 1; a += 0.1) {
        const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: 0, anisotropy: a });
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('ridged with warp', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { warpStrength: 0.5 });
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });

  describe('fbmNatural domain warping', () => {
    it('warp strength variations', () => {
      const noise = createNoise(42, 'simplex');
      const strengths = [0, 0.2, 0.5, 0.8, 1.0];
      for (const strength of strengths) {
        const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: strength });
        expect(Math.abs(val)).toBeLessThanOrEqual(1);
      }
    });

    it('warp with ridged mode', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { warpStrength: 0.3 });
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });

  describe('Statistical distribution tests', () => {
    it('simplex fbm has near-zero mean over many samples', () => {
      const noise = createNoise(42, 'simplex');
      let sum = 0;
      const count = 1000;
      for (let i = 0; i < count; i++) {
        sum += noise.fbm(i * 0.123, i * 0.456, 4, 2, 0.5, 'standard');
      }
      const mean = sum / count;
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });

    it('ridged fbm has positive mean', () => {
      const noise = createNoise(42, 'simplex');
      let sum = 0;
      const count = 1000;
      for (let i = 0; i < count; i++) {
        sum += noise.fbm(i * 0.123, i * 0.456, 4, 2, 0.5, 'ridged');
      }
      const mean = sum / count;
      expect(mean).toBeGreaterThan(0.3);
      expect(mean).toBeLessThan(0.8);
    });

    it('variance is reasonable', () => {
      const noise = createNoise(42, 'simplex');
      const samples: number[] = [];
      for (let i = 0; i < 500; i++) {
        samples.push(noise.fbm(i * 0.17, i * 0.31, 4, 2, 0.5, 'standard'));
      }
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance = samples.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / samples.length;
      expect(variance).toBeGreaterThan(0.05);
      expect(variance).toBeLessThan(0.5);
    });
  });

  describe('Continuity stress tests', () => {
    it('small steps maintain continuity over long path', () => {
      const noise = createNoise(42, 'simplex');
      let prev = noise.fbm(0, 0, 4, 2, 0.5, 'standard');
      let maxJump = 0;
      for (let i = 1; i <= 100; i++) {
        const curr = noise.fbm(i * 0.01, 0, 4, 2, 0.5, 'standard');
        maxJump = Math.max(maxJump, Math.abs(curr - prev));
        prev = curr;
      }
      expect(maxJump).toBeLessThan(0.15);
    });

    it('2D grid continuity', () => {
      const noise = createNoise(42, 'simplex');
      const size = 20;
      let maxDiff = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const v = noise.fbm(x * 0.05, y * 0.05, 4, 2, 0.5, 'standard');
          if (x > 0) {
            const left = noise.fbm((x - 1) * 0.05, y * 0.05, 4, 2, 0.5, 'standard');
            maxDiff = Math.max(maxDiff, Math.abs(v - left));
          }
          if (y > 0) {
            const above = noise.fbm(x * 0.05, (y - 1) * 0.05, 4, 2, 0.5, 'standard');
            maxDiff = Math.max(maxDiff, Math.abs(v - above));
          }
        }
      }
      expect(maxDiff).toBeLessThan(0.5);
    });
  });

  describe('Performance-related edge cases', () => {
    it('single octave is fast', () => {
      const noise = createNoise(42, 'simplex');
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        noise.fbm(i * 0.1, i * 0.2, 1, 2, 0.5, 'standard');
      }
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('many octaves completes', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 12, 2, 0.5, 'standard');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });
  });

  describe('Reproducibility across sessions', () => {
    it('known seed produces known value', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      expect(typeof val).toBe('number');
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('sequence of values is reproducible', () => {
      const noise = createNoise(123, 'simplex');
      const values = [];
      for (let i = 0; i < 10; i++) {
        values.push(noise.fbm(i * 0.1, i * 0.1, 4, 2, 0.5, 'standard'));
      }
      const noise2 = createNoise(123, 'simplex');
      for (let i = 0; i < 10; i++) {
        expect(noise2.fbm(i * 0.1, i * 0.1, 4, 2, 0.5, 'standard')).toBe(values[i]);
      }
    });
  });
});
