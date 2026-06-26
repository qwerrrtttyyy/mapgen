export function analyzeRegions(width, height, elevation, moisture, temperature, plateId, seaLevel, seed) {
  const size = width * height;
  const visited = new Uint8Array(size);
  const regions = [];
  let regionId = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || elevation[idx] <= seaLevel) continue;
      const elev = elevation[idx];
      const moist = moisture[idx];
      const temp = temperature[idx];
      let type = 'plain';
      if (elev > 0.7) type = 'mountain';
      else if (elev > 0.5) type = 'plateau';
      else if (elev > 0.3) type = 'hill';
      else if (temp < 0.2) type = 'tundra';
      else if (moist < 0.2 && temp > 0.5) type = 'desert';
      else if (moist > 0.7 && temp > 0.4) type = 'wetland';
      else if (moist > 0.5 && temp > 0.3) type = 'forest';
      const stack = [idx];
      const pixels = [];
      let sumElev = 0, sumMoist = 0, sumTemp = 0, sumX = 0, sumY = 0;
      const pid = plateId[idx];
      while (stack.length > 0) {
        const ci = stack.pop();
        if (visited[ci]) continue;
        visited[ci] = 1;
        pixels.push(ci);
        const cx = ci % width;
        const cy = Math.floor(ci / width);
        sumElev += elevation[ci];
        sumMoist += moisture[ci];
        sumTemp += temperature[ci];
        sumX += cx;
        sumY += cy;
        for (const d of [-1, 1, -width, width]) {
          const ni = ci + d;
          const nx = ni % width;
          const ny = Math.floor(ni / width);
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (visited[ni]) continue;
          if (elevation[ni] <= seaLevel) continue;
          if (plateId[ni] !== pid) continue;
          const ne = elevation[ni];
          let nt = 'plain';
          if (ne > 0.7) nt = 'mountain';
          else if (ne > 0.5) nt = 'plateau';
          else if (ne > 0.3) nt = 'hill';
          if (nt !== type && Math.abs(ne - elev) > 0.2) continue;
          stack.push(ni);
        }
      }
      if (pixels.length > 50) {
        const REGION_COLORS = {
          mountain: [0.55, 0.45, 0.35], plateau: [0.65, 0.55, 0.45],
          hill: [0.45, 0.65, 0.35], plain: [0.55, 0.75, 0.35],
          desert: [0.85, 0.75, 0.45], forest: [0.25, 0.55, 0.25],
          wetland: [0.35, 0.55, 0.45], tundra: [0.75, 0.85, 0.85],
          ice: [0.9, 0.95, 1.0], basin: [0.45, 0.55, 0.65],
        };
        regions.push({
          id: regionId, name: `${type}_${regionId}`, type,
          area: pixels.length,
          population: Math.floor(pixels.length * (moisture[idx] + 0.1) * 100),
          centerX: sumX / pixels.length, centerY: sumY / pixels.length,
          avgElevation: sumElev / pixels.length,
          avgMoisture: sumMoist / pixels.length,
          avgTemperature: sumTemp / pixels.length,
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

export function computeClimate(width, height, elevation, seaLevel, tempOffset, snowLine) {
  const size = width * height;
  const temperature = new Float32Array(size);
  const tempZone = new Float32Array(size);
  const moisture = new Float32Array(size);
  const rainfall = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      const lat = Math.abs(y / height - 0.5) * 2;
      let temp = 1 - lat - elev * 0.5 + tempOffset;
      temp = Math.max(-1, Math.min(1, temp));
      temperature[idx] = temp;
      if (temp > 0.6) tempZone[idx] = 0;
      else if (temp > 0.3) tempZone[idx] = 1;
      else if (temp > 0) tempZone[idx] = 2;
      else if (temp > -0.3) tempZone[idx] = 3;
      else tempZone[idx] = 4;
      let moist = 0.5;
      if (elev <= seaLevel) { moist = 0.9; }
      else {
        moist = 0.3 + (1 - lat) * 0.4;
        moist += Math.sin(y / height * Math.PI) * 0.2;
      }
      moisture[idx] = Math.max(0, Math.min(1, moist));
      rainfall[idx] = moist * Math.max(0, temp + 0.5);
    }
  }
  return { temperature, tempZone, moisture, rainfall };
}
