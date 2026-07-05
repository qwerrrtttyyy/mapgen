/**
 * 噪声类型枚举
 */
export type NoiseType = 'perlin' | 'simplex' | 'value' | 'worley';
/**
 * FBM（分形布朗运动）类型枚举
 */
export type FbmType = 'standard' | 'ridged' | 'billowy' | 'warped';
export declare class NoiseEngine {
    seed: number;
    sample: (x: number, y: number) => number;
    private perm;
    private worleyCache;
    private cacheInsertOrder;
    constructor(seed: number);
    perlin2(x: number, y: number): number;
    simplex2(x: number, y: number): number;
    value2(x: number, y: number): number;
    private _worleyDistances;
    worley2(x: number, y: number): number;
    worleyF2F1(x: number, y: number): number;
    clearCache(): void;
    _hash(x: number, y: number): number;
    fbm(x: number, y: number, octaves: number, lacunarity: number, persistence: number, type?: FbmType): number;
    /**
     * 自然 FBM 体系（AC-1.1, AC-1.2）：
     * - 谱权重：w_i = persistence^i × (1 - 0.4·i/(oct-1))，抑制高频过强导致的网格伪影
     * - 域形变：低频独立噪声扰动采样坐标，让海岸线/等高线有机化
     * - 各向异性（ridged）：沿 ridgeAngle 拉伸，山脊连续
     */
    fbmNatural(x: number, y: number, octaves: number, lacunarity: number, persistence: number, type?: FbmType, opts?: {
        warpStrength?: number;
        ridgeAngle?: number;
        anisotropy?: number;
    }): number;
}
export declare function createNoise(seed: number, type?: NoiseType): NoiseEngine;
export declare function hashSeed(str: string): number;
