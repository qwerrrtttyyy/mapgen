/**
 * High-performance connected components labeling using Two-Pass algorithm
 * with Union-Find (Disjoint Set Union) with path compression and union by rank.
 *
 * Reference: "A linear-time component-labeling algorithm using contour tracing technique"
 * and the standard Rosenfeld-Pfaltz two-pass algorithm optimized with DSU.
 */

export interface ComponentStats {
  id: number;
  area: number;
  sumX: number;
  sumY: number;
  label: number;
}

/**
 * Union-Find data structure with path compression and union by rank.
 * Uses Int32Array for performance over plain objects/arrays.
 */
class UnionFind {
  parent: Int32Array;
  rank: Uint8Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    this.rank = new Uint8Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

/**
 * Label connected components using Two-Pass algorithm with Union-Find.
 * 4-connectivity (up, down, left, right).
 *
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @param shouldLabel - predicate function(i) returning true if pixel i is foreground
 * @param areConnected - predicate function(i, j) returning true if pixels i and j should be in the same component
 * @returns Int32Array of component labels (0 = background/unlabeled), and number of unique components
 */
export function labelComponents(
  width: number,
  height: number,
  shouldLabel: (i: number) => boolean,
  areConnected: (i: number, j: number) => boolean,
): { labels: Int32Array; count: number } {
  const size = width * height;
  const labels = new Int32Array(size);
  const uf = new UnionFind(size + 1);
  let nextLabel = 1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (!shouldLabel(i)) continue;

      let left = 0;
      let up = 0;

      if (x > 0 && labels[i - 1] > 0 && areConnected(i, i - 1)) {
        left = labels[i - 1];
      }
      if (y > 0 && labels[i - width] > 0 && areConnected(i, i - width)) {
        up = labels[i - width];
      }

      if (left === 0 && up === 0) {
        labels[i] = nextLabel++;
      } else if (left !== 0 && up === 0) {
        labels[i] = left;
      } else if (left === 0 && up !== 0) {
        labels[i] = up;
      } else {
        labels[i] = Math.min(left, up);
        if (left !== up) uf.union(left, up);
      }
    }
  }

  const remap = new Int32Array(nextLabel);
  let componentCount = 0;
  for (let i = 1; i < nextLabel; i++) {
    if (uf.find(i) === i) {
      remap[i] = ++componentCount;
    }
  }
  for (let i = 1; i < nextLabel; i++) {
    if (remap[i] === 0) {
      remap[i] = remap[uf.find(i)];
    }
  }

  for (let i = 0; i < size; i++) {
    if (labels[i] > 0) {
      labels[i] = remap[labels[i]];
    }
  }

  return { labels, count: componentCount };
}

/**
 * Compute per-component statistics (area, centroid numerators) from a label array.
 * Returns a map from component ID to stats, plus the background label (0) is skipped.
 */
export function computeComponentStats(
  width: number,
  height: number,
  labels: Int32Array,
): Map<number, ComponentStats> {
  const stats = new Map<number, ComponentStats>();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const lbl = labels[i];
      if (lbl === 0) continue;
      let s = stats.get(lbl);
      if (!s) {
            s = { id: lbl, area: 0, sumX: 0, sumY: 0, label: lbl };
            stats.set(lbl, s);
      }
      s.area++;
      s.sumX += x;
      s.sumY += y;
    }
  }
  return stats;
}

/**
 * High-performance flood fill using a pre-allocated typed-array stack.
 * Significantly faster than JS Array push/pop for large regions.
 *
 * @param startIdx starting pixel index
 * @param width image width
 * @param height image height
 * @param visited Uint8Array marking visited pixels (modified in-place)
 * @param shouldVisit predicate(i) returning true if pixel i should be included
 * @param onVisit callback(i, x, y) called for each visited pixel
 */
export function fastFloodFill(
  startIdx: number,
  width: number,
  height: number,
  visited: Uint8Array,
  shouldVisit: (i: number) => boolean,
  onVisit: (i: number, x: number, y: number) => void,
): number {
  const size = width * height;
  const stack = new Int32Array(size);
  let top = 0;
  stack[top++] = startIdx;
  let count = 0;
  const dirs = [-1, 1, -width, width];

  while (top > 0) {
    const ci = stack[--top];
    if (visited[ci]) continue;
    const cx = ci % width;
    const cy = (ci / width) | 0;

    visited[ci] = 1;
    count++;
    onVisit(ci, cx, cy);

    for (let d = 0; d < 4; d++) {
      const di = dirs[d];
      const ni = ci + di;
      if (ni < 0 || ni >= size) continue;
      if (visited[ni]) continue;
      if (di === -1 && cx === 0) continue;
      if (di === 1 && cx === width - 1) continue;
      if (di === -width && cy === 0) continue;
      if (di === width && cy === height - 1) continue;
      if (!shouldVisit(ni)) continue;
      stack[top++] = ni;
    }
  }
  return count;
}
