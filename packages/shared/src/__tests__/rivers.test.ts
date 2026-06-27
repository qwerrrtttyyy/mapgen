import { describe, it, expect } from 'vitest';
import { generateRivers } from '../rivers.js';

describe('generateRivers', () => {
  it('returns correctly-sized riverMask/riverWidth/riverDepth arrays', () => {
    const w = 20, h = 20;
    const elev = new Float32Array(w * h).fill(0.5);
    const moist = new Float32Array(w * h).fill(0.5);
    const result = generateRivers(w, h, elev, moist, 0.1, 5, 42);
    expect(result.riverMask).toBeInstanceOf(Float32Array);
    expect(result.riverWidth).toBeInstanceOf(Float32Array);
    expect(result.riverDepth).toBeInstanceOf(Float32Array);
    expect(result.riverMask.length).toBe(w * h);
    expect(result.riverWidth.length).toBe(w * h);
    expect(result.riverDepth.length).toBe(w * h);
  });

  it('does not modify the input elevation/moisture arrays', () => {
    const w = 20, h = 20;
    const elev = new Float32Array(w * h);
    const moist = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.abs(x - 10) + Math.abs(y - 10);
        elev[y * w + x] = Math.max(0, 0.85 - 0.04 * dist);
        moist[y * w + x] = 0.6;
      }
    }
    const elevSnap = new Float32Array(elev);
    const moistSnap = new Float32Array(moist);
    generateRivers(w, h, elev, moist, 0.1, 5, 42);
    expect(Array.from(elev)).toEqual(Array.from(elevSnap));
    expect(Array.from(moist)).toEqual(Array.from(moistSnap));
  });

  it('routes rivers from high to low elevation (segments strictly decreasing)', () => {
    const w = 24, h = 24;
    const cx = 12, cy = 12;
    const elev = new Float32Array(w * h);
    const moist = new Float32Array(w * h).fill(0.7);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.abs(x - cx) + Math.abs(y - cy);
        elev[y * w + x] = Math.max(0, 0.85 - 0.04 * dist);
      }
    }
    const result = generateRivers(w, h, elev, moist, 0.05, 10, 7);
    expect(result.rivers.length).toBeGreaterThan(0);
    for (const river of result.rivers) {
      expect(river.segments.length).toBeGreaterThan(1);
      for (let i = 0; i < river.segments.length - 1; i++) {
        const a = river.segments[i];
        const b = river.segments[i + 1];
        const ea = elev[a.y * w + a.x];
        const eb = elev[b.y * w + b.x];
        expect(ea).toBeGreaterThan(eb);
      }
    }
  });

  it('is deterministic for identical inputs', () => {
    const w = 20, h = 20;
    const makeElev = () => {
      const e = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dist = Math.abs(x - 10) + Math.abs(y - 10);
          e[y * w + x] = Math.max(0, 0.85 - 0.04 * dist);
        }
      }
      return e;
    };
    const makeMoist = () => new Float32Array(w * h).fill(0.6);
    const a = generateRivers(w, h, makeElev(), makeMoist(), 0.05, 5, 42);
    const b = generateRivers(w, h, makeElev(), makeMoist(), 0.05, 5, 42);
    expect(JSON.stringify(a.rivers)).toBe(JSON.stringify(b.rivers));
    expect(Array.from(a.riverMask)).toEqual(Array.from(b.riverMask));
    expect(Array.from(a.riverWidth)).toEqual(Array.from(b.riverWidth));
    expect(Array.from(a.riverDepth)).toEqual(Array.from(b.riverDepth));
  });

  it('returns no rivers when count = 0', () => {
    const w = 20, h = 20;
    const elev = new Float32Array(w * h).fill(0.6);
    const moist = new Float32Array(w * h).fill(0.6);
    const result = generateRivers(w, h, elev, moist, 0.1, 0, 1);
    expect(result.rivers).toEqual([]);
    expect(Array.from(result.riverMask)).toEqual(Array.from(new Float32Array(w * h)));
    expect(Array.from(result.riverWidth)).toEqual(Array.from(new Float32Array(w * h)));
    expect(Array.from(result.riverDepth)).toEqual(Array.from(new Float32Array(w * h)));
  });

  it('only records rivers with length > 5', () => {
    // 单一孤峰：峰顶河流仅 2 段，其余候选源处于平地只能产生 1 段河流；都应被过滤
    const w = 16, h = 16;
    const elev = new Float32Array(w * h).fill(0.4);
    const moist = new Float32Array(w * h).fill(0.7);
    elev[8 * w + 8] = 0.7;
    const result = generateRivers(w, h, elev, moist, 0.1, 8, 3);
    for (const river of result.rivers) {
      expect(river.length).toBeGreaterThan(5);
    }
    // 在此场景下所有候选河流都过短，应被完全过滤
    expect(result.rivers.length).toBe(0);
  });
});
