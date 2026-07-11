import { lerp, clamp } from './utils.js';

const GRAD3: number[][] = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

/**
 * 生成种子排列数组（用于噪声哈希）
 * @param seed - 随机种子
 * @returns 512 长度的排列数组
 */
function seedPermutation(seed: number): Uint8Array {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/**
 * 平滑阶跃函数 - 用于噪声插值
 * @param t - 输入值 [0, 1]
 * @returns 平滑后的值
 */
function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }

/**
 * 根据哈希值计算梯度点积
 * @param hash - 哈希值
 * @param x - X 坐标
 * @param y - Y 坐标
 * @returns 梯度点积结果
 */
function grad(hash: number, x: number, y: number): number {
  const g = GRAD3[hash & 11];
  return g[0] * x + g[1] * y;
}

/**
 * 噪声类型枚举
 */
export type NoiseType = 'perlin' | 'simplex' | 'value' | 'worley';
/**
 * FBM（分形布朗运动）类型枚举
 */
export type FbmType = 'standard' | 'ridged' | 'billowy' | 'warped';

const WORLEY_CACHE_MAX = 10000;

export class NoiseEngine {
  seed: number;
  sample: (x: number, y: number) => number;
  private perm: Uint8Array;
  private worleyCache = new Map<string, { x: number; y: number }[]>();
  private cacheInsertOrder: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.perm = seedPermutation(seed);
    this.sample = this.perlin2.bind(this);
  }

  perlin2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const p = this.perm;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return lerp(
      lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
      lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
      v
    );
  }

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
    const p = this.perm;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = p[ii + p[jj]] % 12;
      n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = p[ii + i1 + p[jj + j1]] % 12;
      n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = p[ii + 1 + p[jj + 1]] % 12;
      n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  value2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const p = this.perm;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return lerp(
      lerp(p[A] / 255, p[B] / 255, u),
      lerp(p[A + 1] / 255, p[B + 1] / 255, u),
      v
    ) * 2 - 1;
  }

  private _worleyDistances(x: number, y: number): { f1: number; f2: number } {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    let f1 = 9999, f2 = 9999;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = X + dx;
        const cy = Y + dy;
        const key = `${cx},${cy}`;
        let pts = this.worleyCache.get(key);
        if (!pts) {
          let s = this._hash(cx, cy);
          const px = cx + (s / 2147483647);
          s = (s * 16807) % 2147483647;
          const py = cy + (s / 2147483647);
          pts = [{ x: px, y: py }];
          this.worleyCache.set(key, pts);
          this.cacheInsertOrder.push(key);
          if (this.cacheInsertOrder.length > WORLEY_CACHE_MAX) {
            const oldest = this.cacheInsertOrder.shift()!;
            this.worleyCache.delete(oldest);
          }
        }
        const { x: px, y: py } = pts[0];
        const dx_ = x - px;
        const dy_ = y - py;
        const d = Math.sqrt(dx_ * dx_ + dy_ * dy_);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
    return { f1, f2 };
  }

  worley2(x: number, y: number): number {
    const { f1 } = this._worleyDistances(x, y);
    return 1 - Math.min(f1 * 2, 1);
  }

  worleyF2F1(x: number, y: number): number {
    const { f1, f2 } = this._worleyDistances(x, y);
    return f2 - f1;
  }

  clearCache(): void {
    this.worleyCache.clear();
    this.cacheInsertOrder = [];
  }

  _hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return Math.abs(h) % 2147483647;
  }

  fbm(x: number, y: number, octaves: number, lacunarity: number, persistence: number, type: FbmType = 'standard'): number {
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

  /**
   * 自然 FBM 体系（AC-1.1, AC-1.2）：
   * - 谱权重：w_i = persistence^i × (1 - 0.4·i/(oct-1))，抑制高频过强导致的网格伪影
   * - 域形变：低频独立噪声扰动采样坐标，让海岸线/等高线有机化
   * - 各向异性（ridged）：沿 ridgeAngle 拉伸，山脊连续
   */
  fbmNatural(
    x: number, y: number, octaves: number, lacunarity: number, persistence: number,
    type: FbmType = 'standard',
    opts?: { warpStrength?: number; ridgeAngle?: number; anisotropy?: number }
  ): number {
    const warpStrength = opts?.warpStrength ?? 0.35;
    const ridgeAngle = opts?.ridgeAngle ?? 0;
    const anisotropy = opts?.anisotropy ?? 0;

    // 域形变：用偏移坐标的独立低频噪声扰动采样点
    let wx = x, wy = y;
    if (warpStrength > 0) {
      const w1 = this.sample(x * 0.5 + 100.3, y * 0.5 + 100.3);
      const w2 = this.sample(x * 0.5 + 200.7, y * 0.5 + 200.7);
      wx = x + w1 * warpStrength * 0.3;
      wy = y + w2 * warpStrength * 0.3;
    }

    // 各向异性：旋转到 ridge 局部坐标系，沿垂直方向拉伸使山脊沿 ridgeAngle 延伸
    let sx = wx, sy = wy;
    if (anisotropy > 0 && type === 'ridged') {
      const cos = Math.cos(ridgeAngle), sin = Math.sin(ridgeAngle);
      const xr = wx * cos + wy * sin;       // 沿山脊方向
      const yr = -wx * sin + wy * cos;      // 垂直山脊方向
      sx = xr;
      sy = yr * (1 + anisotropy);
    }

    let total = 0;
    let frequency = 1;
    let maxValue = 0;
    const oct = Math.max(1, octaves);
    for (let i = 0; i < oct; i++) {
      // 谱权重：高频衰减补偿
      const spectral = oct > 1 ? (1 - 0.4 * i / (oct - 1)) : 1;
      const amplitude = Math.pow(persistence, i) * spectral;
      const n = this.sample(sx * frequency, sy * frequency);
      let v: number;
      if (type === 'ridged') {
        v = 1 - Math.abs(n);
      } else if (type === 'billowy') {
        v = Math.abs(n);
      } else if (type === 'warped') {
        v = this.sample(sx * frequency + n * 0.5, sy * frequency + n * 0.5);
      } else {
        v = n;
      }
      total += v * amplitude;
      maxValue += amplitude;
      frequency *= lacunarity;
    }
    return maxValue > 0 ? total / maxValue : 0;
  }
}

export function createNoise(seed: number, type: NoiseType = 'perlin'): NoiseEngine {
  const engine = new NoiseEngine(seed);
  if (type === 'simplex') engine.sample = engine.simplex2.bind(engine);
  else if (type === 'value') engine.sample = engine.value2.bind(engine);
  else if (type === 'worley') engine.sample = engine.worley2.bind(engine);
  else engine.sample = engine.perlin2.bind(engine);
  return engine;
}

export function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}
