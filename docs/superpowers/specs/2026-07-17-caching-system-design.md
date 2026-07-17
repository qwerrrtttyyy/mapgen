# Caching System Design

**Date:** 2026-07-17
**Status:** Approved
**Scope:** @mapgen/core, @mapgen/web, @mapgen/server

## Summary

引入全栈多层缓存系统，在不破坏现有API的前提下显著提升重复地图生成性能。系统复用已有的 `LRUCache`/`TerrainCache` 基础设施，按Core算法层→Web Worker→Web持久化→Server端四级构建缓存，支持pipeline阶段级缓存、智能失效和统计监控。

## Goals

- 用户使用相同参数（或改单一阶段参数）重新生成时，跳过已计算阶段，响应速度提升 5-10x
- 跨会话持久化：已生成过的地图刷新浏览器后可秒加载
- Server端重复API请求直接返回缓存结果
- 编辑器画笔/板块操作后智能失效下游阶段，保证一致性
- 所有缓存功能向后兼容，不传cache参数时代码路径与当前完全一致
- 提供缓存统计和手动清除能力（Debug Panel）

## Non-Goals

- 不引入外部缓存库（复用已有LRUCache实现）
- 不做Service Worker/HTTP缓存层
- 不做跨浏览器/跨用户缓存共享
- 不缓存renderer输出纹理（由GPU/WebGL状态管理，非CPU数据缓存范畴）

## Architecture

### 分层结构

```
┌─────────────────────────────────────────────────────────────┐
│  @mapgen/web (Browser)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UI / Debug Panel (stats + clear button)              │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │  LocalProvider / Worker                                │  │
│  │  L2 Persistent Cache (IndexedDB, serialized maps)     │  │
│  │  L1 Memory Cache (PipelineCache, in worker)           │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  @mapgen/core                                               │
│  generateMap() with cache-aware pipeline                    │
│  NoiseEngine (LRUCache-backed Worley points)                │
│  LRUCache / TerrainCache / PipelineCache / memoize          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  @mapgen/server (optional)                                  │
│  Result Cache (LRU, completed serialized maps)              │
│  In-flight deduplication (concurrent identical requests)    │
└─────────────────────────────────────────────────────────────┘
```

### Cache Tiers

| Tier | Location | Storage | Capacity | Lifecycle | Hit Benefit |
|------|----------|---------|----------|-----------|-------------|
| L0 | NoiseEngine | Heap (JS Map-backed LRU) | ~20000 Worley cells | Per NoiseEngine instance | Skip per-cell point gen |
| L1 | PipelineCache (worker) | Heap | 8 full maps / 64 phase entries | Worker lifetime / manual clear | Skip entire phase compute |
| L2 | Web browser | IndexedDB | 20 entries / ~128MB | Cross-session, LRU evict | Full generation skipped |
| L3 | Server | Heap | 32 results | Server restart clears | API returns instantly |

## Core Layer Design

### LRUCache Enhancements

File: `packages/core/src/cache.ts`

Add to existing `LRUCache<K, V>`:

```typescript
export interface CacheStats {
  size: number;
  maxSize: number;
  ttlMs: number;
  hits: number;
  misses: number;
  evictions: number;
  readonly hitRate: number;
}

computeIfAbsent(key: K, computeFn: () => V): V;
getStats(): CacheStats;
resetStats(): void;
```

- `computeIfAbsent` 原子化 get-or-compute，避免并发下重复计算
- `getStats` 返回命中统计快照
- `resetStats` 重置计数器（不清除条目）

### `hashParams` — Deterministic Parameter Hashing

```typescript
export function hashParams(params: Record<string, unknown>): string;
```

- 对 `MapParams` 做稳定哈希
- Keys按字母序排序，浮点值保留4位小数
- 忽略 `undefined`/`null` 值
- 返回短hex字符串（如 `a3f2c1d8`）
- UI-only参数（renderStyle、showGrid等）不纳入 — 在调用处过滤

### PipelineCache — New Phase-Granular Cache

```typescript
export type PipelinePhase =
  | 'tectonic' | 'elevation' | 'erosion'
  | 'coastline' | 'currents' | 'climate' | 'ice'
  | 'biomes' | 'watershed' | 'volcanism' | 'seasons'
  | 'lakes' | 'rivers' | 'regions' | 'naming' | 'packing';

export interface PipelineCacheOptions {
  maxPhaseEntries?: number;  // default 8 per phase
  maxTotalEntries?: number;  // default 64
  enableStats?: boolean;     // default true
}

export class PipelineCache {
  constructor(options?: PipelineCacheOptions);

  getPhaseResult<T>(seed: number, w: number, h: number, phase: PipelinePhase, paramsHash?: string): T | undefined;
  putPhaseResult<T>(seed: number, w: number, h: number, phase: PipelinePhase, result: T, paramsHash?: string): void;

  getMapResult(seed: number, w: number, h: number, paramsHash: string):
    { mapData: MapData; checkpoints: Record<string, unknown> } | undefined;
  putMapResult(seed: number, w: number, h: number, paramsHash: string,
    result: { mapData: MapData; checkpoints: Record<string, unknown> }): void;

  invalidateDownstream(seed: number, w: number, h: number, fromPhase: PipelinePhase): void;
  invalidate(seed: number, w: number, h: number): void;
  clear(): void;

  getStats(): CacheStats & { phaseBreakdown: Record<PipelinePhase, { hits: number; misses: number }> };
}
```

**Phase dependency order** (for downstream invalidation):
```
tectonic → elevation → erosion → coastline → currents → climate → ice
        → biomes → watershed → volcanism → seasons → lakes → rivers
        → regions → naming → packing
```

### TerrainCache

保持现有API向后兼容；内部可委托给新 `PipelineCache` 或继续独立实现（保持简单即可）。

### NoiseEngine Refactor

File: `packages/core/src/noise.ts`

- Replace ad-hoc `worleyCache: Map` + `cacheInsertOrder: string[]` FIFO with `LRUCache<string, {x:number;y:number}[]>`
- `WORLEY_CACHE_MAX` kept at 10000
- `clearCache()` delegates to `this.worleyCache.clear()`
- Public API unchanged

### memoize Enhancement

Add optional `keySerializer` argument and expose stats:

```typescript
export function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  options?: CacheOptions & { keySerializer?: (args: Args) => string }
): ((...args: Args) => R) & { cache: LRUCache<string, R>; getStats(): CacheStats };
```

### generateMap Integration

File: `packages/core/src/index.ts`

New signature (fully backward compatible):

```typescript
export function generateMap(
  params: MapParams,
  onProgress?: ProgressCallback,
  cache?: PipelineCache
): { mapData: MapData; checkpoints: Record<string, unknown> };
```

Behavior:
1. Compute `seed = hashSeed(params.seedStr)`, resolve `{width, height}`, compute `paramsHash = hashParams(relevantParams(params))`
2. If `cache` provided:
   - Check full map result → hit: return immediately, fire progress as cached (synthetic 100%)
   - Check each phase result before running that stage → hit: skip computation, restore state, progress jumps forward
   - After each stage completes, store result in cache
3. If `cache` not provided: execute exactly as today (zero allocation overhead)

**Relevant params filter**: exclude UI-only fields. The filter logic is a local helper `extractCacheableParams(params)` that picks only generation-affecting fields.

### Backward Compatibility

- All new parameters are optional
- When `cache` is undefined, no cache objects are instantiated; code path identical to current
- NoiseEngine refactor preserves public API
- Existing tests must pass without modification

## Web Layer Design

### Worker L1 Cache

File: `packages/web/src/core/mapGenWorker.ts`

- Module-level singleton: `const pipelineCache = new PipelineCache()`
- `generate()` passes cache to core's `generateMap`
- Expose new worker message handlers:
  - `{ type: 'clearCache' }` → `pipelineCache.clear()` + clear L2
  - `{ type: 'getCacheStats' }` → returns combined L1+L2 stats
- On `cancel()`: do NOT clear cache; partial phase results are reusable for future calls

### Persistent L2 Cache (IndexedDB)

New file: `packages/web/src/core/persistentCache.ts`

```typescript
export interface SerializedGenerationResult {
  mapData: import('@mapgen/shared-types').SerializedMapData;
  checkpoints: Record<string, unknown>;
  timestamp: number;
  paramsHash: string;
  seed: number;
  width: number;
  height: number;
}

export class PersistentCache {
  constructor(dbName?: string, storeName?: string, maxEntries?: number, maxBytes?: number);
  get(key: string): Promise<SerializedGenerationResult | null>;
  put(key: string, result: SerializedGenerationResult): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<{ count: number; totalBytes: number }>;
}
```

- DB: `mapgen-cache`, store: `results`, version 1
- Key format: `v1:{paramsHash}:{seed}:{w}:{h}`
- On `put`: after write, evict oldest entries until `count <= maxEntries(20)` AND `totalBytes <= maxBytes(128MB)`
- Size estimation: `result.mapData` JSON string approx length (Float32Arrays base64)
- Worker flow:
  1. Compute key
  2. Check L1 (PipelineCache) → hit: return
  3. Check L2 (IndexedDB) → hit: deserialize, populate L1, return
  4. Generate via core
  5. Put L1 → put L2 (async, fire-and-forget, catch errors silently)

### Editor Smart Invalidation

File: `packages/core/src/editor.ts` (cache integration hook) + `packages/web/src/editor/EditorController.ts`

- PipelineCache is owned by the worker; editor needs a way to signal invalidation
- Add a `cacheInvalidation` callback to editor operation options, or:
- Expose an `invalidateCache(phase: PipelinePhase)` method through the worker message protocol
- EditorController calls this after applying edits:
  - Elevation brushes (applyBrushStroke/applySmoothBrush/applyNoiseBrush/applySetElevationBrush): invalidate from `'elevation'`
  - River/lake drawing (applyRiverDraw/applyLakeDraw): invalidate from `'rivers'`
  - Plate operations (movePlate/recomputePlateGeometry): invalidate from `'tectonic'`

### Debug Panel Integration

File: `packages/web/src/ui/debugPanel.ts`

Add a "Cache" section showing:
- L1: hits/misses/hitRate/entries
- L2: hits/misses/hitRate/entries/estimated bytes
- Buttons: [Clear L1] [Clear L2] [Clear All]
- When a generation completes fully from cache, show "⚡ served from cache" badge in timeline

## Server Layer Design

### Result Cache

Files:
- `packages/server/src/services/mapEngine.ts`
- `packages/server/src/services/jobQueue.ts`
- New: `packages/server/src/services/cache.ts` (optional extraction)

- New module-level LRU: `const resultCache = new LRUCache<string, SerializedJobResult>({ maxSize: 32 })`
- In job execution (or at generate route level):
  1. Compute key from params (same key algorithm as web)
  2. Check cache → hit: set job result immediately, complete
  3. Check in-flight map → exists: await that promise
  4. Otherwise: add to in-flight map, execute generation, put to cache, remove from in-flight

### In-Flight Deduplication

```typescript
const inFlight = new Map<string, Promise<SerializedJobResult>>();
```

- Identical concurrent requests share the same promise
- Failed jobs reject all waiters and remove from in-flight (no caching of errors)

### Cache Management API

New routes:
- `GET /api/cache/stats` → `{ l3: { hits, misses, size, maxSize }, inFlight: number }`
- `DELETE /api/cache` → clear cache, return `{ cleared: number }`

## Key Format

```
Map result:     v1:{paramsHash}:{seed}:{w}:{h}
Phase result:   v1:{paramsHash}:{seed}:{w}:{h}:{phase}
Worley cell:    {cx},{cy} (per-NoiseEngine, not namespaced further)
```

Version prefix `v1:` allows future cache format changes without invalidating incorrectly.

## Invalidation Rules

| Trigger | Invalidates | Method |
|---------|-------------|--------|
| New params/new seed/new size | Nothing (different key, auto miss) | — |
| Elevation/smooth/noise/set brush | elevation + all downstream | `invalidateDownstream(seed,w,h,'elevation')` |
| River/lake draw | rivers + packing | `invalidateDownstream(seed,w,h,'rivers')` |
| Plate move/recompute | tectonic + all downstream | `invalidateDownstream(seed,w,h,'tectonic')` |
| User clicks Clear All | Everything | `cache.clear()` + L2 clear |
| LRU capacity reached | Least recently used entry | Automatic eviction |
| Server restart | L3 cache | N/A (in-memory) |
| Browser hard reload + clear site data | L2 cache | N/A (IndexedDB cleared by browser) |

## Testing Strategy

### Core

- Extend `packages/core/src/__tests__/cache.test.ts`:
  - `LRUCache.computeIfAbsent` computes once on miss, returns cached on hit
  - `LRUCache.getStats`/`resetStats` accuracy
  - `PipelineCache` get/put phase results
  - `PipelineCache.invalidateDownstream` invalidates correct phases, preserves upstream
  - `PipelineCache.invalidate` clears all for seed+size
  - `hashParams` deterministic, order-independent, float precision
  - `memoize` exposes cache and stats
- Add `packages/core/src/__tests__/pipelineCache.test.ts` (or extend cache test):
  - End-to-end: call `generateMap` twice with same params + cache; second call returns same result
  - Phase reuse: modify param that only affects climate; tectonic/elevation reused
- Noise tests: verify Worley LRU cache produces identical results to previous FIFO (add noise cache hit test)

### Web

- PersistentCache test with fake IndexedDB (or using existing test infra)
  - get/put/delete/clear
  - LRU eviction by count and byte size
- Worker message protocol tests for clearCache/getCacheStats/invalidateCache

### Server

- Mock generateMap and verify second identical request hits cache (first call count = 1)
- Concurrent identical requests: generateMap called once
- GET/DELETE /api/cache/stats endpoints

### Existing Tests

All existing tests must continue to pass without modification. In particular:
- `cache.test.ts` existing LRUCache/TerrainCache/memoize tests
- All pipeline/stage tests
- All web/server tests

## Implementation Phases

1. **Phase 1 — Core cache primitives**
   - Enhance LRUCache (computeIfAbsent, stats)
   - Add hashParams, PipelineCache
   - Enhance memoize
   - Refactor NoiseEngine Worley cache to use LRUCache
   - Tests for all of the above

2. **Phase 2 — Core pipeline integration**
   - Add cache parameter to generateMap
   - Integrate per-phase cache checks and writes
   - Add extractCacheableParams helper
   - Full-map result cache shortcut
   - Tests for cache-aware generateMap

3. **Phase 3 — Web worker + L2 persistent cache**
   - Worker holds PipelineCache singleton
   - Implement PersistentCache (IndexedDB)
   - Worker message protocol for clear/stats/invalidate
   - L1→L2 flow (check L1→L2→generate→populate both)

4. **Phase 4 — Editor invalidation + Debug Panel**
   - EditorController calls invalidateCache after edits
   - Debug Panel cache section with stats and buttons
   - "Served from cache" badge in progress UI

5. **Phase 5 — Server cache + dedup**
   - Server-side LRU result cache
   - In-flight request dedup
   - /api/cache/stats and DELETE /api/cache routes
   - Server tests

## Rollout & Risk

- All cache code paths are opt-in (callers must pass a PipelineCache instance); no behavior change for uninstrumented callers
- Persistent L2 cache gracefully degrades if IndexedDB is unavailable (falls back to L1 only; already pattern in checkpoint.ts)
- Cache keys versioned (`v1:`) to avoid stale data across code updates
- Memory: L1 PipelineCache bounded (64 entries); LRU eviction prevents unbounded growth
- Worst case: if a bug returns stale cached data, users can click "Clear All Cache" in debug panel
