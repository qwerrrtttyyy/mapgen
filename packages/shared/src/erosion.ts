import { createNoise, type NoiseType, type FbmType } from './noise.js';
import type { Plate } from './tectonic.js';
import { computeSlope } from './slope.js';
import {
  CONTINENT_BASE_ELEVATION, CONTINENT_SHELF_DROP,
  OCEAN_BASE_DEPTH, OCEAN_ABYSS_DROP,
  LAND_RIDGED_WEIGHT, LAND_DETAIL_WEIGHT, OCEAN_DETAIL_WEIGHT,
  RIDGE_ACTIVATION_THRESHOLD, COAST_DETAIL_RANGE, COAST_DETAIL_MAX_OFFSET,
  BOUNDARY_SMOOTH_RADIUS, BOUNDARY_SMOOTH_PASSES,
  CONVERGENT_MOUNTAIN_SCALE, CONVERGENT_NOISE_OFFSET, DIVERGENT_RIFT_SCALE,
  EROSION_WATER_INCREMENT, EROSION_SLOPE_CAPACITY_FACTOR,
  EROSION_STEP_FRACTION, EROSION_WATER_TRANSFER,
  EROSION_DEFAULT_EVAPORATION, EROSION_MAX_CHANGE_THRESHOLD,
  LAKE_MAX_ELEV_ABOVE_SEA, LAKE_FILL_RADIUS,
} from './constants.js';

const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

export function generateElevation(
  width: number, height: number, seed: number, plateId: Float32Array, plates: Plate[],
  plateDist: Float32Array, tectonicForce: Float32Array,
  noiseType: NoiseType, fbmType: FbmType, octaves: number, lacunarity: number, persistence: number, seaLevel: number,
  mountainFold: number, coastDetail: number
): { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array } {
  const size = width * height;
  const elevation = new Float32Array(size);
  const ridge = new Float32Array(size);
  const ridgeMask = new Float32Array(size);
  const noise = createNoise(seed, noiseType);
  const detailNoise = createNoise(seed + 1, 'simplex');
  const ridgeNoise = createNoise(seed + 999, 'perlin');

  const plateTypes = new Uint8Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateTypes[i] = plates[i].type === 'continent' ? 1 : 0;
  }

  // 预计算每个板块的归一化距离（0=中心, 1=边缘）
  // plateDist 是到板块中心的欧氏距离，需估计各板块的最大距离用于归一化
  const plateMaxDist = new Float32Array(plates.length);
  for (let i = 0; i < size; i++) {
    const pid = plateId[i] | 0;
    if (plateDist[i] > plateMaxDist[pid]) plateMaxDist[pid] = plateDist[i];
  }

  const invW = 1 / width;
  const invH = 1 / height;

  for (let y = 0; y < height; y++) {
    const ny = y * invH;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const nx = x * invW;
      const pid = plateId[idx] | 0;
      const isContinental = plateTypes[pid] === 1;

      // ── 1. 板块基础高度（Azgaar：板块类型决定陆/海基底）──
      const maxD = plateMaxDist[pid] || 1;
      const normDist = plateDist[idx] / maxD; // 0 中心 → 1 边缘
      let elev: number;
      if (isContinental) {
        const shelf = smoothstep(0.5, 1.0, normDist);
        elev = CONTINENT_BASE_ELEVATION - shelf * CONTINENT_SHELF_DROP;
      } else {
        const abyss = 1 - smoothstep(0.0, 0.7, normDist);
        elev = OCEAN_BASE_DEPTH - abyss * OCEAN_ABYSS_DROP;
      }

      // ── 2. 多尺度地形噪声（自然 FBM：谱权重+域形变+各向异性）──
      // 陆地：ridged（山脊）混合 standard（细节），海洋：standard 平滑
      if (isContinental) {
        const ridged = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'ridged',
          { warpStrength: 0.4, ridgeAngle: 0, anisotropy: 0.5 });
        const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard',
          { warpStrength: 0.4 });
        elev += ridged * LAND_RIDGED_WEIGHT + detail * LAND_DETAIL_WEIGHT;
      } else {
        const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard',
          { warpStrength: 0.3 });
        elev += detail * OCEAN_DETAIL_WEIGHT;
      }

      // ── 3. 山脊场（用于独立山脊图层）──
      const r = ridgeNoise.fbm(nx * 8, ny * 8, 4, 2, 0.5, 'ridged');
      ridge[idx] = r;
      ridgeMask[idx] = r > RIDGE_ACTIVATION_THRESHOLD && elev > seaLevel ? 1 : 0;

      // ── 4. 海岸细节抖动 ──
      if (coastDetail > 0 && Math.abs(elev - seaLevel) < COAST_DETAIL_RANGE) {
        const cn = detailNoise.fbm(nx * 18, ny * 18, 3, 2, 0.5, 'standard');
        elev += cn * coastDetail * COAST_DETAIL_MAX_OFFSET;
      }

      elevation[idx] = elev < -1 ? -1 : elev > 1 ? 1 : elev;
    }
  }

  // （构造力在边界平滑后叠加，避免被平滑稀释）

  // ── 板块边界过渡带平滑（AC-4.1）──
  // 标记边界带：plateId 变化像素的半径 2 邻域，对整个带做 2 pass 邻域平均，过渡 ≥3px 单调
  const boundaryBand = new Uint8Array(size);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pid = plateId[idx];
      if (plateId[idx - 1] !== pid || plateId[idx + 1] !== pid ||
          plateId[idx - width] !== pid || plateId[idx + width] !== pid) {
        for (let dy = -BOUNDARY_SMOOTH_RADIUS; dy <= BOUNDARY_SMOOTH_RADIUS; dy++) {
          for (let dx = -BOUNDARY_SMOOTH_RADIUS; dx <= BOUNDARY_SMOOTH_RADIUS; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              boundaryBand[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }
  const smoothed = new Float32Array(elevation);
  for (let pass = 0; pass < BOUNDARY_SMOOTH_PASSES; pass++) {
    const src = pass === 0 ? elevation : smoothed;
    const dst = pass === 0 ? smoothed : elevation;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (!boundaryBand[idx]) { if (pass === 1) dst[idx] = src[idx]; continue; }
        let sum = src[idx];
        let cnt = 1;
        for (let dy = -BOUNDARY_SMOOTH_RADIUS; dy <= BOUNDARY_SMOOTH_RADIUS; dy++) {
          for (let dx = -BOUNDARY_SMOOTH_RADIUS; dx <= BOUNDARY_SMOOTH_RADIUS; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = (y + dy) * width + (x + dx);
            sum += src[ni];
            cnt++;
          }
        }
        dst[idx] = sum / cnt;
      }
    }
  }

  // ── 边界构造力叠加（AC-4.2，平滑后施加避免被稀释）──
  // 汇聚→山脉（ridhed 噪声增强走向），离散→裂谷
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const tf = tectonicForce[idx];
      if (tf === 0) continue;
      const nx = x / width, ny = y / height;
      if (tf > 0) {
        let m = tf * mountainFold * CONVERGENT_MOUNTAIN_SCALE;
        m += (ridgeNoise.fbm(nx * 30, ny * 30, 3, 2, 0.5, 'ridged') - 0.5) * mountainFold * CONVERGENT_NOISE_OFFSET;
        elevation[idx] = Math.min(1, elevation[idx] + m);
      } else {
        elevation[idx] = Math.max(-1, elevation[idx] + tf * mountainFold * DIVERGENT_RIFT_SCALE);
      }
    }
  }
  // 坡度由共享 computeSlope 计算（与编辑器/refreshNames 标度一致）
  const slope = computeSlope(width, height, elevation);
  return { elevation, slope, ridge, ridgeMask };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function hydraulicErosion(
  width: number, height: number, elevation: Float32Array,
  iterations: number, strength: number, evaporationRate: number = EROSION_DEFAULT_EVAPORATION
): Float32Array {
  const elev = new Float32Array(elevation);
  const size = width * height;
  const water = new Float32Array(size);
  const sediment = new Float32Array(size);

  // 预计算 8 方向偏移（内联避免数组查找开销）
  const DX = [-1, 1, 0, 0, -1, -1, 1, 1];
  const DY = [0, 0, -1, 1, -1, 1, -1, 1];

  const evapFactor = 1 - evaporationRate;
  const stepFrac = EROSION_STEP_FRACTION;
  const slopeFactor = EROSION_SLOPE_CAPACITY_FACTOR;
  const waterTransfer = EROSION_WATER_TRANSFER;

  for (let iter = 0; iter < iterations; iter++) {
    let totalChange = 0;
    for (let y = 1; y < height - 1; y++) {
      const rowBase = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowBase + x;

        // 注水（合并到主循环，避免额外全量遍历）
        if (elev[idx] > 0) water[idx] += EROSION_WATER_INCREMENT;

        const e = elev[idx];
        let minE = e, minDir = -1;

        // 8 方向找最低邻居（内联，避免函数调用）
        const idx_mw = idx - 1, idx_pw = idx + 1;
        const idx_mh = idx - width, idx_ph = idx + width;
        let ne: number;

        ne = elev[idx_mw]; if (ne < minE) { minE = ne; minDir = 0; }
        ne = elev[idx_pw]; if (ne < minE) { minE = ne; minDir = 1; }
        ne = elev[idx_mh]; if (ne < minE) { minE = ne; minDir = 2; }
        ne = elev[idx_ph]; if (ne < minE) { minE = ne; minDir = 3; }
        ne = elev[idx_mh - 1]; if (ne < minE) { minE = ne; minDir = 4; }
        ne = elev[idx_mh + 1]; if (ne < minE) { minE = ne; minDir = 5; }
        ne = elev[idx_ph - 1]; if (ne < minE) { minE = ne; minDir = 6; }
        ne = elev[idx_ph + 1]; if (ne < minE) { minE = ne; minDir = 7; }

        if (minDir >= 0) {
          const slp = e - minE;
          const w = water[idx];
          const carryCapacity = slp * w * strength * (1 + slp * slopeFactor);
          const sDiff = carryCapacity - sediment[idx];
          let amount = 0;
          if (sDiff > 0) {
            amount = Math.min(sDiff * stepFrac, e - minE);
            elev[idx] -= amount;
            sediment[idx] += amount;
          } else {
            amount = Math.min(-sDiff * stepFrac, sediment[idx]);
            elev[idx] += amount;
            sediment[idx] -= amount;
          }
          totalChange += amount;
          const ni = idx + DX[minDir] + DY[minDir] * width;
          const halfW = w * waterTransfer;
          const halfS = sediment[idx] * waterTransfer;
          water[ni] += halfW;
          sediment[ni] += halfS;
          water[idx] = halfW;
          sediment[idx] = halfS;
        }
      }
    }
    // 蒸发（合并到主循环后只需一次遍历）
    for (let i = 0; i < size; i++) water[i] *= evapFactor;
    if (totalChange < EROSION_MAX_CHANGE_THRESHOLD) break;
  }
  return elev;
}

export function generateLakes(width: number, height: number, elevation: Float32Array, seaLevel: number, lakeDensity: number, seed: number): Float32Array {
  const lakes = new Float32Array(width * height);
  const noise = createNoise(seed + 7, 'simplex');
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      if (elev > seaLevel && elev < seaLevel + LAKE_MAX_ELEV_ABOVE_SEA) {
        const n = noise.fbm(x / width * 20, y / height * 20, 2, 2, 0.5, 'standard');
        if (n > 1 - lakeDensity) {
          let isBasin = true;
          for (let dy = -1; dy <= 1 && isBasin; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (elevation[(y + dy) * width + (x + dx)] < elev) {
                isBasin = false; break;
              }
            }
          }
          if (isBasin) {
            lakes[idx] = 1;
            for (let dy = -LAKE_FILL_RADIUS; dy <= LAKE_FILL_RADIUS; dy++) {
              for (let dx = -LAKE_FILL_RADIUS; dx <= LAKE_FILL_RADIUS; dx++) {
                lakes[(y + dy) * width + (x + dx)] = 1;
              }
            }
          }
        }
      }
    }
  }
  return lakes;
}
