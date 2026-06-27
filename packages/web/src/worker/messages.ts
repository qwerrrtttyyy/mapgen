import type { MapParams, MapData } from '@mapgen/core';

export type WorkerRequest =
  | { type: 'generate'; params: MapParams; id: number }
  | { type: 'abort'; id: number };

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: number; phaseName: string }
  | { type: 'complete'; id: number; mapData: MapData }
  | { type: 'error'; id: number; message: string };
