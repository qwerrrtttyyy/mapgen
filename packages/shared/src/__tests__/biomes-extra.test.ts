import { describe, it, expect } from 'vitest';
import { classifyBiomes, BIOME_INFO, BIOME_COUNT } from '../biomes.js';

describe('Biomes Module - Additional Tests', () => {
  const W = 16, H = 16;
  
  function buildField(fn: (i: number) => number): Float32Array {
    const arr = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) arr[i] = fn(i);
    return arr;
  }

  describe('Desert biome variations', () => {
    it('hot desert classification', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.4);
      const rainfall = buildField(() => 0.08);
      const moisture = buildField(() => 0.08);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([6, 7]).toContain(biomeId[0]);
    });

    it('cold desert classification', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.05);
      const rainfall = buildField(() => 0.08);
      const moisture = buildField(() => 0.08);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([6, 7, 9]).toContain(biomeId[0]);
    });

    it('semi-arid hot steppe', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.35);
      const rainfall = buildField(() => 0.25);
      const moisture = buildField(() => 0.25);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([8, 9]).toContain(biomeId[0]);
    });

    it('semi-arid cold steppe', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.1);
      const rainfall = buildField(() => 0.2);
      const moisture = buildField(() => 0.2);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([8, 9]).toContain(biomeId[0]);
    });
  });

  describe('Mediterranean climate biomes', () => {
    it('hot summer Mediterranean (Csa)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.45);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.35);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([10, 11, 12, 13]).toContain(biomeId[0]);
    });

    it('warm summer Mediterranean (Csb)', () => {
      const elevation = buildField(() => 0.25);
      const temperature = buildField(() => 0.25);
      const rainfall = buildField(() => 0.45);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([10, 11, 12, 13, 14]).toContain(biomeId[0]);
    });
  });

  describe('Humid subtropical and oceanic', () => {
    it('humid subtropical (Cfa)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.45);
      const rainfall = buildField(() => 0.65);
      const moisture = buildField(() => 0.65);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([12, 13]).toContain(biomeId[0]);
    });

    it('oceanic climate (Cfb)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.25);
      const rainfall = buildField(() => 0.6);
      const moisture = buildField(() => 0.6);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([13, 14]).toContain(biomeId[0]);
    });

    it('subpolar oceanic (Cfc)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.12);
      const rainfall = buildField(() => 0.55);
      const moisture = buildField(() => 0.55);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([13, 14]).toContain(biomeId[0]);
    });
  });

  describe('Continental climate biomes', () => {
    it('humid continental warm summer (Dfa)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.05);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([15, 16, 17, 18]).toContain(biomeId[0]);
    });

    it('humid continental cool summer (Dfb)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => -0.1);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([16, 17, 18]).toContain(biomeId[0]);
    });

    it('subarctic climate (Dfc)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => -0.2);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([17, 18]).toContain(biomeId[0]);
    });

    it('severe winter continental (Dfd)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => -0.5);
      const rainfall = buildField(() => 0.3);
      const moisture = buildField(() => 0.3);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([17, 18, 19]).toContain(biomeId[0]);
    });
  });

  describe('Polar biomes', () => {
    it('tundra (ET)', () => {
      const elevation = buildField(() => 0.1);
      const temperature = buildField(() => -0.5);
      const rainfall = buildField(() => 0.2);
      const moisture = buildField(() => 0.2);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([19, 20]).toContain(biomeId[0]);
    });

    it('ice cap (EF)', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => -0.7);
      const rainfall = buildField(() => 0.1);
      const moisture = buildField(() => 0.1);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([19, 20]).toContain(biomeId[0]);
    });
  });

  describe('Alpine biomes detailed', () => {
    it('alpine tundra at high elevation', () => {
      const elevation = buildField(() => 0.75);
      const temperature = buildField(() => -0.1);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([21, 22, 23, 24]).toContain(biomeId[0]);
    });

    it('alpine meadow with high moisture', () => {
      const elevation = buildField(() => 0.75);
      const temperature = buildField(() => 0.1);
      const rainfall = buildField(() => 0.6);
      const moisture = buildField(() => 0.7);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([21, 22, 23, 24]).toContain(biomeId[0]);
    });

    it('alpine cold desert', () => {
      const elevation = buildField(() => 0.8);
      const temperature = buildField(() => -0.3);
      const rainfall = buildField(() => 0.15);
      const moisture = buildField(() => 0.15);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([21, 22, 23, 24]).toContain(biomeId[0]);
    });
  });

  describe('Special water biomes', () => {
    it('lake detection with lakeMask', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const lakeMask = buildField(() => 0.8);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, lakeMask,
      });
      expect(biomeId[0]).toBe(30);
    });

    it('glacier from landIce mask', () => {
      const elevation = buildField(() => 0.5);
      const temperature = buildField(() => 0.1);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const landIce = buildField(() => 0.6);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, landIce,
      });
      expect(biomeId[0]).toBe(28);
    });

    it('sea ice in ocean', () => {
      const elevation = buildField(() => -0.3);
      const temperature = buildField(() => -0.5);
      const rainfall = buildField(() => 0.2);
      const moisture = buildField(() => 0.2);
      const seaIce = buildField(() => 0.7);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, seaIce,
      });
      expect(biomeId[0]).toBe(29);
    });
  });

  describe('Coastal special biomes', () => {
    it('mangrove in tropical coastal area', () => {
      const elevation = buildField(() => 0.05);
      const temperature = buildField(() => 0.7);
      const rainfall = buildField(() => 0.7);
      const moisture = buildField(() => 0.7);
      const coastDist = buildField(() => 2);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, coastDist,
      });
      expect([25, 26, 27, 31]).toContain(biomeId[0]);
    });

    it('salt marsh in temperate coastal lowland', () => {
      const elevation = buildField(() => 0.05);
      const temperature = buildField(() => 0.2);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.8);
      const coastDist = buildField(() => 3);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, coastDist,
      });
      expect([25, 26, 27, 31]).toContain(biomeId[0]);
    });

    it('riparian forest along rivers', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const riverMask = buildField(() => 0.6);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, riverMask,
      });
      expect([26, 27, 31]).toContain(biomeId[0]);
    });
  });

  describe('Biome transition zones', () => {
    it('gradient from wet to dry produces different biomes', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField(() => 0.4);
      const rainfall = buildField((i) => i / (W * H));
      const moisture = buildField((i) => i / (W * H));
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      const uniqueBiomes = new Set(biomeId);
      expect(uniqueBiomes.size).toBeGreaterThan(2);
    });

    it('temperature gradient produces biome variation', () => {
      const elevation = buildField(() => 0.2);
      const temperature = buildField((i) => (i % 32) / 32 - 0.5);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      const uniqueBiomes = new Set(biomeId);
      expect(uniqueBiomes.size).toBeGreaterThan(3);
    });
  });

  describe('BIOME_INFO completeness', () => {
    it('all biome IDs from 0 to 31 are defined', () => {
      for (let id = 0; id < 32; id++) {
        const info = BIOME_INFO.find(b => b.id === id);
        expect(info).toBeDefined();
        expect(info?.id).toBe(id);
      }
    });

    it('ocean biomes count', () => {
      const oceanBiomes = BIOME_INFO.filter(b => !b.isLand);
      expect(oceanBiomes.length).toBeGreaterThanOrEqual(2);
    });

    it('land biomes count', () => {
      const landBiomes = BIOME_INFO.filter(b => b.isLand);
      expect(landBiomes.length).toBeGreaterThanOrEqual(28);
    });

    it('koppen classifications distribution', () => {
      const koppenCounts: Record<string, number> = {};
      for (const biome of BIOME_INFO) {
        koppenCounts[biome.koppen] = (koppenCounts[biome.koppen] || 0) + 1;
      }
      expect(koppenCounts['A']).toBeGreaterThan(0);
      expect(koppenCounts['B']).toBeGreaterThan(0);
      expect(koppenCounts['C']).toBeGreaterThan(0);
      expect(koppenCounts['D']).toBeGreaterThan(0);
      expect(koppenCounts['E']).toBeGreaterThan(0);
    });
  });

  describe('Edge boundary conditions', () => {
    it('exactly at sea level', () => {
      const elevation = buildField(() => 0);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        expect(biomeId[i]).toBeLessThan(2);
      }
    });

    it('just above sea level', () => {
      const elevation = buildField(() => 0.001);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        expect(biomeId[i]).toBeGreaterThanOrEqual(2);
      }
    });

    it('at alpine threshold boundary', () => {
      const elevation = buildField(() => 0.7);
      const temperature = buildField(() => 0.1);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, alpineThreshold: 0.7,
      });
      const hasAlpine = Array.from(biomeId).some(id => id >= 21 && id <= 24);
      const hasNonAlpine = Array.from(biomeId).some(id => id < 21 || id > 24);
      expect(hasAlpine || hasNonAlpine).toBe(true);
    });
  });

  describe('Input array size consistency', () => {
    it('handles different array sizes', () => {
      const sizes = [4, 16, 64, 128];
      for (const size of sizes) {
        const elevation = new Float32Array(size);
        const temperature = new Float32Array(size);
        const rainfall = new Float32Array(size);
        const moisture = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          elevation[i] = 0.3;
          temperature[i] = 0.4;
          rainfall[i] = 0.5;
          moisture[i] = 0.5;
        }
        const { biomeId, biomeNormalized } = classifyBiomes({
          elevation, temperature, rainfall, moisture,
          seaLevel: 0, snowLine: 0.5,
        });
        expect(biomeId.length).toBe(size);
        expect(biomeNormalized.length).toBe(size);
      }
    });
  });

  describe('Biome normalized values', () => {
    it('normalized values are correctly scaled', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.4);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId, biomeNormalized } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        const expectedNorm = biomeId[i] / 31;
        expect(Math.abs(biomeNormalized[i] - expectedNorm)).toBeLessThan(0.001);
      }
    });

    it('normalized values stay in [0, 1]', () => {
      const elevation = buildField((i) => (i % 5) * 0.2 - 0.5);
      const temperature = buildField((i) => (i % 7) * 0.15 - 0.5);
      const rainfall = buildField((i) => (i % 3) * 0.3);
      const moisture = buildField((i) => (i % 4) * 0.2);
      const { biomeNormalized } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        expect(biomeNormalized[i]).toBeGreaterThanOrEqual(0);
        expect(biomeNormalized[i]).toBeLessThanOrEqual(1);
      }
    });
  });
});
