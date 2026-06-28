import { describe, it, expect } from 'vitest';
import { generateElevation } from '../erosion.js';
import type { Plate } from '../tectonic.js';

function makePlates(): Plate[] {
  return [
    { id: 0, type: 'continent', elevation: 0.4, centerX: 0.3, centerY: 0.5, vx: 0.01, vy: 0 },
    { id: 1, type: 'ocean', elevation: -0.4, centerX: 0.7, centerY: 0.5, vx: -0.01, vy: 0 },
  ];
}

function makePlateId(width: number, height: number): Float32Array {
  const pid = new Float32Array(width * height);
  const plateDist = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const left = x / width < 0.5;
      pid[idx] = left ? 0 : 1;
      const cx = left ? 0.3 : 0.7;
      const cy = 0.5;
      const dx = x / width - cx, dy = y / height - cy;
      plateDist[idx] = Math.sqrt(dx * dx + dy * dy);
    }
  }
  return pid;
}

function makePlateDist(width: number, height: number): Float32Array {
  const plateDist = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const left = x / width < 0.5;
      const cx = left ? 0.3 : 0.7;
      const cy = 0.5;
      const dx = x / width - cx, dy = y / height - cy;
      plateDist[idx] = Math.sqrt(dx * dx + dy * dy);
    }
  }
  return plateDist;
}

describe('板块边界平滑 (AC-4.1)', () => {
  it('边界处高程过渡单调（大陆-海洋交界不跳变）', () => {
    const W = 64, H = 64;
    const plates = makePlates();
    const plateId = makePlateId(W, H);
    const plateDist = makePlateDist(W, H);
    const tectonicForce = new Float32Array(W * H); // 无构造力，纯过渡
    const { elevation } = generateElevation(
      W, H, 42, plateId, plates, plateDist, tectonicForce,
      'simplex', 'standard', 4, 2, 0.5, 0.45, 0.3, 0.5
    );
    // 在中线 x=32 附近取一行，检查相邻像素高程差不超过 0.3
    const midY = Math.floor(H / 2);
    let maxJump = 0;
    for (let x = 28; x < 36; x++) {
      const diff = Math.abs(elevation[midY * W + x + 1] - elevation[midY * W + x]);
      maxJump = Math.max(maxJump, diff);
    }
    expect(maxJump).toBeLessThanOrEqual(0.3);
  });

  it('汇聚边界生成山脉（有构造力时边界高程高于无构造力）', () => {
    const W = 64, H = 64;
    const plates = makePlates();
    const plateId = makePlateId(W, H);
    const plateDist = makePlateDist(W, H);

    // 无构造力
    const noForce = new Float32Array(W * H);
    const { elevation: elevNo } = generateElevation(
      W, H, 42, plateId, plates, plateDist, noForce,
      'simplex', 'standard', 4, 2, 0.5, 0.45, 0.5, 0.5
    );

    // 有汇聚构造力
    const force = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 30; x < 34; x++) {
        force[y * W + x] = 1.0;
      }
    }
    const { elevation: elevYes } = generateElevation(
      W, H, 42, plateId, plates, plateDist, force,
      'simplex', 'standard', 4, 2, 0.5, 0.45, 0.5, 0.5
    );

    // 边界列最大高程：有构造力应高于无构造力
    const midY = Math.floor(H / 2);
    let maxNo = -Infinity, maxYes = -Infinity;
    for (let x = 28; x < 36; x++) {
      maxNo = Math.max(maxNo, elevNo[midY * W + x]);
      maxYes = Math.max(maxYes, elevYes[midY * W + x]);
    }
    expect(maxYes).toBeGreaterThan(maxNo + 0.1);
  });
});
