// 水力侵蚀与地形合成引擎

import { createNoise } from './noise';

export function generateElevation(
  width: number,
  height: number,
  seed: number,
  plateId: Float32Array,
  plates: { type: string; elevation: number }[],
  boundary: Float32Array,
  noiseType: string,
  fbmType: string,
  octaves: number,
  lacunarity: number,
  persistence: number,
  seaLevel: number,
  mountainFold: number,
  coastDetail: number
): { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array } {
  const size = width * height;
  const elevation = new Float32Array(size);
  const slope = new Float32Array(size);
  const ridge = new Float32Array(size);
  const ridgeMask = new Float32Array(size);

  const noise = createNoise(seed, noiseType);
  const detailNoise = createNoise(seed + 1, 'simplex');

  // 预计算板块类型和海拔
  const plateTypes = new Uint8Array(plates.length);
  const plateElevs = new Float32Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateTypes[i] = plates[i].type === 'continent' ? 1 : 0;
    plateElevs[i] = plates[i].elevation;
  }

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = x / width;
      const pid = Math.floor(plateId[idx]);

      // 基础板块高程
      let elev = plateElevs[pid];

      // 边界隆起（山脉）
      const b = boundary[idx];
      if (b > 0 && plateTypes[pid] === 1) {
        elev += b * mountainFold * (0.5 + 0.5 * noise.sample(nx * 8, ny * 8));
      }

      // FBM 噪声叠加
      const n = noise.fbm(nx * 4, ny * 4, octaves, lacunarity, persistence, fbmType);
      elev += n * 0.3;

      // 海岸线细节
      const coastNoise = detailNoise.fbm(nx * 16, ny * 16, 3, 2, 0.5, 'standard');
      const distToSea = Math.abs(elev - seaLevel);
      if (distToSea < 0.1) {
        elev += coastNoise * coastDetail * 0.05;
      }

      // 脊线
      const r = Math.abs(noise.sample(nx * 12, ny * 12));
      ridge[idx] = r;
      ridgeMask[idx] = r > 0.6 ? 1 : 0;

      elevation[idx] = elev;
    }
  }

  // 计算坡度
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

export function hydraulicErosion(
  width: number,
  height: number,
  elevation: Float32Array,
  iterations: number,
  strength: number
): Float32Array {
  const elev = new Float32Array(elevation);
  const size = width * height;
  const water = new Float32Array(size);
  const sediment = new Float32Array(size);

  for (let iter = 0; iter < iterations; iter++) {
    // 降雨
    for (let i = 0; i < size; i++) {
      water[i] += 0.01;
    }

    // 侵蚀与沉积
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const e = elev[idx];
        let minE = e;
        let minDir = -1;
        const dirs = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
        for (let d = 0; d < 8; d++) {
          const ni = idx + dirs[d];
          if (elev[ni] < minE) {
            minE = elev[ni];
            minDir = d;
          }
        }
        if (minDir >= 0) {
          const slope = e - minE;
          const carryCapacity = slope * water[idx] * strength;
          const sedimentDiff = carryCapacity - sediment[idx];
          if (sedimentDiff > 0) {
            // 侵蚀
            const amount = Math.min(sedimentDiff * 0.1, e - minE);
            elev[idx] -= amount;
            sediment[idx] += amount;
          } else {
            // 沉积
            const amount = Math.min(-sedimentDiff * 0.1, sediment[idx]);
            elev[idx] += amount;
            sediment[idx] -= amount;
          }
          // 水流与沉积物转移
          const ni = idx + dirs[minDir];
          water[ni] += water[idx] * 0.5;
          sediment[ni] += sediment[idx] * 0.5;
          water[idx] *= 0.5;
          sediment[idx] *= 0.5;
        }
      }
    }

    // 蒸发
    for (let i = 0; i < size; i++) {
      water[i] *= 0.9;
    }
  }

  return elev;
}

export function generateLakes(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  lakeDensity: number,
  seed: number
): Float32Array {
  const lakes = new Float32Array(width * height);
  const noise = createNoise(seed + 7, 'simplex');

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      if (elev > seaLevel && elev < seaLevel + 0.1) {
        const n = noise.fbm(x / width * 20, y / height * 20, 2, 2, 0.5, 'standard');
        if (n > 1 - lakeDensity) {
          // 简单盆地检测
          let isBasin = true;
          for (let dy = -1; dy <= 1 && isBasin; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ni = (y + dy) * width + (x + dx);
              if (elevation[ni] < elev) {
                isBasin = false;
                break;
              }
            }
          }
          if (isBasin) {
            lakes[idx] = 1;
            // 扩散小范围
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
