// 火山系统：热点火山链 + 板缘火山 + 概率场 + 破火山口。
//
// 火山类型：
//   1. 热点（地幔柱）：板块漂移经过固定热点，形成年龄递增的火山链（如夏威夷-皇帝海山链）
//      - 每个热点固定位置，板块从西向东漂移 → 越东越年轻、越大
//   2. 俯冲带火山：汇聚板块边界（板块构造 boundaryType=1）上的火山弧（如安第斯山、日本）
//      - 沿边界呈线状分布，俯冲带越长火山越多
//   3. 洋中脊火山：离散边界（boundaryType=2）的中央裂谷火山
//   4. 裂谷火山：转换边界（boundaryType=3）的局部火山
//
// 输出：
//   - volcanoProb: 每像素火山概率 [0,1]
//   - hotspots: 热点中心坐标列表（用于命名）
//   - volcanoSites: 检测出的具体火山位置（高于阈值且为局部极大）
//   - calderaMask: 破火山口标记（大火山口的环形凹陷区）
//
// 用途：
//   - editor.ts detectTerrainRegions 用 volcanoProb 强化 volcano 类型检测
//   - naming.ts 给火山命名
//   - 可视化叠加火山标记

import type { Plate } from './tectonic.js';

export interface VolcanismInput {
  width: number;
  height: number;
  elevation: Float32Array;
  seaLevel: number;
  /** 板块 ID 场（每像素所属板块） */
  plateId: Float32Array;
  /** 板块列表（含漂移方向） */
  plates: Plate[];
  /** 构造边界（boundary[i]>0 表示 i 是边界像素） */
  boundary: Float32Array;
  /** 边界类型（1=汇聚,2=离散,3=转换） */
  boundaryType?: Float32Array;
  /** 热点数量（建议 1~5） */
  hotspotCount?: number;
  /** 火山概率场强度系数（0=关闭, 1=标准, 2=狂暴） */
  intensity?: number;
  seed: number;
}

export interface VolcanoSite {
  x: number;
  y: number;
  /** 火山类型：hotspot/arc/ridge/rift */
  kind: 'hotspot' | 'arc' | 'ridge' | 'rift';
  /** 喷发强度 [0,1]（影响是否形成破火山口） */
  strength: number;
  /** 关联热点 ID（仅 kind=hotspot） */
  hotspotId?: number;
}

export interface Hotspot {
  id: number;
  x: number;
  y: number;
  /** 热点强度（决定火山链规模） */
  strength: number;
}

export interface VolcanismResult {
  /** 每像素火山概率 [0,1]（叠加热点+板缘+洋脊） */
  volcanoProb: Float32Array;
  /** 热点列表 */
  hotspots: Hotspot[];
  /** 检测出的具体火山位置（峰值） */
  volcanoSites: VolcanoSite[];
  /** 破火山口标记（1=破火山口环形凹陷） */
  calderaMask: Uint8Array;
}

// xorshift32 PRNG（轻量确定性）
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * 计算火山概率场并检测火山位置。
 *
 * 算法：
 * 1. 热点：在地幔柱固定位置（高斯衰减），向板块漂移方向延伸成火山链
 * 2. 板缘：汇聚边界为火山弧（高概率带），离散边界为洋中脊（中等概率）
 * 3. 局部极大值检测：概率 + 海拔双阈值 → 具体火山位置
 * 4. 破火山口：大火山位置周围环形凹陷
 */
export function computeVolcanism(input: VolcanismInput): VolcanismResult {
  const { width, height, elevation, seaLevel, plateId, plates, boundary, seed } = input;
  const size = width * height;
  const intensity = input.intensity ?? 1;
  const hotspotCount = input.hotspotCount ?? 3;
  const rng = makeRng(seed ^ 0x5c7a);

  const volcanoProb = new Float32Array(size);
  const calderaMask = new Uint8Array(size);
  const hotspots: Hotspot[] = [];
  const volcanoSites: VolcanoSite[] = [];

  if (intensity <= 0) {
    return { volcanoProb, hotspots, volcanoSites, calderaMask };
  }

  // ── 1. 热点 + 火山链 ──
  // 随机选 hotspotCount 个热点位置（偏向海洋，但陆地上也可有）
  for (let h = 0; h < hotspotCount; h++) {
    const hx = Math.floor(rng() * width);
    const hy = Math.floor(rng() * height);
    const strength = 0.6 + rng() * 0.4; // 0.6~1.0
    hotspots.push({ id: h, x: hx, y: hy, strength });

    // 高斯衰减半径
    const R = 8;
    const sigma2 = R * R * 0.5;

    // 找该位置所属板块的漂移方向
    const pid = Math.round(plateId[hy * width + hx]);
    const plate = plates[pid] ?? plates[0];
    // 板块漂移方向（vx, vy 归一化）
    let pvx = 1,
      pvy = 0;
    if (plate) {
      const vx = plate.vx,
        vy = plate.vy;
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag > 1e-4) {
        pvx = vx / mag;
        pvy = vy / mag;
      }
    }

    // 沿漂移反方向（板块从反方向移动过来）画火山链
    const chainLength = 60; // 火山链长度（像素）
    const ageStep = 0.02; // 每像素年龄增量（越远越老 → 越小）
    for (let step = -chainLength; step <= chainLength; step++) {
      const cx = Math.round(hx - pvx * step);
      const cy = Math.round(hy - pvy * step);
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
      // 越接近热点越年轻、强度越大
      const age = Math.abs(step) * ageStep;
      const youthFactor = Math.max(0, 1 - age);
      const peak = strength * youthFactor * intensity;
      // 高斯涂抹
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const nx = cx + dx,
            ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          const gauss = Math.exp(-d2 / (2 * sigma2));
          const ni = ny * width + nx;
          volcanoProb[ni] = Math.max(volcanoProb[ni], peak * gauss);
        }
      }
    }
  }

  // ── 2. 板缘火山弧 ──
  // 汇聚边界：高概率带（火山弧）
  // 离散边界：中等概率（洋中脊）
  // 转换边界：低概率（裂谷）
  const btArr = input.boundaryType;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (boundary[idx] <= 0) continue;
      let prob = 0;
      if (btArr) {
        const t = btArr[idx];
        if (t === 1)
          prob = 0.7 * intensity; // 汇聚 → 火山弧
        else if (t === 2)
          prob = 0.35 * intensity; // 离散 → 洋中脊
        else if (t === 3) prob = 0.15 * intensity; // 转换 → 裂谷
      } else {
        prob = 0.4 * intensity;
      }
      // 涂抹到 5 像素半径
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          const falloff = 1 - Math.sqrt(dx * dx + dy * dy) / 3;
          if (falloff > 0) {
            volcanoProb[ni] = Math.max(volcanoProb[ni], prob * falloff);
          }
        }
      }
    }
  }

  // ── 3. 检测具体火山位置 ──
  // 高概率 + 高海拔 + 局部极大值 → 火山
  const PROB_THRESHOLD = 0.35;
  const ELEV_THRESHOLD = seaLevel + 0.25;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (volcanoProb[idx] < PROB_THRESHOLD) continue;
      if (elevation[idx] < ELEV_THRESHOLD) continue;
      // 局部极大值检测（5×5 窗口）
      const e = elevation[idx];
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++) {
        for (let dx = -2; dx <= 2 && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = (y + dy) * width + (x + dx);
          if (elevation[ni] > e + 0.005) isMax = false;
        }
      }
      if (!isMax) continue;
      // 分类火山类型
      let kind: VolcanoSite['kind'] = 'arc';
      let hotspotId: number | undefined;
      if (boundary[idx] > 0) {
        const t = btArr ? btArr[idx] : 0;
        if (t === 2) kind = 'ridge';
        else if (t === 3) kind = 'rift';
        else kind = 'arc';
      } else {
        // 找最近热点
        let minD2 = Infinity,
          nearestH = -1;
        for (const h of hotspots) {
          const dx = h.x - x,
            dy = h.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < minD2) {
            minD2 = d2;
            nearestH = h.id;
          }
        }
        if (minD2 < 100) {
          kind = 'hotspot';
          hotspotId = nearestH;
        }
      }
      const strength = Math.min(1, volcanoProb[idx] * (1 + (e - seaLevel) * 0.5));
      volcanoSites.push({ x, y, kind, strength, hotspotId });

      // 强火山 → 标记破火山口（中心凹陷 + 环形高地的简化标记）
      if (strength > 0.65) {
        const calderaR = 3;
        for (let dy = -calderaR; dy <= calderaR; dy++) {
          for (let dx = -calderaR; dx <= calderaR; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < calderaR * 0.4) {
              // 中心破火山口（标记，不修改 elevation，由 fs-map.frag 视觉强调）
              calderaMask[ny * width + nx] = 1;
            } else if (d < calderaR) {
              calderaMask[ny * width + nx] = 2; // 环
            }
          }
        }
      }
    }
  }

  return { volcanoProb, hotspots, volcanoSites, calderaMask };
}
