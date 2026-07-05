import { describe, it, expect } from 'vitest';
import { classifyBiomes, getBiomeInfo, BIOME_INFO, BIOME_COUNT, BIOME_NAMES } from '../biomes.js';

describe('Biomes Module - Comprehensive Tests', () => {
  const W = 32, H = 32;

  function buildField(fn: (i: number) => number): Float32Array {
    const arr = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) arr[i] = fn(i);
    return arr;
  }

  describe('BIOME_INFO constants', () => {
    it('BIOME_COUNT equals 32', () => {
      expect(BIOME_COUNT).toBe(32);
    });

    it('BIOME_INFO has correct length', () => {
      expect(BIOME_INFO.length).toBe(BIOME_COUNT);
    });

    it('all biome IDs are unique', () => {
      const ids = BIOME_INFO.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(BIOME_COUNT);
    });

    it('biome IDs are contiguous from 0 to 31', () => {
      for (let i = 0; i < BIOME_COUNT; i++) {
        expect(BIOME_INFO[i].id).toBe(i);
      }
    });

    it('all biomes have non-empty names', () => {
      for (const biome of BIOME_INFO) {
        expect(biome.name).toBeDefined();
        expect(biome.name.length).toBeGreaterThan(0);
      }
    });

    it('all biomes have valid koppen classification', () => {
      const validKoppen = ['A', 'B', 'C', 'D', 'E', 'H', 'M', 'X', ''];
      for (const biome of BIOME_INFO) {
        expect(validKoppen).toContain(biome.koppen);
      }
    });

    it('ocean biomes are marked as not land', () => {
      expect(BIOME_INFO[0].isLand).toBe(false); // Deep ocean
      expect(BIOME_INFO[1].isLand).toBe(false); // Shallow ocean
    });

    it('land biomes are marked as land', () => {
      expect(BIOME_INFO[2].isLand).toBe(true); // Tropical rainforest
      expect(BIOME_INFO[21].isLand).toBe(true); // Alpine tundra
    });
  });

  describe('getBiomeInfo function', () => {
    it('returns correct info for deep ocean', () => {
      const info = getBiomeInfo(0);
      expect(info.id).toBe(0);
      expect(info.name).toBe('深海');
    });

    it('returns correct info for tropical rainforest', () => {
      const info = getBiomeInfo(2);
      expect(info.id).toBe(2);
      expect(info.name).toBe('热带雨林');
      expect(info.koppen).toBe('A');
    });

    it('returns correct info for polar ice cap', () => {
      const info = getBiomeInfo(20);
      expect(info.id).toBe(20);
      expect(info.name).toBe('极地冰盖');
      expect(info.koppen).toBe('E');
    });

    it('handles all valid biome IDs', () => {
      for (let i = 0; i < BIOME_COUNT; i++) {
        const info = getBiomeInfo(i);
        expect(info).toBeDefined();
        expect(info.id).toBe(i);
      }
    });
  });

  describe('Ocean biome classification', () => {
    it('deep water classified as deep ocean', () => {
      const elevation = buildField(() => -0.8);
      const temperature = buildField(() => 0.5);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        expect(biomeId[i]).toBe(0);
      }
    });

    it('shallow water classified as shallow ocean', () => {
      const elevation = buildField(() => -0.1);
      const temperature = buildField(() => 0.5);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      for (let i = 0; i < W * H; i++) {
        expect(biomeId[i]).toBe(1);
      }
    });
  });

  describe('Tropical biome classification', () => {
    it('high temp + high rain = tropical rainforest', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.9);
      const rainfall = buildField(() => 0.9);
      const moisture = buildField(() => 0.9);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect(biomeId[0]).toBe(2);
    });

    it('high temp + medium rain = tropical seasonal', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.85);
      const rainfall = buildField(() => 0.6);
      const moisture = buildField(() => 0.6);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([2, 3, 4]).toContain(biomeId[0]);
    });

    it('high temp + low rain = tropical desert', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.8);
      const rainfall = buildField(() => 0.15);
      const moisture = buildField(() => 0.15);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([5, 6]).toContain(biomeId[0]);
    });
  });

  describe('Temperate biome classification', () => {
    it('medium temp + high rain = temperate forest', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.4);
      const rainfall = buildField(() => 0.7);
      const moisture = buildField(() => 0.7);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([12, 13]).toContain(biomeId[0]);
    });

    it('medium temp + low rain = temperate grassland', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.3);
      const moisture = buildField(() => 0.3);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([8, 9, 12, 13]).toContain(biomeId[0]);
    });
  });

  describe('Cold biome classification', () => {
    it('low temp = boreal forest/taiga', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => -0.1);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([16, 17, 18]).toContain(biomeId[0]);
    });

    it('very low temp = polar tundra', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => -0.8);
      const rainfall = buildField(() => 0.3);
      const moisture = buildField(() => 0.3);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([19, 20]).toContain(biomeId[0]);
    });
  });

  describe('Alpine biome classification', () => {
    it('high elevation = alpine biomes', () => {
      const elevation = buildField(() => 0.85);
      const temperature = buildField(() => -0.2);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      expect([21, 22, 23, 24]).toContain(biomeId[0]);
    });
  });

  describe('Special biome masks', () => {
    it('landIce mask overrides to glacier', () => {
      const elevation = buildField(() => 0.4);
      const temperature = buildField(() => 0);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const landIce = buildField(() => 0.7);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, landIce,
      });
      expect(biomeId[0]).toBe(28);
    });

    it('lakeMask overrides to lake', () => {
      const elevation = buildField(() => 0.3);
      const temperature = buildField(() => 0.4);
      const rainfall = buildField(() => 0.4);
      const moisture = buildField(() => 0.4);
      const lakeMask = buildField(() => 0.9);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5, lakeMask,
      });
      expect(biomeId[0]).toBe(30);
    });
  });

  describe('biomeNormalized output', () => {
    it('values in [0, 1] range', () => {
      const elevation = buildField((i) => (i % 3 === 0 ? 0.3 : (i % 3 === 1 ? -0.3 : 0.8)));
      const temperature = buildField(() => 0.5);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
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

  describe('Edge cases', () => {
    it('handles seaLevel boundary', () => {
      const elevation = buildField((i) => i % 2 === 0 ? 0.01 : -0.01);
      const temperature = buildField(() => 0.5);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      // Pixels just above sea level should be land biomes
      // Pixels just below should be ocean biomes
      expect(biomeId[0]).not.toBe(biomeId[1]);
    });

    it('handles snowLine boundary', () => {
      const elevation = buildField((i) => 0.49 + (i % 10) * 0.02);
      const temperature = buildField(() => 0.3);
      const rainfall = buildField(() => 0.5);
      const moisture = buildField(() => 0.5);
      const { biomeId } = classifyBiomes({
        elevation, temperature, rainfall, moisture,
        seaLevel: 0, snowLine: 0.5,
      });
      // Should produce valid biome IDs
      for (let i = 0; i < W * H; i++) {
        expect(biomeId[i]).toBeGreaterThanOrEqual(0);
        expect(biomeId[i]).toBeLessThan(BIOME_COUNT);
      }
    });
  });

  describe('BIOME_INFO array', () => {
    it('has correct length', () => {
      expect(BIOME_INFO.length).toBe(BIOME_COUNT);
    });

    it('all names are non-empty strings', () => {
      for (const biome of BIOME_INFO) {
        expect(typeof biome.name).toBe('string');
        expect(biome.name.length).toBeGreaterThan(0);
      }
    });

    it('all biomes have valid isLand boolean', () => {
      for (const biome of BIOME_INFO) {
        expect(typeof biome.isLand).toBe('boolean');
      }
    });
  });
});
