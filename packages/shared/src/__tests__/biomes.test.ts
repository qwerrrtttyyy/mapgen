import { describe, it, expect } from 'vitest';
import { classifyBiomes, getBiomeInfo, BIOME_INFO, BIOME_COUNT } from '../biomes.js';

describe('生物群系分类 (Köppen-Geiger)', () => {
  const W = 32, H = 32;

  function buildField(fn: (i: number) => number): Float32Array {
    const arr = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) arr[i] = fn(i);
    return arr;
  }

  it('BIOME_INFO 包含 32 个生物群系且 ID 连续', () => {
    expect(BIOME_INFO.length).toBe(BIOME_COUNT);
    for (let i = 0; i < BIOME_COUNT; i++) {
      expect(BIOME_INFO[i].id).toBe(i);
    }
  });

  it('海洋像素分类为深海或浅海', () => {
    const elevation = buildField(() => -0.5); // 全深海
    const temperature = buildField(() => 0.5);
    const rainfall = buildField(() => 0.5);
    const moisture = buildField(() => 0.5);
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5,
    });
    // 全部应为 0（深海）
    for (let i = 0; i < W * H; i++) {
      expect(biomeId[i]).toBe(0);
    }
  });

  it('赤道高湿陆地 → 热带雨林 (Af, id=2)', () => {
    const elevation = buildField(() => 0.3); // 陆地
    const temperature = buildField(() => 0.8); // 热带
    const rainfall = buildField(() => 0.85);
    const moisture = buildField(() => 0.85); // 高湿
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5,
    });
    expect(biomeId[0]).toBe(2);
  });

  it('极地低温 → 极地冰盖或苔原', () => {
    const elevation = buildField(() => 0.3);
    const temperature = buildField(() => -0.7); // 极地
    const rainfall = buildField(() => 0.3);
    const moisture = buildField(() => 0.3);
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5,
    });
    expect(biomeId[0]).toBe(20); // EF 极地冰盖
  });

  it('高海拔 → 高山带', () => {
    const elevation = buildField(() => 0.85); // 高山带
    const temperature = buildField(() => -0.3); // 冷
    const rainfall = buildField(() => 0.4);
    const moisture = buildField(() => 0.4);
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5,
    });
    // 应为高山寒漠(24)或高山苔原(21)
    expect([21, 24]).toContain(biomeId[0]);
  });

  it('冰川覆盖 → 冰川生物群系 (id=28)', () => {
    const elevation = buildField(() => 0.4);
    const temperature = buildField(() => 0);
    const rainfall = buildField(() => 0.5);
    const moisture = buildField(() => 0.5);
    const landIce = buildField(() => 0.6); // 冰川覆盖
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5, landIce,
    });
    expect(biomeId[0]).toBe(28);
  });

  it('湖泊 → 湖泊生物群系 (id=30)', () => {
    const elevation = buildField(() => 0.4); // 陆地高程
    const temperature = buildField(() => 0.4);
    const rainfall = buildField(() => 0.4);
    const moisture = buildField(() => 0.4);
    const lakeMask = buildField(() => 0.8); // 湖泊
    const { biomeId } = classifyBiomes({
      elevation, temperature, rainfall, moisture,
      seaLevel: 0, snowLine: 0.5, lakeMask,
    });
    expect(biomeId[0]).toBe(30);
  });

  it('getBiomeInfo 返回正确元数据', () => {
    const info = getBiomeInfo(2);
    expect(info.name).toBe('热带雨林');
    expect(info.koppen).toBe('A');
    expect(info.isLand).toBe(true);
  });

  it('biomeNormalized 在 [0,1] 范围内', () => {
    const elevation = buildField((i) => i % 2 === 0 ? 0.3 : -0.3);
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
