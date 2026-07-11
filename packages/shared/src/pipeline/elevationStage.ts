import { generateElevation, hydraulicErosion } from '../erosion.js';
import type { MapParams } from '../index.js';
import type { TectonicState } from './tectonicStage.js';
import { f32 } from './typedArrays.js';

export interface ElevationState {
  /** 侵蚀前高程（用于 checkpoint / 增量重生成） */
  elevationPre: Float32Array;
  /** 侵蚀后高程（下游计算使用此字段） */
  elevation: Float32Array;
  slope: Float32Array;
  ridge: Float32Array;
  ridgeMask: Float32Array;
}

export function runElevationStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams,
  tectonic: TectonicState
): ElevationState {
  const size = width * height;
  const isBlank = params.mode === 'blank';

  if (isBlank) {
    const elev = f32(size).fill(params.seaLevel - 0.3);
    return {
      elevationPre: elev,
      elevation: elev,
      slope: f32(size),
      ridge: f32(size),
      ridgeMask: f32(size),
    };
  }

  const elevResult = generateElevation(
    width,
    height,
    seed,
    tectonic.plateId,
    tectonic.plates,
    tectonic.plateDist,
    tectonic.tectonicForce,
    params.noiseType,
    params.fbmType,
    params.octaves,
    params.lacunarity,
    params.persistence,
    params.seaLevel,
    params.mountainFold,
    params.coastDetail
  );

  const elevationPre = elevResult.elevation;
  let elevation = elevationPre;
  if (params.erosionIterations > 0 && params.erosionStrength > 0) {
    elevation = hydraulicErosion(
      width,
      height,
      elevation,
      params.erosionIterations,
      params.erosionStrength,
      0.01
    );
  }

  return {
    elevationPre,
    elevation,
    slope: elevResult.slope,
    ridge: elevResult.ridge,
    ridgeMask: elevResult.ridgeMask,
  };
}
