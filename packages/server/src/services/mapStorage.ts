import type {
  SerializedMapData,
  SavedMapSummary,
  MapMeta,
  SavedMapRef,
  MapFilter,
} from '@mapgen/shared-types';
import { encodeMapData, decodeMapData } from '../utils/serialization.js';
import { randomUUID } from 'node:crypto';
import type { InMemoryDatabase, MapRecord } from '../db/index.js';

export class MapStorage {
  constructor(private db: InMemoryDatabase) {}

  save(map: SerializedMapData, meta?: MapMeta): SavedMapRef {
    const id = randomUUID();
    const now = Date.now();
    const record: MapRecord = {
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
    };
    this.db.maps.set(id, record);
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

    let rows = Array.from(this.db.maps.values());

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter(r => {
        const name = (r.name || '').toLowerCase();
        const seed = r.seed.toLowerCase();
        return name.includes(q) || seed.includes(q);
      });
    }

    if (filter?.tags && filter.tags.length > 0) {
      const filterTags = filter.tags;
      rows = rows.filter(r => {
        const tags = JSON.parse(r.tags || '[]') as string[];
        return filterTags.every(t => tags.includes(t));
      });
    }

    const total = rows.length;
    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt).slice(offset, offset + limit);

    return {
      maps: sorted.map(r => this.toSummary(r)),
      total,
    };
  }

  delete(id: string): boolean {
    return this.db.maps.delete(id);
  }

  private toSummary(r: MapRecord): SavedMapSummary {
    return {
      id: r.id,
      name: r.name || '未命名地图',
      seed: r.seed,
      width: r.width,
      height: r.height,
      createdAt: r.createdAt,
      tags: JSON.parse(r.tags || '[]') as string[],
    };
  }
}
