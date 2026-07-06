import type {
  SerializedMapData,
  SavedMapSummary,
  MapMeta,
  SavedMapRef,
  MapFilter,
} from '@mapgen/shared-types';
import { encodeMapData, decodeMapData } from '../utils/serialization.js';
import { randomUUID } from 'node:crypto';
import type { InMemoryDatabase } from '../db/index.js';

export class MapStorage {
  constructor(private db: InMemoryDatabase) {}

  save(map: SerializedMapData, meta?: MapMeta): SavedMapRef {
    const id = randomUUID();
    const now = Date.now();
    this.db.maps.set(id, {
      id,
      name: meta?.name || null,
      seed: map.seed.toString(),
      params: JSON.stringify({}),
      mapData: encodeMapData(map),
      width: map.width,
      height: map.height,
      createdAt: now,
      updatedAt: now,
      tags: JSON.stringify(meta?.tags || []),
    });
    return { id, createdAt: now };
  }

  load(id: string): SerializedMapData | null {
    const row = this.db.maps.get(id);
    if (!row) return null;
    return decodeMapData(row.mapData);
  }

  list(filter?: MapFilter): { maps: SavedMapSummary[]; total: number } {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const all = Array.from(this.db.maps.values());
    const total = all.length;
    const rows = all.sort((a, b) => b.createdAt - a.createdAt).slice(offset, offset + limit);

    return {
      maps: rows.map(r => ({
        id: r.id,
        name: r.name || '未命名地图',
        seed: r.seed,
        width: r.width,
        height: r.height,
        createdAt: r.createdAt,
        tags: JSON.parse(r.tags || '[]') as string[],
      })),
      total,
    };
  }

  delete(id: string): boolean {
    return this.db.maps.delete(id);
  }
}
