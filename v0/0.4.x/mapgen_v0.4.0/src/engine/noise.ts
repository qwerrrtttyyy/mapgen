// 高性能噪声引擎：Simplex / Perlin / Value / Worley

const PERM = new Uint8Array(512);
const GRAD3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

function seedPermutation(seed: number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
  const g = GRAD3[hash & 11];
  return g[0] * x + g[1] * y;
}

export class NoiseEngine {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
    seedPermutation(seed);
  }

  // 2D Perlin noise
  perlin2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = PERM[X] + Y;
    const B = PERM[X + 1] + Y;
    return lerp(
      lerp(grad(PERM[A], x, y), grad(PERM[B], x - 1, y), u),
      lerp(grad(PERM[A + 1], x, y - 1), grad(PERM[B + 1], x - 1, y - 1), u),
      v
    );
  }

  // 2D Simplex noise
  simplex2(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    let i1 = 0, j1 = 0;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = PERM[ii + PERM[jj]] % 12;
      n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 12;
      n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 12;
      n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  // Value noise
  value2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = PERM[X] + Y;
    const B = PERM[X + 1] + Y;
    return lerp(
      lerp(PERM[A] / 255, PERM[B] / 255, u),
      lerp(PERM[A + 1] / 255, PERM[B + 1] / 255, u),
      v
    ) * 2 - 1;
  }

  // Worley / Cellular noise
  worley2(x: number, y: number): number {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    let minDist = 9999;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = X + dx;
        const cy = Y + dy;
        let s = this.hash(cx, cy);
        const px = cx + (s / 2147483647);
        s = (s * 16807) % 2147483647;
        const py = cy + (s / 2147483647);
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (d < minDist) minDist = d;
      }
    }
    return 1 - Math.min(minDist * 2, 1);
  }

  private hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return Math.abs(h);
  }

  // FBM 合成
  fbm(x: number, y: number, octaves: number, lacunarity: number, persistence: number, type: string): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      const n = this.sample(x * frequency, y * frequency);
      let v = n;
      if (type === 'ridged') v = 1 - Math.abs(n);
      else if (type === 'billowy') v = Math.abs(n);
      else if (type === 'warped') {
        const warp = this.sample(x * frequency + n * 0.5, y * frequency + n * 0.5);
        v = warp;
      }
      total += v * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  sample(x: number, y: number): number {
    return this.perlin2(x, y);
  }
}

export function createNoise(seed: number, type: string): NoiseEngine {
  const engine = new NoiseEngine(seed);
  if (type === 'simplex') {
    engine.sample = engine.simplex2.bind(engine);
  } else if (type === 'value') {
    engine.sample = engine.value2.bind(engine);
  } else if (type === 'worley') {
    engine.sample = engine.worley2.bind(engine);
  } else {
    engine.sample = engine.perlin2.bind(engine);
  }
  return engine;
}

// 全局单例缓存，避免重复创建
const noiseCache = new Map<string, NoiseEngine>();

export function getCachedNoise(seed: number, type: string): NoiseEngine {
  const key = `${seed}_${type}`;
  if (!noiseCache.has(key)) {
    noiseCache.set(key, createNoise(seed, type));
  }
  return noiseCache.get(key)!;
}

export function clearNoiseCache() {
  noiseCache.clear();
}
