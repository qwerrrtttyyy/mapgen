export interface IceResult {
    /** 陆地冰厚 [0,1] */
    landIce: Float32Array;
    /** 海冰厚 [0,1] */
    seaIce: Float32Array;
    /** 冰川流向 x（用于侵蚀与可视化） */
    glacierVx: Float32Array;
    /** 冰川流向 y */
    glacierVy: Float32Array;
}
export interface IceInput {
    width: number;
    height: number;
    elevation: Float32Array;
    seaLevel: number;
    temperature: Float32Array;
    snowLine: number;
    /** 极地纬度阈值（absLat > 此值 → 海冰可能） */
    polarLatThreshold?: number;
    seed: number;
}
/**
 * 计算冰盖场并就地应用冰川侵蚀。
 * 约定：y=0 南极（lat=-1）、y=H 北极（lat=+1）。
 */
export declare function computeIceSheet(input: IceInput): IceResult;
