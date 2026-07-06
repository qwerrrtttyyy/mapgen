import { describe, it, expect } from 'vitest';
import { serializeMapData, deserializeMapData } from '../serialization.js';
import type { MapData } from '../map.js';

function createSampleMapData(): MapData {
  return {
    width: 4,
    height: 4,
    seed: 12345,
    plates: [{ id: 0, type: 'ocean', centroid: [2, 2], drift: [0, 0] }],
    regions: [],
    rivers: [],
    names: { plates: [], regions: [], volcanoes: [] },
    plateTex: new Float32Array(4 * 4 * 4).fill(0.1),
    elevTex: new Float32Array(4 * 4 * 4).fill(0.2),
    moistTex: new Float32Array(4 * 4 * 4).fill(0.3),
    riverTex: new Float32Array(4 * 4 * 4).fill(0.4),
    tempTex: new Float32Array(4 * 4 * 4).fill(0.5),
    volcanoSites: [],
    hotspots: [],
  };
}

describe('serialization', () => {
  it('round-trips MapData correctly', () => {
    const original = createSampleMapData();
    const serialized = serializeMapData(original);
    const restored = deserializeMapData(serialized);

    expect(restored.width).toBe(original.width);
    expect(restored.height).toBe(original.height);
    expect(restored.seed).toBe(original.seed);
    expect(restored.plateTex.length).toBe(original.plateTex.length);
    expect(restored.elevTex[0]).toBeCloseTo(original.elevTex[0]);
  });
});
