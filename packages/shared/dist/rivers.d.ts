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
export declare function generateRivers(width: number, height: number, elevation: Float32Array, moisture: Float32Array, seaLevel: number, count: number, seed: number): {
    rivers: River[];
    riverMask: Float32Array;
    riverWidth: Float32Array;
    riverDepth: Float32Array;
};
