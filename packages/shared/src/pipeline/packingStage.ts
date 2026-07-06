import { classifyBiome } from '../texturePack.js';
import { getBiomeInfo } from '../biomes.js';
import type { MapData, MapParams } from '../index.js';
import type { TectonicState } from './tectonicStage.js';
import type { ClimateState } from './climateStage.js';
import type { RiverState } from './riverStage.js';
import type { RegionState } from './regionStage.js';
import { f32, u8 } from './typedArrays.js';

export function runPackingStage(
  width: number,
  height: number,
  seed: number,
  params: MapParams,
  tectonic: TectonicState,
  climate: ClimateState,
  riverState: RiverState,
  regionState: RegionState
): MapData {
  const size = width * height;
  const plateTex = f32(size * 4);
  const elevTex = f32(size * 4);
  const moistTex = f32(size * 4);
  const riverTex = f32(size * 4);
  const tempTex = f32(size * 4);
  const currentTex = f32(size * 4);
  const iceTex = f32(size * 4);
  const biomeTex = f32(size * 4);
  const watershedTex = f32(size * 4);
  const volcanismTex = f32(size * 4);

  const plateTypeArr = u8(tectonic.plates.length);
  for (let i = 0; i < tectonic.plates.length; i++) {
    plateTypeArr[i] = tectonic.plates[i].type === 'continent' ? 1 : 0;
  }

  const invPlateCount = 1 / params.plateCount;
  const inv4 = 0.25;
  const inv13 = 1 / 15;
  const inv31 = 1 / 31;
  const inv7 = 1 / 7;
  const seaLevel = params.seaLevel;
  const snowLine = params.snowLine;

  const elevation = climate.elevation;
  const slope = climate.slope;
  const temperature = climate.temperature;
  const tempZone = climate.tempZone;
  const moisture = climate.moisture;
  const rainfall = climate.rainfall;
  const plateId = tectonic.plateId;
  const boundary = tectonic.boundary;
  const plateDist = tectonic.plateDist;
  const ridge = climate.ridge;
  const ridgeMask = climate.ridgeMask;
  const currentVx = climate.currentVx;
  const currentVy = climate.currentVy;
  const currentTempDelta = climate.currentTempDelta;
  const currentSpeed = climate.currentSpeed;
  const landIce = climate.landIce;
  const seaIce = climate.seaIce;
  const glacierVx = climate.glacierVx;
  const glacierVy = climate.glacierVy;
  const riverMask = riverState.riverMask;
  const riverWidth = riverState.riverWidth;
  const riverDepth = riverState.riverDepth;
  const lakes = riverState.lakes;
  const biomeId = riverState.biomeId;
  const biomeNormalized = riverState.biomeNormalized;
  const basinId = riverState.basinId;
  const isDivide = riverState.isDivide;
  const streamOrder = riverState.streamOrder;
  const volcanoProb = riverState.volcanoProb;
  const calderaMask = riverState.calderaMask;
  const seasonTex = riverState.seasonTex;
  const volcanoSites = riverState.volcanoSites;
  const hotspots = riverState.hotspots;

  for (let i = 0; i < size; i++) {
    const pid = plateId[i] | 0;
    const i4 = i * 4;
    const elev = elevation[i];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * inv4;

    plateTex[i4 + 0] = pid * invPlateCount;
    plateTex[i4 + 1] = plateTypeArr[pid];
    plateTex[i4 + 2] = boundary[i];
    plateTex[i4 + 3] = plateDist[i];
    elevTex[i4 + 0] = elev;
    elevTex[i4 + 1] = slope[i];
    elevTex[i4 + 2] = ridge[i];
    elevTex[i4 + 3] = ridgeMask[i];
    moistTex[i4 + 0] = moist;
    moistTex[i4 + 1] = rainfall[i];
    moistTex[i4 + 2] = temp;
    moistTex[i4 + 3] = tz;
    riverTex[i4 + 0] = riverMask[i];
    riverTex[i4 + 1] = riverWidth[i];
    riverTex[i4 + 2] = riverDepth[i];
    riverTex[i4 + 3] = lakes[i];

    const simpleBiome = classifyBiome(elev, temp, moist, seaLevel, snowLine);
    const advancedBiome = biomeNormalized[i];
    const useAdvanced = params.enableAdvancedBiomes !== false && advancedBiome > 0;
    tempTex[i4 + 0] = temp;
    tempTex[i4 + 1] = tz;
    tempTex[i4 + 2] = useAdvanced ? advancedBiome : simpleBiome * inv13;
    tempTex[i4 + 3] = 0;

    currentTex[i4 + 0] = (currentVx[i] + 1) * 0.5;
    currentTex[i4 + 1] = (currentVy[i] + 1) * 0.5;
    currentTex[i4 + 2] = (currentTempDelta[i] + 1) * 0.5;
    currentTex[i4 + 3] = Math.min(1, currentSpeed[i] * 4);

    iceTex[i4 + 0] = landIce[i];
    iceTex[i4 + 1] = seaIce[i];
    iceTex[i4 + 2] = (glacierVx[i] + 1) * 0.5;
    iceTex[i4 + 3] = (glacierVy[i] + 1) * 0.5;

    const bId = biomeId[i];
    const bInfo = getBiomeInfo(bId);
    biomeTex[i4 + 0] = bId * inv31;
    biomeTex[i4 + 1] = bInfo.isLand ? 1 : 0;
    biomeTex[i4 + 2] = ['X', 'A', 'B', 'C', 'D', 'E', 'M'].indexOf(bInfo.koppen) * inv7;
    biomeTex[i4 + 3] = streamOrder[i] * inv7;

    const b = basinId[i];
    watershedTex[i4 + 0] = b < 0 ? 0 : Math.min(1, b / 65535);
    watershedTex[i4 + 1] = isDivide[i];
    watershedTex[i4 + 2] = streamOrder[i] * inv7;

    volcanismTex[i4 + 0] = volcanoProb[i];
    volcanismTex[i4 + 1] = calderaMask[i] * 0.5;
    volcanismTex[i4 + 2] =
      hotspots.length > 0 ? Math.max(...hotspots.map(h => h.strength)) * 0.5 : 0;
    volcanismTex[i4 + 3] = 0;
  }

  const mapData: MapData = {
    width,
    height,
    plateTex,
    elevTex,
    moistTex,
    riverTex,
    tempTex,
    currentTex,
    iceTex,
    coastDist: climate.coastDist,
    biomeTex,
    watershedTex,
    volcanismTex,
    seasonTex,
    volcanoSites,
    hotspots,
    plates: tectonic.plates,
    regions: regionState.regions,
    rivers: riverState.rivers,
    names: regionState.names,
    seed,
  };

  return mapData;
}
