import { describe, it, expect } from 'vitest';
import { serializeMapData, deserializeMapData } from '../serialization.js';
import type { MapData } from '../map.js';

function createSampleMapData(): MapData {
  return {
    width: 4,
    height: 4,
    seed: 12345,
    plates: [{
      id: 0,
      x: 0.5,
      y: 0.5,
      vx: 0,
      vy: 0,
      type: 'ocean',
      color: [0, 0, 1],
      area: 16,
      boundary: 0,
      growth: 0,
      elevation: -0.3,
      moisture: 0.7,
      temperature: 0.5,
      name: 'Test Plate',
      selected: false,
    }],
    regions: [],
    rivers: [],
    names: { plates: [], regions: [] },
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
