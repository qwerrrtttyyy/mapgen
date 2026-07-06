import type {
  MapGenEngine,
  MapParams,
  GenerationResult,
  GenerationProgress,
  Result,
  SavedMapRef,
  SavedMapSummary,
  SerializedMapData,
  MapMeta,
  EngineCapabilities,
} from '@mapgen/shared-types';
import { ok, err, serializeMapData } from '@mapgen/shared-types';
import { mapGenWorker } from '../core/mapGenWorker.js';

export class LocalProvider implements MapGenEngine {
  async generate(
    params: MapParams,
    onProgress?: (progress: GenerationProgress) => void,
    signal?: AbortSignal
  ): Promise<Result<GenerationResult>> {
    const jobId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const { mapData, checkpoints } = await mapGenWorker.generate(
        params as unknown as import('@mapgen/core').MapParams,
        (fraction: number, phase: string) => {
          if (onProgress) {
            onProgress({ jobId, phase, fraction, phaseLabel: phase });
          }
        }
      );
      if (signal?.aborted) {
        return err({ code: 'TIMEOUT', message: 'Generation aborted' });
      }
      const result: GenerationResult = {
        jobId,
        mapData: serializeMapData(mapData),
        checkpoints,
      };
      return ok(result);
    } catch (e) {
      return err({ code: 'GENERATION_FAILED', message: String(e) });
    }
  }

  async saveMap(map: SerializedMapData, meta?: MapMeta): Promise<Result<SavedMapRef>> {
    const id = `local-map-${Date.now()}`;
    try {
      const payload = JSON.stringify({ map, meta, savedAt: Date.now() });
      localStorage.setItem(`mapgen.map.${id}`, payload);
      return ok({ id, createdAt: Date.now() });
    } catch (e) {
      return err({ code: 'STORAGE_ERROR', message: String(e) });
    }
  }

  async loadMap(id: string): Promise<Result<SerializedMapData | null>> {
    try {
      const raw = localStorage.getItem(`mapgen.map.${id}`);
      if (!raw) return ok(null);
      const parsed = JSON.parse(raw);
      return ok(parsed.map as SerializedMapData);
    } catch (e) {
      return err({ code: 'STORAGE_ERROR', message: String(e) });
    }
  }

  async listMaps(): Promise<Result<SavedMapSummary[]>> {
    try {
      const summaries: SavedMapSummary[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('mapgen.map.')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          summaries.push({
            id: key.replace('mapgen.map.', ''),
            name: parsed.meta?.name || '未命名地图',
            seed: parsed.map.seed.toString(),
            width: parsed.map.width,
            height: parsed.map.height,
            createdAt: parsed.savedAt || Date.now(),
            tags: parsed.meta?.tags || [],
          });
        }
      }
      return ok(summaries);
    } catch (e) {
      return err({ code: 'STORAGE_ERROR', message: String(e) });
    }
  }

  async deleteMap(id: string): Promise<Result<void>> {
    try {
      localStorage.removeItem(`mapgen.map.${id}`);
      return ok(undefined);
    } catch (e) {
      return err({ code: 'STORAGE_ERROR', message: String(e) });
    }
  }

  getCapabilities(): EngineCapabilities {
    return {
      maxResolution: 0,
      supportsPersistence: true,
      supportsAbort: true,
      features: [
        'oceanCurrents',
        'iceSheet',
        'monsoon',
        'continentality',
        'hadley',
        'advancedBiomes',
        'watershed',
        'volcanism',
        'seasons',
      ],
    };
  }

  dispose(): void {
    mapGenWorker.cancel();
  }
}
