import type { MapGenEngine } from '@mapgen/shared-types';
import { LocalProvider } from './local.js';
import { RemoteProvider } from './remote.js';
import { ENGINE_CONFIG_KEY, type EngineConfig } from './provider.js';

let cachedProvider: MapGenEngine | null = null;

export function readEngineConfig(): EngineConfig {
  if (typeof window === 'undefined') return { mode: 'local' };
  const params = new URLSearchParams(window.location.search);
  const backend = params.get('backend');
  if (backend && backend !== 'local') {
    return { mode: 'remote', remoteUrl: backend, fallback: true };
  }
  const stored = localStorage.getItem(ENGINE_CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as EngineConfig;
    } catch {
      // fall through
    }
  }
  return { mode: 'local' };
}

export function writeEngineConfig(config: EngineConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENGINE_CONFIG_KEY, JSON.stringify(config));
}

export function createEngineProvider(config?: EngineConfig): MapGenEngine {
  const cfg = config ?? readEngineConfig();
  if (cfg.mode === 'remote' && cfg.remoteUrl) {
    return new RemoteProvider({ baseUrl: cfg.remoteUrl, fallback: cfg.fallback });
  }
  return new LocalProvider();
}

export function getEngineProvider(): MapGenEngine {
  if (!cachedProvider) {
    cachedProvider = createEngineProvider();
  }
  return cachedProvider;
}

export function setEngineProvider(provider: MapGenEngine): void {
  if (cachedProvider && cachedProvider !== provider) {
    cachedProvider.dispose();
  }
  cachedProvider = provider;
}

export function resetEngineProvider(): void {
  if (cachedProvider) {
    cachedProvider.dispose();
    cachedProvider = null;
  }
}
