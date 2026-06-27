import { describe, it, expect } from 'vitest';
import { hydraulicErosion } from '../erosion.js';

describe('hydraulicErosion', () => {
  it('returns an array of the same size as input', () => {
    const w = 8, h = 8;
    const elev = new Float32Array(w * h).fill(0.5);
    const out = hydraulicErosion(w, h, elev, 3, 0.1);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(w * h);
  });

  it('does not modify the input elevation array', () => {
    const w = 8, h = 8;
    const elev = new Float32Array(w * h).fill(0.5);
    const snapshot = new Float32Array(elev);
    hydraulicErosion(w, h, elev, 3, 0.1);
    expect(Array.from(elev)).toEqual(Array.from(snapshot));
  });

  it('erodes peaks toward lower neighbors (water flows downhill)', () => {
    const w = 5, h = 5;
    const elev = new Float32Array(w * h).fill(0.3);
    // 中心为山峰
    elev[2 * w + 2] = 0.9;
    const out = hydraulicErosion(w, h, elev, 10, 0.5);
    // 中心高度应降低
    expect(out[2 * w + 2]).toBeLessThan(0.9);
  });

  it('deposits sediment in low areas (valley fill)', () => {
    const w = 5, h = 5;
    const elev = new Float32Array(w * h).fill(0.6);
    // 中心为谷底
    elev[2 * w + 2] = 0.1;
    const out = hydraulicErosion(w, h, elev, 10, 0.5);
    // 谷底因沉积应升高
    expect(out[2 * w + 2]).toBeGreaterThan(0.1);
  });

  it('converges (stops early) when strength is very low', () => {
    const w = 8, h = 8;
    const elev = new Float32Array(w * h).fill(0.5);
    // 几乎无变化，应快速收敛不抛错
    const out = hydraulicErosion(w, h, elev, 50, 0.0001);
    expect(out.length).toBe(w * h);
  });

  it('produces deterministic output for identical inputs', () => {
    const w = 10, h = 10;
    const make = () => {
      const e = new Float32Array(w * h);
      for (let i = 0; i < e.length; i++) e[i] = 0.3 + (i % 7) * 0.05;
      return e;
    };
    const a = hydraulicErosion(w, h, make(), 5, 0.3);
    const b = hydraulicErosion(w, h, make(), 5, 0.3);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('handles zero iterations gracefully', () => {
    const w = 4, h = 4;
    const elev = new Float32Array(w * h).fill(0.5);
    const out = hydraulicErosion(w, h, elev, 0, 0.5);
    expect(Array.from(out)).toEqual(Array.from(elev));
  });
});
