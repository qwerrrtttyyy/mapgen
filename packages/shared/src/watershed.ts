// 流域分析：排水盆地划分 + Strahler 河序 + 大陆分水岭。
// 输入：高程场 + 海平面 + 河流遮罩
// 输出：
//   1. basinId — 每个陆地像素归属的排水盆地编号（同盆地水流汇聚到同一出口）
//   2. streamOrder — Strahler 河流分级（1=源头, 4=大河, 7=巨型河流如亚马逊）
//   3. isDivide — 大陆分水岭标记（不同盆地的边界像素，山顶/山脊）
//   4. flowDir — 每个像素的水流方向（4/8 邻接，向下游）
//
// 算法：
//   1. 计算每个像素的 steepest-descent 流向（D8 法）
//   2. 从海岸/海洋像素反向 BFS，按盆地划分（每个海岸出口对应一个盆地）
//   3. Strahler 河序：从源头起算，同级汇合 +1
//   4. 分水岭：basinId 不同的相邻像素为分水岭
//
// 用途：
//   - editor.ts detectTerrainRegions 标注大河流域/分水岭
//   - 名称叠加层显示主要河流名（按 streamOrder 过滤）
//   - 可视化：分水岭叠加等高线效果

export interface WatershedInput {
  width: number;
  height: number;
  elevation: Float32Array;
  seaLevel: number;
  /** 河流遮罩 [0,1]（用于 Strahler 河序仅对河道计算） */
  riverMask?: Float32Array;
  /** 湖泊遮罩（湖泊视为局部汇，水流进入湖泊后视为终端） */
  lakeMask?: Float32Array;
  /** 仅生成 basinId 时跳过 Strahler 计算（性能优化） */
  skipStreamOrder?: boolean;
  /** 盆地最小面积阈值（像素数 < 此值的盆地合并到邻居） */
  minBasinArea?: number;
}

export interface WatershedResult {
  /** 流向（D8 编码：1=E,2=SE,4=S,8=SW,16=W,32=NW,64=N,128=NE，0=终端/海洋） */
  flowDir: Uint8Array;
  /** 排水盆地编号（同盆地像素同号，海洋为 -1） */
  basinId: Int32Array;
  /** 盆地数量 */
  basinCount: number;
  /** Strahler 河流分级 [0,7]（仅 riverMask > 阈值的像素） */
  streamOrder: Uint8Array;
  /** 大陆分水岭标记（1=分水岭像素，0=否） */
  isDivide: Uint8Array;
  /** 每个盆地的出口坐标（海岸交点） */
  basinOutlets: Array<{ basinId: number; x: number; y: number }>;
  /** 每个盆地的面积（像素数） */
  basinAreas: Int32Array;
}

// D8 方向编码（bit 位）
const D8_E = 1;
const D8_SE = 2;
const D8_S = 4;
const D8_SW = 8;
const D8_W = 16;
const D8_NW = 32;
const D8_N = 64;
const D8_NE = 128;

const D8_OFFSETS: Array<{ dir: number; dx: number; dy: number; dist: number }> = [
  { dir: D8_E, dx: 1, dy: 0, dist: 1 },
  { dir: D8_SE, dx: 1, dy: 1, dist: Math.SQRT2 },
  { dir: D8_S, dx: 0, dy: 1, dist: 1 },
  { dir: D8_SW, dx: -1, dy: 1, dist: Math.SQRT2 },
  { dir: D8_W, dx: -1, dy: 0, dist: 1 },
  { dir: D8_NW, dx: -1, dy: -1, dist: Math.SQRT2 },
  { dir: D8_N, dx: 0, dy: -1, dist: 1 },
  { dir: D8_NE, dx: 1, dy: -1, dist: Math.SQRT2 },
];

/**
 * D8 流向计算：每像素找最陡下降邻居。
 * 平坦区：找最低邻居（若全平则流向为 0）
 */
function computeFlowDirection(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  lakeMask: Float32Array | undefined
): Uint8Array {
  const size = width * height;
  const flowDir = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // 海洋/湖泊 = 终端
      if (elevation[idx] <= seaLevel) continue;
      if (lakeMask && lakeMask[idx] > 0.5) continue;

      const elevHere = elevation[idx];
      let maxDrop = 0;
      let bestDir = 0;
      for (const off of D8_OFFSETS) {
        const nx = x + off.dx,
          ny = y + off.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        const ne = elevation[ni];
        // 湖泊视为水平面（以湖面高程 = 这里简化为 seaLevel+0.05）
        const target = lakeMask && lakeMask[ni] > 0.5 ? Math.min(ne, seaLevel + 0.05) : ne;
        const drop = (elevHere - target) / off.dist;
        if (drop > maxDrop) {
          maxDrop = drop;
          bestDir = off.dir;
        }
      }
      flowDir[idx] = bestDir;
    }
  }
  return flowDir;
}

/**
 * 反向 BFS 从海岸出口出发，划分排水盆地。
 * 海岸像素 = 陆地像素中至少有一个海洋邻居的像素。
 * 同一盆地内：从出口出发，沿流向反向遍历可达的所有像素。
 */
function partitionBasins(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  flowDir: Uint8Array,
  minArea: number
): {
  basinId: Int32Array;
  basinCount: number;
  outlets: Array<{ basinId: number; x: number; y: number }>;
  areas: Int32Array;
} {
  const size = width * height;
  const basinId = new Int32Array(size).fill(-1);
  // 海洋像素 basinId = -1（不归属任何陆地盆地）
  // 湖泊像素 basinId = -2（独立终端，不参与盆地划分）

  // 收集所有海岸出口（陆地像素且至少一个邻居是海洋）
  const outlets: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (elevation[idx] <= seaLevel) continue; // 仅陆地
      let isOutlet = false;
      for (const off of D8_OFFSETS) {
        const nx = x + off.dx,
          ny = y + off.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (elevation[ni] <= seaLevel) {
          isOutlet = true;
          break;
        }
      }
      if (isOutlet) outlets.push(idx);
    }
  }

  // 构造反向流图：对每个像素，记录哪些邻居流向它
  // 用一个数组按像素存"上游列表头"，再用链表串联（节省内存）
  const upstreamHead = new Int32Array(size).fill(-1);
  const upstreamNext = new Int32Array(size);
  const upstreamOf = new Int32Array(size); // 链表中存的是"上游像素 idx"
  let linkCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const d = flowDir[idx];
      if (d === 0) continue;
      // 反向找：流向 d 对应的下游像素
      const off = D8_OFFSETS.find(o => o.dir === d);
      if (!off) continue;
      const nx = x + off.dx,
        ny = y + off.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const downstream = ny * width + nx;
      // 把 idx 加到 downstream 的上游链表
      upstreamOf[linkCount] = idx;
      upstreamNext[linkCount] = upstreamHead[downstream];
      upstreamHead[downstream] = linkCount;
      linkCount++;
    }
  }

  // 多源 BFS：每个海岸出口是一个盆地种子，反向 BFS 上溯
  let basinCount = 0;
  const basinOutlets: Array<{ basinId: number; x: number; y: number }> = [];
  const queue: number[] = [];

  for (let i = 0; i < outlets.length; i++) {
    const idx = outlets[i];
    if (basinId[idx] !== -1) continue; // 已被其他出口 BFS 到达
    const id = basinCount++;
    basinId[idx] = id;
    basinOutlets.push({ basinId: id, x: idx % width, y: (idx / width) | 0 });
    queue.length = 0;
    queue.push(idx);
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      let link = upstreamHead[cur];
      while (link !== -1) {
        const up = upstreamOf[link];
        if (basinId[up] === -1) {
          basinId[up] = id;
          queue.push(up);
        }
        link = upstreamNext[link];
      }
    }
  }

  // 计算每个盆地面积
  const areas = new Int32Array(basinCount);
  for (let i = 0; i < size; i++) {
    const b = basinId[i];
    if (b >= 0) areas[b]++;
  }

  // 合并小盆地到最大邻居盆地（< minArea）
  if (minArea > 0) {
    for (let b = 0; b < basinCount; b++) {
      if (areas[b] >= minArea) continue;
      // 找该盆地所有像素的最大邻居盆地
      const neighborCount = new Map<number, number>();
      for (let i = 0; i < size; i++) {
        if (basinId[i] !== b) continue;
        const x = i % width,
          y = (i / width) | 0;
        for (const off of D8_OFFSETS) {
          const nx = x + off.dx,
            ny = y + off.dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nb = basinId[ny * width + nx];
          if (nb >= 0 && nb !== b) {
            neighborCount.set(nb, (neighborCount.get(nb) ?? 0) + 1);
          }
        }
      }
      let maxNeighbor = -1,
        maxCount = 0;
      for (const [nb, cnt] of neighborCount) {
        if (cnt > maxCount) {
          maxCount = cnt;
          maxNeighbor = nb;
        }
      }
      if (maxNeighbor === -1) continue;
      // 重映射
      for (let i = 0; i < size; i++) {
        if (basinId[i] === b) basinId[i] = maxNeighbor;
      }
      areas[maxNeighbor] += areas[b];
      areas[b] = 0;
    }
  }

  return { basinId, basinCount, outlets: basinOutlets, areas };
}

/**
 * Strahler 河序：递归从源头起算。
 *   - 源头（无上游河段）= 1
 *   - 当 ≥2 条同级 i 河段汇合 → i+1
 *   - 不同级汇合 → 取大者
 *
 * 仅在 riverMask > 阈值的河道像素上计算，使用流向的反向拓扑。
 */
function computeStrahlerOrder(
  width: number,
  height: number,
  flowDir: Uint8Array,
  riverMask: Float32Array | undefined,
  seaLevel: number,
  elevation: Float32Array
): Uint8Array {
  const size = width * height;
  const order = new Uint8Array(size);
  if (!riverMask) return order;

  // 仅河道像素参与计算
  const isRiver = (i: number): boolean => riverMask[i] > 0.2 && elevation[i] > seaLevel;

  // 拓扑序：先计算入度（上游河道数），入度=0 为源头
  const inDegree = new Int32Array(size);
  const upstreamHead = new Int32Array(size).fill(-1);
  const upstreamNext = new Int32Array(size);
  const upstreamOf = new Int32Array(size);
  let linkCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isRiver(idx)) continue;
      const d = flowDir[idx];
      if (d === 0) continue;
      const off = D8_OFFSETS.find(o => o.dir === d);
      if (!off) continue;
      const nx = x + off.dx,
        ny = y + off.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const downstream = ny * width + nx;
      if (!isRiver(downstream)) continue; // 下游非河道（如入海）
      upstreamOf[linkCount] = idx;
      upstreamNext[linkCount] = upstreamHead[downstream];
      upstreamHead[downstream] = linkCount;
      linkCount++;
      inDegree[downstream]++;
    }
  }

  // 拓扑排序：源头入队（order=1），按拓扑序处理
  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    if (isRiver(i) && inDegree[i] === 0) {
      order[i] = 1;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = flowDir[cur];
    if (d === 0) continue;
    const off = D8_OFFSETS.find(o => o.dir === d);
    if (!off) continue;
    const x = cur % width,
      y = (cur / width) | 0;
    const nx = x + off.dx,
      ny = y + off.dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const downstream = ny * width + nx;
    if (!isRiver(downstream)) continue;
    // Strahler 规则：统计同级上游数
    let curMax = 0;
    let sameMaxCount = 0;
    let link = upstreamHead[downstream];
    while (link !== -1) {
      const up = upstreamOf[link];
      const uo = order[up];
      if (uo > curMax) {
        curMax = uo;
        sameMaxCount = 1;
      } else if (uo === curMax) sameMaxCount++;
      link = upstreamNext[link];
    }
    order[downstream] = sameMaxCount >= 2 ? curMax + 1 : curMax;
    inDegree[downstream]--;
    if (inDegree[downstream] === 0) queue.push(downstream);
  }

  // 钳制到 [0,7]
  for (let i = 0; i < size; i++) {
    if (order[i] > 7) order[i] = 7;
  }
  return order;
}

/** 标记分水岭：basinId 不同的相邻像素均为分水岭 */
function markDivides(
  width: number,
  height: number,
  basinId: Int32Array,
  elevation: Float32Array,
  seaLevel: number
): Uint8Array {
  const size = width * height;
  const isDivide = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (elevation[idx] <= seaLevel) continue;
      if (basinId[idx] < 0) continue;
      const myBasin = basinId[idx];
      let isDiv = false;
      // 4-邻接检查（更细的 8-邻接会过度标记）
      if (x > 0) {
        const nb = basinId[idx - 1];
        if (nb >= 0 && nb !== myBasin) isDiv = true;
      }
      if (x < width - 1) {
        const nb = basinId[idx + 1];
        if (nb >= 0 && nb !== myBasin) isDiv = true;
      }
      if (y > 0) {
        const nb = basinId[idx - width];
        if (nb >= 0 && nb !== myBasin) isDiv = true;
      }
      if (y < height - 1) {
        const nb = basinId[idx + width];
        if (nb >= 0 && nb !== myBasin) isDiv = true;
      }
      if (isDiv) isDivide[idx] = 1;
    }
  }
  return isDivide;
}

/** 流域分析主入口 */
export function computeWatershed(input: WatershedInput): WatershedResult {
  const { width, height, elevation, seaLevel } = input;
  const minArea = input.minBasinArea ?? 30;

  // 1. 流向
  const flowDir = computeFlowDirection(width, height, elevation, seaLevel, input.lakeMask);

  // 2. 盆地划分
  const basins = partitionBasins(width, height, elevation, seaLevel, flowDir, minArea);

  // 3. Strahler 河序
  const streamOrder = input.skipStreamOrder
    ? new Uint8Array(width * height)
    : computeStrahlerOrder(width, height, flowDir, input.riverMask, seaLevel, elevation);

  // 4. 分水岭
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
