import { type NoiseType, type FbmType } from './noise.js';
import type { Plate } from './tectonic.js';
export declare function generateElevation(width: number, height: number, seed: number, plateId: Float32Array, plates: Plate[], plateDist: Float32Array, tectonicForce: Float32Array, noiseType: NoiseType, fbmType: FbmType, octaves: number, lacunarity: number, persistence: number, seaLevel: number, mountainFold: number, coastDetail: number): {
    elevation: Float32Array;
    slope: Float32Array;
    ridge: Float32Array;
    ridgeMask: Float32Array;
};
export declare function hydraulicErosion(width: number, height: number, elevation: Float32Array, iterations: number, strength: number, evaporationRate?: number): Float32Array;
export declare function generateLakes(width: number, height: number, elevation: Float32Array, seaLevel: number, lakeDensity: number, seed: number): Float32Array;
