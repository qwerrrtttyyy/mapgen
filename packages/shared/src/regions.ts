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
  tempOffset: number, snowLine: number,
  windDirectionX: number = 1,
  windDirectionY: number = 0,
  rainStrength: number = 1
): ClimateData {
  const size = width * height;
  const temperature = new Float32Array(size);
  const tempZone = new Float32Array(size);
  const moisture = new Float32Array(size);
  const rainfall = new Float32Array(size);

  const invH = 1 / height;
  const landRange = 1 - seaLevel;

  // ── 1. 温度场（Azgaar：纬度余弦 + 海拔修正 + 海洋调节）──
  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2; // -1 南极 → 1 北极
    const absLat = Math.abs(lat);
    // 赤道热(1)，极地冷(-0.3)，余弦分布
    const latTemp = 1 - absLat * absLat * 1.3;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const elev = elevation[idx];
      let temp = latTemp;
      if (elev > seaLevel) {
        // 海拔每升高一个单位（相对陆地范围）降温
        temp -= ((elev - seaLevel) / (landRange + 1e-4)) * 0.7;
      } else {
        // 海洋温度更温和（接近纬度均值，不极端）
        temp = latTemp * 0.85 + 0.1;
      }
      temp += tempOffset;
      temp = temp < -1 ? -1 : temp > 1 ? 1 : temp;
      temperature[idx] = temp;

      if (temp > 0.6) tempZone[idx] = 0;
      else if (temp > 0.3) tempZone[idx] = 1;
      else if (temp > 0) tempZone[idx] = 2;
      else if (temp > -0.3) tempZone[idx] = 3;
      else tempZone[idx] = 4;
    }
  }

  // ── 2. 风带模型（Azgaar 三环环流）──
  // 每个纬度有主导风向（屏幕坐标 y 向下）：
  //   信风带 (0-30°)：北半球从 NE 来 → 风向 (-1, +1)
  //   西风带 (30-60°)：北半球从 SW 来 → 风向 (+1, -1)
  //   极地东风 (60-90°)：北半球从 NE 来 → 风向 (-1, +1)
  // 用户传入的 windDirX/Y 作为全局偏置叠加
  const windField = new Float32Array(size * 2);
  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2;
    const absLat = Math.abs(lat);
    const sign = lat >= 0 ? 1 : -1; // 北半球 +1, 南半球 -1
    let wbx: number, wby: number;
    if (absLat < 0.33) {
      // 信风：吹向赤道（向 y 中心），从东来
      wbx = -1; wby = sign; // 北半球 (-1,+1) 南半球 (-1,-1)
    } else if (absLat < 0.66) {
      // 西风带：从西来，吹向极地
      wbx = 1; wby = -sign;
    } else {
      // 极地东风：从东来，吹向赤道
      wbx = -1; wby = sign;
    }
    // 叠加用户风向偏置
    wbx += windDirectionX;
    wby += windDirectionY;
    const mag = Math.sqrt(wbx * wbx + wby * wby) || 1;
    wbx /= mag; wby /= mag;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      windField[idx * 2] = wbx;
      windField[idx * 2 + 1] = wby;
    }
  }

  // ── 3. 湿气传递（Azgaar 核心创新）──
  // 海洋 = 湿气源；风把湿气吹向陆地；遇上升地形释放降水（雨影）
  // 初始化：海洋高湿气，陆地低湿气
  for (let i = 0; i < size; i++) {
    if (elevation[i] <= seaLevel) {
      moisture[i] = 0.95;
    } else {
      moisture[i] = 0.1;
    }
  }

  const PASSES = 4; // 多次迭代传递湿气
  for (let pass = 0; pass < PASSES; pass++) {
    const prev = new Float32Array(moisture);
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        // 海洋持续补充湿气（蒸发源）
        if (elevation[idx] <= seaLevel) {
          moisture[idx] = 0.95 * rainStrength;
          continue;
        }
        const wbx = windField[idx * 2];
        const wby = windField[idx * 2 + 1];
        // 上风单元（风从哪来）
        const uxC = x - Math.round(wbx);
        const uyC = y - Math.round(wby);
        // 取上风方向 3 邻居的湿气加权
        let incoming = 0;
        let weightSum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = uxC + dx;
            const ny = uyC + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            const dot = dx * wbx + dy * wby; // 与风向同向权重高
            if (dot < -0.1) continue;
            const w = dot + 0.5;
            incoming += prev[ni] * w;
            weightSum += w;
          }
        }
        if (weightSum < 1e-4) { moisture[idx] = moisture[idx] * 0.5; continue; }
        incoming /= weightSum;

        // 遇上升地形释放降水（雨影）
        const upwindIdx = uyC * width + uxC;
        const upwindElev = (uxC >= 0 && uxC < width && uyC >= 0 && uyC < height) ? elevation[upwindIdx] : elevation[idx];
        const elevDiff = elevation[idx] - upwindElev;
        let released = 0;
        let carried = incoming;
        if (elevDiff > 0.01) {
          // 地形抬升 → 降水释放
          released = incoming * Math.min(0.6, elevDiff * 2.5);
          carried = incoming - released;
        }
        // 温度也影响持水能力（冷空气持水少 → 更多降水）
        const tempFactor = 0.5 + temperature[idx] * 0.5;
        if (carried > tempFactor) {
          released += (carried - tempFactor) * 0.5;
          carried = tempFactor;
        }
        rainfall[idx] += released * rainStrength;
        // 湿气随距离衰减 + 剩余携带
        moisture[idx] = carried * 0.92 + moisture[idx] * 0.08;
      }
    }
  }

  // 归一化降雨量
  let maxRain = 1e-4;
  for (let i = 0; i < size; i++) if (rainfall[i] > maxRain) maxRain = rainfall[i];
  const invMaxR = 1 / maxRain;
  for (let i = 0; i < size; i++) {
    moisture[i] = moisture[i] < 0 ? 0 : moisture[i] > 1 ? 1 : moisture[i];
    rainfall[i] = rainfall[i] * invMaxR;
    rainfall[i] = rainfall[i] < 0 ? 0 : rainfall[i] > 1 ? 1 : rainfall[i];
  }

  return { temperature, tempZone, moisture, rainfall };
}