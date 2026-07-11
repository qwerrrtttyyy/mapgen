/**
 * @module editor/vectorTools
 * 矢量绘制工具：矢量线→山脉 + 矢量多边形→海/陆/湖
 *
 * 从 editor.ts 拆分（P2-3）。
 * - applyVectorMountain: 沿矢量线生成山脉，山脉宽度由参数控制
 * - applyVectorPolygon: 将闭合多边形区域设为指定地形（陆地/海洋/湖泊）
 */

import type { Command } from './commandStack.js';
import { gaussianFalloff } from './brushes.js';

// 共享常量（从 terrainDetection 导入）
import { SEA_TARGET_OFFSET, LAND_TARGET_ELEV, LAKE_TARGET_OFFSET } from './terrainDetection.js';

export type VectorTarget = 'sea' | 'land' | 'lake';

/** 点到线段最短距离 */
export function pointToSegmentDist(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const dx = x1 - x0,
    dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export function applyVectorMountain(
  width: number,
  height: number,
  elevation: Float32Array,
  line: number[][],
  width_: number,
  mountainHeight: number
): Command {
  const r = Math.max(1, width_);
  const changes: Array<{ idx: number; before: number; after: number }> = [];

  // 折线包围盒（含半径）
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of line) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const x0 = Math.max(0, Math.floor(minX) - r);
  const x1 = Math.min(width - 1, Math.ceil(maxX) + r);
  const y0 = Math.max(0, Math.floor(minY) - r);
  const y1 = Math.min(height - 1, Math.ceil(maxY) + r);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // 像素中心点到折线的最短距离
      let minDist = Infinity;
      for (let i = 0; i < line.length - 1; i++) {
        const d = pointToSegmentDist(
          x + 0.5,
          y + 0.5,
          line[i][0],
          line[i][1],
          line[i + 1][0],
          line[i + 1][1]
        );
        if (d < minDist) minDist = d;
      }
      if (minDist > r) continue;
      const idx = y * width + x;
      const before = elevation[idx];
      const fall = gaussianFalloff(minDist, r);
      // 抬升到目标（取 max，不破坏已有更高地形）
      const after = Math.max(before, before * (1 - fall) + mountainHeight * fall);
      if (after !== before) {
        changes.push({ idx, before, after });
        elevation[idx] = after;
      }
    }
  }

  return {
    kind: 'vector-mountain',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}

// ── 矢量多边形 → 地形（AC-6.2）──
export function applyVectorPolygon(
  width: number,
  height: number,
  elevation: Float32Array,
  polygon: number[][],
  target: VectorTarget,
  seaLevel: number = 0
): Command {
  const targetElev =
    target === 'sea'
      ? seaLevel - SEA_TARGET_OFFSET
      : target === 'lake'
        ? seaLevel + LAKE_TARGET_OFFSET
        : LAND_TARGET_ELEV;
  const changes: Array<{ idx: number; before: number; after: number }> = [];

  // 多边形包围盒
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(width - 1, Math.ceil(maxX));
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  // 射线法点在多边形内
  function inside(x: number, y: number): boolean {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0],
        yi = polygon[i][1];
      const xj = polygon[j][0],
        yj = polygon[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) {
        hit = !hit;
      }
    }
    return hit;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const idx = y * width + x;
      const before = elevation[idx];
      if (before !== targetElev) {
        changes.push({ idx, before, after: targetElev });
        elevation[idx] = targetElev;
      }
    }
  }

  return {
    kind: 'vector-terrain',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}

// ── 板块几何重算（plate-paint/拖拽后，plateId 已变，需同步 plateDist + plates.type）──
/**
 * 基于当前 plateId 重算每个板块的质心、type、plateDist。
 * - 质心：板块所有像素的算术平均（像素坐标）。
 * - type：板块像素平均高程 > seaLevel → continent，否则 ocean。
 * - plateDist：每个像素到所属板块质心的欧氏距离（像素单位）。
 *
 * 用于 plate-paint / 板块拖拽后局部重算高程前，修正 generateElevation 依赖的几何量。
 */
