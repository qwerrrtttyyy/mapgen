/**
 * @module editor/terrainDetection
 * 地形区自动检测：山脉/高原/盆地/沙漠/森林/平原/冰川/三角洲/火山/群岛
 *
 * 从 editor.ts 拆分（P2-3）。基于高程、坡度、湿度 + 可选世界式数据
 * （landIce/coastDist/riverMask/volcanoProb/biomeId/streamOrder/basinId）
 * 检测地形类型，再用 4 邻接连通域标记聚合为区域。
 */

import type { TerrainType } from '../naming.js';
import { labelComponents, computeComponentStats } from '../connectedComponents.js';

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
export const SEA_TARGET_OFFSET = 0.3; // 海洋目标高程偏移
export const LAND_TARGET_ELEV = 0.2; // 陆地目标高程
export const LAKE_TARGET_OFFSET = 0.05; // 湖泊目标高程偏移

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
