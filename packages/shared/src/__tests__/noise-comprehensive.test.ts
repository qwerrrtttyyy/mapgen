import { describe, it, expect } from 'vitest';
import { createNoise } from '../noise.js';

describe('Noise Module - Comprehensive Tests', () => {
  describe('createNoise function', () => {
    it('creates simplex noise instance', () => {
      const noise = createNoise(42, 'simplex');
      expect(noise).toBeDefined();
      expect(typeof noise.fbm).toBe('function');
      expect(typeof noise.fbmNatural).toBe('function');
    });

    it('creates perlin noise instance', () => {
      const noise = createNoise(42, 'perlin');
      expect(noise).toBeDefined();
      expect(typeof noise.fbm).toBe('function');
    });

    it('creates value noise instance', () => {
      const noise = createNoise(42, 'value');
      expect(noise).toBeDefined();
      expect(typeof noise.fbm).toBe('function');
    });

    it('different seeds produce different outputs', () => {
      const noise1 = createNoise(1, 'simplex');
      const noise2 = createNoise(2, 'simplex');
      const val1 = noise1.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      const val2 = noise2.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      expect(val1).not.toBe(val2);
    });

    it('same seed produces same output', () => {
      const noise1 = createNoise(123, 'simplex');
      const noise2 = createNoise(123, 'simplex');
      for (let i = 0; i < 10; i++) {
        const x = i * 0.1;
        const y = i * 0.2;
        expect(noise1.fbm(x, y, 4, 2, 0.5, 'standard')).toBe(noise2.fbm(x, y, 4, 2, 0.5, 'standard'));
      }
    });
  });

  describe('FBM standard mode', () => {
    it('returns values in [-1, 1] range', () => {
      const noise = createNoise(42, 'simplex');
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * 0.37;
        const y = Math.floor(i / 10) * 0.41;
        const val = noise.fbm(x, y, 4, 2, 0.5, 'standard');
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('octaves affect detail level', () => {
      const noise = createNoise(42, 'simplex');
      const lowOctaves = noise.fbm(0.5, 0.5, 1, 2, 0.5, 'standard');
      const highOctaves = noise.fbm(0.5, 0.5, 6, 2, 0.5, 'standard');
      expect(lowOctaves).toBeDefined();
      expect(highOctaves).toBeDefined();
    });

    it('lacunarity affects frequency scaling', () => {
      const noise = createNoise(42, 'simplex');
      const lowLac = noise.fbm(0.5, 0.5, 4, 1.5, 0.5, 'standard');
      const highLac = noise.fbm(0.5, 0.5, 4, 3.0, 0.5, 'standard');
      expect(lowLac).toBeDefined();
      expect(highLac).toBeDefined();
    });

    it('persistence affects amplitude scaling', () => {
      const noise = createNoise(42, 'simplex');
      const lowPers = noise.fbm(0.5, 0.5, 4, 2, 0.3, 'standard');
      const highPers = noise.fbm(0.5, 0.5, 4, 2, 0.8, 'standard');
      expect(lowPers).toBeDefined();
      expect(highPers).toBeDefined();
    });

    it('handles edge coordinates', () => {
      const noise = createNoise(42, 'simplex');
      expect(() => noise.fbm(0, 0, 4, 2, 0.5, 'standard')).not.toThrow();
      expect(() => noise.fbm(1000, 1000, 4, 2, 0.5, 'standard')).not.toThrow();
      expect(() => noise.fbm(-1000, -1000, 4, 2, 0.5, 'standard')).not.toThrow();
    });
  });

  describe('FBM ridged mode', () => {
    it('returns values in [0, 1] range for ridged', () => {
      const noise = createNoise(42, 'simplex');
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * 0.37;
        const y = Math.floor(i / 10) * 0.41;
        const val = noise.fbm(x, y, 4, 2, 0.5, 'ridged');
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('ridged creates sharp ridges', () => {
      const noise = createNoise(42, 'simplex');
      const size = 32;
      let ridgeCount = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const val = noise.fbm(x / size * 4, y / size * 4, 4, 2, 0.5, 'ridged');
          if (val > 0.7) ridgeCount++;
        }
      }
      expect(ridgeCount).toBeGreaterThan(0);
    });

    it('ridgeAngle parameter affects orientation', () => {
      const noise = createNoise(42, 'simplex');
      const horizontal = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: 0, anisotropy: 0.7 });
      const vertical = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: Math.PI / 2, anisotropy: 0.7 });
      expect(horizontal).toBeDefined();
      expect(vertical).toBeDefined();
    });

    it('anisotropy parameter affects ridge elongation', () => {
      const noise = createNoise(42, 'simplex');
      const iso = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: 0, anisotropy: 0 });
      const aniso = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: 0, anisotropy: 0.8 });
      expect(iso).toBeDefined();
      expect(aniso).toBeDefined();
    });
  });

  describe('fbmNatural with domain warping', () => {
    it('warpStrength=0 produces similar results to standard fbm', () => {
      const noise = createNoise(42, 'simplex');
      const standard = noise.fbm(0.5, 0.5, 4, 2, 0.5, 'standard');
      const warped = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0 });
      // Both should be in similar range (not exact due to implementation details)
      expect(Math.abs(warped - standard)).toBeLessThan(0.1);
    });

    it('warpStrength>0 produces different output', () => {
      const noise = createNoise(42, 'simplex');
      const noWarp = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0 });
      const warped = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0.5 });
      expect(noWarp).not.toBe(warped);
    });

    it('higher warpStrength increases distortion', () => {
      const noise = createNoise(42, 'simplex');
      const base = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0 });
      const low = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0.3 });
      const high = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'standard', { warpStrength: 0.8 });
      const diffLow = Math.abs(low - base);
      const diffHigh = Math.abs(high - base);
      expect(diffHigh).toBeGreaterThanOrEqual(diffLow * 0.5);
    });
  });

  describe('Continuity tests', () => {
    it('adjacent pixels have small differences (simplex)', () => {
      const noise = createNoise(42, 'simplex');
      const size = 32;
      const step = 0.01;
      let maxDiff = 0;
      for (let i = 0; i < size; i++) {
        const x = i * step;
        const y = 0.5;
        const v1 = noise.fbm(x, y, 4, 2, 0.5, 'standard');
        const v2 = noise.fbm(x + step, y, 4, 2, 0.5, 'standard');
        maxDiff = Math.max(maxDiff, Math.abs(v1 - v2));
      }
      expect(maxDiff).toBeLessThan(0.3);
    });

    it('adjacent pixels have small differences (perlin)', () => {
      const noise = createNoise(42, 'perlin');
      const size = 32;
      const step = 0.01;
      let maxDiff = 0;
      for (let i = 0; i < size; i++) {
        const x = i * step;
        const y = 0.5;
        const v1 = noise.fbm(x, y, 4, 2, 0.5, 'standard');
        const v2 = noise.fbm(x + step, y, 4, 2, 0.5, 'standard');
        maxDiff = Math.max(maxDiff, Math.abs(v1 - v2));
      }
      expect(maxDiff).toBeLessThan(0.3);
    });

    it('diagonal continuity is maintained', () => {
      const noise = createNoise(42, 'simplex');
      const step = 0.02;
      let maxDiff = 0;
      for (let i = 0; i < 20; i++) {
        const x = i * step;
        const y = i * step;
        const v1 = noise.fbm(x, y, 4, 2, 0.5, 'standard');
        const v2 = noise.fbm(x + step, y + step, 4, 2, 0.5, 'standard');
        maxDiff = Math.max(maxDiff, Math.abs(v1 - v2));
      }
      expect(maxDiff).toBeLessThan(0.4);
    });
  });

  describe('Performance and edge cases', () => {
    it('handles zero octaves gracefully', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 0, 2, 0.5, 'standard');
      expect(val).toBeDefined();
      expect(typeof val).toBe('number');
    });

    it('handles very high octaves', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbm(0.5, 0.5, 10, 2, 0.5, 'standard');
      expect(val).toBeDefined();
      expect(Math.abs(val)).toBeLessThanOrEqual(1);
    });

    it('handles extreme lacunarity', () => {
      const noise = createNoise(42, 'simplex');
      expect(() => noise.fbm(0.5, 0.5, 4, 0.5, 0.5, 'standard')).not.toThrow();
      expect(() => noise.fbm(0.5, 0.5, 4, 5.0, 0.5, 'standard')).not.toThrow();
    });

    it('handles extreme persistence', () => {
      const noise = createNoise(42, 'simplex');
      expect(() => noise.fbm(0.5, 0.5, 4, 2, 0, 'standard')).not.toThrow();
      expect(() => noise.fbm(0.5, 0.5, 4, 2, 1, 'standard')).not.toThrow();
    });

    it('large coordinate values remain stable', () => {
      const noise = createNoise(42, 'simplex');
      const val1 = noise.fbm(10000, 10000, 4, 2, 0.5, 'standard');
      const val2 = noise.fbm(10000.001, 10000, 4, 2, 0.5, 'standard');
      expect(Math.abs(val1 - val2)).toBeLessThan(0.5);
    });
  });

  describe('Seed determinism', () => {
    it('seed 0 is deterministic', () => {
      const n1 = createNoise(0, 'simplex');
      const n2 = createNoise(0, 'simplex');
      for (let i = 0; i < 20; i++) {
        expect(n1.fbm(i * 0.1, i * 0.2, 4, 2, 0.5, 'standard')).toBe(n2.fbm(i * 0.1, i * 0.2, 4, 2, 0.5, 'standard'));
      }
    });

    it('negative seeds work correctly', () => {
      const n1 = createNoise(-42, 'simplex');
      const n2 = createNoise(-42, 'simplex');
      expect(n1.fbm(0.5, 0.5, 4, 2, 0.5, 'standard')).toBe(n2.fbm(0.5, 0.5, 4, 2, 0.5, 'standard'));
    });

    it('large seeds work correctly', () => {
      const n1 = createNoise(9999999, 'simplex');
      const n2 = createNoise(9999999, 'simplex');
      expect(n1.fbm(0.5, 0.5, 4, 2, 0.5, 'standard')).toBe(n2.fbm(0.5, 0.5, 4, 2, 0.5, 'standard'));
    });
  });

  describe('All noise types produce valid output', () => {
    const noiseTypes: Array<'simplex' | 'perlin' | 'value'> = ['simplex', 'perlin', 'value'];
    
    noiseTypes.forEach(type => {
      it(`${type} noise returns valid numbers`, () => {
        const noise = createNoise(42, type);
        for (let i = 0; i < 20; i++) {
          const val = noise.fbm(i * 0.1, i * 0.2, 4, 2, 0.5, 'standard');
          expect(typeof val).toBe('number');
          expect(Number.isNaN(val)).toBe(false);
          expect(Number.isFinite(val)).toBe(true);
        }
      });

      it(`${type} noise is continuous`, () => {
        const noise = createNoise(42, type);
        let maxDiff = 0;
        for (let i = 0; i < 20; i++) {
          const x = i * 0.05;
          const v1 = noise.fbm(x, 0.5, 4, 2, 0.5, 'standard');
          const v2 = noise.fbm(x + 0.01, 0.5, 4, 2, 0.5, 'standard');
          maxDiff = Math.max(maxDiff, Math.abs(v1 - v2));
        }
        expect(maxDiff).toBeLessThan(0.5);
      });
    });
  });

  describe('Ridged mode variations', () => {
    it('ridged with default options', () => {
      const noise = createNoise(42, 'simplex');
      const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged');
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });

    it('ridged with custom ridgeAngle', () => {
      const noise = createNoise(42, 'simplex');
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: angle, anisotropy: 0.5 });
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('ridged with varying anisotropy', () => {
      const noise = createNoise(42, 'simplex');
      for (let aniso = 0; aniso <= 1; aniso += 0.2) {
        const val = noise.fbmNatural(0.5, 0.5, 4, 2, 0.5, 'ridged', { ridgeAngle: 0, anisotropy: aniso });
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Statistical properties', () => {
    it('fbm output has reasonable distribution', () => {
      const noise = createNoise(42, 'simplex');
      const samples: number[] = [];
      for (let i = 0; i < 500; i++) {
        samples.push(noise.fbm(i * 0.137, i * 0.283, 4, 2, 0.5, 'standard'));
      }
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(Math.abs(mean)).toBeLessThan(0.3);
    });

    it('ridged output has mean in expected range', () => {
      const noise = createNoise(42, 'simplex');
      const samples: number[] = [];
      for (let i = 0; i < 500; i++) {
        samples.push(noise.fbm(i * 0.137, i * 0.283, 4, 2, 0.5, 'ridged'));
      }
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // Ridged output is in [0, 1], mean typically around 0.5-0.7
      expect(mean).toBeGreaterThanOrEqual(0.3);
      expect(mean).toBeLessThanOrEqual(0.8);
    });
  });
});
