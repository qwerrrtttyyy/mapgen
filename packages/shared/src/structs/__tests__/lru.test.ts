import { describe, it, expect } from 'vitest';
import { LRUCache } from '../lru.js';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(2);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts least recently used when capacity exceeded', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // make a recently used
    cache.set('c', 3); // evict b
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('updates existing keys and marks them recently used', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 3); // update a, now a is recently used
    cache.set('c', 4); // evict b
    expect(cache.get('a')).toBe(3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(4);
  });

  it('clears all entries', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.has('a')).toBe(false);
  });
});
