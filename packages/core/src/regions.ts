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

const TYPE_MOUNTAIN = 0;
const TYPE_PLATEAU = 1;
const TYPE_HILL = 2;
const TYPE_TUNDRA = 3;
const TYPE_DESERT = 4;
const TYPE_WETLAND = 5;
const TYPE_FOREST = 6;
const TYPE_PLAIN = 7;

function classifyRegionTypeId(elev: number, moist: number, temp: number): number {
  if (elev > 0.7) return TYPE_MOUNTAIN;
  if (elev > 0.5) return TYPE_PLATEAU;
  if (elev > 0.3) return TYPE_HILL;
  if (temp < 0.2) return TYPE_TUNDRA;
  if (moist < 0.2 && temp > 0.5) return TYPE_DESERT;
  if (moist > 0.7 && temp > 0.4) return TYPE_WETLAND;
  if (moist > 0.5 && temp > 0.3) return TYPE_FOREST;
  return TYPE_PLAIN;
}

const TYPE_NAMES: string[] = [
  'mountain',
  'plateau',
  'hill',
  'tundra',
  'desert',
  'wetland',
  'forest',
  'plain',
];

export function analyzeRegions(
  width: number,
  height: number,
  elevation: Float32Array,
  moisture: Float32Array,
  temperature: Float32Array,
  plateId: Float32Array,
  seaLevel: number,
  _seed: number
): Region[] {
  const size = width * height;
  const visited = new Uint8Array(size);
  const typeMap = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    typeMap[i] =
      elevation[i] > seaLevel
        ? classifyRegionTypeId(elevation[i], moisture[i], temperature[i])
        : 255;
  }

  const regions: Region[] = [];
  let regionId = 0;
  const stack = new Int32Array(size);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      if (visited[idx] || elevation[idx] <= seaLevel) continue;

      const seedType = typeMap[idx];
      const seedElev = elevation[idx];
      const pid = plateId[idx];
      const seedMoist = moisture[idx];

      let sumElev = 0,
        sumMoist = 0,
        sumTemp = 0,
        sumX = 0,
        sumY = 0;
      let area = 0;

      let top = 0;
      stack[top++] = idx;

      while (top > 0) {
        const ci = stack[--top];
        if (visited[ci]) continue;
        visited[ci] = 1;
        area++;

        const cx = ci % width;
        const cy = (ci / width) | 0;
        sumElev += elevation[ci];
        sumMoist += moisture[ci];
        sumTemp += temperature[ci];
        sumX += cx;
        sumY += cy;

        let nx = cx - 1,
          ny = cy;
        if (nx >= 0) {
          const ni = ci - 1;
          if (!visited[ni] && elevation[ni] > seaLevel && plateId[ni] === pid) {
            const nt = typeMap[ni];
            if (nt === seedType || Math.abs(elevation[ni] - seedElev) <= 0.2) {
              stack[top++] = ni;
            }
          }
        }
        nx = cx + 1;
        if (nx < width) {
          const ni = ci + 1;
          if (!visited[ni] && elevation[ni] > seaLevel && plateId[ni] === pid) {
            const nt = typeMap[ni];
            if (nt === seedType || Math.abs(elevation[ni] - seedElev) <= 0.2) {
              stack[top++] = ni;
            }
          }
        }
        ny = cy - 1;
        if (ny >= 0) {
          const ni = ci - width;
          if (!visited[ni] && elevation[ni] > seaLevel && plateId[ni] === pid) {
            const nt = typeMap[ni];
            if (nt === seedType || Math.abs(elevation[ni] - seedElev) <= 0.2) {
              stack[top++] = ni;
            }
          }
        }
        ny = cy + 1;
        if (ny < height) {
          const ni = ci + width;
          if (!visited[ni] && elevation[ni] > seaLevel && plateId[ni] === pid) {
            const nt = typeMap[ni];
            if (nt === seedType || Math.abs(elevation[ni] - seedElev) <= 0.2) {
              stack[top++] = ni;
            }
          }
        }
      }

      if (area > 50) {
        const typeName = TYPE_NAMES[seedType] || 'plain';
        regions.push({
          id: regionId,
          name: `${typeName}_${regionId}`,
          type: typeName,
          area,
          population: Math.floor(area * (seedMoist + 0.1) * 100),
          centerX: sumX / area,
          centerY: sumY / area,
          avgElevation: sumElev / area,
          avgMoisture: sumMoist / area,
          avgTemperature: sumTemp / area,
          plateId: pid,
          color: REGION_COLORS[typeName] || [0.5, 0.5, 0.5],
          selected: false,
        });
        regionId++;
      }
    }
  }

  return regions;
}

/** 行星级气候增强选项（全部可选，缺省=关闭，向后兼容）。 */
export interface ClimateEnhanceOptions {
  /** 海岸距离场（陆地正）—— 大陆度修正 */
  coastDist?: Float32Array;
  /** 洋流温度增量（暖+/寒-）—— 沿岸温度修正 */
  currentTempDelta?: Float32Array;
  /** 开启大陆度修正（内陆偏冷） */
  enableContinentality?: boolean;
  /** 开启洋流沿岸温度修正 */
  enableOceanCurrents?: boolean;
  /** 开启 Hadley cell 强化（ITCZ 增湿 + 副热带高压沙漠带减湿） */
  enableHadleyEnhancement?: boolean;
  /** 开启季风（热带沿海陆地增湿） */
  enableMonsoon?: boolean;
}

export function computeClimate(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  tempOffset: number,
  snowLine: number,
  windDirectionX: number = 1,
  windDirectionY: number = 0,
  rainStrength: number = 1,
  enhance?: ClimateEnhanceOptions
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
      wbx = -1;
      wby = sign; // 北半球 (-1,+1) 南半球 (-1,-1)
    } else if (absLat < 0.66) {
      // 西风带：从西来，吹向极地
      wbx = 1;
      wby = -sign;
    } else {
      // 极地东风：从东来，吹向赤道
      wbx = -1;
      wby = sign;
    }
    // 叠加用户风向偏置
    wbx += windDirectionX;
    wby += windDirectionY;
    const mag = Math.sqrt(wbx * wbx + wby * wby) || 1;
    wbx /= mag;
    wby /= mag;
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

  const PASSES = 10; // 多次迭代传递湿气（保证内陆湿度传播）
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
        // 上风单元（风从哪来）—— 单像素平流
        const uxC = x - Math.round(wbx);
        const uyC = y - Math.round(wby);
        let incoming: number;
        if (uxC < 0 || uxC >= width || uyC < 0 || uyC >= height) {
          incoming = moisture[idx]; // 边界，保持
        } else {
          incoming = prev[uyC * width + uxC];
        }

        // 雨影释放：仅山地（高于 seaLevel+0.3）触发，避免海岸线被误判为山脉
        // 海拔越高持续释放越强（平顶山也不穿透），上升梯度额外加成
        const mountainThreshold = seaLevel + 0.3;
        let released = 0;
        let carried = incoming;
        if (elevation[idx] > mountainThreshold) {
          const elevAbove = elevation[idx] - mountainThreshold;
          const baseRate = Math.min(0.4, elevAbove * 0.8);
          const upwindElev =
            uxC >= 0 && uxC < width && uyC >= 0 && uyC < height
              ? elevation[uyC * width + uxC]
              : elevation[idx];
          const elevDiff = Math.max(0, elevation[idx] - upwindElev);
          const slopeBonus = Math.min(0.4, elevDiff * 0.6);
          const totalRate = Math.min(0.85, baseRate + slopeBonus);
          released = carried * totalRate;
          carried = carried - released;
        }
        // 温度也影响持水能力（冷空气持水少 → 更多降水）
        const tempFactor = 0.5 + temperature[idx] * 0.5;
        if (carried > tempFactor) {
          released += (carried - tempFactor) * 0.5;
          carried = tempFactor;
        }
        rainfall[idx] += released * rainStrength;
        // 平流携带 + 距离衰减
        moisture[idx] = carried * 0.9 + moisture[idx] * 0.1;
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

  // ── 行星级增强（可选）──
  if (enhance) {
    applyClimateEnhancements(
      width,
      height,
      elevation,
      seaLevel,
      temperature,
      tempZone,
      moisture,
      rainfall,
      enhance
    );
  }

  return { temperature, tempZone, moisture, rainfall };
}

/**
 * 行星级气候增强：
 *   1. 大陆度：内陆温度偏冷（冬冷简化），高纬更明显
 *   2. 洋流：沿岸温度 += currentTempDelta（暖流增温、寒流降温）
 *   3. Hadley 强化：ITCZ（赤道带）增湿增雨；副热带高压带（30°）减湿减雨 → 沙漠带
 *   4. 季风：热带沿海陆地增湿增雨（海陆热力差驱动，简化为常驻增湿）
 */
function applyClimateEnhancements(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  temperature: Float32Array,
  tempZone: Float32Array,
  moisture: Float32Array,
  rainfall: Float32Array,
  enhance: ClimateEnhanceOptions
): void {
  const invH = 1 / height;
  const hasCoast = !!enhance.coastDist;
  const hasCurrent = !!enhance.currentTempDelta;
  const coastDist = enhance.coastDist;
  const currentDelta = enhance.currentTempDelta;

  // 大陆度归一化阈值（像素）
  const CONTINENT_MAX = 30;

  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2;
    const absLat = Math.abs(lat);
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const isLand = elevation[idx] > seaLevel;

      // 1. 大陆度温度修正（仅陆地）：内陆偏冷，高纬更显著
      if (enhance.enableContinentality && isLand && hasCoast && coastDist) {
        const cd = coastDist[idx];
        if (cd > 0) {
          const cont = Math.min(1, cd / CONTINENT_MAX);
          // 内陆偏冷 0~0.15，高纬（absLat 大）幅度更大
          const chill = cont * 0.15 * (0.5 + absLat);
          temperature[idx] = Math.max(-1, temperature[idx] - chill);
        }
      }

      // 2. 洋流沿岸温度修正（陆地+海洋均受影响）
      if (enhance.enableOceanCurrents && hasCurrent && currentDelta) {
        temperature[idx] = Math.max(-1, Math.min(1, temperature[idx] + currentDelta[idx]));
      }

      // 3. Hadley cell 强化
      if (enhance.enableHadleyEnhancement) {
        if (absLat < 0.15) {
          // ITCZ 赤道辐合带：增湿增雨
          const itczStrength = 1 - absLat / 0.15;
          moisture[idx] = Math.min(1, moisture[idx] + itczStrength * 0.3);
          rainfall[idx] = Math.min(1, rainfall[idx] + itczStrength * 0.25);
        } else if (absLat > 0.3 && absLat < 0.45) {
          // 副热带高压带：减湿减雨（沙漠成因）
          // 距离 30°/45° 中点越近越干旱
          const desertStrength = 1 - Math.abs(absLat - 0.375) / 0.075;
          if (isLand) {
            moisture[idx] = Math.max(0, moisture[idx] - desertStrength * 0.4);
            rainfall[idx] = Math.max(0, rainfall[idx] - desertStrength * 0.5);
          }
        }
      }

      // 4. 季风：热带沿海陆地增湿（海陆热力差驱动）
      if (enhance.enableMonsoon && isLand && absLat < 0.3 && hasCoast && coastDist) {
        const cd = coastDist[idx];
        if (cd > 0 && cd < 15) {
          const monsoonStrength = (1 - cd / 15) * (1 - absLat / 0.3);
          moisture[idx] = Math.min(1, moisture[idx] + monsoonStrength * 0.35);
          rainfall[idx] = Math.min(1, rainfall[idx] + monsoonStrength * 0.3);
        }
      }

      // 重算 tempZone（温度可能已变）
      const t = temperature[idx];
      if (t > 0.6) tempZone[idx] = 0;
      else if (t > 0.3) tempZone[idx] = 1;
      else if (t > 0) tempZone[idx] = 2;
      else if (t > -0.3) tempZone[idx] = 3;
      else tempZone[idx] = 4;
    }
  }
}
