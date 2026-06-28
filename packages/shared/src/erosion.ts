import { createNoise, type NoiseType, type FbmType } from './noise.js';
import type { Plate } from './tectonic.js';

const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

export function generateElevation(
  width: number, height: number, seed: number, plateId: Float32Array, plates: Plate[],
  plateDist: Float32Array, tectonicForce: Float32Array,
  noiseType: NoiseType, fbmType: FbmType, octaves: number, lacunarity: number, persistence: number, seaLevel: number,
  mountainFold: number, coastDetail: number
): { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array } {
  const size = width * height;
  const elevation = new Float32Array(size);
  const slope = new Float32Array(size);
  const ridge = new Float32Array(size);
  const ridgeMask = new Float32Array(size);
  const noise = createNoise(seed, noiseType);
  const warpNoise = createNoise(seed + 777, 'simplex');
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

      // ── 2. 边界构造力（汇聚→山脉, 离散→裂谷, 高斯剖面）──
      const tf = tectonicForce[idx];
      if (tf !== 0) {
        if (tf > 0) {
          // 汇聚边界：山脉，高度随构造力增长
          elev += tf * mountainFold * 0.7;
          // 山脉噪声细节（山脊走向）
          elev += (ridgeNoise.fbm(nx * 30, ny * 30, 3, 2, 0.5, 'ridged') - 0.5) * mountainFold * 0.2;
        } else {
          // 离散边界：裂谷/海岭
          elev += tf * mountainFold * 0.4;
        }
      }

      // ── 3. 域形变（domain warp）让海岸线有机化 ──
      const warpX = warpNoise.fbm(nx * 3, ny * 3, 3, 2, 0.5, 'standard') * 0.06;
      const warpY = warpNoise.fbm(nx * 3 + 31.4, ny * 3 + 17.7, 3, 2, 0.5, 'standard') * 0.06;

      // ── 4. 多尺度地形噪声（丘陵/山谷）──
      const terrain = noise.fbm(
        (nx + warpX) * 5, (ny + warpY) * 5,
        octaves, lacunarity, persistence, fbmType
      );
      // 陆地用 ridged 增强山脊，海洋用 standard 平滑
      if (isContinental) {
        elev += terrain * 0.22;
      } else {
        elev += terrain * 0.12;
      }

      // ── 5. 山脊场（用于独立山脊图层）──
      const r = ridgeNoise.fbm(nx * 8, ny * 8, 4, 2, 0.5, 'ridged');
      ridge[idx] = r;
      ridgeMask[idx] = r > 0.55 && elev > seaLevel ? 1 : 0;

      // ── 6. 海岸细节抖动 ──
      if (coastDetail > 0 && Math.abs(elev - seaLevel) < 0.12) {
        const cn = detailNoise.fbm(nx * 18, ny * 18, 3, 2, 0.5, 'standard');
        elev += cn * coastDetail * 0.06;
      }

      elevation[idx] = elev < -1 ? -1 : elev > 1 ? 1 : elev;
    }
  }

  // ── 坡度计算 ──
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const dx = elevation[idx + 1] - elevation[idx - 1];
      const dy = elevation[idx + width] - elevation[idx - width];
      slope[idx] = Math.sqrt(dx * dx + dy * dy) * width * 0.5;
    }
  }
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
  const dirs = EROSION_DIRS;
  const maxChangeThreshold = 1e-5;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < size; i++) {
      if (elev[i] > 0) water[i] += 0.01;
    }
    let totalChange = 0;
    for (let y = 1; y < height - 1; y++) {
      const rowBase = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowBase + x;
        const e = elev[idx];
        let minE = e, minDir = -1;
        for (let d = 0; d < 8; d++) {
          const ni = idx + dirs[d * 2] + dirs[d * 2 + 1] * width;
          const ne = elev[ni];
          if (ne < minE) { minE = ne; minDir = d; }
        }
        if (minDir >= 0) {
          const slp = e - minE;
          const carryCapacity = slp * water[idx] * strength * (1 + slp * 5);
          const sDiff = carryCapacity - sediment[idx];
          let amount = 0;
          if (sDiff > 0) {
            amount = Math.min(sDiff * 0.1, e - minE);
            elev[idx] -= amount;
            sediment[idx] += amount;
          } else {
            amount = Math.min(-sDiff * 0.1, sediment[idx]);
            elev[idx] += amount;
            sediment[idx] -= amount;
          }
          totalChange += amount;
          const ddx = dirs[minDir * 2];
          const ddy = dirs[minDir * 2 + 1];
          const ni = idx + ddx + ddy * width;
          const halfWater = water[idx] * 0.5;
          const halfSediment = sediment[idx] * 0.5;
          water[ni] += halfWater;
          sediment[ni] += halfSediment;
          water[idx] = halfWater;
          sediment[idx] = halfSediment;
        }
      }
    }
    for (let i = 0; i < size; i++) water[i] *= (1 - evaporationRate);
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
