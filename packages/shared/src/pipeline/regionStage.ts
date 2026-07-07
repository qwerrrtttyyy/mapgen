import { analyzeRegions, type Region } from '../regions.js';
import { detectTerrainRegions } from '../editor.js';
import {
  generateNames,
  type NameablePlate,
  type NameableRegion,
  type NameManifest,
} from '../naming.js';
import type { MapParams } from '../types.js';
import type { TectonicState } from './tectonicStage.js';
import type { ClimateState } from './climateStage.js';
import type { RiverState } from './riverStage.js';

export interface RegionState {
  regions: Region[];
  names: NameManifest;
}

export function runRegionStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams,
  tectonic: TectonicState,
  climate: ClimateState,
  riverState: RiverState
): RegionState {
  const regions = analyzeRegions(
    width,
    height,
    climate.elevation,
    climate.moisture,
    climate.temperature,
    tectonic.plateId,
    params.seaLevel,
    seed
  );

  const plateSumX = new Float64Array(tectonic.plates.length);
  const plateSumY = new Float64Array(tectonic.plates.length);
  const plateCount = new Float64Array(tectonic.plates.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pid = tectonic.plateId[y * width + x] | 0;
      plateSumX[pid] += x;
      plateSumY[pid] += y;
      plateCount[pid]++;
    }
  }
  const nameablePlates: NameablePlate[] = tectonic.plates.map((p, i) => ({
    plateId: i,
    type: p.type === 'continent' ? 'continent' : 'ocean',
    centroid:
      plateCount[i] > 0
        ? [plateSumX[i] / plateCount[i], plateSumY[i] / plateCount[i]]
        : [width * 0.5, height * 0.5],
  }));

  const detectedRegions = detectTerrainRegions(
    width,
    height,
    climate.elevation,
    climate.slope,
    climate.moisture,
    params.seaLevel,
    params.snowLine,
    30,
    {
      landIce: climate.landIce,
      coastDist: climate.coastDist,
      riverMask: riverState.riverMask,
      volcanoProb: riverState.volcanoProb,
      biomeId: riverState.biomeId,
      streamOrder: riverState.streamOrder,
      basinId: riverState.basinId,
    }
  );

  const nameableRegions: NameableRegion[] = detectedRegions.map(r => ({
    key: r.key,
    type: r.type,
    centroid: r.centroid,
    area: r.area,
  }));

  const names = generateNames(seed, width, height, nameablePlates, nameableRegions);

  return { regions, names };
}
