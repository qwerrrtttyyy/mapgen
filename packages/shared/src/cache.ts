/**
 * Generic LRU (Least Recently Used) Cache with TTL support.
 * Provides O(1) get/put operations using a doubly-linked list + HashMap.
 *
 * @module cache
 */

export interface CacheOptions {
  /** Maximum number of entries. Default: 256 */
  maxSize?: number;
  /** Time-to-live in milliseconds. 0 = no expiry. Default: 0 */
  ttlMs?: number;
  /** Optional callback when an entry is evicted */
  onEvict?: (key: string, value: unknown) => void;
}

interface CacheEntry<V> {
  key: string;
  value: V;
  expiresAt: number;
  prev: CacheEntry<V> | null;
  next: CacheEntry<V> | null;
}

/**
 * LRU Cache with O(1) operations.
 *
 * Usage:
 * ```ts
 * const cache = new LRUCache<string, Float32Array>({ maxSize: 100, ttlMs: 60_000 });
 * cache.put('elevation-123', elevationData);
 * const data = cache.get('elevation-123');
 * ```
 */
export class LRUCache<K, V> {
  private map = new Map<string, CacheEntry<V>>();
  private head: CacheEntry<V> | null = null;
  private tail: CacheEntry<V> | null = null;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly onEvict?: (key: string, value: unknown) => void;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 256;
    this.ttlMs = options.ttlMs ?? 0;
    this.onEvict = options.onEvict;
  }

  /** Current number of entries */
  get size(): number {
    return this.map.size;
  }

  /** Check if a key exists (without updating access order) */
  has(key: K): boolean {
    const k = String(key);
    const entry = this.map.get(k);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.removeEntry(entry);
      return false;
    }
    return true;
  }

  /** Get a value by key. Returns undefined if not found or expired. */
  get(key: K): V | undefined {
    const k = String(key);
    const entry = this.map.get(k);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.removeEntry(entry);
      return undefined;
    }
    this.moveToFront(entry);
    return entry.value;
  }

  /** Put a key-value pair. Evicts LRU entry if at capacity. */
  put(key: K, value: V): void {
    const k = String(key);
    const existing = this.map.get(k);
    if (existing) {
      existing.value = value;
      existing.expiresAt = this.ttlMs > 0 ? Date.now() + this.ttlMs : 0;
      this.moveToFront(existing);
      return;
    }

    if (this.map.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      key: k,
      value,
      expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : 0,
      prev: null,
      next: null,
    };
    this.map.set(k, entry);
    this.addToFront(entry);
  }

  /** Delete a specific key. Returns true if deleted. */
  delete(key: K): boolean {
    const k = String(key);
    const entry = this.map.get(k);
    if (!entry) return false;
    this.removeEntry(entry);
    return true;
  }

  /** Clear all entries */
  clear(): void {
    if (this.onEvict) {
      let curr = this.head;
      while (curr) {
        this.onEvict(curr.key, curr.value);
        curr = curr.next;
      }
    }
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /** Remove all expired entries */
  purge(): number {
    let count = 0;
    const now = Date.now();
    let curr = this.head;
    while (curr) {
      const next = curr.next;
      if (curr.expiresAt > 0 && curr.expiresAt <= now) {
        this.removeEntry(curr);
        count++;
      }
      curr = next;
    }
    return count;
  }

  /** Get all keys (in access order, most recent first) */
  keys(): string[] {
    const result: string[] = [];
    let curr = this.head;
    while (curr) {
      result.push(curr.key);
      curr = curr.next;
    }
    return result;
  }

  /** Get cache stats */
  stats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.map.size, maxSize: this.maxSize, ttlMs: this.ttlMs };
  }

  // --- Internal ---

  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt > 0 && entry.expiresAt <= Date.now();
  }

  private moveToFront(entry: CacheEntry<V>): void {
    if (entry === this.head) return;
    this.detach(entry);
    this.addToFront(entry);
  }

  private addToFront(entry: CacheEntry<V>): void {
    entry.prev = null;
    entry.next = this.head;
    if (this.head) this.head.prev = entry;
    this.head = entry;
    if (!this.tail) this.tail = entry;
  }

  private detach(entry: CacheEntry<V>): void {
    if (entry.prev) entry.prev.next = entry.next;
    if (entry.next) entry.next.prev = entry.prev;
    if (entry === this.head) this.head = entry.next;
    if (entry === this.tail) this.tail = entry.prev;
    entry.prev = null;
    entry.next = null;
  }

  private removeEntry(entry: CacheEntry<V>): void {
    this.detach(entry);
    this.map.delete(entry.key);
    if (this.onEvict) this.onEvict(entry.key, entry.value);
  }

  private evictLRU(): void {
    if (!this.tail) return;
    this.removeEntry(this.tail);
  }
}

/**
 * Compute a stable hash key for terrain generation parameters.
 * Produces a deterministic string key suitable for cache lookups.
 */
export function terrainCacheKey(
  seed: number,
  width: number,
  height: number,
  phase: string,
  params?: Record<string, unknown>,
): string {
  let key = `${seed}:${width}:${height}:${phase}`;
  if (params) {
    const sorted = Object.keys(params).sort();
    for (const k of sorted) {
      const v = params[k];
      if (v !== undefined && v !== null) {
        key += `:${k}=${typeof v === 'number' ? v.toFixed(4) : String(v)}`;
      }
    }
  }
  return key;
}

/**
 * Specialized cache for terrain generation data.
 * Pre-configured with sensible defaults for map generation workloads.
 */
export class TerrainCache extends LRUCache<string, Float32Array> {
  constructor(maxEntries = 16) {
    super({
      maxSize: maxEntries,
      ttlMs: 0, // No expiry — terrain data is deterministic for a given seed
    });
  }

  /** Cache elevation texture */
  getElevation(seed: number, w: number, h: number): Float32Array | undefined {
    return this.get(terrainCacheKey(seed, w, h, 'elevation'));
  }

  putElevation(seed: number, w: number, h: number, data: Float32Array): void {
    this.put(terrainCacheKey(seed, w, h, 'elevation'), data);
  }

  /** Cache plate texture */
  getPlate(seed: number, w: number, h: number): Float32Array | undefined {
    return this.get(terrainCacheKey(seed, w, h, 'plate'));
  }

  putPlate(seed: number, w: number, h: number, data: Float32Array): void {
    this.put(terrainCacheKey(seed, w, h, 'plate'), data);
  }

  /** Cache moisture texture */
  getMoisture(seed: number, w: number, h: number): Float32Array | undefined {
    return this.get(terrainCacheKey(seed, w, h, 'moisture'));
  }

  putMoisture(seed: number, w: number, h: number, data: Float32Array): void {
    this.put(terrainCacheKey(seed, w, h, 'moisture'), data);
  }

  /** Cache temperature texture */
  getTemperature(seed: number, w: number, h: number): Float32Array | undefined {
    return this.get(terrainCacheKey(seed, w, h, 'temperature'));
  }

  putTemperature(seed: number, w: number, h: number, data: Float32Array): void {
    this.put(terrainCacheKey(seed, w, h, 'temperature'), data);
  }

  /** Cache river texture */
  getRiver(seed: number, w: number, h: number): Float32Array | undefined {
    return this.get(terrainCacheKey(seed, w, h, 'river'));
  }

  putRiver(seed: number, w: number, h: number, data: Float32Array): void {
    this.put(terrainCacheKey(seed, w, h, 'river'), data);
  }

  /** Invalidate all caches for a given seed+size combo */
  invalidate(seed: number, w: number, h: number): void {
    const prefix = `${seed}:${w}:${h}:`;
    for (const key of this.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
      }
    }
  }
}

/**
 * Memoize a pure function with LRU caching.
 * The function must have deterministic output for the same inputs.
 *
 * @example
 * const cachedNoise = memoize((x: number, y: number) => noise.sample(x, y), { maxSize: 1024 });
 */
export function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  options: CacheOptions = {},
): (...args: Args) => R {
  const cache = new LRUCache<string, R>(options);
  return (...args: Args): R => {
    const key = args.map(a => String(a)).join(':');
    let result = cache.get(key);
    if (result === undefined) {
      result = fn(...args);
      cache.put(key, result);
    }
    return result;
  };
}
