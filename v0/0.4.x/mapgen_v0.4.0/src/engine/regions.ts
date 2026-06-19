// 地形区分析引擎

import { Region } from '@/types';

const REGION_TYPES = [
  { name: 'mountain', threshold: 0.7, color: [0.55, 0.45, 0.35] },
  { name: 'plateau', threshold: 0.5, color: [0.65, 0.55, 0.45] },
  { name: 'hill', threshold: 0.3, color: [0.45, 0.65, 0.35] },
  { name: 'plain', threshold: 0.1, color: [0.55, 0.75, 0.35] },
  { name: 'desert', threshold: 0, color: [0.85, 0.75, 0.45] },
  { name: 'forest', threshold: 0, color: [0.25, 0.55, 0.25] },
  { name: 'wetland', threshold: 0, color: [0.35, 0.55, 0.45] },
  { name: 'tundra', threshold: 0, color: [0.75, 0.85, 0.85] },
  { name: 'ice', threshold: 0, color: [0.9, 0.95, 1.0] },
  { name: 'basin', threshold: 0, color: [0.45, 0.55, 0.65] },
];

export function analyzeRegions(
  width: number,
  height: number,
  elevation: Float32Array,
  moisture: Float32Array,
  temperature: Float32Array,
  plateId: Float32Array,
  seaLevel: number,
  seed: number
): Region[] {
  const size = width * height;
  const regionMap = new Int32Array(size).fill(-1);
  const regions: Region[] = [];
  let regionId = 0;

  // 基于海拔、温度、湿度的区域生长
  const visited = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || elevation[idx] <= seaLevel) continue;

      // 确定区域类型
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

      // 泛洪填充
      const stack = [idx];
      const pixels: number[] = [];
      let sumElev = 0;
      let sumMoist = 0;
      let sumTemp = 0;
      let sumX = 0;
      let sumY = 0;
      const pid = plateId[idx];

      while (stack.length > 0) {
        const ci = stack.pop()!;
        if (visited[ci]) continue;
        visited[ci] = 1;
        regionMap[ci] = regionId;
        pixels.push(ci);

        const cx = ci % width;
        const cy = Math.floor(ci / width);
        sumElev += elevation[ci];
        sumMoist += moisture[ci];
        sumTemp += temperature[ci];
        sumX += cx;
        sumY += cy;

        // 4邻域扩展，条件相似
        const dirs = [-1, 1, -width, width];
        for (const d of dirs) {
          const ni = ci + d;
          const nx = ni % width;
          const ny = Math.floor(ni / width);
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (visited[ni]) continue;
          if (elevation[ni] <= seaLevel) continue;
          if (plateId[ni] !== pid) continue;
          // 类型相似性
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
        const rt = REGION_TYPES.find(r => r.name === type) || REGION_TYPES[3];
        regions.push({
          id: regionId,
          name: `${type}_${regionId}`,
          type,
          area: pixels.length,
          population: Math.floor(pixels.length * (moisture[idx] + 0.1) * 100),
          centerX: sumX / pixels.length,
          centerY: sumY / pixels.length,
          avgElevation: sumElev / pixels.length,
          avgMoisture: sumMoist / pixels.length,
          avgTemperature: sumTemp / pixels.length,
          plateId: pid,
          color: rt.color as [number, number, number],
          selected: false,
        });
        regionId++;
      }
    }
  }

  return regions;
}

export function computeClimate(
  width: number,
  height: number,
  elevation: Float32Array,
  seaLevel: number,
  tempOffset: number,
  snowLine: number
): { temperature: Float32Array; tempZone: Float32Array; moisture: Float32Array; rainfall: Float32Array } {
  const size = width * height;
  const temperature = new Float32Array(size);
  const tempZone = new Float32Array(size);
  const moisture = new Float32Array(size);
  const rainfall = new Float32Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      const lat = Math.abs(y / height - 0.5) * 2; // 0=赤道, 1=极点

      // 基础温度（纬度 + 海拔递减）
      let temp = 1 - lat - elev * 0.5 + tempOffset;
      temp = Math.max(-1, Math.min(1, temp));
      temperature[idx] = temp;

      // 温度带
      if (temp > 0.6) tempZone[idx] = 0; // 热带
      else if (temp > 0.3) tempZone[idx] = 1; // 亚热带
      else if (temp > 0) tempZone[idx] = 2; // 温带
      else if (temp > -0.3) tempZone[idx] = 3; // 寒温带
      else tempZone[idx] = 4; // 极地

      // 湿度（海洋附近高，山脉背风坡低）
      let moist = 0.5;
      if (elev <= seaLevel) {
        moist = 0.9;
      } else {
        moist = 0.3 + (1 - lat) * 0.4;
        // 简单风向模拟（西风湿润）
        const windX = Math.sin(y / height * Math.PI);
        moist += windX * 0.2;
      }
      moisture[idx] = Math.max(0, Math.min(1, moist));
      rainfall[idx] = moist * Math.max(0, temp + 0.5);
    }
  }

  return { temperature, tempZone, moisture, rainfall };
}
