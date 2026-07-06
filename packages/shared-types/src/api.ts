import type { MapParams } from './params.js';
import type {
  GenerationResult,
  EngineCapabilities,
  SavedMapRef,
  SavedMapSummary,
  MapMeta,
  MapFilter,
  GenerationProgress,
} from './engine.js';
import type { MapGenError } from './errors.js';
import type { SerializedMapData } from './map.js';

export interface GenerateRequest {
  params: MapParams;
}

export interface GenerateResponse {
  jobId: string;
  status: 'queued';
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobResponse {
  jobId: string;
  status: JobStatus;
  progress?: GenerationProgress;
  result?: GenerationResult;
  error?: MapGenError;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  capabilities: EngineCapabilities;
}

export interface CreateMapRequest {
  map: SerializedMapData;
  meta?: MapMeta;
}

export interface ListMapsResponse {
  maps: SavedMapSummary[];
  total: number;
}

export type {
  MapParams,
  GenerationResult,
  SavedMapRef,
  SavedMapSummary,
  MapMeta,
  MapFilter,
  EngineCapabilities,
  MapGenError,
  GenerationProgress,
  SerializedMapData,
};
