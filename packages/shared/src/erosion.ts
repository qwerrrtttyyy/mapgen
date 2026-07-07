import { createNoise, type NoiseType, type FbmType } from './noise.js';
import type { Plate } from './tectonic.js';
import { computeSlope } from './slope.js';

const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

let _cachedWidth = -1;
let _erosionOffsets: Int32Array | null = null;
function getErosionOffsets(width: number): Int32Array {
  if (_cachedWidth !== width || !_erosionOffsets) {
    _cachedWidth = width;
    _erosionOffsets = new Int32Array(8);
    for (let d = 0; d < 8; d++) {
      _erosionOffsets[d] = EROSION_DIRS[d * 2] + EROSION_DIRS[d * 2 + 1] * width;
    }
  }
  return _erosionOffsets;
}

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
        // 大陆：内部高，边缘大陆架下降
        const shelf = smoothstep(0.5, 1.0, normDist); // 边缘 ~0.4 衰减
        elev = 0.35 - shelf * 0.15;
      } else {
        // 大洋：中心深，边缘略浅（洋中脊由构造力处理）
        const abyss = 1 - smoothstep(0.0, 0.7, normDist);
        elev = -0.35 - abyss * 0.25;
      }

      // ── 2. 多尺度地形噪声（自然 FBM：谱权重+域形变+各向异性）──
      // 陆地：ridged（山脊）混合 standard（细节），海洋：standard 平滑
      if (isContinental) {
        const ridged = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'ridged',
          { warpStrength: 0.4, ridgeAngle: 0, anisotropy: 0.5 });
        const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard',
          { warpStrength: 0.4 });
        elev += ridged * 0.12 + detail * 0.14;
      } else {
        const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard',
          { warpStrength: 0.3 });
        elev += detail * 0.10;
      }

      // ── 3. 山脊场（用于独立山脊图层）──
      const r = ridgeNoise.fbm(nx * 8, ny * 8, 4, 2, 0.5, 'ridged');
      ridge[idx] = r;
      ridgeMask[idx] = r > 0.55 && elev > seaLevel ? 1 : 0;

      // ── 4. 海岸细节抖动 ──
      if (coastDetail > 0 && Math.abs(elev - seaLevel) < 0.12) {
        const cn = detailNoise.fbm(nx * 18, ny * 18, 3, 2, 0.5, 'standard');
        elev += cn * coastDetail * 0.06;
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
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
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
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? elevation : smoothed;
    const dst = pass === 0 ? smoothed : elevation;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (!boundaryBand[idx]) { if (pass === 1) dst[idx] = src[idx]; continue; }
        let sum = src[idx];
        let cnt = 1;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
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
        let m = tf * mountainFold * 0.8;
        m += (ridgeNoise.fbm(nx * 30, ny * 30, 3, 2, 0.5, 'ridged') - 0.5) * mountainFold * 0.25;
        elevation[idx] = Math.min(1, elevation[idx] + m);
      } else {
        elevation[idx] = Math.max(-1, elevation[idx] + tf * mountainFold * 0.4);
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
  iterations: number, strength: number, evaporationRate: number = 0.01
): Float32Array {
  const elev = new Float32Array(elevation);
  const size = width * height;
  const water = new Float32Array(size);
  const sediment = new Float32Array(size);
  const dirs = getErosionOffsets(width);
  const maxChangeThreshold = 1e-5;
  const rainAmount = 0.01;
  const depositionRate = 0.1;
  const erosionRate = 0.1;
  const capacityFactor = strength;
  const halfFactor = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < size; i++) {
      if (elev[i] > 0) water[i] += rainAmount;
    }
    let totalChange = 0;
    for (let y = 1; y < height - 1; y++) {
      const rowBase = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowBase + x;
        const e = elev[idx];
        let minE = e;
        let minDir = -1;
        const d0 = dirs[0], n0 = idx + d0; if (elev[n0] < minE) { minE = elev[n0]; minDir = 0; }
        const d1 = dirs[1], n1 = idx + d1; if (elev[n1] < minE) { minE = elev[n1]; minDir = 1; }
        const d2 = dirs[2], n2 = idx + d2; if (elev[n2] < minE) { minE = elev[n2]; minDir = 2; }
        const d3 = dirs[3], n3 = idx + d3; if (elev[n3] < minE) { minE = elev[n3]; minDir = 3; }
        const d4 = dirs[4], n4 = idx + d4; if (elev[n4] < minE) { minE = elev[n4]; minDir = 4; }
        const d5 = dirs[5], n5 = idx + d5; if (elev[n5] < minE) { minE = elev[n5]; minDir = 5; }
        const d6 = dirs[6], n6 = idx + d6; if (elev[n6] < minE) { minE = elev[n6]; minDir = 6; }
        const d7 = dirs[7], n7 = idx + d7; if (elev[n7] < minE) { minE = elev[n7]; minDir = 7; }

        if (minDir >= 0) {
          const slp = e - minE;
          const w = water[idx];
          const s = sediment[idx];
          const carryCapacity = slp * w * capacityFactor * (1 + slp * 5);
          const sDiff = carryCapacity - s;
          let amount = 0;
          if (sDiff > 0) {
            amount = Math.min(sDiff * erosionRate, slp);
            elev[idx] = e - amount;
            sediment[idx] = s + amount;
          } else {
            amount = Math.min(-sDiff * depositionRate, s);
            elev[idx] = e + amount;
            sediment[idx] = s - amount;
          }
          totalChange += amount;
          const ni = idx + dirs[minDir];
          const hw = w * halfFactor;
          const hs = sediment[idx] * halfFactor;
          water[ni] += hw;
          sediment[ni] += hs;
          water[idx] = hw;
          sediment[idx] = hs;
        }
      }
    }
    const evapFactor = 1 - evaporationRate;
    for (let i = 0; i < size; i++) water[i] *= evapFactor;
    if (totalChange < maxChangeThreshold) break;
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
      if (elev > seaLevel && elev < seaLevel + 0.1) {
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
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
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
