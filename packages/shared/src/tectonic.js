import { createNoise } from './noise.js';

export function generatePlates(seed, count, width, height, landmass) {
  const plates = [];
  const noise = createNoise(seed, 'simplex');

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + noise.perlin2(i * 0.5, 0) * 0.5;
    const dist = 0.2 + Math.abs(noise.perlin2(i * 0.3, 10)) * 0.3;
    const x = 0.5 + Math.cos(angle) * dist;
    const y = 0.5 + Math.sin(angle) * dist;
    const vx = noise.perlin2(i * 0.7, 20) * 0.02;
    const vy = noise.perlin2(i * 0.7, 30) * 0.02;
    const isLand = i < Math.floor(count * landmass);
    const h = i * 137.508;
    const color = [
      0.5 + 0.5 * Math.sin(h * 0.0174533),
      0.5 + 0.5 * Math.sin((h + 120) * 0.0174533),
      0.5 + 0.5 * Math.sin((h + 240) * 0.0174533),
    ];
    plates.push({
      id: i, x, y, vx, vy,
      type: isLand ? 'continent' : 'ocean',
      color,
      area: 0, boundary: 0, growth: 0,
      elevation: isLand ? 0.3 + Math.random() * 0.4 : -0.3 - Math.random() * 0.3,
      moisture: isLand ? 0.3 + Math.random() * 0.4 : 0.7 + Math.random() * 0.3,
      temperature: isLand ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.2,
      name: `Plate ${i + 1}`,
      selected: false,
    });
  }
  return plates;
}

export function assignPlates(width, height, plates) {
  const size = width * height;
  const plateId = new Float32Array(size);
  const plateDist = new Float32Array(size);
  const plateXs = new Float32Array(plates.length);
  const plateYs = new Float32Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateXs[i] = plates[i].x;
    plateYs[i] = plates[i].y;
  }
  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = x / width;
      let minDist = Infinity;
      let closest = 0;
      for (let i = 0; i < plates.length; i++) {
        const dx = nx - plateXs[i];
        const dy = ny - plateYs[i];
        const d = dx * dx + dy * dy;
        if (d < minDist) { minDist = d; closest = i; }
      }
      plateId[idx] = closest;
      plateDist[idx] = Math.sqrt(minDist);
    }
  }
  return { plateId, plateDist };
}

export function computeBoundaries(width, height, plateId) {
  const boundary = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const id = plateId[idx];
      if (plateId[idx - 1] !== id || plateId[idx + 1] !== id ||
          plateId[idx - width] !== id || plateId[idx + width] !== id) {
        boundary[idx] = 1;
      }
    }
  }
  return boundary;
}
