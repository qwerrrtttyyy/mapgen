import { describe, it, expect } from 'vitest';
import { computeSeasonalVariation, decodeSeasonDelta } from '../seasons.js';

describe('季节性气候变差', () => {
  const W = 32,
    H = 32;

  function buildElev(landFraction: number): Float32Array {
    const e = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) e[i] = i < W * H * landFraction ? 0.4 : -0.3;
    return e;
  }

  it('夏冬温度 delta 范围 [-1,1]', () => {
    const elevation = buildElev(0.5);
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    for (let i = 0; i < W * H; i++) {
      expect(result.summerTemp[i]).toBeGreaterThanOrEqual(-1);
      expect(result.summerTemp[i]).toBeLessThanOrEqual(1);
      expect(result.winterTemp[i]).toBeGreaterThanOrEqual(-1);
      expect(result.winterTemp[i]).toBeLessThanOrEqual(1);
    }
  });

  it('极地季节振幅 > 赤道季节振幅', () => {
    const elevation = buildElev(0.5);
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    // 赤道 y = H/2, 极地 y = 0
    const equatorIdx = Math.floor(H / 2) * W + Math.floor(W / 2);
    const polarIdx = 0 * W + Math.floor(W / 2);
    const equatorAmp = Math.abs(result.summerTemp[equatorIdx]);
    const polarAmp = Math.abs(result.summerTemp[polarIdx]);
    expect(polarAmp).toBeGreaterThan(equatorAmp);
  });

  it('陆地的季节振幅 > 海洋', () => {
    // 同纬度下，陆地 vs 海洋
    const elevation = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // 左半陆地，右半海洋（同纬度对比）
        elevation[y * W + x] = x < W / 2 ? 0.4 : -0.3;
      }
    }
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    const midY = Math.floor(H / 2);
    const landIdx = midY * W + 1;
    const oceanIdx = midY * W + (W - 1);
    expect(Math.abs(result.summerTemp[landIdx])).toBeGreaterThan(
      Math.abs(result.summerTemp[oceanIdx])
    );
  });

  it('内陆季节振幅 > 沿海（同纬度陆地）', () => {
    // 沿海陆地：左边缘；内陆陆地：远离海岸
    // 全陆地，但构造 coastDist 模拟海岸距离
    const elevation = new Float32Array(W * H).fill(0.4);
    const coastDist = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // 左边为虚拟海洋，coastDist 从左递增
        coastDist[y * W + x] = x;
      }
    }
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
      coastDist,
    });
    const midY = Math.floor(H / 2);
    const coastalIdx = midY * W + 1;
    const inlandIdx = midY * W + (W - 2);
    expect(Math.abs(result.summerTemp[inlandIdx])).toBeGreaterThan(
      Math.abs(result.summerTemp[coastalIdx])
    );
  });

  it('seasonTex 通道值在 [0,1]', () => {
    const elevation = buildElev(0.5);
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    for (let i = 0; i < W * H * 4; i++) {
      expect(result.seasonTex[i]).toBeGreaterThanOrEqual(0);
      expect(result.seasonTex[i]).toBeLessThanOrEqual(1);
    }
  });

  it('decodeSeasonDelta 4 季循环正确', () => {
    const elevation = buildElev(0.5);
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    const size = W * H;
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const { tempDelta, rainDelta } = decodeSeasonDelta(result.seasonTex, size, season);
      expect(tempDelta.length).toBe(size);
      expect(rainDelta.length).toBe(size);
      for (let i = 0; i < size; i++) {
        expect(tempDelta[i]).toBeGreaterThanOrEqual(-1);
        expect(tempDelta[i]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('夏季温度 delta > 冬季温度 delta（中纬度陆地）', () => {
    const elevation = buildElev(0.5);
    const result = computeSeasonalVariation({
      width: W,
      height: H,
      elevation,
      seaLevel: 0,
    });
    const size = W * H;
    const summer = decodeSeasonDelta(result.seasonTex, size, 'summer');
    const winter = decodeSeasonDelta(result.seasonTex, size, 'winter');
    // 在中纬度陆地像素检查夏季 > 冬季
    const midY = Math.floor(H * 0.3);
    const midX = Math.floor(W * 0.5);
    const idx = midY * W + midX;
    if (elevation[idx] > 0) {
      expect(summer.tempDelta[idx]).toBeGreaterThan(winter.tempDelta[idx]);
    }
  });
});
