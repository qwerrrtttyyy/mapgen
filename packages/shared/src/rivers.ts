import { BinaryHeap } from './structs/heap.js';

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

// 8 邻居方向（与 erosion.ts 的 EROSION_DIRS 一致），避免在内层循环中重新分配 [dx, dy] 数组
const RIVER_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);

/**
 * 预计算 8 邻居线性偏移量，避免内层循环中重复计算 dx + dy*width。
 */
function buildNeighborOffsets(width: number): Int32Array {
  const offsets = new Int32Array(8);
  for (let d = 0; d < 8; d++) {
    offsets[d] = RIVER_DIRS[d * 2] + RIVER_DIRS[d * 2 + 1] * width;
  }
  return offsets;
}

interface RiverSource {
  x: number;
  y: number;
  score: number;
  idx: number; // 插入顺序，用作同分数时的稳定排序 tie-breaker
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

  // 用 max-heap 按 score 降序出堆；同分数时按插入顺序（idx 升序）保证与 Array.sort 稳定排序等价
  const heap = new BinaryHeap<RiverSource>((a, b) => b.score - a.score || a.idx - b.idx);

  let sourceIdx = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      if (elev > seaLevel + 0.2 && elev < 0.9) {
        heap.push({ x, y, score: elev * moisture[idx], idx: sourceIdx++ });
      }
    }
  }

  const used = new Uint8Array(size);
  const offsets = buildNeighborOffsets(width);
  const maxRivers = Math.min(count, heap.size);

  for (let i = 0; i < maxRivers; i++) {
    const src = heap.pop()!;
    if (used[src.y * width + src.x]) continue;

    const segments: RiverSegment[] = [];
    let cx = src.x, cy = src.y, steps = 0;
    const maxSteps = Math.max(width, height) * 2;

    while (steps < maxSteps) {
      const idx = cy * width + cx;
      if (used[idx] || elevation[idx] <= seaLevel) break;

      segments.push({
        x: cx, y: cy,
        width: 1 + Math.floor(segments.length / 20),
        depth: 0.1 + segments.length * 0.001
      });
      used[idx] = 1;

      let minE = elevation[idx], nx = cx, ny = cy;
      // 内部点使用预计算线性偏移（无跨行回绕风险）；边界点逐方向校验
      if (cx > 0 && cx < width - 1 && cy > 0 && cy < height - 1) {
        for (let d = 0; d < 8; d++) {
          const pidx = idx + offsets[d];
          if (elevation[pidx] < minE) {
            minE = elevation[pidx];
            nx = cx + RIVER_DIRS[d * 2];
            ny = cy + RIVER_DIRS[d * 2 + 1];
          }
        }
      } else {
        for (let d = 0; d < 8; d++) {
          const px = cx + RIVER_DIRS[d * 2];
          const py = cy + RIVER_DIRS[d * 2 + 1];
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          const pidx = py * width + px;
          if (elevation[pidx] < minE) { minE = elevation[pidx]; nx = px; ny = py; }
        }
      }

      if (nx === cx && ny === cy) break;
      cx = nx; cy = ny; steps++;
    }

    if (segments.length > 5) {
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
