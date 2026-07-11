import { describe, it, expect } from 'vitest';
import {
  serializeMapData,
  deserializeMapData,
  float32ToBase64,
  base64ToFloat32,
} from '../serialization.js';
import type { MapData } from '../map.js';

function createSampleMapData(): MapData {
  return {
    width: 4,
    height: 4,
    seed: 12345,
    plates: [
      {
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
      },
    ],
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

  it('round-trips 所有必填纹理通道', () => {
    const original = createSampleMapData();
    const restored = deserializeMapData(serializeMapData(original));

    expect(restored.plateTex.length).toBe(original.plateTex.length);
    expect(restored.elevTex.length).toBe(original.elevTex.length);
    expect(restored.moistTex.length).toBe(original.moistTex.length);
    expect(restored.riverTex.length).toBe(original.riverTex.length);
    expect(restored.tempTex.length).toBe(original.tempTex.length);

    for (let i = 0; i < original.plateTex.length; i++) {
      expect(restored.plateTex[i]).toBeCloseTo(original.plateTex[i], 5);
    }
  });

  it('round-trips 可选纹理通道', () => {
    const original = createSampleMapData();
    original.currentTex = new Float32Array(16).fill(0.6);
    original.iceTex = new Float32Array(16).fill(0.7);
    original.coastDist = new Float32Array(16).fill(0.8);
    original.biomeTex = new Float32Array(16).fill(0.9);
    original.watershedTex = new Float32Array(16).fill(0.15);
    original.volcanismTex = new Float32Array(16).fill(0.25);
    original.seasonTex = new Float32Array(16).fill(0.35);

    const restored = deserializeMapData(serializeMapData(original));

    expect(restored.currentTex).toBeDefined();
    expect(restored.iceTex).toBeDefined();
    expect(restored.coastDist).toBeDefined();
    expect(restored.biomeTex).toBeDefined();
    expect(restored.watershedTex).toBeDefined();
    expect(restored.volcanismTex).toBeDefined();
    expect(restored.seasonTex).toBeDefined();

    expect(restored.currentTex![0]).toBeCloseTo(0.6, 5);
    expect(restored.iceTex![0]).toBeCloseTo(0.7, 5);
    expect(restored.seasonTex![0]).toBeCloseTo(0.35, 5);
  });

  it('无可选纹理时 restored 对应字段为 undefined', () => {
    const restored = deserializeMapData(serializeMapData(createSampleMapData()));
    expect(restored.currentTex).toBeUndefined();
    expect(restored.iceTex).toBeUndefined();
    expect(restored.coastDist).toBeUndefined();
    expect(restored.biomeTex).toBeUndefined();
    expect(restored.watershedTex).toBeUndefined();
    expect(restored.volcanismTex).toBeUndefined();
    expect(restored.seasonTex).toBeUndefined();
  });

  it('round-trips plates/regions/rivers/names 元数据', () => {
    const original = createSampleMapData();
    original.plates[0].name = '北境大陆';
    original.plates[0].elevation = 0.85;
    original.names = {
      plates: [{ plateId: 0, type: 'continent', name: '北境大陆', centroid: [0.5, 0.5] }],
      regions: [{ key: 'r0', type: 'mountain', name: '龙脊山脉', centroid: [0.3, 0.4], area: 100 }],
    };

    const restored = deserializeMapData(serializeMapData(original));

    expect(restored.plates[0].name).toBe('北境大陆');
    expect(restored.plates[0].elevation).toBeCloseTo(0.85, 5);
    expect(restored.names.plates).toHaveLength(1);
    expect(restored.names.plates[0].name).toBe('北境大陆');
    expect(restored.names.regions).toHaveLength(1);
    expect(restored.names.regions[0].name).toBe('龙脊山脉');
  });

  it('round-trips volcanoSites/hotspots', () => {
    const original = createSampleMapData();
    original.volcanoSites = [
      { x: 0.2, y: 0.3, kind: 'hotspot', strength: 0.8, hotspotId: 5 },
      { x: 0.4, y: 0.6, kind: 'arc', strength: 0.5 },
    ];
    original.hotspots = [{ id: 5, x: 0.2, y: 0.3, strength: 0.8 }];

    const restored = deserializeMapData(serializeMapData(original));

    expect(restored.volcanoSites).toHaveLength(2);
    expect(restored.volcanoSites![0].kind).toBe('hotspot');
    expect(restored.volcanoSites![0].hotspotId).toBe(5);
    expect(restored.hotspots).toHaveLength(1);
    expect(restored.hotspots![0].id).toBe(5);
  });

  it('处理空纹理数组', () => {
    const original = createSampleMapData();
    original.plateTex = new Float32Array(0);
    original.elevTex = new Float32Array(0);
    original.moistTex = new Float32Array(0);
    original.riverTex = new Float32Array(0);
    original.tempTex = new Float32Array(0);

    const restored = deserializeMapData(serializeMapData(original));

    expect(restored.plateTex.length).toBe(0);
    expect(restored.elevTex.length).toBe(0);
  });
});

describe('float32ToBase64 / base64ToFloat32', () => {
  it('round-trips Float32Array', () => {
    const arr = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const b64 = float32ToBase64(arr);
    expect(typeof b64).toBe('string');
    const restored = base64ToFloat32(b64);
    expect(restored.length).toBe(arr.length);
    for (let i = 0; i < arr.length; i++) {
      expect(restored[i]).toBeCloseTo(arr[i], 5);
    }
  });

  it('处理极值（0, 1, 负数, Infinity, -Infinity）', () => {
    const arr = new Float32Array([0, 1, -1, Infinity, -Infinity]);
    const restored = base64ToFloat32(float32ToBase64(arr));
    expect(restored[0]).toBe(0);
    expect(restored[1]).toBe(1);
    expect(restored[2]).toBe(-1);
    expect(restored[3]).toBe(Infinity);
    expect(restored[4]).toBe(-Infinity);
  });

  it('NaN round-trip（IEEE 754 保证位级一致）', () => {
    const arr = new Float32Array([NaN]);
    const restored = base64ToFloat32(float32ToBase64(arr));
    expect(Number.isNaN(restored[0])).toBe(true);
  });

  it('空数组 round-trip', () => {
    const arr = new Float32Array(0);
    const restored = base64ToFloat32(float32ToBase64(arr));
    expect(restored.length).toBe(0);
  });

  it('大数组 round-trip（1024 元素）', () => {
    const arr = new Float32Array(1024);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.sin(i) * 0.5;
    const restored = base64ToFloat32(float32ToBase64(arr));
    expect(restored.length).toBe(1024);
    for (let i = 0; i < arr.length; i++) {
      expect(restored[i]).toBeCloseTo(arr[i], 5);
    }
  });
});
