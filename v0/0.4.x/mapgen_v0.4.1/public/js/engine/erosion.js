import { createNoise } from './noise.js';
import { SeededRandom } from './seeded-random.js';

export function generateElevation(width, height, seed, plateId, plates, boundary,
  noiseType, fbmType, octaves, lacunarity, persistence, seaLevel,
  mountainFold, coastDetail) {
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
  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = x / width;
      const pid = Math.floor(plateId[idx]);
      let elev = plateElevs[pid];
      const b = boundary[idx];
      if (b > 0 && plateTypes[pid] === 1) {
        elev += b * mountainFold * (0.5 + 0.5 * noise.sample(nx * 8, ny * 8));
      }
      const n = noise.fbm(nx * 4, ny * 4, octaves, lacunarity, persistence, fbmType);
      elev += n * 0.3;
      const coastNoise = detailNoise.fbm(nx * 16, ny * 16, 3, 2, 0.5, 'standard');
      const distToSea = Math.abs(elev - seaLevel);
      if (distToSea < 0.1) elev += coastNoise * coastDetail * 0.05;
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

export function hydraulicErosion(width, height, elevation, iterations, strength, seed) {
  const elev = new Float32Array(elevation);
  const size = width * height;
  const numDrops = Math.max(10, Math.floor(size * 0.01 * (strength || 1)));
  const maxSteps = Math.min(64, Math.floor(Math.max(width, height) / 32));
  const inertia = 0.05;
  const sedimentCapacityFactor = 4.0;
  const minSlope = 0.01;
  const erodeRate = 0.3 * (strength || 1);
  const depositRate = 0.2;
  const W = width, H = height;
  const rng = new SeededRandom(seed || Date.now());
  for (let iter = 0; iter < iterations; iter++) {
    for (let di = 0; di < numDrops; di++) {
      let px = rng.next() * (W - 2) + 1;
      let py = rng.next() * (H - 2) + 1;
      let dx = 0, dy = 0, speed = 1, sediment = 0, water = 1;
      for (let s = 0; s < maxSteps; s++) {
        const ix = Math.floor(px), iy = Math.floor(py);
        if (ix < 1 || ix >= W - 1 || iy < 1 || iy >= H - 1) break;
        const idx00 = iy * W + ix, idx10 = idx00 + 1, idx01 = idx00 + W, idx11 = idx01 + 1;
        const fx = px - ix, fy = py - iy;
        const h00 = elev[idx00], h10 = elev[idx10], h01 = elev[idx01], h11 = elev[idx11];
        const curH = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
        const gdx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
        const gdy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
        dx = dx * inertia - gdx * (1 - inertia);
        dy = dy * inertia - gdy * (1 - inertia);
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.0001) { dx = rng.next() - 0.5; dy = rng.next() - 0.5; }
        else { dx /= len; dy /= len; }
        px += dx; py += dy;
        if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) break;
        const nix = Math.floor(px), niy = Math.floor(py);
        const nIdx = niy * W + nix;
        const newH = elev[nIdx];
        const deltaH = newH - curH;
        const capacity = Math.max(-deltaH, minSlope) * speed * water * sedimentCapacityFactor;
        if (sediment > capacity || deltaH > 0) {
          const depositAmt = deltaH > 0 ? Math.min(deltaH, sediment) : (sediment - capacity) * depositRate;
          sediment -= depositAmt;
          elev[nIdx] += depositAmt;
        } else {
          const erodeAmt = Math.min((capacity - sediment) * erodeRate, -deltaH * 0.5);
          sediment += erodeAmt;
          elev[nIdx] -= erodeAmt;
        }
        speed = Math.sqrt(Math.max(0, speed * speed + deltaH * 4.0));
        water *= 0.99;
      }
    }
  }
  for (let i = 0; i < size; i++) elev[i] = elev[i] < 0 ? 0 : elev[i] > 1 ? 1 : elev[i];
  return elev;
}

export function generateLakes(width, height, elevation, seaLevel, lakeDensity, seed) {
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
