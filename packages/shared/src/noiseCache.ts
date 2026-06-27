import { createNoise, type NoiseEngine, type NoiseType } from './noise.js';
import { LRUCache } from './structs/lru.js';

interface NoiseKey {
  seed: number;
  type: NoiseType;
}

function keyToString(k: NoiseKey): string {
  return `${k.seed}:${k.type}`;
}

/**
 * 噪声引擎缓存：以 (seed, noiseType) 为 key 复用已构建的 NoiseEngine。
 * 相同种子重复生成时直接复用排列表，避免重复初始化。
 */
export class NoiseCache {
  private cache: LRUCache<string, NoiseEngine>;

  constructor(capacity = 8) {
    this.cache = new LRUCache<string, NoiseEngine>(capacity);
  }

  get(seed: number, type: NoiseType = 'perlin'): NoiseEngine {
    const key = keyToString({ seed, type });
    const existing = this.cache.get(key);
    if (existing) return existing;
    const engine = createNoise(seed, type);
    this.cache.set(key, engine);
    return engine;
  }

  clear(): void {
    this.cache.clear();
  }
}
