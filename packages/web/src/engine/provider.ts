import type { MapGenEngine } from '@mapgen/shared-types';

export type { MapGenEngine };
export const ENGINE_CONFIG_KEY = 'mapgen.engine.config';

export interface EngineConfig {
  mode: 'local' | 'remote';
  remoteUrl?: string;
  fallback?: boolean;
}
