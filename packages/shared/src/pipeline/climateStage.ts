import { computeCoastDistance } from '../coastline.js';
import { computeOceanCurrents } from '../oceanCurrents.js';
import { computeSlope } from '../slope.js';
import { computeClimate } from '../regions.js';
import { computeIceSheet } from '../ice.js';
import type { MapParams } from '../index.js';
import type { ElevationState } from './elevationStage.js';
import type { TectonicState } from './tectonicStage.js';
import { f32 } from './typedArrays.js';

export interface ClimateState {
  coastDist: Float32Array;
  currentVx: Float32Array;
  currentVy: Float32Array;
  currentTempDelta: Float32Array;
  currentSpeed: Float32Array;
  temperature: Float32Array;
  tempZone: Float32Array;
  moisture: Float32Array;
  rainfall: Float32Array;
  landIce: Float32Array;
  seaIce: Float32Array;
  glacierVx: Float32Array;
  glacierVy: Float32Array;
  elevation: Float32Array;
  slope: Float32Array;
  ridge: Float32Array;
  ridgeMask: Float32Array;
}

export function runClimateStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams,
  tectonic: TectonicState,
  elevationState: ElevationState
): ClimateState {
  const size = width * height;
  const isBlank = params.mode === 'blank';

  let coastDist = f32(size);
  let currentVx = f32(size);
  let currentVy = f32(size);
  let currentTempDelta = f32(size);
  let currentSpeed = f32(size);
  let landIce = f32(size);
  let seaIce = f32(size);
  let glacierVx = f32(size);
  let glacierVy = f32(size);
  let elevation = elevationState.elevation;
  let slope = elevationState.slope;

  if (!isBlank) {
    coastDist = computeCoastDistance(width, height, elevation, params.seaLevel);

    if (params.enableOceanCurrents !== false) {
      const currents = computeOceanCurrents({
        width, height, elevation, seaLevel: params.seaLevel,
        coastDist, windDirX: params.windDirX ?? 1, windDirY: params.windDirY ?? 0,
        rainStrength: params.rainStrength ?? 1, seed,
      });
      currentVx = currents.vx;
      currentVy = currents.vy;
      currentTempDelta = currents.tempDelta;
      currentSpeed = currents.speed;
    }
  }

  let temperature: Float32Array;
  let tempZone: Float32Array;
  let moisture: Float32Array;
  let rainfall: Float32Array;

  if (isBlank) {
    temperature = f32(size);
    tempZone = f32(size);
    moisture = f32(size).fill(1);
    rainfall = f32(size);
  } else {
    const climate = computeClimate(
      width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine,
      params.windDirX ?? 1, params.windDirY ?? 0, params.rainStrength ?? 1,
      {
        coastDist,
        currentTempDelta,
        enableContinentality: params.enableContinentality !== false,
        enableOceanCurrents: params.enableOceanCurrents !== false,
        enableHadleyEnhancement: params.enableHadleyEnhancement !== false,
        enableMonsoon: params.enableMonsoon !== false,
      },
    );
    temperature = climate.temperature;
    tempZone = climate.tempZone;
    moisture = climate.moisture;
    rainfall = climate.rainfall;

    if (params.enableIceSheet !== false) {
      const ice = computeIceSheet({
        width, height, elevation, seaLevel: params.seaLevel,
        temperature, snowLine: params.snowLine, seed,
      });
      landIce = ice.landIce;
      seaIce = ice.seaIce;
      glacierVx = ice.glacierVx;
      glacierVy = ice.glacierVy;
      // computeIceSheet 会就地改写传入的 elevation，只需重算 slope
      slope = computeSlope(width, height, elevation);
    }
  }

  return {
    coastDist,
    currentVx, currentVy, currentTempDelta, currentSpeed,
    temperature,
    tempZone,
    moisture,
    rainfall,
    landIce, seaIce, glacierVx, glacierVy,
    elevation,
    slope,
    ridge: elevationState.ridge,
    ridgeMask: elevationState.ridgeMask,
  };
}
