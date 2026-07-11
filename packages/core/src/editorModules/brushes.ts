/**
 * @module editor/brushes
 * 画笔工具：基础画笔 + 平滑/噪声/绝对高程/河流/湖泊画笔
 *
 * 从 editor.ts 拆分（P2-3）。
 * - applyBrushStroke: 基础画笔（raise/lower/sea/land/plate-paint）
 * - applySmoothBrush: 平滑画笔（邻域均值滤波）
 * - applyNoiseBrush: 噪声画笔（叠加 value noise FBM）
 * - applySetElevationBrush: 绝对高程画笔
 * - applyRiverDraw: 河流绘制
 * - applyLakeDraw: 湖泊绘制
 */

import type { Command } from './commandStack.js';
import { pointToSegmentDist } from './vectorTools.js';
import { SEA_TARGET_OFFSET, LAND_TARGET_ELEV } from './terrainDetection.js';

export type BrushTarget =
  | 'raise'
  | 'lower'
  | 'sea'
  | 'land'
  | 'plate-paint'
  | 'smooth'
  | 'noise'
  | 'set'
  | 'river'
  | 'lake';
/** 高斯衰减（中心 1，边缘趋近 0） */
export function gaussianFalloff(dist: number, radius: number): number {
  const sigma = radius / 2;
  return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

/**
 * 画笔涂刷（AC-5.1, AC-5.2）。
 * 返回 Command，redo 已应用（调用方负责压栈）。
 * @param data  elevation 或 plateId 数组
 * @param target  raise/lower 调整高程；sea/land 设定陆海；plate-paint 切换板块
 */
/**
 * 画笔涂刷（raise/lower/sea/land/plate-paint）
 * 返回 Command，redo 已应用（调用方负责压栈）
 *
 * @param width - 地图宽度
 * @param height - 地图高度
 * @param data - elevation 或 plateId 数组
 * @param cx - 画笔中心 X
 * @param cy - 画笔中心 Y
 * @param radius - 画笔半径
 * @param strength - 画笔强度 [0,1]
 * @param target - 画笔目标类型
 * @param opts - 可选参数（targetPlateId, seaLevel）
 * @returns Command 对象（支持 undo/redo）
 */
export function applyBrushStroke(
  width: number,
  height: number,
  data: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  target: BrushTarget,
  opts?: { targetPlateId?: number; seaLevel?: number }
): Command {
  const seaLevel = opts?.seaLevel ?? 0;
  const targetPlateId = opts?.targetPlateId ?? 0;
  const r = Math.max(1, Math.floor(radius));
  const changes: Array<{ idx: number; before: number; after: number }> = [];

  const x0 = Math.max(0, Math.floor(cx) - r);
  const x1 = Math.min(width - 1, Math.floor(cx) + r);
  const y0 = Math.max(0, Math.floor(cy) - r);
  const y1 = Math.min(height - 1, Math.floor(cy) + r);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx,
        dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      const idx = y * width + x;
      const before = data[idx];
      let after = before;
      const fall = gaussianFalloff(dist, radius);
      switch (target) {
        case 'raise':
          after = Math.min(1, before + strength * fall);
          break;
        case 'lower':
          after = Math.max(-1, before - strength * fall);
          break;
        case 'sea': {
          const seaTarget = seaLevel - SEA_TARGET_OFFSET;
          after = before * (1 - fall) + seaTarget * fall;
          break;
        }
        case 'land': {
          const landTarget = LAND_TARGET_ELEV;
          after = before * (1 - fall) + landTarget * fall;
          break;
        }
        case 'plate-paint':
          // 板块涂刷：硬边（离散值不做高斯混合）
          after = dist <= r ? targetPlateId : before;
          break;
      }
      if (after !== before) {
        changes.push({ idx, before, after });
        data[idx] = after;
      }
    }
  }

  return {
    kind: 'brush',
    redo: () => {
      for (const c of changes) data[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) data[c.idx] = c.before;
    },
  };
}

// ── 矢量线 → 山脉（AC-6.1）──
export type FalloffMode = 'gaussian' | 'linear' | 'constant';
export type BrushShape = 'circle' | 'square';

/** 线性衰减 */
function linearFalloff(dist: number, radius: number): number {
  return Math.max(0, 1 - dist / radius);
}

/** 根据模式获取衰减值 */
function getFalloff(dist: number, radius: number, mode: FalloffMode): number {
  switch (mode) {
    case 'gaussian':
      return gaussianFalloff(dist, radius);
    case 'linear':
      return linearFalloff(dist, radius);
    case 'constant':
      return 1;
  }
}

/** 判断像素是否在画笔范围内 */
function isInBrush(dx: number, dy: number, radius: number, shape: BrushShape): boolean {
  switch (shape) {
    case 'circle':
      return dx * dx + dy * dy <= radius * radius;
    case 'square':
      return Math.abs(dx) <= radius && Math.abs(dy) <= radius;
  }
}

// ── 噪声画笔参数 ──
export interface NoiseBrushParams {
  frequency: number; // 噪声频率（默认 0.05）
  amplitude: number; // 噪声幅度（默认 0.3）
  octaves: number; // 八度数（默认 3）
  seed: number; // 随机种子
}

// ── 平滑画笔：对区域内像素做均值滤波 ──
/**
 * 平滑画笔：3x3 邻域均值滤波，平滑地形棱角
 *
 * @param width - 地图宽度
 * @param height - 地图高度
 * @param elevation - 高程数组
 * @param cx - 画笔中心 X
 * @param cy - 画笔中心 Y
 * @param radius - 画笔半径
 * @param strength - 平滑强度 [0,1]
 * @param shape - 画笔形状（circle/square）
 * @param falloff - 衰减模式（gaussian/linear/constant）
 * @returns Command 对象
 */
export function applySmoothBrush(
  width: number,
  height: number,
  elevation: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  shape: BrushShape = 'circle',
  falloff: FalloffMode = 'gaussian'
): Command {
  const r = Math.max(1, Math.floor(radius));
  const changes: Array<{ idx: number; before: number; after: number }> = [];
  const x0 = Math.max(0, Math.floor(cx) - r);
  const x1 = Math.min(width - 1, Math.floor(cx) + r);
  const y0 = Math.max(0, Math.floor(cy) - r);
  const y1 = Math.min(height - 1, Math.floor(cy) + r);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (!isInBrush(dx, dy, radius, shape)) continue;
      const idx = y * width + x;

      // 3x3 邻域均值
      let sum = 0;
      let cnt = 0;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          sum += elevation[ny * width + nx];
          cnt++;
        }
      }
      const avg = sum / cnt;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fall = getFalloff(dist, radius, falloff);
      const before = elevation[idx];
      const after = before + (avg - before) * strength * fall;
      if (Math.abs(after - before) > 1e-6) {
        changes.push({ idx, before, after });
        elevation[idx] = after;
      }
    }
  }

  return {
    kind: 'brush-smooth',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}

// ── 噪声画笔：叠加柏林噪声 ──
/**
 * 噪声画笔：叠加 value noise FBM，增加自然地形细节
 *
 * @param width - 地图宽度
 * @param height - 地图高度
 * @param elevation - 高程数组
 * @param cx - 画笔中心 X
 * @param cy - 画笔中心 Y
 * @param radius - 画笔半径
 * @param strength - 噪声强度 [0,1]
 * @param params - 噪声参数（frequency, amplitude, octaves, seed）
 * @param shape - 画笔形状
 * @param falloff - 衰减模式
 * @returns Command 对象
 */
export function applyNoiseBrush(
  width: number,
  height: number,
  elevation: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  params: NoiseBrushParams,
  shape: BrushShape = 'circle',
  falloff: FalloffMode = 'gaussian'
): Command {
  const r = Math.max(1, Math.floor(radius));
  const changes: Array<{ idx: number; before: number; after: number }> = [];
  const x0 = Math.max(0, Math.floor(cx) - r);
  const x1 = Math.min(width - 1, Math.floor(cx) + r);
  const y0 = Math.max(0, Math.floor(cy) - r);
  const y1 = Math.min(height - 1, Math.floor(cy) + r);

  // 简化的 value noise（基于 hash）
  function hashNoise(px: number, py: number): number {
    let h = (px * 374761393 + py * 668265263 + params.seed) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff; // [0, 1)
  }

  function smoothNoise(px: number, py: number): number {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const sx = fx * fx * (3 - 2 * fx); // smoothstep
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = hashNoise(ix, iy);
    const n10 = hashNoise(ix + 1, iy);
    const n01 = hashNoise(ix, iy + 1);
    const n11 = hashNoise(ix + 1, iy + 1);
    return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
  }

  function fbm(px: number, py: number): number {
    let val = 0;
    let amp = 1;
    let freq = params.frequency;
    let maxVal = 0;
    for (let o = 0; o < params.octaves; o++) {
      val += smoothNoise(px * freq, py * freq) * amp;
      maxVal += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / maxVal; // 归一化到 [0, 1]
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (!isInBrush(dx, dy, radius, shape)) continue;
      const idx = y * width + x;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fall = getFalloff(dist, radius, falloff);
      const noise = (fbm(x, y) - 0.5) * 2 * params.amplitude; // [-amp, +amp]
      const before = elevation[idx];
      const after = before + noise * strength * fall;
      if (Math.abs(after - before) > 1e-6) {
        changes.push({ idx, before, after });
        elevation[idx] = after;
      }
    }
  }

  return {
    kind: 'brush-noise',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}

// ── 绝对高程画笔：设置目标高程值 ──
/**
 * 绝对高程画笔：设置目标高程值，适合精确地形雕刻
 *
 * @param targetElevation - 目标高程值
 * @param strength - 混合强度 [0,1]（0=不改变，1=完全设置为目标值）
 */
export function applySetElevationBrush(
  width: number,
  height: number,
  elevation: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  targetElevation: number,
  strength: number,
  shape: BrushShape = 'circle',
  falloff: FalloffMode = 'gaussian'
): Command {
  const r = Math.max(1, Math.floor(radius));
  const changes: Array<{ idx: number; before: number; after: number }> = [];
  const x0 = Math.max(0, Math.floor(cx) - r);
  const x1 = Math.min(width - 1, Math.floor(cx) + r);
  const y0 = Math.max(0, Math.floor(cy) - r);
  const y1 = Math.min(height - 1, Math.floor(cy) + r);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (!isInBrush(dx, dy, radius, shape)) continue;
      const idx = y * width + x;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fall = getFalloff(dist, radius, falloff);
      const before = elevation[idx];
      const after = before + (targetElevation - before) * strength * fall;
      if (Math.abs(after - before) > 1e-6) {
        changes.push({ idx, before, after });
        elevation[idx] = after;
      }
    }
  }

  return {
    kind: 'brush-set',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}

// ── 河流绘制：沿路径挖出河道 ──
/**
 * 河流绘制：沿路径挖出河道，同时修改 elevation/riverMask/riverWidth/riverDepth
 *
 * @param points - 路径点列表 [[x,y], ...]
 * @param channelWidth - 河道宽度（像素）
 * @param channelDepth - 河道深度（高程差）
 * @param seaLevel - 海平面
 * @returns Command 对象
 */
export function applyRiverDraw(
  width: number,
  height: number,
  elevation: Float32Array,
  riverMask: Float32Array,
  riverWidth: Float32Array,
  riverDepth: Float32Array,
  points: number[][],
  channelWidth: number, // 河道宽度（像素）
  channelDepth: number, // 河道深度（高程差）
  _seaLevel: number // 保留参数以维持 API 签名兼容；当前实现未直接使用
): Command {
  const elevChanges: Array<{ idx: number; before: number; after: number }> = [];
  const maskChanges: Array<{ idx: number; before: number; after: number }> = [];
  const widthChanges: Array<{ idx: number; before: number; after: number }> = [];
  const depthChanges: Array<{ idx: number; before: number; after: number }> = [];

  if (points.length < 2) {
    return { kind: 'river-draw', redo: () => {}, undo: () => {} };
  }

  const halfW = channelWidth / 2;

  // 沿路径逐段处理
  for (let seg = 0; seg < points.length - 1; seg++) {
    const [x0, y0] = points[seg];
    const [x1, y1] = points[seg + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(len));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;

      // 河道矩形区域
      const minX = Math.max(0, Math.floor(px - halfW));
      const maxX = Math.min(width - 1, Math.ceil(px + halfW));
      const minY = Math.max(0, Math.floor(py - halfW));
      const maxY = Math.min(height - 1, Math.ceil(py + halfW));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = y * width + x;
          // 到路径中心线的距离
          const dist = pointToSegmentDist(x, y, x0, y0, x1, y1);
          if (dist > halfW) continue;

          const fall = 1 - dist / halfW; // 线性衰减
          const depth = channelDepth * fall;

          // 挖深河道
          const elevBefore = elevation[idx];
          const elevAfter = elevBefore - depth;
          if (elevAfter < elevBefore) {
            if (!elevChanges.some(c => c.idx === idx)) {
              elevChanges.push({ idx, before: elevBefore, after: elevAfter });
            } else {
              const c = elevChanges.find(c => c.idx === idx)!;
              c.after = Math.min(c.after, elevAfter);
            }
            elevation[idx] = Math.min(elevation[idx], elevAfter);
          }

          // 设置河流掩码
          const maskBefore = riverMask[idx];
          if (maskBefore < fall) {
            if (!maskChanges.some(c => c.idx === idx)) {
              maskChanges.push({ idx, before: maskBefore, after: fall });
            } else {
              const c = maskChanges.find(c => c.idx === idx)!;
              c.after = Math.max(c.after, fall);
            }
            riverMask[idx] = Math.max(riverMask[idx], fall);
          }

          // 设置河流宽度
          const wBefore = riverWidth[idx];
          const wAfter = channelWidth * fall;
          if (wAfter > wBefore) {
            if (!widthChanges.some(c => c.idx === idx)) {
              widthChanges.push({ idx, before: wBefore, after: wAfter });
            } else {
              const c = widthChanges.find(c => c.idx === idx)!;
              c.after = Math.max(c.after, wAfter);
            }
            riverWidth[idx] = Math.max(riverWidth[idx], wAfter);
          }

          // 设置河流深度
          const dBefore = riverDepth[idx];
          const dAfter = channelDepth * fall;
          if (dAfter > dBefore) {
            if (!depthChanges.some(c => c.idx === idx)) {
              depthChanges.push({ idx, before: dBefore, after: dAfter });
            } else {
              const c = depthChanges.find(c => c.idx === idx)!;
              c.after = Math.max(c.after, dAfter);
            }
            riverDepth[idx] = Math.max(riverDepth[idx], dAfter);
          }
        }
      }
    }
  }

  return {
    kind: 'river-draw',
    redo: () => {
      for (const c of elevChanges) elevation[c.idx] = c.after;
      for (const c of maskChanges) riverMask[c.idx] = c.after;
      for (const c of widthChanges) riverWidth[c.idx] = c.after;
      for (const c of depthChanges) riverDepth[c.idx] = c.after;
    },
    undo: () => {
      for (const c of elevChanges) elevation[c.idx] = c.before;
      for (const c of maskChanges) riverMask[c.idx] = c.before;
      for (const c of widthChanges) riverWidth[c.idx] = c.before;
      for (const c of depthChanges) riverDepth[c.idx] = c.before;
    },
  };
}

// ── 湖泊绘制：在指定位置挖出湖泊 ──
/**
 * 湖泊绘制：在指定位置挖掘湖泊盆地
 *
 * @param cx - 湖泊中心 X
 * @param cy - 湖泊中心 Y
 * @param radius - 湖泊半径
 * @param depth - 湖泊深度
 * @param seaLevel - 海平面
 * @param shape - 画笔形状
 * @returns Command 对象
 */
export function applyLakeDraw(
  width: number,
  height: number,
  elevation: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  depth: number,
  seaLevel: number,
  shape: BrushShape = 'circle'
): Command {
  const r = Math.max(1, Math.floor(radius));
  const changes: Array<{ idx: number; before: number; after: number }> = [];
  const x0 = Math.max(0, Math.floor(cx) - r);
  const x1 = Math.min(width - 1, Math.floor(cx) + r);
  const y0 = Math.max(0, Math.floor(cy) - r);
  const y1 = Math.min(height - 1, Math.floor(cy) + r);

  // 计算湖底高程（当前中心高程 - depth，但不低于 seaLevel）
  const centerIdx = Math.floor(cy) * width + Math.floor(cx);
  const lakeFloor = Math.max(seaLevel - 0.1, elevation[centerIdx] - depth);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (!isInBrush(dx, dy, radius, shape)) continue;
      const idx = y * width + x;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fall = 1 - dist / radius; // 线性衰减，边缘与原始高程平滑过渡
      const before = elevation[idx];
      const target = lakeFloor + (before - lakeFloor) * (1 - fall);
      const after = Math.min(before, target); // 只降低不升高
      if (after < before) {
        changes.push({ idx, before, after });
        elevation[idx] = after;
      }
    }
  }

  return {
    kind: 'lake-draw',
    redo: () => {
      for (const c of changes) elevation[c.idx] = c.after;
    },
    undo: () => {
      for (const c of changes) elevation[c.idx] = c.before;
    },
  };
}
