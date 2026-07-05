export interface Plate {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 'continent' | 'ocean';
    color: number[];
    area: number;
    boundary: number;
    growth: number;
    elevation: number;
    moisture: number;
    temperature: number;
    name: string;
    selected: boolean;
}
export type BoundaryType = 0 | 1 | 2 | 3;
export declare function generatePlates(seed: number, count: number, width: number, height: number, landmass: number): Plate[];
export declare function assignPlates(width: number, height: number, plates: Plate[]): {
    plateId: Float32Array;
    plateDist: Float32Array;
};
export declare function computeBoundaries(width: number, height: number, plateId: Float32Array): Float32Array;
export declare function computeBoundaryTypes(width: number, height: number, plateId: Float32Array, plates: Plate[]): {
    boundaryType: Uint8Array;
    boundaryIntensity: Float32Array;
};
