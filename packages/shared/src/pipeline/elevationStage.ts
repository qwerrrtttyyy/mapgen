import { generateElevation, hydraulicErosion } from '../erosion.js';
import type { MapParams } from '../index.js';
import type { TectonicState } from './tectonicStage.js';
import { f32 } from './typedArrays.js';

export interface ElevationState {
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
    return {
      elevation: f32(size).fill(params.seaLevel - 0.3),
      slope: f32(size),
      ridge: f32(size),
      ridgeMask: f32(size),
    };
  }

  const elevResult = generateElevation(
    width, height, seed,
    tectonic.plateId, tectonic.plates, tectonic.plateDist, tectonic.tectonicForce,
    params.noiseType, params.fbmType, params.octaves,
    params.lacunarity, params.persistence, params.seaLevel,
    params.mountainFold, params.coastDetail
  );

  let elevation = elevResult.elevation;
  if (params.erosionIterations > 0 && params.erosionStrength > 0) {
    elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength, 0.01);
  }

  return {
    elevation,
    slope: elevResult.slope,
    ridge: elevResult.ridge,
    ridgeMask: elevResult.ridgeMask,
  };
}
