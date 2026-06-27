import { createNoise, type NoiseType, type FbmType } from './noise.js';
import type { NoiseCache } from './noiseCache.js';
import type { Plate } from './tectonic.js';

const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

/**
 * 预计算 8 邻居线性偏移量，避免内层循环中重复计算 dirs[d*2] + dirs[d*2+1]*width。
 */
function buildNeighborOffsets(width: number): Int32Array {
  const offsets = new Int32Array(8);
  for (let d = 0; d < 8; d++) {
    offsets[d] = EROSION_DIRS[d * 2] + EROSION_DIRS[d * 2 + 1] * width;
  }
  return offsets;
}

export function generateElevation(
  width: number, height: number, seed: number, plateId: Float32Array, plates: Plate[], boundary: Float32Array,
  noiseType: NoiseType, fbmType: FbmType, octaves: number, lacunarity: number, persistence: number, seaLevel: number,
  mountainFold: number, coastDetail: number, noiseCache?: NoiseCache
): { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array } {
  const size = width * height;
  const elevation = new Float32Array(size);
  const slope = new Float32Array(size);
  const ridge = new Float32Array(size);
  const ridgeMask = new Float32Array(size);
  const noise = noiseCache ? noiseCache.get(seed, noiseType) : createNoise(seed, noiseType);
  const detailNoise = noiseCache ? noiseCache.get(seed + 1, 'simplex') : createNoise(seed + 1, 'simplex');
  const plateTypes = new Uint8Array(plates.length);
  const plateElevs = new Float32Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateTypes[i] = plates[i].type === 'continent' ? 1 : 0;
    plateElevs[i] = plates[i].elevation;
  }

  // Precompute normalized coordinates to avoid per-pixel divisions
  const nxArr = new Float32Array(width);
  for (let x = 0; x < width; x++) nxArr[x] = x / width;
  const nyArr = new Float32Array(height);
  for (let y = 0; y < height; y++) nyArr[y] = y / height;

  for (let y = 0; y < height; y++) {
    const ny = nyArr[y];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = nxArr[x];
      const pid = plateId[idx] | 0;
      let elev = plateElevs[pid];
      const b = boundary[idx];
      if (b > 0 && plateTypes[pid] === 1) {
        elev += b * mountainFold * (0.5 + 0.5 * noise.sample(nx * 8, ny * 8));
      }
      const n = noise.fbm(nx * 4, ny * 4, octaves, lacunarity, persistence, fbmType);
      elev += n * 0.3;
      const distToSea = Math.abs(elev - seaLevel);
      if (distToSea < 0.1 && coastDetail > 0) {
        const coastNoise = detailNoise.fbm(nx * 16, ny * 16, 3, 2, 0.5, 'standard');
        elev += coastNoise * coastDetail * 0.05;
      }
      const r = Math.abs(noise.sample(nx * 12, ny * 12));
      ridge[idx] = r;
      ridgeMask[idx] = r > 0.6 ? 1 : 0;
      elevation[idx] = elev;
    }
  }
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

export function hydraulicErosion(width: number, height: number, elevation: Float32Array, iterations: number, strength: number): Float32Array {
  if (iterations <= 0) return new Float32Array(elevation);

  const elev = new Float32Array(elevation);
  const size = width * height;
  const water = new Float32Array(size);
  const sediment = new Float32Array(size);
  // 预计算邻居偏移，避免内层循环重复算
  const offsets = buildNeighborOffsets(width);
  const maxChangeThreshold = 1e-5;
  // 蒸发因子（每轮末 water *= 0.9）与降水（每轮首 water += 0.01）合并：
  // 下一轮开始时 water[i] = water[i] * 0.9 + 0.01
  const EVAP = 0.9;
  const RAIN = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    // 合并蒸发+降水为单次遍历（首轮蒸发无效但 water 全为 0，无影响）
    if (iter === 0) {
      for (let i = 0; i < size; i++) water[i] = RAIN;
    } else {
      for (let i = 0; i < size; i++) water[i] = water[i] * EVAP + RAIN;
    }
    let totalChange = 0;
    for (let y = 1; y < height - 1; y++) {
      const rowBase = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowBase + x;
        const e = elev[idx];
        let minE = e, minDir = -1;
        // 使用预计算偏移量查找最低邻居
        for (let d = 0; d < 8; d++) {
          const ne = elev[idx + offsets[d]];
          if (ne < minE) { minE = ne; minDir = d; }
        }
        if (minDir >= 0) {
          const slp = e - minE;
          const carryCapacity = slp * water[idx] * strength;
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
          // 水与沉积物向最低邻居分流
          const ni = idx + offsets[minDir];
          const halfWater = water[idx] * 0.5;
          const halfSediment = sediment[idx] * 0.5;
          water[ni] += halfWater;
          sediment[ni] += halfSediment;
          water[idx] = halfWater;
          sediment[idx] = halfSediment;
        }
      }
    }
    if (totalChange < maxChangeThreshold) break;
  }
  return elev;
}

export function generateLakes(width: number, height: number, elevation: Float32Array, seaLevel: number, lakeDensity: number, seed: number, noiseCache?: NoiseCache): Float32Array {
  const lakes = new Float32Array(width * height);
  const noise = noiseCache ? noiseCache.get(seed + 7, 'simplex') : createNoise(seed + 7, 'simplex');
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
