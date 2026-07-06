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
  MapFilter,
  EngineCapabilities,
  MapGenError,
} from '@mapgen/shared-types';
import { ok, err } from '@mapgen/shared-types';
import type { GenerateResponse, ListMapsResponse } from '@mapgen/shared-types';

export interface RemoteProviderOptions {
  baseUrl: string;
  fallback?: boolean;
}

export class RemoteProvider implements MapGenEngine {
  private baseUrl: string;
  private fallback: boolean;
  private capabilities: EngineCapabilities | null = null;

  constructor(options: RemoteProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fallback = options.fallback ?? true;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<Result<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: MapGenError };
        return err(body.error ?? { code: 'NETWORK_ERROR', message: `HTTP ${res.status}` });
      }
      return ok((await res.json()) as T);
    } catch (e) {
      return err({ code: 'NETWORK_ERROR', message: String(e) });
    }
  }

  async generate(
    params: MapParams,
    onProgress?: (progress: GenerationProgress) => void,
    signal?: AbortSignal
  ): Promise<Result<GenerationResult>> {
    const createRes = await this.fetchJson<GenerateResponse>('/api/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
      signal,
    });
    if (!createRes.ok) return createRes;

    const { jobId } = createRes.value;
    return new Promise(resolve => {
      const es = new EventSource(`${this.baseUrl}/api/v1/jobs/${jobId}`);
      if (signal) {
        signal.addEventListener('abort', () => {
          es.close();
          resolve(err({ code: 'TIMEOUT', message: 'Generation aborted' }));
        });
      }

      es.addEventListener('progress', event => {
        const data = JSON.parse(event.data as string) as GenerationProgress;
        if (onProgress) onProgress(data);
      });

      es.addEventListener('completed', event => {
        es.close();
        const data = JSON.parse(event.data as string) as {
          jobId: string;
          result: GenerationResult;
        };
        resolve(ok(data.result));
      });

      es.addEventListener('failed', event => {
        es.close();
        const data = JSON.parse(event.data as string) as { jobId: string; error: MapGenError };
        resolve(err(data.error));
      });

      es.addEventListener('error', () => {
        es.close();
        resolve(err({ code: 'NETWORK_ERROR', message: 'SSE connection failed' }));
      });
    });
  }

  async saveMap(map: SerializedMapData, meta?: MapMeta): Promise<Result<SavedMapRef>> {
    return this.fetchJson<SavedMapRef>('/api/v1/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map, meta }),
    });
  }

  async loadMap(id: string): Promise<Result<SerializedMapData | null>> {
    return this.fetchJson<SerializedMapData>(`/api/v1/maps/${id}`);
  }

  async listMaps(filter?: MapFilter): Promise<Result<SavedMapSummary[]>> {
    const query = new URLSearchParams();
    if (filter?.limit) query.set('limit', String(filter.limit));
    if (filter?.offset) query.set('offset', String(filter.offset));
    if (filter?.search) query.set('search', filter.search);
    if (filter?.tags) filter.tags.forEach(t => query.append('tags', t));
    const res = await this.fetchJson<ListMapsResponse>(`/api/v1/maps?${query.toString()}`);
    if (!res.ok) return res;
    return ok(res.value.maps);
  }

  async deleteMap(id: string): Promise<Result<void>> {
    const res = await fetch(`${this.baseUrl}/api/v1/maps/${id}`, { method: 'DELETE' });
    if (!res.ok) return err({ code: 'MAP_NOT_FOUND', message: `Delete failed: ${res.status}` });
    return ok(undefined);
  }

  getCapabilities(): EngineCapabilities {
    if (this.capabilities) return this.capabilities;
    return { maxResolution: 0, supportsPersistence: false, supportsAbort: false, features: [] };
  }

  dispose(): void {
    // no-op
  }
}
