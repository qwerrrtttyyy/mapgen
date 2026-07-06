/**
 * 流域分析：排水盆地划分 + Strahler 河序 + 大陆分水岭。
 *
 * 性能优化要点：
 *   1. BFS 时同时收集每个盆地的像素列表，合并小盆地时仅遍历该列表
 *   2. 反向流图用扁平数组 + 计数器代替链表
 *   3. D8 流向用 switch 代替 Array.find
 *   4. 小盆地合并用邻接统计，不全量扫描
 */

export interface WatershedInput {
  width: number;
  height: number;
  elevation: Float32Array;
  seaLevel: number;
  riverMask?: Float32Array;
  lakeMask?: Float32Array;
  skipStreamOrder?: boolean;
  minBasinArea?: number;
}

export interface WatershedResult {
  flowDir: Uint8Array;
  basinId: Int32Array;
  basinCount: number;
  streamOrder: Uint8Array;
  isDivide: Uint8Array;
  basinOutlets: Array<{ basinId: number; x: number; y: number }>;
  basinAreas: Int32Array;
}

// D8 方向编码
const D8_E  = 1, D8_SE = 2, D8_S = 4, D8_SW = 8;
const D8_W  = 16, D8_NW = 32, D8_N = 64, D8_NE = 128;

// D8 偏移表（索引 0..7 对应 8 个方向）
const DX = [1, 1, 0, -1, -1, -1, 0, 1] as const;
const DY = [0, 1, 1, 1, 0, -1, -1, -1] as const;
const DIR = [D8_E, D8_SE, D8_S, D8_SW, D8_W, D8_NW, D8_N, D8_NE] as const;
const DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2] as const;

/** D8 方向 → 偏移表索引 */
function dirToIndex(d: number): number {
  switch (d) {
    case D8_E: return 0; case D8_SE: return 1; case D8_S: return 2; case D8_SW: return 3;
    case D8_W: return 4; case D8_NW: return 5; case D8_N: return 6; case D8_NE: return 7;
    default: return -1;
  }
}

/**
 * D8 流向：每像素找最陡下降邻居。
 * 优化：内循环用 switch 索引代替 Array.find。
 */
function computeFlowDirection(
  width: number, height: number,
  elevation: Float32Array, seaLevel: number,
  lakeMask: Float32Array | undefined,
): Uint8Array {
  const size = width * height;
  const flowDir = new Uint8Array(size);
  const hasLake = !!lakeMask;
  const lakeThreshold = seaLevel + 0.05;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel) continue;
      if (hasLake && lakeMask![idx] > 0.5) continue;

      const elevHere = elevation[idx];
      let maxDrop = 0;
      let bestDir = 0;

      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        const ne = elevation[ni];
        const target = hasLake && lakeMask![ni] > 0.5 ? Math.min(ne, lakeThreshold) : ne;
        const drop = (elevHere - target) / DIST[d];
        if (drop > maxDrop) {
          maxDrop = drop;
          bestDir = DIR[d];
        }
      }
      flowDir[idx] = bestDir;
    }
  }
  return flowDir;
}

/**
 * 盆地划分：反向 BFS + 像素追踪。
 * 优化：BFS 时收集每个盆地的像素列表（用于后续小盆地合并）。
 */
function partitionBasins(
  width: number, height: number,
  elevation: Float32Array, seaLevel: number,
  flowDir: Uint8Array,
  minArea: number,
): { basinId: Int32Array; basinCount: number; outlets: Array<{ basinId: number; x: number; y: number }>; areas: Int32Array } {
  const size = width * height;
  const basinId = new Int32Array(size).fill(-1);

  // 构建反向流图：每个像素的上游列表
  // 用扁平数组 + 计数器（比链表更 cache-friendly）
  const upCount = new Int32Array(size); // 每个像素的上游数量
  for (let i = 0; i < size; i++) {
    const d = flowDir[i];
    if (d === 0) continue;
    const di = dirToIndex(d);
    if (di < 0) continue;
    const x = i % width, y = (i / width) | 0;
    const nx = x + DX[di], ny = y + DY[di];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    upCount[ny * width + nx]++;
  }

  // 前缀和 → 每个像素在扁平上游数组中的起始位置
  const upOffset = new Int32Array(size + 1);
  for (let i = 0; i < size; i++) upOffset[i + 1] = upOffset[i] + upCount[i];
  const totalUp = upOffset[size];
  const upstream = new Int32Array(totalUp);
  // 临时计数器（填充时用）
  const fillPos = new Int32Array(upOffset);

  for (let i = 0; i < size; i++) {
    const d = flowDir[i];
    if (d === 0) continue;
    const di = dirToIndex(d);
    if (di < 0) continue;
    const x = i % width, y = (i / width) | 0;
    const nx = x + DX[di], ny = y + DY[di];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const down = ny * width + nx;
    upstream[fillPos[down]++] = i;
  }

  // 收集海岸出口
  const outlets: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (elevation[ny * width + nx] <= seaLevel) { outlets.push(idx); break; }
      }
    }
  }

  // 多源 BFS：每个出口是一个盆地种子
  // 同时收集每个盆地的像素列表
  let basinCount = 0;
  const basinOutlets: Array<{ basinId: number; x: number; y: number }> = [];
  const basinPixels: number[][] = []; // basinPixels[basinId] = [pixel indices]
  const queue = new Int32Array(size); // 预分配队列
  let qHead = 0, qTail = 0;

  for (let oi = 0; oi < outlets.length; oi++) {
    const idx = outlets[oi];
    if (basinId[idx] !== -1) continue;

    const id = basinCount++;
    basinId[idx] = id;
    basinOutlets.push({ basinId: id, x: idx % width, y: (idx / width) | 0 });

    // BFS
    const pixels: number[] = [idx];
    qHead = 0; qTail = 0;
    queue[qTail++] = idx;

    while (qHead < qTail) {
      const cur = queue[qHead++];
      const start = upOffset[cur], end = upOffset[cur + 1];
      for (let j = start; j < end; j++) {
        const up = upstream[j];
        if (basinId[up] === -1) {
          basinId[up] = id;
          queue[qTail++] = up;
          pixels.push(up);
        }
      }
    }
    basinPixels.push(pixels);
  }

  // 计算面积
  const areas = new Int32Array(basinCount);
  for (let b = 0; b < basinCount; b++) areas[b] = basinPixels[b].length;

  // 合并小盆地：仅遍历该盆地的像素列表，统计邻居盆地
  if (minArea > 0) {
    // 需要多次迭代，因为合并后可能产生新的小盆地
    let changed = true;
    while (changed) {
      changed = false;
      for (let b = 0; b < basinCount; b++) {
        if (areas[b] >= minArea || areas[b] === 0) continue;

        // 统计该盆地像素的邻居盆地
        const neighborCount = new Map<number, number>();
        const pixels = basinPixels[b];
        for (let pi = 0; pi < pixels.length; pi++) {
          const i = pixels[pi];
          const x = i % width, y = (i / width) | 0;
          for (let d = 0; d < 4; d++) { // 4-邻接足够
            const nx = x + DX[d], ny = y + DY[d];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nb = basinId[ny * width + nx];
            if (nb >= 0 && nb !== b) {
              neighborCount.set(nb, (neighborCount.get(nb) ?? 0) + 1);
            }
          }
        }

        let maxNeighbor = -1, maxCount = 0;
        for (const [nb, cnt] of neighborCount) {
          if (cnt > maxCount) { maxCount = cnt; maxNeighbor = nb; }
        }
        if (maxNeighbor === -1) continue;

        // 合并到 maxNeighbor
        const pixels_b = basinPixels[b];
        for (let pi = 0; pi < pixels_b.length; pi++) {
          basinId[pixels_b[pi]] = maxNeighbor;
        }
        basinPixels[maxNeighbor].push(...pixels_b);
        areas[maxNeighbor] += areas[b];
        areas[b] = 0;
        basinPixels[b] = [];
        changed = true;
      }
    }
  }

  return { basinId, basinCount, outlets: basinOutlets, areas };
}

/**
 * Strahler 河序：拓扑排序 + 动态规划。
 * 优化：内循环用索引代替 Array.find。
 */
function computeStrahlerOrder(
  width: number, height: number,
  flowDir: Uint8Array,
  riverMask: Float32Array | undefined,
  seaLevel: number,
  elevation: Float32Array,
): Uint8Array {
  const size = width * height;
  const order = new Uint8Array(size);
  if (!riverMask) return order;

  const isRiver = (i: number) => riverMask[i] > 0.2 && elevation[i] > seaLevel;

  // 构建反向流图（仅河道像素）
  const upCount = new Int32Array(size);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (!isRiver(idx)) continue;
      const d = flowDir[idx];
      if (d === 0) continue;
      const di = dirToIndex(d);
      if (di < 0) continue;
      const nx = x + DX[di], ny = y + DY[di];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const down = ny * width + nx;
      if (isRiver(down)) upCount[down]++;
    }
  }

  const upOffset = new Int32Array(size + 1);
  for (let i = 0; i < size; i++) upOffset[i + 1] = upOffset[i] + upCount[i];
  const upstream = new Int32Array(upOffset[size]);
  const fillPos = new Int32Array(upOffset);

  const inDegree = new Int32Array(size);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (!isRiver(idx)) continue;
      const d = flowDir[idx];
      if (d === 0) continue;
      const di = dirToIndex(d);
      if (di < 0) continue;
      const nx = x + DX[di], ny = y + DY[di];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const down = ny * width + nx;
      if (!isRiver(down)) continue;
      upstream[fillPos[down]++] = idx;
      inDegree[down]++;
    }
  }

  // 拓扑排序
  const queue = new Int32Array(size);
  let qHead = 0, qTail = 0;
  for (let i = 0; i < size; i++) {
    if (isRiver(i) && inDegree[i] === 0) {
      order[i] = 1;
      queue[qTail++] = i;
    }
  }

  while (qHead < qTail) {
    const cur = queue[qHead++];
    const d = flowDir[cur];
    if (d === 0) continue;
    const di = dirToIndex(d);
    if (di < 0) continue;
    const x = cur % width, y = (cur / width) | 0;
    const nx = x + DX[di], ny = y + DY[di];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const downstream = ny * width + nx;
    if (!isRiver(downstream)) continue;

    // Strahler：统计同级上游
    let curMax = 0, sameMaxCount = 0;
    const start = upOffset[downstream], end = upOffset[downstream + 1];
    for (let j = start; j < end; j++) {
      const uo = order[upstream[j]];
      if (uo > curMax) { curMax = uo; sameMaxCount = 1; }
      else if (uo === curMax) sameMaxCount++;
    }
    order[downstream] = sameMaxCount >= 2 ? curMax + 1 : curMax;

    inDegree[downstream]--;
    if (inDegree[downstream] === 0) queue[qTail++] = downstream;
  }

  // 钳制
  for (let i = 0; i < size; i++) {
    if (order[i] > 7) order[i] = 7;
  }
  return order;
}

/** 标记分水岭 */
function markDivides(
  width: number, height: number,
  basinId: Int32Array, elevation: Float32Array, seaLevel: number,
): Uint8Array {
  const size = width * height;
  const isDivide = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel || basinId[idx] < 0) continue;
      const myBasin = basinId[idx];
      if ((x > 0 && basinId[idx - 1] >= 0 && basinId[idx - 1] !== myBasin) ||
          (x < width - 1 && basinId[idx + 1] >= 0 && basinId[idx + 1] !== myBasin) ||
          (y > 0 && basinId[idx - width] >= 0 && basinId[idx - width] !== myBasin) ||
          (y < height - 1 && basinId[idx + width] >= 0 && basinId[idx + width] !== myBasin)) {
        isDivide[idx] = 1;
      }
    }
  }
  return isDivide;
}

/** 流域分析主入口 */
export function computeWatershed(input: WatershedInput): WatershedResult {
  const { width, height, elevation, seaLevel } = input;
  const minArea = input.minBasinArea ?? 30;

  const flowDir = computeFlowDirection(width, height, elevation, seaLevel, input.lakeMask);
  const basins = partitionBasins(width, height, elevation, seaLevel, flowDir, minArea);
  const streamOrder = input.skipStreamOrder
    ? new Uint8Array(width * height)
    : computeStrahlerOrder(width, height, flowDir, input.riverMask, seaLevel, elevation);
  const isDivide = markDivides(width, height, basins.basinId, elevation, seaLevel);

  return {
    flowDir,
    basinId: basins.basinId,
    basinCount: basins.basinCount,
    streamOrder,
    isDivide,
    basinOutlets: basins.outlets,
    basinAreas: basins.areas,
  };
}
