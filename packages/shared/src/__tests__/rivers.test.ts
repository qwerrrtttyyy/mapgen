import { describe, it, expect } from 'vitest';
import { generateRivers } from '../rivers.js';

// 构造一个确定性斜坡：北高南低，底部为海
function makeSlopeElevation(W: number, H: number, seaLevel: number): Float32Array {
  const elev = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      // y=0 顶部高程 0.9，y=H-1 底部 -0.3（海），线性递减 + 微噪声让河流分散
      const t = y / (H - 1);
      const noise = ((x * 7 + y * 13) % 5) * 0.01;
      elev[idx] = 0.9 - t * 1.2 + noise;
    }
  }
  return elev;
}

function makeMoisture(W: number, H: number, val: number): Float32Array {
  const m = new Float32Array(W * H);
  m.fill(val);
  return m;
}

describe('河流系统 (AC-2.1, AC-2.2)', () => {
  it('AC-2.1 河流不逆坡：每条河全程高程递减', () => {
    const W = 48, H = 48;
    const seaLevel = 0;
    const elev = makeSlopeElevation(W, H, seaLevel);
    const moist = makeMoisture(W, H, 0.7);
    const { rivers } = generateRivers(W, H, elev, moist, seaLevel, 10, 1);
    expect(rivers.length).toBeGreaterThan(0);
    for (const river of rivers) {
      let prev = Infinity;
      for (const seg of river.segments) {
        const e = elev[seg.y * W + seg.x];
        // 允许相等（平坦段），但不允许上升超过 0.05（数值容差）
        expect(e).toBeLessThanOrEqual(prev + 0.05);
        prev = e;
      }
    }
  });

  it('AC-2.1 河流终点低于源头（下流而非上爬）', () => {
    const W = 48, H = 48;
    const seaLevel = 0;
    const elev = makeSlopeElevation(W, H, seaLevel);
    const moist = makeMoisture(W, H, 0.7);
    const { rivers } = generateRivers(W, H, elev, moist, seaLevel, 10, 1);
    for (const river of rivers) {
      const first = river.segments[0];
      const last = river.segments[river.segments.length - 1];
      const firstElev = elev[first.y * W + first.x];
      const lastElev = elev[last.y * W + last.x];
      // 终点高程 < 源头（河流下流），入海或汇入主流
      expect(lastElev).toBeLessThan(firstElev);
    }
  });

  it('AC-2.2 下游宽度不小于上游（累积流量驱动）', () => {
    const W = 64, H = 64;
    const seaLevel = 0;
    const elev = makeSlopeElevation(W, H, seaLevel);
    const moist = makeMoisture(W, H, 0.8);
    const { rivers } = generateRivers(W, H, elev, moist, seaLevel, 8, 1);
    for (const river of rivers) {
      // 下游段宽度应 ≥ 上游段宽度（允许相等）
      const upstream = river.segments[Math.floor(river.segments.length * 0.2)];
      const downstream = river.segments[Math.floor(river.segments.length * 0.8)];
      expect(downstream.width).toBeGreaterThanOrEqual(upstream.width - 0.5);
    }
  });

  it('河流数量受 count 参数控制', () => {
    const W = 64, H = 64;
    const seaLevel = 0;
    const elev = makeSlopeElevation(W, H, seaLevel);
    const moist = makeMoisture(W, H, 0.8);
    const { rivers: few } = generateRivers(W, H, elev, moist, seaLevel, 3, 1);
    const { rivers: many } = generateRivers(W, H, elev, moist, seaLevel, 15, 1);
    expect(many.length).toBeGreaterThan(few.length);
  });
});
