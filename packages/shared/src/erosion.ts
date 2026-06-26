import { createNoise, type NoiseType, type FbmType } from './noise.js';
import type { Plate } from './tectonic.js';

const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

export function generateElevation(
  width: number, height: number, seed: number, plateId: Float32Array, plates: Plate[], boundary: Float32Array,
  noiseType: NoiseType, fbmType: FbmType, octaves: number, lacunarity: number, persistence: number, seaLevel: number,
  mountainFold: number, coastDetail: number
): { elevation: Float32Array; slope: Float32Array; ridge: Float32Array; ridgeMask: Float32Array } {
  const size = width * height;
  const elevation = new Float32Array(size);
  const slope = new Float32Array(size);
  const ridge = new Float32Array(size);
  const ridgeMask = new Float32Array(size);
  const noise = createNoise(seed, noiseType);
  const detailNoise = createNoise(seed + 1, 'simplex');
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
  const elev = new Float32Array(elevation);
  const size = width * height;
  const water = new Float32Array(size);
  const sediment = new Float32Array(size);
  const dirs = EROSION_DIRS;
  const maxChangeThreshold = 1e-5;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < size; i++) water[i] += 0.01;
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
    for (let i = 0; i < size; i++) water[i] *= 0.9;
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
