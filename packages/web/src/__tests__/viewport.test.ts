// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the viewport coordinate math directly.
// The functions use `state` from appState, so we mock it.

vi.mock('../core/appState.js', () => ({
  state: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },
}));

import { clientToMapUv, mapUvToClient, mapPixelToClient } from '../map/viewport.js';

function makeRect(x: number, y: number, w: number, h: number): DOMRect {
  return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => '' };
}

describe('viewport coordinate transforms', () => {
  describe('mapUvToClient', () => {
    it('maps (0,0) to top-left of rect at default zoom/pan', () => {
      const rect = makeRect(100, 50, 800, 600);
      const [sx, sy] = mapUvToClient(0, 0, rect, 512, 512);
      // At default zoom=1, pan=0: sx = ((0 - 0.5 + 0)*1 + 0.5) * 800 = 0 -> + rect.left = 100
      expect(sx).toBeCloseTo(rect.left, 0);
      // ny=0 -> mapV=1 -> sy = ((1 - 0.5 + 0)*1 + 0.5) * 600 = 600 -> + rect.top = 650
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
  });

  describe('mapPixelToClient', () => {
    it('delegates to mapUvToClient with normalized coordinates', () => {
      const rect = makeRect(0, 0, 800, 600);
      const [sx, sy] = mapPixelToClient(256, 256, rect, 512, 512);
      // Should be same as mapUvToClient(0.5, 0.5)
      const [sx2, sy2] = mapUvToClient(0.5, 0.5, rect, 512, 512);
      expect(sx).toBeCloseTo(sx2, 5);
      expect(sy).toBeCloseTo(sy2, 5);
    });
  });
});
