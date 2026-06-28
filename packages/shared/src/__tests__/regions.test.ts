import { describe, it, expect } from 'vitest';
import { computeClimate } from '../regions.js';

describe('气候分布 (AC-3.1, AC-3.2)', () => {
  const W = 64, H = 64;
  const seaLevel = 0;

  // 全海洋世界（测试纯纬度气候带）
  function allOcean(): Float32Array {
    const e = new Float32Array(W * H);
    e.fill(-0.3); // 全部低于海平面
    return e;
  }

  it('AC-3.1 赤道带温度≥0.7 且湿度≥0.6', () => {
    const elev = allOcean();
    const { temperature, moisture } = computeClimate(W, H, elev, seaLevel, 0, 0.5, 1, 0, 1);
    const midY = Math.floor(H / 2); // 赤道
    const midX = Math.floor(W / 2);
    const idx = midY * W + midX;
    expect(temperature[idx]).toBeGreaterThanOrEqual(0.7);
    expect(moisture[idx]).toBeGreaterThanOrEqual(0.6);
  });

  it('AC-3.1 极地比赤道冷', () => {
    const elev = allOcean();
    const { temperature } = computeClimate(W, H, elev, seaLevel, 0, 0.5, 1, 0, 1);
    const midY = Math.floor(H / 2);
    const polarY = 2;
    expect(temperature[polarY * W + 32]).toBeLessThan(temperature[midY * W + 32]);
  });

  it('AC-3.2 雨影：山脉背风坡湿度低于迎风坡', () => {
    // 构造：西部海洋，中部南北向山脉（高），东部陆地
    const elev = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (x < W * 0.15) {
          elev[idx] = -0.3; // 西部海洋
        } else if (x > W * 0.3 && x < W * 0.4) {
          elev[idx] = 0.8; // 南北向山脉（高于雪线 0.5）
        } else {
          elev[idx] = 0.2; // 陆地
        }
      }
    }
    // 中纬度西风带（absLat~0.4）自然东风向 + 用户 windDirX=1 增强
    const { moisture } = computeClimate(W, H, elev, seaLevel, 0, 0.5, 1, 0, 1);
    const midLatY = Math.floor(H * 0.3); // 北半球中纬度
    // 迎风坡（山脉西侧陆地，紧邻海洋）
    const windward = moisture[midLatY * W + Math.floor(W * 0.2)];
    // 背风坡（山脉东侧陆地）
    const leeward = moisture[midLatY * W + Math.floor(W * 0.6)];
    expect(windward - leeward).toBeGreaterThanOrEqual(0.1);
  });

  it('温度随纬度递减（赤道→极地）', () => {
    const elev = allOcean();
    const { temperature } = computeClimate(W, H, elev, seaLevel, 0, 0.5, 1, 0, 1);
    const midY = Math.floor(H / 2);
    let prev = temperature[midY * W + 32];
    for (let y = midY - 1; y >= 0; y -= 4) {
      const t = temperature[y * W + 32];
      // 向极地移动温度应下降
      expect(t).toBeLessThanOrEqual(prev + 0.05);
      prev = t;
    }
  });
});
