import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../grid.js';

describe('SpatialGrid', () => {
  it('finds points within radius', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: number }>(100, 100, 10);
    grid.insert({ x: 10, y: 10, id: 1 });
    grid.insert({ x: 15, y: 15, id: 2 });
    grid.insert({ x: 90, y: 90, id: 3 });
    const found = grid.queryRadius(12, 12, 10);
    expect(found.map(p => p.id).sort()).toEqual([1, 2]);
  });

  it('returns empty array when no points are near', () => {
    const grid = new SpatialGrid<{ x: number; y: number }>(100, 100, 10);
    grid.insert({ x: 10, y: 10 });
    expect(grid.queryRadius(80, 80, 5)).toEqual([]);
  });

  it('ignores out-of-bounds inserts', () => {
    const grid = new SpatialGrid<{ x: number; y: number }>(100, 100, 10);
    expect(() => grid.insert({ x: 200, y: 200 })).not.toThrow();
    expect(grid.queryRadius(200, 200, 10)).toEqual([]);
  });

  it('returns points exactly at radius boundary', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: number }>(100, 100, 10);
    grid.insert({ x: 0, y: 5, id: 1 });
    const found = grid.queryRadius(0, 0, 5);
    expect(found.map(p => p.id)).toEqual([1]);
  });
});
