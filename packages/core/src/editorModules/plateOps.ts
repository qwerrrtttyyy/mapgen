/**
 * @module editor/plateOps
 * 板块操作：拖拽平移 + 几何重算
 *
 * 从 editor.ts 拆分（P2-3）。
 * - movePlate: 平移板块所有像素到新位置
 * - recomputePlateGeometry: 重算与相邻板块的边界
 */

import type { Plate } from '../tectonic.js';
import type { Command } from './commandStack.js';
import { SEA_TARGET_OFFSET } from './terrainDetection.js';

export function recomputePlateGeometry(
  width: number,
  height: number,
  plateId: Float32Array,
  plates: Plate[],
  elevation: Float32Array,
  seaLevel: number
): { plateDist: Float32Array; plates: Plate[] } {
  const size = width * height;
  const n = plates.length;
  const sumX = new Float64Array(n);
  const sumY = new Float64Array(n);
  const cnt = new Float64Array(n);
  const sumElev = new Float64Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pid = plateId[idx] | 0;
      if (pid < 0 || pid >= n) continue;
      sumX[pid] += x;
      sumY[pid] += y;
      cnt[pid]++;
      sumElev[pid] += elevation[idx];
    }
  }
  const cx = new Float64Array(n);
  const cy = new Float64Array(n);
  const newPlates: Plate[] = plates.map((p, i) => {
    const ccx = cnt[i] > 0 ? sumX[i] / cnt[i] : p.x * width;
    const ccy = cnt[i] > 0 ? sumY[i] / cnt[i] : p.y * height;
    cx[i] = ccx;
    cy[i] = ccy;
    const meanElev = cnt[i] > 0 ? sumElev[i] / cnt[i] : seaLevel - SEA_TARGET_OFFSET;
    return {
      ...p,
      x: ccx / width,
      y: ccy / height,
      type: meanElev > seaLevel ? 'continent' : 'ocean',
      area: cnt[i],
    };
  });
  const plateDist = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pid = plateId[idx] | 0;
      if (pid < 0 || pid >= n) {
        plateDist[idx] = 0;
        continue;
      }
      const dx = x - cx[pid],
        dy = y - cy[pid];
      plateDist[idx] = Math.sqrt(dx * dx + dy * dy);
    }
  }
  return { plateDist, plates: newPlates };
}

// ── 板块拖拽（AC-7.1）──
export function movePlate(
  width: number,
  height: number,
  plateId: Float32Array,
  plateIdValue: number,
  dx: number,
  dy: number
): Command {
  const size = width * height;
  // 收集该板块所有像素位置
  const srcPositions: number[] = [];
  for (let i = 0; i < size; i++) {
    if (plateId[i] === plateIdValue) srcPositions.push(i);
  }
  // 记录受影响单元格（源位置 + 目标位置）的 before
  const affected = new Map<number, number>();
  for (const idx of srcPositions) {
    if (!affected.has(idx)) affected.set(idx, plateId[idx]);
    const x = idx % width;
    const y = (idx / width) | 0;
    const nx = x + dx,
      ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const nidx = ny * width + nx;
      if (!affected.has(nidx)) affected.set(nidx, plateId[nidx]);
    }
  }

  function apply(doMove: boolean): void {
    // 先把源位置填 0（海洋/空），再把目标位置设为 plateIdValue
    if (doMove) {
      for (const idx of srcPositions) plateId[idx] = 0;
      for (const idx of srcPositions) {
        const x = idx % width;
        const y = (idx / width) | 0;
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          plateId[ny * width + nx] = plateIdValue;
        }
      }
    } else {
      // undo：恢复 affected 的 before
      for (const [idx, before] of affected) plateId[idx] = before;
    }
  }

  // redo = 移动，undo = 恢复 affected
  return {
    kind: 'plate-move',
    redo: () => apply(true),
    undo: () => apply(false),
  };
}

// ── 画笔衰减模式 ──
