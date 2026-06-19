export function generateRivers(width, height, elevation, moisture, seaLevel, count, seed) {
  const size = width * height;
  const riverMask = new Float32Array(size);
  const riverWidth = new Float32Array(size);
  const riverDepth = new Float32Array(size);
  const rivers = [];
  const sources = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      if (elev > seaLevel + 0.2 && elev < 0.9) {
        sources.push({ x, y, score: elev * moisture[idx] });
      }
    }
  }
  sources.sort((a, b) => b.score - a.score);
  const used = new Uint8Array(size);
  const maxRivers = Math.min(count, sources.length);
  for (let i = 0; i < maxRivers; i++) {
    const src = sources[i];
    if (used[src.y * width + src.x]) continue;
    const segments = [];
    let cx = src.x, cy = src.y, steps = 0;
    const maxSteps = Math.max(width, height) * 2;
    while (steps < maxSteps) {
      const idx = cy * width + cx;
      if (used[idx] || elevation[idx] <= seaLevel) break;
      segments.push({ x: cx, y: cy, width: 1 + Math.floor(segments.length / 20), depth: 0.1 + segments.length * 0.001 });
      used[idx] = 1;
      let minE = elevation[idx], nx = cx, ny = cy;
      const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
      for (const [dx, dy] of dirs) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const pidx = py * width + px;
        if (elevation[pidx] < minE) { minE = elevation[pidx]; nx = px; ny = py; }
      }
      if (nx === cx && ny === cy) break;
      cx = nx; cy = ny; steps++;
    }
    if (segments.length > 5) {
      rivers.push({
        id: i, segments, length: segments.length,
        sourceX: segments[0].x, sourceY: segments[0].y,
        mouthX: segments[segments.length - 1].x, mouthY: segments[segments.length - 1].y,
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
              if (!riverMask[pidx]) { riverMask[pidx] = 0.7; riverWidth[pidx] = s.width * 0.7; riverDepth[pidx] = s.depth * 0.7; }
            }
          }
        }
      }
    }
  }
  return { rivers, riverMask, riverWidth, riverDepth };
}
