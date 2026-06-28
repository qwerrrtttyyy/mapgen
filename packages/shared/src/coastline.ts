// 海岸距离场：多源 BFS 从所有海岸像素扩散。
// 陆地像素为正距离（向内陆增大），海洋像素为负距离（向远海减小）。
// 用途：
//   1. 大陆度修正温度（内陆冬冷夏热）—— regions.ts
//   2. 河口三角洲检测（河流出口 + 海岸邻近）—— editor.ts detectTerrainRegions
//   3. 洋流沿岸影响范围（仅影响 |coastDist| < 阈值的像素）—— regions.ts

/**
 * 多源 BFS 计算带符号海岸距离场。
 * 海岸定义：陆地像素与海洋像素 4-邻接的边界像素（陆地侧与海洋侧都标记为 0）。
 *
 * @param width       地图宽度
 * @param height      地图高度
 * @param elevation   高程场
 * @param seaLevel    海平面
 * @returns coastDist 陆地为正（向内陆增大），海洋为负（向远海减小），海岸为 0
 */
export function computeCoastDistance(
  width: number, height: number,
  elevation: Float32Array, seaLevel: number,
): Float32Array {
  const size = width * height;
  const coastDist = new Float32Array(size).fill(Infinity);
  // 用普通数组当队列；地图规模 <1M 像素时性能可接受
  const queue: number[] = [];

  // 第一遍：标记海岸像素（陆地-海洋边界两侧）为 0 并入队
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isLand = elevation[idx] > seaLevel;
      // 检查右、下邻居（左、上由对称覆盖）
      if (x < width - 1) {
        const right = elevation[idx + 1] > seaLevel;
        if (isLand !== right) {
          if (coastDist[idx] !== 0) { coastDist[idx] = 0; queue.push(idx); }
          const ni = idx + 1;
          if (coastDist[ni] !== 0) { coastDist[ni] = 0; queue.push(ni); }
        }
      }
      if (y < height - 1) {
        const down = elevation[idx + width] > seaLevel;
        if (isLand !== down) {
          if (coastDist[idx] !== 0) { coastDist[idx] = 0; queue.push(idx); }
          const ni = idx + width;
          if (coastDist[ni] !== 0) { coastDist[ni] = 0; queue.push(ni); }
        }
      }
    }
  }

  // 第二遍：BFS 多源扩散，带符号距离（陆地+1 / 海洋-1）
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cur = coastDist[idx];
    const sign = cur >= 0 ? 1 : -1; // 海岸 0 视为两侧都能扩散（陆地侧下一步+1，海洋侧下一步-1）
    const next = cur + sign;
    const x = idx % width, y = (idx / width) | 0;
    // 4-邻接
    if (x > 0) {
      const ni = idx - 1;
      if (coastDist[ni] === Infinity) {
        const niLand = elevation[ni] > seaLevel;
        // 0（海岸）两侧均可扩散；非零则仅同侧扩散
        if (cur === 0 || (sign > 0) === niLand) {
          coastDist[ni] = niLand ? Math.abs(next) : -Math.abs(next);
          queue.push(ni);
        }
      }
    }
    if (x < width - 1) {
      const ni = idx + 1;
      if (coastDist[ni] === Infinity) {
        const niLand = elevation[ni] > seaLevel;
        if (cur === 0 || (sign > 0) === niLand) {
          coastDist[ni] = niLand ? Math.abs(next) : -Math.abs(next);
          queue.push(ni);
        }
      }
    }
    if (y > 0) {
      const ni = idx - width;
      if (coastDist[ni] === Infinity) {
        const niLand = elevation[ni] > seaLevel;
        if (cur === 0 || (sign > 0) === niLand) {
          coastDist[ni] = niLand ? Math.abs(next) : -Math.abs(next);
          queue.push(ni);
        }
      }
    }
    if (y < height - 1) {
      const ni = idx + width;
      if (coastDist[ni] === Infinity) {
        const niLand = elevation[ni] > seaLevel;
        if (cur === 0 || (sign > 0) === niLand) {
          coastDist[ni] = niLand ? Math.abs(next) : -Math.abs(next);
          queue.push(ni);
        }
      }
    }
  }

  // 未访问的孤立区域（全陆地无海、或全海无陆）填 0 避免无穷大
  for (let i = 0; i < size; i++) {
    if (!Number.isFinite(coastDist[i])) coastDist[i] = 0;
  }

  return coastDist;
}

/**
 * 大陆度系数 [0, 1]：0=海岸，1=内陆深处。
 * 用于温度修正（内陆冬冷夏热，简化为整体偏冷 + 极端温差）。
 * @param coastDist 海岸距离场（陆地正）
 * @param maxDist   归一化距离阈值（典型 ~30 像素）
 */
export function continentalityFactor(coastDist: Float32Array, maxDist: number): Float32Array {
  const size = coastDist.length;
  const out = new Float32Array(size);
  const invMax = 1 / maxDist;
  for (let i = 0; i < size; i++) {
    const d = coastDist[i];
    if (d <= 0) { out[i] = 0; continue; }
    out[i] = Math.min(1, d * invMax);
  }
  return out;
}
