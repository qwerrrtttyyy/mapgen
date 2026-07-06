import { describe, it, expect, vi } from 'vitest';
import { LRUCache, TerrainCache, terrainCacheKey, memoize } from '../cache.js';

describe('LRUCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.put('a', 1);
    cache.put('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('should return undefined for missing keys', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should evict LRU entry when at capacity', () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    cache.put('d', 4); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(3);
  });

  it('should update access order on get', () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    cache.get('a'); // 'a' moves to front
    cache.put('d', 4); // should evict 'b' (least recently used)
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('should update value for existing key', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.put('a', 1);
    cache.put('a', 99);
    expect(cache.get('a')).toBe(99);
    expect(cache.size).toBe(1);
  });

  it('should delete entries', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.put('a', 1);
    cache.put('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(1);
    expect(cache.delete('missing')).toBe(false);
  });

  it('should clear all entries', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should check has without updating access order', () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    cache.has('a'); // should NOT move 'a' to front
    cache.put('d', 4); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
  });

  it('should handle TTL expiry', () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, number>({ maxSize: 10, ttlMs: 1000 });
    cache.put('a', 1);
    expect(cache.get('a')).toBe(1);

    vi.advanceTimersByTime(500);
    expect(cache.get('a')).toBe(1);

    vi.advanceTimersByTime(600); // total 1100ms
    expect(cache.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('should call onEvict callback', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, number>({ maxSize: 2, onEvict });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3); // evicts 'a'
    expect(onEvict).toHaveBeenCalledWith('a', 1);
  });

  it('should purge expired entries', () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, number>({ maxSize: 10, ttlMs: 1000 });
    cache.put('a', 1);
    cache.put('b', 2);
    vi.advanceTimersByTime(1100);
    const purged = cache.purge();
    expect(purged).toBe(2);
    expect(cache.size).toBe(0);
    vi.useRealTimers();
  });

  it('should return keys in access order', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    expect(cache.keys()).toEqual(['c', 'b', 'a']);
  });

  it('should work with non-string keys', () => {
    const cache = new LRUCache<number, string>({ maxSize: 10 });
    cache.put(42, 'hello');
    cache.put(0, 'zero');
    expect(cache.get(42)).toBe('hello');
    expect(cache.has(0)).toBe(true);
  });
});

describe('terrainCacheKey', () => {
  it('should produce deterministic keys', () => {
    const k1 = terrainCacheKey(123, 512, 512, 'elevation');
    const k2 = terrainCacheKey(123, 512, 512, 'elevation');
    expect(k1).toBe(k2);
  });

  it('should differ for different seeds', () => {
    const k1 = terrainCacheKey(123, 512, 512, 'elevation');
    const k2 = terrainCacheKey(456, 512, 512, 'elevation');
    expect(k1).not.toBe(k2);
  });

  it('should include sorted params', () => {
    const k1 = terrainCacheKey(1, 2, 3, 'test', { b: 2, a: 1 });
    const k2 = terrainCacheKey(1, 2, 3, 'test', { a: 1, b: 2 });
    expect(k1).toBe(k2); // order shouldn't matter
    expect(k1).toContain('a=1');
    expect(k1).toContain('b=2');
  });
});

describe('TerrainCache', () => {
  it('should cache elevation data', () => {
    const cache = new TerrainCache();
    const data = new Float32Array([0.1, 0.2, 0.3]);
    cache.putElevation(42, 64, 64, data);
    expect(cache.getElevation(42, 64, 64)).toBe(data);
    expect(cache.getElevation(99, 64, 64)).toBeUndefined();
  });

  it('should cache multiple texture types', () => {
    const cache = new TerrainCache();
    const elev = new Float32Array([1]);
    const plate = new Float32Array([2]);
    const moist = new Float32Array([3]);

    cache.putElevation(1, 100, 100, elev);
    cache.putPlate(1, 100, 100, plate);
    cache.putMoisture(1, 100, 100, moist);

    expect(cache.getElevation(1, 100, 100)).toBe(elev);
    expect(cache.getPlate(1, 100, 100)).toBe(plate);
    expect(cache.getMoisture(1, 100, 100)).toBe(moist);
  });

  it('should invalidate all caches for a seed+size', () => {
    const cache = new TerrainCache();
    cache.putElevation(1, 100, 100, new Float32Array([1]));
    cache.putPlate(1, 100, 100, new Float32Array([2]));
    cache.putElevation(2, 100, 100, new Float32Array([3]));

    cache.invalidate(1, 100, 100);

    expect(cache.getElevation(1, 100, 100)).toBeUndefined();
    expect(cache.getPlate(1, 100, 100)).toBeUndefined();
    expect(cache.getElevation(2, 100, 100)).toBeDefined(); // different seed
  });
});

describe('memoize', () => {
  it('should cache function results', () => {
    let callCount = 0;
    const fn = memoize((x: number) => {
      callCount++;
      return x * 2;
    }, { maxSize: 10 });

    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(callCount).toBe(1); // only called once
  });

  it('should cache different arguments separately', () => {
    let callCount = 0;
    const fn = memoize((x: number, y: number) => {
      callCount++;
      return x + y;
    }, { maxSize: 10 });

    expect(fn(1, 2)).toBe(3);
    expect(fn(3, 4)).toBe(7);
    expect(fn(1, 2)).toBe(3);
    expect(callCount).toBe(2);
  });
});
