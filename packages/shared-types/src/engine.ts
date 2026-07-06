import type { Result } from './errors.js';
import type { MapParams } from './params.js';
import type { SerializedMapData } from './map.js';

export interface GenerationProgress {
  jobId: string;
  phase: string;
  fraction: number;
  phaseLabel: string;
}

export interface GenerationResult {
  jobId: string;
  mapData: SerializedMapData;
  checkpoints?: Record<string, unknown>;
}

export interface MapMeta {
  name?: string;
  tags?: string[];
}

export interface SavedMapRef {
  id: string;
  createdAt: number;
}

export interface SavedMapSummary {
  id: string;
  name: string;
  seed: string;
  width: number;
  height: number;
  createdAt: number;
  tags: string[];
  thumbnail?: string;
}

export interface MapFilter {
  limit?: number;
  offset?: number;
  search?: string;
  tags?: string[];
}

export interface EngineCapabilities {
  maxResolution: number;
  supportsPersistence: boolean;
  supportsAbort: boolean;
  features: string[];
}

export interface MapGenEngine {
  generate(
    params: MapParams,
    onProgress?: (progress: GenerationProgress) => void,
    signal?: AbortSignal
  ): Promise<Result<GenerationResult>>;

  saveMap(map: SerializedMapData, meta?: MapMeta): Promise<Result<SavedMapRef>>;
  loadMap(id: string): Promise<Result<SerializedMapData | null>>;
  listMaps(filter?: MapFilter): Promise<Result<SavedMapSummary[]>>;
  deleteMap(id: string): Promise<Result<void>>;
  getCapabilities(): EngineCapabilities;
  dispose(): void;
}
