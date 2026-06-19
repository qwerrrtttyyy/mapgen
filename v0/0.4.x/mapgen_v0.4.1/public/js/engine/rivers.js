import { createNoise } from './noise.js';

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

export function generateLakes(width, height, elevation, seaLevel, lakeDensity, seed) {
  const lakes = new Float32Array(width * height);
  const noise = createNoise(seed + 7, 'simplex');
  const lakeVisited = new Uint8Array(width * height);
  let lakeToken = 0;
  const numLakeSeeds = Math.max(5, Math.floor(width * height * 0.0003 * lakeDensity * 10));
  const lakeQueue = new Int32Array(width * height);
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      if (elev > seaLevel && elev < seaLevel + 0.1) {
        const n = noise.fbm(x / width * 20, y / height * 20, 2, 2, 0.5, 'standard');
        if (n > 1 - lakeDensity) {
          let isLocalMin = true;
          for (let dy = -2; dy <= 2 && isLocalMin; dy++) {
            for (let dx = -2; dx <= 2 && isLocalMin; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ni = (y + dy) * width + (x + dx);
              if (ni >= 0 && ni < width * height && elevation[ni] < elev) isLocalMin = false;
            }
          }
          if (!isLocalMin) continue;
          lakeToken++;
          let sillLevel = elev;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ni = (y + dy) * width + (x + dx);
              if (ni >= 0 && ni < width * height) sillLevel = Math.max(sillLevel, elevation[ni]);
            }
          }
          const fillLevel = Math.max(sillLevel, elev + 0.01);
          let qHead = 0, qTail = 0;
          lakeQueue[qTail++] = idx;
          lakeVisited[idx] = lakeToken;
          while (qHead < qTail) {
            const ci = lakeQueue[qHead++];
            const cy = Math.floor(ci / width), cx = ci % width;
            if (elevation[ci] > fillLevel) continue;
            lakes[ci] = 1;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const ny = cy + dy, nx = cx + dx;
                if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
                const ni = ny * width + nx;
                if (lakeVisited[ni] !== lakeToken && elevation[ni] <= fillLevel) {
                  lakeVisited[ni] = lakeToken;
                  lakeQueue[qTail++] = ni;
                }
              }
            }
          }
        }
      }
    }
  }
  return lakes;
}
