// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mapGenWorker
vi.mock('../core/mapGenWorker.js', () => ({
  mapGenWorker: {
    generate: vi.fn(),
  },
}));

// Mock shared-types serialization
vi.mock('@mapgen/shared-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mapgen/shared-types')>();
  return {
    ...actual,
    ok: <T>(value: T) => ({ ok: true, value }),
    err: (error: unknown) => ({ ok: false, error }),
    serializeMapData: vi.fn((data: unknown) => data),
  };
});

import { LocalProvider } from '../engine/local.js';

describe('LocalProvider', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalProvider();
  });

  describe('saveMap / loadMap / listMaps / deleteMap', () => {
    const mockMap = {
      width: 64,
      height: 64,
      seed: 12345,
      plateTex: new Float32Array(64 * 64 * 4),
      elevTex: new Float32Array(64 * 64 * 4),
      moistTex: new Float32Array(64 * 64 * 4),
      riverTex: new Float32Array(64 * 64 * 4),
      tempTex: new Float32Array(64 * 64 * 4),
      plates: [],
      regions: [],
      rivers: [],
      names: { plates: [], regions: [] },
    } as unknown as import('@mapgen/shared-types').SerializedMapData;

    it('saves and loads a map', async () => {
      const saveResult = await provider.saveMap(mockMap, { name: 'Test Map' });
      expect(saveResult.ok).toBe(true);
      if (!saveResult.ok) return;

      const loadResult = await provider.loadMap(saveResult.value.id);
      expect(loadResult.ok).toBe(true);
    });

    it('lists saved maps', async () => {
      await provider.saveMap(mockMap, { name: 'Map 1' });
      await provider.saveMap(mockMap, { name: 'Map 2' });

      const listResult = await provider.listMaps();
      expect(listResult.ok).toBe(true);
      if (!listResult.ok) return;
      expect(listResult.value.length).toBe(2);
    });

    it('deletes a map', async () => {
      const saveResult = await provider.saveMap(mockMap, { name: 'Delete Me' });
      expect(saveResult.ok).toBe(true);
      if (!saveResult.ok) return;

      const deleteResult = await provider.deleteMap(saveResult.value.id);
      expect(deleteResult.ok).toBe(true);

      const loadResult = await provider.loadMap(saveResult.value.id);
      expect(loadResult.ok).toBe(true);
      if (!loadResult.ok) return;
      expect(loadResult.value).toBeNull();
    });

    it('returns null for non-existent map', async () => {
      const result = await provider.loadMap('nonexistent-id');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });
  });

  describe('getCapabilities', () => {
    it('returns local capabilities', () => {
      const caps = provider.getCapabilities();
      expect(caps.maxResolution).toBe(4096);
      expect(caps.supportsPersistence).toBe(true);
      expect(caps.supportsAbort).toBe(true);
    });
  });

  describe('dispose', () => {
    it('does not throw', () => {
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
