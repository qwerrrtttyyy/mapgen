import { createNoise } from './noise.js';
import {
  PLATE_ANGLE_JITTER, PLATE_DIST_MIN, PLATE_DIST_MAX,
  PLATE_VELOCITY_SCALE, BOUNDARY_TYPE_THRESHOLD,
  CONVERGENT_INTENSITY_SCALE, DIVERGENT_INTENSITY_SCALE, TRANSFORM_INTENSITY_SCALE,
  BOUNDARY_VIS_BASE, BOUNDARY_VIS_SCALE,
} from './constants.js';

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
    const angle = (i / count) * Math.PI * 2 + noise.perlin2(i * 0.5, 0) * PLATE_ANGLE_JITTER;
    const dist = PLATE_DIST_MIN + Math.abs(noise.perlin2(i * 0.3, 10)) * PLATE_DIST_MAX;
    const x = 0.5 + Math.cos(angle) * dist;
    const y = 0.5 + Math.sin(angle) * dist;
    const vx = noise.perlin2(i * 0.7, 20) * PLATE_VELOCITY_SCALE;
    const vy = noise.perlin2(i * 0.7, 30) * PLATE_VELOCITY_SCALE;
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

  // 预提取板块属性到 typed array（避免反复属性访问）
  const plateVX = new Float32Array(plates.length);
  const plateVY = new Float32Array(plates.length);
  const plateCX = new Float32Array(plates.length);
  const plateCY = new Float32Array(plates.length);
  for (let i = 0; i < plates.length; i++) {
    plateVX[i] = plates[i].vx;
    plateVY[i] = plates[i].vy;
    plateCX[i] = plates[i].x;
    plateCY[i] = plates[i].y;
  }

  // 4-邻接偏移（比 8-邻接更快，且结果足够准确）
  const DX4 = [-1, 1, 0, 0] as const;
  const DY4 = [0, 0, -1, 1] as const;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pid = plateId[idx] | 0;

      // 找最常见的不同板块邻居（4-邻接，无 Map 分配）
      let bestNid = -1;
      let bestCount = 0;
      // 用简单计数：4 个方向最多 4 种不同板块
      let nid1 = -1, cnt1 = 0, nid2 = -1, cnt2 = 0;

      for (let d = 0; d < 4; d++) {
        const ni = (y + DY4[d]) * width + (x + DX4[d]);
        const nid = plateId[ni] | 0;
        if (nid === pid) continue;
        if (nid === nid1) { cnt1++; }
        else if (nid === nid2) { cnt2++; }
        else if (nid1 === -1) { nid1 = nid; cnt1 = 1; }
        else if (nid2 === -1) { nid2 = nid; cnt2 = 1; }
        // 最多只需跟踪 2 个候选
      }

      if (nid1 === -1) continue;
      bestNid = cnt1 >= cnt2 ? nid1 : nid2;
      bestCount = Math.max(cnt1, cnt2);
      if (bestNid === -1) continue;

      // 相对速度
      const relVX = plateVX[bestNid] - plateVX[pid];
      const relVY = plateVY[bestNid] - plateVY[pid];
      const relSpeedSq = relVX * relVX + relVY * relVY;

      if (relSpeedSq < 1e-12) {
        boundaryType[idx] = 0;
        boundaryIntensity[idx] = 0;
        continue;
      }
      const relSpeed = Math.sqrt(relSpeedSq);

      // 边界法线
      const nx_norm = plateCX[bestNid] - plateCX[pid];
      const ny_norm = plateCY[bestNid] - plateCY[pid];
      const normLenSq = nx_norm * nx_norm + ny_norm * ny_norm;

      if (normLenSq < 1e-12) {
        boundaryType[idx] = 3;
        boundaryIntensity[idx] = relSpeed;
        continue;
      }

      const dot = (relVX * nx_norm + relVY * ny_norm) / Math.sqrt(normLenSq);

      if (dot < -BOUNDARY_TYPE_THRESHOLD) {
        boundaryType[idx] = 1;
        boundaryIntensity[idx] = -dot * CONVERGENT_INTENSITY_SCALE;
      } else if (dot > BOUNDARY_TYPE_THRESHOLD) {
        boundaryType[idx] = 2;
        boundaryIntensity[idx] = dot * DIVERGENT_INTENSITY_SCALE;
      } else {
        boundaryType[idx] = 3;
        boundaryIntensity[idx] = relSpeed * TRANSFORM_INTENSITY_SCALE;
      }
    }
  }

  return { boundaryType, boundaryIntensity };
}