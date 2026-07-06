import { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes, type Plate } from '../tectonic.js';
import type { MapParams } from '../index.js';
import { f32 } from './typedArrays.js';

export interface TectonicState {
  plates: Plate[];
  plateId: Float32Array;
  plateDist: Float32Array;
  boundary: Float32Array;
  tectonicForce: Float32Array;
  boundaryTypeArr: Float32Array;
}

export function runTectonicStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams
): TectonicState {
  const size = width * height;
  const isBlank = params.mode === 'blank';
  let plates: Plate[];
  let plateId: Float32Array;
  let plateDist: Float32Array;
  let boundary: Float32Array;
  let tectonicForce = f32(size);
  let boundaryTypeArr = f32(size);

  if (isBlank) {
    plates = generatePlates(seed, params.plateCount, width, height, 0).map(p => ({ ...p, type: 'ocean' as const }));
    const assigned = assignPlates(width, height, plates);
    plateId = assigned.plateId;
    plateDist = assigned.plateDist;
    boundary = computeBoundaries(width, height, plateId);
    const bt = computeBoundaryTypes(width, height, plateId, plates);
    for (let i = 0; i < boundary.length; i++) {
      if (boundary[i] > 0) boundary[i] = Math.min(1, 0.5 + bt.boundaryIntensity[i] * 0.3);
    }
  } else {
    plates = generatePlates(seed, params.plateCount, width, height, params.landmass);
    const assigned = assignPlates(width, height, plates);
    plateId = assigned.plateId;
    plateDist = assigned.plateDist;
    boundary = computeBoundaries(width, height, plateId);
    const { boundaryType, boundaryIntensity } = computeBoundaryTypes(width, height, plateId, plates);
    for (let i = 0; i < size; i++) boundaryTypeArr[i] = boundaryType[i];
    for (let i = 0; i < size; i++) {
      if (boundary[i] === 0) continue;
      if (boundaryType[i] === 1) tectonicForce[i] = boundaryIntensity[i];
      else if (boundaryType[i] === 2) tectonicForce[i] = -boundaryIntensity[i];
      else if (boundaryType[i] === 3) tectonicForce[i] = boundaryIntensity[i] * 0.3;
    }
    for (let i = 0; i < boundary.length; i++) {
      if (boundary[i] > 0) boundary[i] = Math.min(1, 0.5 + boundaryIntensity[i] * 0.3);
    }
  }

  return { plates, plateId, plateDist, boundary, tectonicForce, boundaryTypeArr };
}
