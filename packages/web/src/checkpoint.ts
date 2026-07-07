import type { MapData, Plate, River } from '@mapgen/core';
import type { UIParams } from './core/appState.js';
import { logger } from './core/logger.js';

const STORAGE_KEY = 'mapgen-checkpoints';
const LEGACY_STORAGE_KEY = 'mapgen-checkpoints-legacy';
const CHECKPOINT_VERSION = 2;
const MAX_CHECKPOINTS = 10;
const DB_NAME = 'mapgen-checkpoints-db';
const DB_STORE = 'checkpoints';
const DB_VERSION = 1;

export interface PackedArray {
  width: number;
  height: number;
  base64: string;
}

export interface CheckpointData {
  version: number;
  name: string;
  phase: string;
  time: number;
  seed: string;
  mapWidth: number;
  mapHeight: number;
  thumbnail?: string;
  data: {
    params: Record<string, unknown>;
    tectonic?: {
      plates: unknown[];
      plateId?: PackedArray;
      plateDist?: PackedArray;
      boundary?: PackedArray;
    };
    elevation?: {
      elevation?: PackedArray;
      slope?: PackedArray;
      ridge?: PackedArray;
      ridgeMask?: PackedArray;
    };
    erosion?: {
      elevation?: PackedArray;
    };
    climate?: {
      temperature?: PackedArray;
      tempZone?: PackedArray;
      moisture?: PackedArray;
      rainfall?: PackedArray;
    };
    rivers?: {
      rivers: unknown[];
      riverMask?: PackedArray;
      riverWidth?: PackedArray;
      riverDepth?: PackedArray;
      lakes?: PackedArray;
    };
    packed?: {
      plateTex: PackedArray;
      elevTex: PackedArray;
      moistTex: PackedArray;
      riverTex: PackedArray;
      tempTex: PackedArray;
      currentTex?: PackedArray;
      iceTex?: PackedArray;
      coastDist?: PackedArray;
    };
  };
}

function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer);
  const len = bytes.byteLength;
  // Batch approach: process in chunks to avoid call stack overflow
  const chunkSize = 0x8000; // 32768
  let binary = '';
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    binary += String.fromCharCode.apply(null, bytes.subarray(i, end) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

function packFloat(data: Float32Array | null, w: number, h: number): PackedArray | null {
  if (!data || !w || !h) return null;
  return { width: w, height: h, base64: float32ToBase64(data) };
}

function unpackFloat(p: PackedArray | null | undefined): Float32Array | null {
  if (!p) return null;
  return base64ToFloat32(p.base64);
}

function generateThumbnail(mapData: MapData): string {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const { width, height, elevTex, moistTex } = mapData;
  const seaLevel = 0.45;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * width);
      const sy = Math.floor((y / size) * height);
      const i = (sy * width + sx) * 4;
      const h = elevTex[i];
      const moisture = moistTex[i];
      const temperature = moistTex[i + 2];
      const idx = (y * size + x) * 4;
      let r = 0, g = 0, b = 0;
      if (h <= seaLevel) {
        const depth = (seaLevel - h) / (seaLevel + 0.5);
        const shallow = 1 - Math.min(1, depth * 3);
        r = 20 + shallow * 40;
        g = 60 + shallow * 80;
        b = 120 + shallow * 60 + depth * 40;
      } else {
        const slope = elevTex[i + 1];
        const sl = Math.min(1, slope * 3);
        const shade = 1 - sl * 0.3;
        if (temperature < 0.25 && h > 0.6) {
          r = 230 * shade; g = 235 * shade; b = 245 * shade;
        } else if (h > 0.7) {
          r = 130 * shade; g = 120 * shade; b = 110 * shade;
        } else if (moisture < 0.15 && temperature > 0.4) {
          r = 200 * shade; g = 175 * shade; b = 110 * shade;
        } else if (moisture > 0.55) {
          r = 40 * shade; g = 100 * shade; b = 40 * shade;
        } else if (moisture > 0.3) {
          r = 110 * shade; g = 150 * shade; b = 50 * shade;
        } else {
          r = 140 * shade; g = 130 * shade; b = 70 * shade;
        }
      }
      img.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      img.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      img.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
  });
}

async function readCheckpoints(): Promise<CheckpointData[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(STORAGE_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const value: unknown = req.result;
        db.close();
        if (Array.isArray(value)) {
          resolve(value.filter(c => (c as CheckpointData).version === CHECKPOINT_VERSION));
        } else {
          resolve([]);
        }
      };
    });
  } catch (e) {
    logger.warn('IndexedDB read failed, falling back to localStorage:', e);
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CheckpointData[];
      return parsed.filter(c => c.version === CHECKPOINT_VERSION);
    }
    return [];
  }
}

async function writeCheckpoints(checkpoints: CheckpointData[]): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.put(checkpoints, STORAGE_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (e) {
    logger.warn('IndexedDB write failed, falling back to localStorage:', e);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(checkpoints));
  }
}

export class CheckpointManager {
  checkpoints: CheckpointData[] = [];
  private _loaded = false;

  async load(): Promise<CheckpointData[]> {
    try {
      this.checkpoints = await readCheckpoints();
      this._loaded = true;
      return this.checkpoints;
    } catch (e) {
      logger.warn('Checkpoint load failed:', e);
      this.checkpoints = [];
      return [];
    }
  }

  async save(
    name: string,
    phase: string,
    mapData: MapData,
    params: UIParams
  ): Promise<CheckpointData | null> {
    const ckpt: CheckpointData = {
      version: CHECKPOINT_VERSION,
      name,
      phase,
      time: Date.now(),
      seed: params.seedStr || '',
      mapWidth: mapData.width,
      mapHeight: mapData.height,
      thumbnail: generateThumbnail(mapData),
      data: {
        params: { ...params } as unknown as Record<string, unknown>,
        packed: {
          plateTex: packFloat(mapData.plateTex, mapData.width, mapData.height) as PackedArray,
          elevTex: packFloat(mapData.elevTex, mapData.width, mapData.height) as PackedArray,
          moistTex: packFloat(mapData.moistTex, mapData.width, mapData.height) as PackedArray,
          riverTex: packFloat(mapData.riverTex, mapData.width, mapData.height) as PackedArray,
          tempTex: packFloat(mapData.tempTex, mapData.width, mapData.height) as PackedArray,
          currentTex:
            packFloat(mapData.currentTex ?? null, mapData.width, mapData.height) ?? undefined,
          iceTex: packFloat(mapData.iceTex ?? null, mapData.width, mapData.height) ?? undefined,
          coastDist:
            packFloat(mapData.coastDist ?? null, mapData.width, mapData.height) ?? undefined,
        },
        tectonic: {
          plates: mapData.plates as unknown[],
        },
        rivers: {
          rivers: mapData.rivers as unknown[],
        },
      },
    };

    try {
      this.checkpoints.push(ckpt);
      if (this.checkpoints.length > MAX_CHECKPOINTS) {
        this.checkpoints.shift();
      }
      await writeCheckpoints(this.checkpoints);
      return ckpt;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('Checkpoint save failed:', msg, e);
      return null;
    }
  }

  restore(id: number): Promise<CheckpointData | null> {
    try {
      return Promise.resolve(this.checkpoints[id] || null);
    } catch (e) {
      logger.warn('Checkpoint restore failed:', e);
      return Promise.resolve(null);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      this.checkpoints.splice(id, 1);
      await writeCheckpoints(this.checkpoints);
    } catch (e) {
      logger.warn('Checkpoint delete failed:', e);
    }
  }

  async rename(id: number, name: string): Promise<void> {
    const ckpt = this.checkpoints[id];
    if (!ckpt) return;
    ckpt.name = name;
    await writeCheckpoints(this.checkpoints);
  }

  restoreMapData(ckpt: CheckpointData): MapData | null {
    try {
      const { mapWidth: width, mapHeight: height, data } = ckpt;
      const packed = data.packed;
      if (!packed) return null;
      return {
        width,
        height,
        plateTex: unpackFloat(packed.plateTex) ?? new Float32Array(width * height * 4),
        elevTex: unpackFloat(packed.elevTex) ?? new Float32Array(width * height * 4),
        moistTex: unpackFloat(packed.moistTex) ?? new Float32Array(width * height * 4),
        riverTex: unpackFloat(packed.riverTex) ?? new Float32Array(width * height * 4),
        tempTex: unpackFloat(packed.tempTex) ?? new Float32Array(width * height * 4),
        currentTex: unpackFloat(packed.currentTex) ?? undefined,
        iceTex: unpackFloat(packed.iceTex) ?? undefined,
        coastDist: unpackFloat(packed.coastDist) ?? undefined,
        plates: (data.tectonic?.plates as Plate[]) ?? [],
        regions: [],
        rivers: (data.rivers?.rivers as River[]) ?? [],
        names: { plates: [], regions: [] },
        seed: 0,
      };
    } catch (e) {
      logger.warn('restoreMapData failed:', e);
      return null;
    }
  }
}
