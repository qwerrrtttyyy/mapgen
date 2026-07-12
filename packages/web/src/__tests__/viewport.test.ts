// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state mock — tests can override zoom/pan values.
const mockState = { zoom: 1, panX: 0, panY: 0 };

vi.mock('../core/appState.js', () => ({
  get state() {
    return mockState;
  },
}));

import { clientToMapUv, mapUvToClient, mapPixelToClient } from '../map/viewport.js';

function makeRect(x: number, y: number, w: number, h: number): DOMRect {
  return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => '' };
}

describe('viewport coordinate transforms', () => {
  beforeEach(() => {
    mockState.zoom = 1;
    mockState.panX = 0;
    mockState.panY = 0;
  });

  describe('mapUvToClient', () => {
    it('maps (0,0) to top-left of rect at default zoom/pan', () => {
      const rect = makeRect(100, 50, 800, 600);
      const [sx, sy] = mapUvToClient(0, 0, rect, 512, 512);
      expect(sx).toBeCloseTo(rect.left, 0);
      expect(sy).toBeCloseTo(rect.top + rect.height, 0);
    });

    it('maps (1,1) to bottom-right of rect at default zoom/pan', () => {
      const rect = makeRect(100, 50, 800, 600);
      const [sx, sy] = mapUvToClient(1, 1, rect, 512, 512);
      expect(sx).toBeCloseTo(rect.left + rect.width, 0);
      expect(sy).toBeCloseTo(rect.top, 0);
    });

    it('maps (0.5,0.5) to center of rect at default zoom/pan', () => {
      const rect = makeRect(0, 0, 800, 600);
      const [sx, sy] = mapUvToClient(0.5, 0.5, rect, 512, 512);
      expect(sx).toBeCloseTo(400, 0);
      expect(sy).toBeCloseTo(300, 0);
    });

    it('at zoom=2, center stays at rect center (pan=0)', () => {
      mockState.zoom = 2;
      const rect = makeRect(0, 0, 800, 600);
      const [sx, sy] = mapUvToClient(0.5, 0.5, rect, 512, 512);
      // ((0.5 - 0.5 + 0)*2 + 0.5) * 800 = 0.5 * 800 = 400
      expect(sx).toBeCloseTo(400, 0);
      expect(sy).toBeCloseTo(300, 0);
    });

    it('at zoom=2, corners expand outward from center', () => {
      mockState.zoom = 2;
      const rect = makeRect(0, 0, 800, 600);
      // (0,0) -> ((0-0.5)*2 + 0.5) * 800 = (-1+0.5)*800 = -400
      const [sx0, sy0] = mapUvToClient(0, 0, rect, 512, 512);
      expect(sx0).toBeCloseTo(-400, 0);
      expect(sy0).toBeCloseTo(900, 0); // mapV=1 -> ((1-0.5)*2+0.5)*600 = 1.5*600 = 900

      // (1,1) -> ((1-0.5)*2 + 0.5) * 800 = 1.5*800 = 1200
      const [sx1, sy1] = mapUvToClient(1, 1, rect, 512, 512);
      expect(sx1).toBeCloseTo(1200, 0);
      expect(sy1).toBeCloseTo(-300, 0); // mapV=0 -> ((0-0.5)*2+0.5)*600 = -0.5*600 = -300
    });

    it('panX shifts the map', () => {
      mockState.panX = 0.25;
      const rect = makeRect(0, 0, 800, 600);
      // center: ((0.5 - 0.5 + 0.25)*1 + 0.5) * 800 = (0.25+0.5)*800 = 600
      const [sx, sy] = mapUvToClient(0.5, 0.5, rect, 512, 512);
      expect(sx).toBeCloseTo(600, 0);
      expect(sy).toBeCloseTo(300, 0);
    });
  });

  describe('clientToMapUv', () => {
    it('returns null for points outside the map', () => {
      const rect = makeRect(0, 0, 800, 600);
      const result = clientToMapUv(-100, -100, rect, 512, 512);
      expect(result).toBeNull();
    });

    it('returns valid UV for center of rect', () => {
      const rect = makeRect(0, 0, 800, 600);
      const result = clientToMapUv(400, 300, rect, 512, 512);
      expect(result).not.toBeNull();
      expect(result!.nx).toBeCloseTo(0.5, 2);
      expect(result!.ny).toBeCloseTo(0.5, 2);
    });

    it('round-trips with mapUvToClient at zoom=2', () => {
      mockState.zoom = 2;
      const rect = makeRect(50, 50, 1000, 800);
      // Forward: UV (0.3, 0.7) -> client
      const [cx, cy] = mapUvToClient(0.3, 0.7, rect, 512, 512);
      // Inverse: client -> UV
      const result = clientToMapUv(cx, cy, rect, 512, 512);
      expect(result).not.toBeNull();
      expect(result!.nx).toBeCloseTo(0.3, 4);
      expect(result!.ny).toBeCloseTo(0.7, 4);
    });
  });

  describe('mapPixelToClient', () => {
    it('delegates to mapUvToClient with normalized coordinates', () => {
      const rect = makeRect(0, 0, 800, 600);
      const [sx, sy] = mapPixelToClient(256, 256, rect, 512, 512);
      const [sx2, sy2] = mapUvToClient(0.5, 0.5, rect, 512, 512);
      expect(sx).toBeCloseTo(sx2, 5);
      expect(sy).toBeCloseTo(sy2, 5);
    });
  });
});
