export interface RiverSegment {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface River {
  id: number;
  segments: RiverSegment[];
  length: number;
  sourceX: number;
  sourceY: number;
  mouthX: number;
  mouthY: number;
}

const D8_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const D8_DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const D8_DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

function computeFlowDirection(
  width: number, height: number, elevation: Float32Array, seaLevel: number
): Int8Array {
  const size = width * height;
  const flowDir = new Int8Array(size);
  flowDir.fill(-1);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel) continue;

      let maxSlope = 0;
      let bestDir = -1;
      const e = elevation[idx];

      for (let d = 0; d < 8; d++) {
        const nx = x + D8_DX[d];
        const ny = y + D8_DY[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        const slope = (e - elevation[ni]) / D8_DIST[d];
        if (slope > maxSlope) {
          maxSlope = slope;
          bestDir = d;
        }
      }

      if (bestDir >= 0) flowDir[idx] = bestDir;
    }
  }

  return flowDir;
}

function computeFlowAccumulation(
  width: number, height: number, flowDir: Int8Array, seaLevel: number, elevation: Float32Array
): Float32Array {
  const size = width * height;
  const accumulation = new Float32Array(size);

  // Compute upstream count using topological sort via indegree
  const indegree = new Int32Array(size);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel) continue;
      const dir = flowDir[idx];
      if (dir < 0) continue;
      const nx = x + D8_DX[dir];
      const ny = y + D8_DY[dir];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      indegree[ny * width + nx]++;
    }
  }

  // Initialize queue with sources (indegree == 0)
  const queue: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      if (elevation[idx] <= seaLevel) continue;
      accumulation[idx] = 1;
      if (indegree[idx] === 0) queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const dir = flowDir[idx];
    if (dir < 0) continue;
    const x = idx % width;
    const y = (idx / width) | 0;
    const nx = x + D8_DX[dir];
    const ny = y + D8_DY[dir];
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const ni = ny * width + nx;
    accumulation[ni] += accumulation[idx];
    indegree[ni]--;
    if (indegree[ni] === 0) queue.push(ni);
  }

  return accumulation;
}

export function generateRivers(
  width: number, height: number, elevation: Float32Array, moisture: Float32Array,
  seaLevel: number, count: number, seed: number
): { rivers: River[]; riverMask: Float32Array; riverWidth: Float32Array; riverDepth: Float32Array } {
  const size = width * height;
  const riverMask = new Float32Array(size);
  const riverWidth = new Float32Array(size);
  const riverDepth = new Float32Array(size);
  const rivers: River[] = [];

  const flowDir = computeFlowDirection(width, height, elevation, seaLevel);
  const accumulation = computeFlowAccumulation(width, height, flowDir, seaLevel, elevation);

  // Find river sources: land pixels with enough accumulation
  const sources: { x: number; y: number; score: number }[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (elevation[idx] > seaLevel + 0.05 && accumulation[idx] >= 1) {
        sources.push({ x, y, score: accumulation[idx] });
      }
    }
  }

  sources.sort((a, b) => b.score - a.score);
  const used = new Uint8Array(size);
  const maxRivers = Math.min(count, sources.length);
  for (let i = 0; i < maxRivers; i++) {
    const src = sources[i];
    const srcIdx = src.y * width + src.x;
    if (used[srcIdx]) continue;
    const segments = [];
    let cx = src.x, cy = src.y, steps = 0;
    const maxSteps = Math.max(width, height) * 3;
    while (steps < maxSteps) {
      const idx = cy * width + cx;
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) break;
      if (elevation[idx] <= seaLevel) break;
      // Junction: stop if we hit an existing river (but not at the source)
      if (used[idx] && steps > 0) break;
      if (used[idx]) break; // source already used
      segments.push({
        x: cx, y: cy,
        width: 1 + Math.floor(segments.length / 20),
        depth: 0.1 + segments.length * 0.001
      });
      used[idx] = 1;
      const dir = flowDir[idx];
      if (dir < 0) break;
      cx = cx + D8_DX[dir];
      cy = cy + D8_DY[dir];
      steps++;
    }
    if (segments.length > 2) {
      rivers.push({
        id: i,
        segments,
        length: segments.length,
        sourceX: segments[0].x,
        sourceY: segments[0].y,
        mouthX: segments[segments.length - 1].x,
        mouthY: segments[segments.length - 1].y,
      });

      for (let j = 0; j < segments.length; j++) {
        const s = segments[j];
        const idx = s.y * width + s.x;
        riverMask[idx] = 1;
        riverWidth[idx] = s.width;
        riverDepth[idx] = s.depth;

        const w = Math.floor(s.width / 2);
        for (let dy = -w; dy <= w; dy++) {
          for (let dx = -w; dx <= w; dx++) {
            const px = s.x + dx, py = s.y + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const pidx = py * width + px;
              if (!riverMask[pidx]) {
                riverMask[pidx] = 0.7;
                riverWidth[pidx] = s.width * 0.7;
                riverDepth[pidx] = s.depth * 0.7;
              }
            }
          }
        }
      }
    }
  }

  return { rivers, riverMask, riverWidth, riverDepth };
}