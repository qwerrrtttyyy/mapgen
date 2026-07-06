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
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number
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
  width: number,
  height: number,
  flowDir: Int8Array,
  seaLevel: number,
  elevation: Float32Array
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
  width: number,
  height: number,
  elevation: Float32Array,
  moisture: Float32Array,
  seaLevel: number,
  count: number,
  _seed: number
): {
  rivers: River[];
  riverMask: Float32Array;
  riverWidth: Float32Array;
  riverDepth: Float32Array;
} {
  const size = width * height;
  const riverMask = new Float32Array(size);
  const riverWidth = new Float32Array(size);
  const riverDepth = new Float32Array(size);
  const rivers: River[] = [];

  const flowDir = computeFlowDirection(width, height, elevation, seaLevel);
  const accumulation = computeFlowAccumulation(width, height, flowDir, seaLevel, elevation);

  // ── 候选源点：高累积流量 + 较高海拔 + 有湿度 ──
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (elevation[idx] > seaLevel + 0.08 && accumulation[idx] >= 2 && moisture[idx] > 0.2) {
        // 评分：累积流量为主，湿度加权
        candidates.push({ x, y, score: accumulation[idx] * (0.5 + moisture[idx]) });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  // ── 地理分散选源：避免河流挤在一起 ──
  const minDist = Math.max(8, Math.sqrt((width * height) / Math.max(count, 1)) * 0.4);
  const minDist2 = minDist * minDist;
  const used = new Uint8Array(size);
  const sources: { x: number; y: number }[] = [];
  for (const c of candidates) {
    if (sources.length >= count) break;
    let ok = true;
    for (const s of sources) {
      const dx = c.x - s.x,
        dy = c.y - s.y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (ok) sources.push({ x: c.x, y: c.y });
  }

  const maxAccum = (() => {
    let m = 1;
    for (let i = 0; i < size; i++) if (accumulation[i] > m) m = accumulation[i];
    return m;
  })();

  // ── 追踪每条河流 ──
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const segments: RiverSegment[] = [];
    let cx = src.x,
      cy = src.y,
      steps = 0;
    const maxSteps = Math.max(width, height) * 4;

    while (steps < maxSteps) {
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) break;
      const idx = cy * width + cx;
      if (elevation[idx] <= seaLevel) break; // 入海
      if (used[idx] && steps > 0) break; // 汇入已有河流

      // 宽度由累积流量开方驱动（Azgaar 风格）
      const accNorm = accumulation[idx] / maxAccum;
      const w = 1 + Math.sqrt(accNorm) * 6;
      const depth = 0.05 + Math.sqrt(accNorm) * 0.4;

      segments.push({ x: cx, y: cy, width: w, depth });
      used[idx] = 1;

      const dir = flowDir[idx];
      if (dir < 0) break; // 内陆洼地（湖泊）
      cx += D8_DX[dir];
      cy += D8_DY[dir];
      steps++;
    }

    if (segments.length > 3) {
      rivers.push({
        id: i,
        segments,
        length: segments.length,
        sourceX: segments[0].x,
        sourceY: segments[0].y,
        mouthX: segments[segments.length - 1].x,
        mouthY: segments[segments.length - 1].y,
      });

      // 绘制河流（含宽度羽化）
      for (const s of segments) {
        const idx = s.y * width + s.x;
        const intensity = Math.min(1, s.width / 4);
        if (intensity > riverMask[idx]) {
          riverMask[idx] = intensity;
          riverWidth[idx] = s.width;
          riverDepth[idx] = s.depth;
        }
        const w = Math.floor(s.width / 2) + 1;
        for (let dy = -w; dy <= w; dy++) {
          for (let dx = -w; dx <= w; dx++) {
            const px = s.x + dx,
              py = s.y + dy;
            if (px < 0 || px >= width || py < 0 || py >= height) continue;
            const pidx = py * width + px;
            const dist2 = dx * dx + dy * dy;
            const fall = 1 - Math.min(1, dist2 / (w * w + 1));
            const val = intensity * fall * 0.6;
            if (val > riverMask[pidx]) {
              riverMask[pidx] = val;
              riverWidth[pidx] = s.width * fall;
              riverDepth[pidx] = s.depth * fall;
            }
          }
        }
      }
    }
  }

  return { rivers, riverMask, riverWidth, riverDepth };
}
