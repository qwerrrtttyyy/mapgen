import { describe, it, expect, vi } from 'vitest';
import { NoiseCache } from '../noiseCache.js';
import { createNoise } from '../noise.js';

describe('NoiseCache', () => {
  it('returns the same engine instance for the same (seed, type) key', () => {
    const cache = new NoiseCache();
    const a = cache.get(123, 'perlin');
    const b = cache.get(123, 'perlin');
    expect(a).toBe(b);
  });

  it('returns different engine instances for different seeds', () => {
    const cache = new NoiseCache();
    const a = cache.get(123, 'perlin');
    const b = cache.get(456, 'perlin');
    expect(a).not.toBe(b);
  });

  it('returns different engine instances for different noise types', () => {
    const cache = new NoiseCache();
    const a = cache.get(123, 'perlin');
    const b = cache.get(123, 'simplex');
    expect(a).not.toBe(b);
  });

  it('evicts least-recently-used entries when capacity is exceeded', () => {
    const cache = new NoiseCache(2);
    const e1 = cache.get(1, 'perlin');
    cache.get(2, 'perlin');
    // 触发淘汰
    cache.get(3, 'perlin');

    // e1 应被淘汰，再次获取应得到新实例
    const e1Again = cache.get(1, 'perlin');
    expect(e1Again).not.toBe(e1);
  });

  it('produces engines that sample identically to createNoise', () => {
    const cache = new NoiseCache();
    const cached = cache.get(42, 'simplex');
    const fresh = createNoise(42, 'simplex');
    expect(cached.sample(1.23, 4.56)).toBeCloseTo(fresh.sample(1.23, 4.56), 6);
  });

  it('clear() removes all cached engines', () => {
    const cache = new NoiseCache();
    const a = cache.get(1, 'perlin');
    cache.clear();
    const b = cache.get(1, 'perlin');
    expect(a).not.toBe(b);
  });
});
