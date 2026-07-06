import { describe, it, expect } from 'vitest';
import { generateNames, type NameablePlate, type NameableRegion } from '../naming.js';

describe('命名系统 (AC-8.1, AC-8.2, AC-8.4, AC-8.5, BR-4)', () => {
  const W = 100,
    H = 80;

  function makePlates(): NameablePlate[] {
    // 4 个板块：北大陆、南大陆、东大洋、西大洋
    return [
      { plateId: 0, type: 'continent', centroid: [W * 0.5, H * 0.2] }, // 北
      { plateId: 1, type: 'continent', centroid: [W * 0.5, H * 0.8] }, // 南
      { plateId: 2, type: 'ocean', centroid: [W * 0.8, H * 0.5] }, // 东
      { plateId: 3, type: 'ocean', centroid: [W * 0.2, H * 0.5] }, // 西
    ];
  }

  function makeRegions(): NameableRegion[] {
    return [
      { key: 'r0', type: 'mountain', centroid: [50, 30], area: 200 },
      { key: 'r1', type: 'plain', centroid: [30, 50], area: 300 },
      { key: 'r2', type: 'desert', centroid: [70, 50], area: 150 },
      { key: 'r3', type: 'mountain', centroid: [60, 60], area: 180 },
    ];
  }

  it('AC-8.4 板块名 = 方位词 + 类型词', () => {
    const plates = makePlates();
    const manifest = generateNames(42, W, H, plates, []);
    expect(manifest.plates).toHaveLength(4);
    for (const p of manifest.plates) {
      // 大陆板块名以「大陆/洲/陆地」结尾，海洋板块以「洋/海/湾」结尾
      if (p.type === 'continent') {
        expect(p.name).toMatch(/(大陆|洲|陆地)$/);
      } else {
        expect(p.name).toMatch(/(洋|海|湾)$/);
      }
      expect(p.name.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('AC-8.4 方位词按质心相对地图中心确定', () => {
    const plates = makePlates();
    const manifest = generateNames(42, W, H, plates, []);
    const byId = new Map(manifest.plates.map(p => [p.plateId, p.name]));
    // 北大陆质心在地图北方 → 名称含「北」
    expect(byId.get(0)).toMatch(/北/);
    // 南大陆质心在南方 → 含「南」
    expect(byId.get(1)).toMatch(/南/);
    // 东大洋质心在东方 → 含「东」
    expect(byId.get(2)).toMatch(/东/);
    // 西大洋质心在西方 → 含「西」
    expect(byId.get(3)).toMatch(/西/);
  });

  it('AC-8.5 地形区名 = 专有名 + 地貌词', () => {
    const regions = makeRegions();
    const manifest = generateNames(42, W, H, [], regions);
    expect(manifest.regions).toHaveLength(4);
    for (const r of manifest.regions) {
      switch (r.type) {
        case 'mountain':
          expect(r.name).toMatch(/(山脉|山脊|峰群)$/);
          break;
        case 'plain':
          expect(r.name).toMatch(/(平原|草原|低地)$/);
          break;
        case 'desert':
          expect(r.name).toMatch(/(沙漠|荒原)$/);
          break;
        case 'plateau':
          expect(r.name).toMatch(/(高原|台地)$/);
          break;
        case 'basin':
          expect(r.name).toMatch(/(盆地|洼地)$/);
          break;
        case 'forest':
          expect(r.name).toMatch(/(森林|林地)$/);
          break;
      }
      // 专有名至少 2 字 + 地貌词 ≥ 2 字 → 总长 ≥ 4
      expect(r.name.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('BR-4 同一种子输出一致', () => {
    const plates = makePlates();
    const regions = makeRegions();
    const a = generateNames(123, W, H, plates, regions);
    const b = generateNames(123, W, H, plates, regions);
    expect(b.plates.map(p => p.name)).toEqual(a.plates.map(p => p.name));
    expect(b.regions.map(r => r.name)).toEqual(a.regions.map(r => r.name));
  });

  it('BR-4 不同种子输出不同', () => {
    const plates = makePlates();
    const regions = makeRegions();
    const a = generateNames(1, W, H, plates, regions);
    const b = generateNames(2, W, H, plates, regions);
    // 至少有一个名称不同（专有名由 rng 决定）
    const aNames = new Set([...a.regions.map(r => r.name)]);
    const bNames = b.regions.map(r => r.name);
    expect(bNames.some(n => !aNames.has(n))).toBe(true);
  });

  it('地形区专有名唯一（同次生成内不重复）', () => {
    const regions: NameableRegion[] = [];
    for (let i = 0; i < 12; i++) {
      regions.push({ key: `r${i}`, type: 'mountain', centroid: [i * 8, 40], area: 100 });
    }
    const manifest = generateNames(7, W, H, [], regions);
    const properNames = manifest.regions.map(r => {
      // 去掉地貌后缀，取专有名（前缀部分）
      const suffix = r.name.match(/(山脉|山脊|峰群)$/)?.[0] ?? '';
      return r.name.slice(0, r.name.length - suffix.length);
    });
    expect(new Set(properNames).size).toBe(properNames.length);
  });
});
