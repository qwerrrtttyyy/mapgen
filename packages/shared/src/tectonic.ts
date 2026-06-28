import { createNoise } from './noise.js';

export interface Plate {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'continent' | 'ocean';
  color: number[];
  area: number;
  boundary: number;
  growth: number;
  elevation: number;
  moisture: number;
  temperature: number;
  name: string;
  selected: boolean;
}

export type BoundaryType = 0 | 1 | 2 | 3; // 0=none, 1=convergent, 2=divergent, 3=transform

export function generatePlates(seed: number, count: number, width: number, height: number, landmass: number): Plate[] {
  const plates: Plate[] = [];
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

export function assignPlates(width: number, height: number, plates: Plate[]): { plateId: Float32Array; plateDist: Float32Array } {
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

export function computeBoundaries(width: number, height: number, plateId: Float32Array): Float32Array {
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

export function computeBoundaryTypes(
  width: number, height: number, plateId: Float32Array, plates: Plate[]
): { boundaryType: Uint8Array; boundaryIntensity: Float32Array } {
  const size = width * height;
  const boundaryType = new Uint8Array(size);
  const boundaryIntensity = new Float32Array(size);

  const plateVX = new Float32Array(plates.length);
  const plateVY = new Float32Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateVX[i] = plates[i].vx;
    plateVY[i] = plates[i].vy;
  }

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pid = plateId[idx] | 0;

      // Find the most common neighbor plate (different from current)
      const neighborCounts = new Map<number, number>();
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nid = plateId[ny * width + nx] | 0;
        if (nid !== pid) {
          neighborCounts.set(nid, (neighborCounts.get(nid) || 0) + 1);
        }
      }

      if (neighborCounts.size === 0) continue;

      // Find the most common neighbor plate
      let bestNid = -1;
      let bestCount = 0;
      for (const [nid, count] of neighborCounts) {
        if (count > bestCount) { bestCount = count; bestNid = nid; }
      }

      if (bestNid < 0) continue;

      // Compute relative velocity between the two plates
      const vx1 = plateVX[pid];
      const vy1 = plateVY[pid];
      const vx2 = plateVX[bestNid];
      const vy2 = plateVY[bestNid];

      // Relative velocity of plate 2 relative to plate 1
      const relVX = vx2 - vx1;
      const relVY = vy2 - vy1;
      const relSpeed = Math.sqrt(relVX * relVX + relVY * relVY);

      if (relSpeed < 1e-6) {
        boundaryType[idx] = 0;
        boundaryIntensity[idx] = 0;
        continue;
      }

      // Approximate boundary normal: direction from current plate center to neighbor
      const cx1 = plates[pid].x;
      const cy1 = plates[pid].y;
      const cx2 = plates[bestNid].x;
      const cy2 = plates[bestNid].y;
      const nx_norm = cx2 - cx1;
      const ny_norm = cy2 - cy1;
      const normLen = Math.sqrt(nx_norm * nx_norm + ny_norm * ny_norm);

      if (normLen < 1e-6) {
        boundaryType[idx] = 3; // transform by default
        boundaryIntensity[idx] = relSpeed;
        continue;
      }

      // Dot product of relative velocity with boundary normal
      // Positive = moving toward each other = convergent
      // Negative = moving apart = divergent
      const dot = (relVX * nx_norm + relVY * ny_norm) / normLen;

      if (dot > 0.003) {
        // Convergent boundary: plates moving toward each other → higher mountains
        boundaryType[idx] = 1;
        boundaryIntensity[idx] = dot * 10;
      } else if (dot < -0.003) {
        // Divergent boundary: plates moving apart → rifts/lower elevation
        boundaryType[idx] = 2;
        boundaryIntensity[idx] = -dot * 10;
      } else {
        // Transform boundary: plates sliding past → linear features
        boundaryType[idx] = 3;
        boundaryIntensity[idx] = relSpeed * 5;
      }
    }
  }

  return { boundaryType, boundaryIntensity };
}