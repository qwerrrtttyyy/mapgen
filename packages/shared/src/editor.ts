/**
 * @module editor
 * 编辑器子系统：地形区检测 + 画笔工具 + 矢量绘制 + 撤销栈
 *
 * 功能概览：
 * - detectTerrainRegions: 地形区自动检测（山脉/高原/盆地/沙漠/森林/平原/冰川/三角洲/火山/群岛）
 * - applyBrushStroke: 基础画笔（raise/lower/sea/land/plate-paint）
 * - applySmoothBrush: 平滑画笔（邻域均值滤波）
 * - applyNoiseBrush: 噪声画笔（叠加 value noise FBM）
 * - applySetElevationBrush: 绝对高程画笔
 * - applyRiverDraw: 河流绘制
 * - applyLakeDraw: 湖泊绘制
 * - applyVectorMountain: 矢量线→山脉
 * - applyVectorPolygon: 矢量多边形→海/陆/湖
 * - CommandStack: 撤销/重做栈（max=50）
 * - movePlate: 板块拖拽
 * - recomputePlateGeometry: 板块几何重算
 */
// 编辑器子系统：地形区检测 + 编辑命令 + 撤销栈
// 本文件先实现 detectTerrainRegions（命名系统依赖）；编辑命令/撤销栈在批次 F 补充。

import type { TerrainType } from './naming.js';
import type { Plate } from './tectonic.js';
import { labelComponents, computeComponentStats } from './connectedComponents.js';

export interface DetectedRegion {
  key: string;
  type: TerrainType;
  centroid: [number, number];
  area: number;
}

/** 世界式生成数据（可选，用于检测冰川/三角洲等地形） */
export interface TerrainDetectOptions {
  /** 陆地冰厚（来自 ice.ts）——检测冰川 */
  landIce?: Float32Array;
  /** 海岸距离场（陆地正）——检测三角洲 */
  coastDist?: Float32Array;
  /** 河流掩码——检测三角洲 */
  riverMask?: Float32Array;
  /** v2: 火山概率场 [0,1]（来自 volcanism.ts）——强化火山检测 */
  volcanoProb?: Float32Array;
  /** v2: 生物群系 ID（来自 biomes.ts）——细分地形区 */
  biomeId?: Uint8Array;
  /** v2: Strahler 河序（来自 watershed.ts）——大河河谷标注 */
  streamOrder?: Uint8Array;
  /** v2: 盆地编号（来自 watershed.ts）——大河流域标注 */
  basinId?: Int32Array;
}

// 类型 ID 编码（用于 Uint8Array 标记图）
const TYPE_IDS: Record<string, number> = {
  ocean: 0,
  mountain: 1,
  plateau: 2,
  basin: 3,
  desert: 4,
  forest: 5,
  plain: 6,
  glacier: 7,
  delta: 8,
  volcano: 9,
  archipelago: 10,
};
const TYPE_NAMES = [
  'ocean',
  'mountain',
  'plateau',
  'basin',
  'desert',
  'forest',
  'plain',
  'glacier',
  'delta',
  'volcano',
  'archipelago',
] as const;

const SLOPE_MOUNTAIN = 0.15;
const SLOPE_FLAT = 0.05;
const GLACIER_ICE_THRESHOLD = 0.3; // 陆地冰厚超过此值 → 冰川
const DELTA_RIVER_THRESHOLD = 0.05; // 河流掩码
const VOLCANO_MAX_AREA = 100; // 火山：孤立小山峰
const VOLCANO_ABS_ELEV_MIN = 0.75; // 火山最低绝对高程（用于连通域后处理）
const VOLCANO_PROB_THRESHOLD = 0.35; // v2: 火山概率阈值
const ARCHIPELAGO_MAX_AREA = 50; // 群岛：小岛最大面积

// classifyTerrain 阈值
const DELTA_SLOPE_MAX = 0.03; // 三角洲最大坡度
const DELTA_ELEV_MAX = 0.08; // 三角洲最大高程（seaLevel + 此值）
const VOLCANO_SEA_OFFSET = 0.3; // 火山最低高程偏移（seaLevel + 此值）
const VOLCANO_SLOPE_FACTOR = 0.7; // 火山坡度阈值系数（SLOPE_MOUNTAIN * 此值）
const BASIN_ELEV_MAX = 0.12; // 盆地最大高程（seaLevel + 此值）
const BASIN_SLOPE_MAX = 0.02; // 盆地最大坡度
const DESERT_MOIST_MAX = 0.3; // 沙漠最大湿度
const FOREST_MOIST_MIN = 0.6; // 森林最小湿度
const PLATEAU_ELEV_FACTOR = 0.7; // 高原高程系数（snowLine * 此值）
const DELTA_COAST_MAX = 10; // 三角洲距海岸最大像素数
const SEA_TARGET_OFFSET = 0.3; // 海洋目标高程偏移
const LAND_TARGET_ELEV = 0.2; // 陆地目标高程
const LAKE_TARGET_OFFSET = 0.05; // 湖泊目标高程偏移

function classifyTerrain(
  elev: number,
  slope: number,
  moist: number,
  seaLevel: number,
  snowLine: number,
  idx: number,
  opts?: TerrainDetectOptions
): number {
  if (elev <= seaLevel) return TYPE_IDS.ocean;
  // 冰川：陆地 + 冰厚充足
  if (opts?.landIce && opts.landIce[idx] > GLACIER_ICE_THRESHOLD) return TYPE_IDS.glacier;
  // 三角洲：近海岸 + 河流出海 + 低坡度 + 低海拔
  if (opts?.coastDist && opts?.riverMask) {
    const cd = opts.coastDist[idx];
    if (
      cd > 0 &&
      cd < DELTA_COAST_MAX &&
      opts.riverMask[idx] > DELTA_RIVER_THRESHOLD &&
      slope < DELTA_SLOPE_MAX &&
      elev < seaLevel + DELTA_ELEV_MAX
    ) {
      return TYPE_IDS.delta;
    }
  }
  // v2: 火山——高海拔 + 火山概率高 + 陡坡
  if (
    opts?.volcanoProb &&
    opts.volcanoProb[idx] > VOLCANO_PROB_THRESHOLD &&
    elev > seaLevel + VOLCANO_SEA_OFFSET &&
    slope > SLOPE_MOUNTAIN * VOLCANO_SLOPE_FACTOR
  ) {
    return TYPE_IDS.volcano;
  }
  if (elev > snowLine * PLATEAU_ELEV_FACTOR && slope > SLOPE_MOUNTAIN) return TYPE_IDS.mountain;
  if (elev > snowLine * PLATEAU_ELEV_FACTOR && slope < SLOPE_FLAT) return TYPE_IDS.plateau;
  // 盆地：低洼且平坦的谷底
  if (elev < seaLevel + BASIN_ELEV_MAX && slope < BASIN_SLOPE_MAX) return TYPE_IDS.basin;
  if (moist < DESERT_MOIST_MAX) return TYPE_IDS.desert;
  if (moist > FOREST_MOIST_MIN) return TYPE_IDS.forest;
  return TYPE_IDS.plain;
}

/**
 * 检测地形区连通域（AC-8.2 + 世界式增强）。
 * 4 邻接连通域标记 + 碎片过滤 + 质心/面积计算 + 后处理（火山/群岛）。
 *
 * @param minArea 面积小于此值的碎片被丢弃（默认 30 像素）
 * @param options 可选世界式数据（landIce/coastDist/riverMask），启用冰川/三角洲检测
 */
/**
 * 检测地形区（山脉/高原/盆地/沙漠/森林/平原/冰川/三角洲/火山/群岛）
 * 优先级：海洋 → 冰川 → 三角洲 → 火山 → 山脉 → 高原 → 盆地 → 沙漠 → 森林 → 平原
 *
 * @param width - 地图宽度
 * @param height - 地图高度
 * @param elevation - 高程场
 * @param slope - 坡度场
 * @param moisture - 湿度场
 * @param seaLevel - 海平面
 * @param snowLine - 雪线
 * @param minArea - 最小区域面积（像素）
 * @param options - 可选世界式生成数据
 * @returns 检测到的地形区列表
 */
export function detectTerrainRegions(
  width: number,
  height: number,
  elevation: Float32Array,
  slope: Float32Array,
  moisture: Float32Array,
  seaLevel: number,
  snowLine: number,
  minArea: number = 30,
  options?: TerrainDetectOptions
): DetectedRegion[] {
  const size = width * height;
  const typeMap = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    typeMap[i] = classifyTerrain(
      elevation[i],
      slope[i],
      moisture[i],
      seaLevel,
      snowLine,
      i,
      options
    );
  }

  const { labels, count } = labelComponents(
    width,
    height,
    i => typeMap[i] !== TYPE_IDS.ocean,
    (i, j) => typeMap[i] === typeMap[j]
  );

  const stats = computeComponentStats(width, height, labels);

  const oceanBorder = new Int32Array(count + 1);
  const landBorder = new Int32Array(count + 1);
  const sumElev = new Float64Array(count + 1);
  const regionType = new Uint8Array(count + 1);

  for (let i = 0; i < size; i++) {
    const lbl = labels[i];
    if (lbl === 0) continue;
    if (regionType[lbl] === 0) regionType[lbl] = typeMap[i];
    sumElev[lbl] += elevation[i];
  }

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const lbl = labels[i];
      if (lbl === 0) continue;
      if (x + 1 < width) {
        const nl = labels[i + 1];
        if (nl === 0) oceanBorder[lbl]++;
        else if (nl !== lbl) landBorder[lbl]++;
      }
      if (y + 1 < height) {
        const nl = labels[i + width];
        if (nl === 0) oceanBorder[lbl]++;
        else if (nl !== lbl) landBorder[lbl]++;
      }
    }
  }

  const regions: DetectedRegion[] = [];
  const smallFragments: DetectedRegion[] = [];
  let regionCounter = 0;

  for (const [lbl, s] of stats) {
    const t = regionType[lbl];
    const ob = oceanBorder[lbl];
    const lb = landBorder[lbl];
    const centroid: [number, number] = [s.sumX / s.area, s.sumY / s.area];
    const count2 = s.area;

    if (t === TYPE_IDS.mountain && count2 < VOLCANO_MAX_AREA) {
      const avgE = sumElev[lbl] / count2;
      const totalBorder = ob + lb;
      if (avgE > VOLCANO_ABS_ELEV_MIN && (totalBorder === 0 || ob / totalBorder > 0.4)) {
        regions.push({
          key: `r${regionCounter++}`,
          type: 'volcano' as TerrainType,
          centroid,
          area: count2,
        });
        continue;
      }
    }

    if (
      count2 < ARCHIPELAGO_MAX_AREA &&
      count2 >= 5 &&
      ob > 0 &&
      (ob + lb === 0 || ob / (ob + lb) > 0.7)
    ) {
      smallFragments.push({
        key: `r${regionCounter++}`,
        type: 'archipelago' as TerrainType,
        centroid,
        area: count2,
      });
      continue;
    }

    if (count2 >= minArea) {
      regions.push({
        key: `r${regionCounter++}`,
        type: TYPE_NAMES[t] as TerrainType,
        centroid,
        area: count2,
      });
    } else if (count2 >= 5) {
      smallFragments.push({
        key: `r${regionCounter++}`,
        type: TYPE_NAMES[t] as TerrainType,
        centroid,
        area: count2,
      });
    }
  }

  if (smallFragments.length >= 3) {
    const CLUSTER_DIST = 30;
    const used = new Uint8Array(smallFragments.length);
    for (let i = 0; i < smallFragments.length; i++) {
      if (used[i]) continue;
      const cluster = [i];
      used[i] = 1;
      for (let j = i + 1; j < smallFragments.length; j++) {
        if (used[j]) continue;
        const dx = smallFragments[j].centroid[0] - smallFragments[i].centroid[0];
        const dy = smallFragments[j].centroid[1] - smallFragments[i].centroid[1];
        if (dx * dx + dy * dy < CLUSTER_DIST * CLUSTER_DIST) {
          cluster.push(j);
          used[j] = 1;
        }
      }
      if (cluster.length >= 3) {
        let cx = 0,
          cy = 0,
          ca = 0;
        for (const ci of cluster) {
          cx += smallFragments[ci].centroid[0] * smallFragments[ci].area;
          cy += smallFragments[ci].centroid[1] * smallFragments[ci].area;
          ca += smallFragments[ci].area;
        }
        regions.push({
          key: `r${regionCounter++}`,
          type: 'archipelago' as TerrainType,
          centroid: [cx / ca, cy / ca],
          area: ca,
        });
      }
    }
  }

  return regions;
}

// ════════════════════════════════════════════════════════════
// 编辑命令 + 撤销栈（AC-9.1, AC-9.2, BR-3）
// ════════════════════════════════════════════════════════════

export interface Command {
  readonly kind: string;
  undo(): void;
  redo(): void;
}

/**
 * 撤销/重做栈。max=50（BR-3）。新编辑清空 redo 栈。
 */
export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly max: number;

  constructor(max: number = 50) {
    this.max = max;
  }

  push(cmd: Command): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.max) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.redo();
    this.undoStack.push(cmd);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get undoDepth(): number {
    return this.undoStack.length;
  }
  get redoDepth(): number {
    return this.redoStack.length;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ── 画笔 ──
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
export type VectorTarget = 'sea' | 'land' | 'lake';

/** 高斯衰减（中心 1，边缘趋近 0） */
function gaussianFalloff(dist: number, radius: number): number {
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
/** 点到线段最短距离 */
function pointToSegmentDist(
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
