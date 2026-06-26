export interface Region {
  id: number;
  name: string;
  type: string;
  area: number;
  population: number;
  centerX: number;
  centerY: number;
  avgElevation: number;
  avgMoisture: number;
  avgTemperature: number;
  plateId: number;
  color: number[];
  selected: boolean;
}

export interface ClimateData {
  temperature: Float32Array;
  tempZone: Float32Array;
  moisture: Float32Array;
  rainfall: Float32Array;
}

const REGION_COLORS: Record<string, number[]> = {
  mountain: [0.55, 0.45, 0.35],
  plateau: [0.65, 0.55, 0.45],
  hill: [0.45, 0.65, 0.35],
  plain: [0.55, 0.75, 0.35],
  desert: [0.85, 0.75, 0.45],
  forest: [0.25, 0.55, 0.25],
  wetland: [0.35, 0.55, 0.45],
  tundra: [0.75, 0.85, 0.85],
  ice: [0.9, 0.95, 1.0],
  basin: [0.45, 0.55, 0.65],
};

function classifyRegionType(elev: number, moist: number, temp: number): string {
  if (elev > 0.7) return 'mountain';
  if (elev > 0.5) return 'plateau';
  if (elev > 0.3) return 'hill';
  if (temp < 0.2) return 'tundra';
  if (moist < 0.2 && temp > 0.5) return 'desert';
  if (moist > 0.7 && temp > 0.4) return 'wetland';
  if (moist > 0.5 && temp > 0.3) return 'forest';
  return 'plain';
}

export function analyzeRegions(
  width: number, height: number, elevation: Float32Array, moisture: Float32Array,
  temperature: Float32Array, plateId: Float32Array, seaLevel: number, seed: number
): Region[] {
  const size = width * height;
  const visited = new Uint8Array(size);
  const regions: Region[] = [];
  let regionId = 0;

  const dirs = [-1, 1, -width, width];

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (visited[idx] || elevation[idx] <= seaLevel) continue;

      const elev = elevation[idx];
      const moist = moisture[idx];
      const temp = temperature[idx];
      const type = classifyRegionType(elev, moist, temp);

      const stack: number[] = [idx];
      const pixels: number[] = [];
      let sumElev = 0, sumMoist = 0, sumTemp = 0, sumX = 0, sumY = 0;
      const pid = plateId[idx];

      while (stack.length > 0) {
        const ci = stack.pop()!;
        if (visited[ci]) continue;
        visited[ci] = 1;
        pixels.push(ci);

        const cx = ci % width;
        const cy = (ci / width) | 0;
        sumElev += elevation[ci];
        sumMoist += moisture[ci];
        sumTemp += temperature[ci];
        sumX += cx;
        sumY += cy;

        for (const d of dirs) {
          const ni = ci + d;
          const nx = ni % width;
          const ny = (ni / width) | 0;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (visited[ni]) continue;
          if (elevation[ni] <= seaLevel) continue;
          if (plateId[ni] !== pid) continue;

          const ne = elevation[ni];
          const nt = classifyRegionType(ne, moisture[ni], temperature[ni]);
          if (nt !== type && Math.abs(ne - elev) > 0.2) continue;
          stack.push(ni);
        }
      }

      if (pixels.length > 50) {
        const len = pixels.length;
        regions.push({
          id: regionId,
          name: `${type}_${regionId}`,
          type,
          area: len,
          population: Math.floor(len * (moisture[idx] + 0.1) * 100),
          centerX: sumX / len,
          centerY: sumY / len,
          avgElevation: sumElev / len,
          avgMoisture: sumMoist / len,
          avgTemperature: sumTemp / len,
          plateId: pid,
          color: REGION_COLORS[type] || [0.5, 0.5, 0.5],
          selected: false,
        });
        regionId++;
      }
    }
  }

  return regions;
}

export function computeClimate(
  width: number, height: number, elevation: Float32Array, seaLevel: number,
  tempOffset: number, snowLine: number
): ClimateData {
  const size = width * height;
  const temperature = new Float32Array(size);
  const tempZone = new Float32Array(size);
  const moisture = new Float32Array(size);
  const rainfall = new Float32Array(size);

  const invH = 1 / height;
  for (let y = 0; y < height; y++) {
    const lat = Math.abs(y * invH - 0.5) * 2;
    const latMoist = 0.3 + (1 - lat) * 0.4;
    const latSin = Math.sin(y * invH * Math.PI) * 0.2;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const elev = elevation[idx];

      let temp = 1 - lat - elev * 0.5 + tempOffset;
      temp = temp < -1 ? -1 : temp > 1 ? 1 : temp;
      temperature[idx] = temp;

      if (temp > 0.6) tempZone[idx] = 0;
      else if (temp > 0.3) tempZone[idx] = 1;
      else if (temp > 0) tempZone[idx] = 2;
      else if (temp > -0.3) tempZone[idx] = 3;
      else tempZone[idx] = 4;

      let moist: number;
      if (elev <= seaLevel) {
        moist = 0.9;
      } else {
        moist = latMoist + latSin;
      }
      moisture[idx] = moist < 0 ? 0 : moist > 1 ? 1 : moist;
      rainfall[idx] = moisture[idx] * (temp + 0.5 > 0 ? temp + 0.5 : 0);
    }
  }

  return { temperature, tempZone, moisture, rainfall };
}
