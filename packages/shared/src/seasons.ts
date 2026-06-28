// 季节性气候变差：基于纬度 + 大陆度 + 海拔的季节温度/降水偏移。
//
// 物理基础：
//   - 季节由地球自转轴倾角产生，南北半球季节相反
//   - 海洋热容大 → 季节温差小；内陆季节温差大（大陆度）
//   - 高海拔季节温差小（山地气候温和）
//   - 降水季节性：热带 ITCZ 随太阳直射点南北移动；季风区干湿季分明；
//                  副热带地中海气候夏干冬雨
//
// 用途：
//   - 在 fs-map.frag 通过 u_season uniform 切换季节，叠加 deltaTex
//   - 可视化季节性变化（如赤道带常年夏季、极地常年冬季、温带四季分明）

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonInput {
  width: number;
  height: number;
  elevation: Float32Array;
  seaLevel: number;
  /** 基础温度场（来自 regions.ts computeClimate，预留用于未来与基础温度耦合） */
  temperature?: Float32Array;
  /** 基础降水场（预留） */
  rainfall?: Float32Array;
  /** 海岸距离场（陆地正）—— 用于大陆度修正 */
  coastDist?: Float32Array;
}

export interface SeasonResult {
  /** 春季温度 delta（叠加到 base temperature） */
  springTemp: Float32Array;
  /** 夏季温度 delta */
  summerTemp: Float32Array;
  /** 秋季温度 delta */
  autumnTemp: Float32Array;
  /** 冬季温度 delta */
  winterTemp: Float32Array;
  /** 春季降水 delta */
  springRain: Float32Array;
  /** 夏季降水 delta */
  summerRain: Float32Array;
  /** 秋季降水 delta */
  autumnRain: Float32Array;
  /** 冬季降水 delta */
  winterRain: Float32Array;
  /** 打包为 RGBA 纹理：R=夏温度 delta G=冬温度 delta B=夏降水 delta A=冬降水 delta
   *  delta 范围 [-1,1] → [0,1]，春/秋用 (夏+冬)/2 简化（节省带宽） */
  seasonTex: Float32Array;
}

/**
 * 计算 4 季温度/降水 delta 场。
 *
 * 约定：y=0 为南极（lat=-1），y=H 为北极（lat=+1）—— 与 regions.ts 一致。
 * 北半球：夏在 y 大的方向（北极夏季暖），冬在 y 小方向
 * 南半球相反
 */
export function computeSeasonalVariation(input: SeasonInput): SeasonResult {
  const { width, height, elevation, seaLevel, coastDist } = input;
  const size = width * height;
  const invH = 1 / height;

  const springTemp = new Float32Array(size);
  const summerTemp = new Float32Array(size);
  const autumnTemp = new Float32Array(size);
  const winterTemp = new Float32Array(size);
  const springRain = new Float32Array(size);
  const summerRain = new Float32Array(size);
  const autumnRain = new Float32Array(size);
  const winterRain = new Float32Array(size);

  const CONTINENT_MAX = 30;
  // 季节振幅（温差幅度，归一化单位）
  // 极地季节振幅最大（极昼极夜效应），赤道季节振幅最小
  // 中纬度大陆性气候季节振幅大（如西伯利亚温差 60°C）

  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2; // -1 南极 → +1 北极
    const absLat = Math.abs(lat);
    const row = y * width;

    // 季节振幅：极地（absLat=1）=0.5；赤道（absLat=0）=0.05
    const latAmplitude = 0.05 + absLat * 0.45;
    // 大陆度系数（陆地，越内陆季节振幅越大）
    const isLand = elevation[row] > seaLevel; // 仅作 row-level 提示

    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const elev = elevation[idx];
      const landHere = elev > seaLevel;

      // 大陆度系数（仅陆地）：海岸=0，内陆深处=1
      let cont = 0;
      if (landHere && coastDist) {
        const cd = coastDist[idx];
        if (cd > 0) cont = Math.min(1, cd / CONTINENT_MAX);
      }

      // 高海拔衰减：海拔越高季节温差越小
      const altFactor = landHere ? Math.max(0.4, 1 - (elev - seaLevel) * 0.8) : 0.7;

      // 总振幅 = 纬度振幅 × (海洋 0.4 / 内陆 1.0) × 高海拔衰减
      // 海洋热容大 → 季节振幅小
      const amp = latAmplitude * (landHere ? (0.5 + cont * 0.5) : 0.4) * altFactor;

      // 夏季：暖 delta（北半球 lat>0 夏季 = +amp，南半球 lat<0 夏季 = +amp 因为对称）
      // 简化：夏季=+amp, 冬季=-amp（南北半球都按本半球的夏天处理）
      // 这里我们用 |lat| 对称：absLat 越大，季节振幅越大
      // 由于季节是半球现象，北半球的"夏"在南半球就是"冬"，故 amp 不带南北符号
      summerTemp[idx] = landHere ? amp : amp * 0.5;
      winterTemp[idx] = landHere ? -amp : -amp * 0.5;
      springTemp[idx] = landHere ? amp * 0.2 : amp * 0.1;
      autumnTemp[idx] = landHere ? -amp * 0.2 : -amp * 0.1;

      // 降水季节性
      // 热带（absLat<0.3）：ITCZ 随太阳直射点移动
      //   - 北半球夏：ITCZ 北移 → 北半球热带增雨，南半球热带减雨
      //   - 反之冬季相反
      // 季风区（已在 regions.ts 增湿）：夏季雨强、冬季干
      // 地中海气候（副热带西岸）：夏干冬雨
      let summerRainDelta = 0;
      let winterRainDelta = 0;

      if (absLat < 0.3) {
        // 热带：ITCZ 跟随太阳直射
        // 北半球夏（直射北）→ 北半球热带 +rain, 南半球热带 -rain
        // 但本纹理不分南北，统一以 absLat 表达振幅，由 fs-map.frag 按实际 y 读取
        const itczStrength = (0.3 - absLat) / 0.3;
        // 北半球（lat>0）：夏 +雨，冬 -雨
        // 南半球（lat<0）：夏 -雨，冬 +雨
        if (lat > 0) {
          summerRainDelta = itczStrength * 0.4 * (landHere ? 1 : 0.5);
          winterRainDelta = -itczStrength * 0.4 * (landHere ? 1 : 0.5);
        } else {
          summerRainDelta = -itczStrength * 0.4 * (landHere ? 1 : 0.5);
          winterRainDelta = itczStrength * 0.4 * (landHere ? 1 : 0.5);
        }
      } else if (absLat >= 0.30 && absLat <= 0.45) {
        // 副热带地中海带：夏干冬雨（仅陆地西岸，简化为全陆地）
        if (landHere) {
          summerRainDelta = -0.2;
          winterRainDelta = +0.25;
        }
      } else {
        // 中高纬度：夏季多雨（陆地蒸发强）
        if (landHere) {
          summerRainDelta = +0.1 * (1 - Math.min(1, (absLat - 0.45) / 0.4));
          winterRainDelta = -0.05;
        }
      }

      summerRain[idx] = summerRainDelta;
      winterRain[idx] = winterRainDelta;
      springRain[idx] = (summerRainDelta + winterRainDelta) * 0.3;
      autumnRain[idx] = (summerRainDelta + winterRainDelta) * 0.5;

      // 抑制海洋降水季节性（海洋蒸发稳定）
      if (!landHere) {
        summerRain[idx] *= 0.3;
        winterRain[idx] *= 0.3;
        springRain[idx] *= 0.3;
        autumnRain[idx] *= 0.3;
      }
    }
  }

  // 打包 seasonTex: RGBA = (summerTemp, winterTemp, summerRain, winterRain) 归一化到 [0,1]
  // delta 范围 [-1,1] → [0,1]
  const seasonTex = new Float32Array(size * 4);
  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    seasonTex[i4]     = (summerTemp[i] + 1) * 0.5;
    seasonTex[i4 + 1] = (winterTemp[i] + 1) * 0.5;
    seasonTex[i4 + 2] = (summerRain[i] + 1) * 0.5;
    seasonTex[i4 + 3] = (winterRain[i] + 1) * 0.5;
  }

  return {
    springTemp, summerTemp, autumnTemp, winterTemp,
    springRain, summerRain, autumnRain, winterRain,
    seasonTex,
  };
}

/** 在指定季节从 seasonTex 解码出温度/降水 delta（用于编辑器或叠加层） */
export function decodeSeasonDelta(
  seasonTex: Float32Array,
  size: number,
  season: Season,
): { tempDelta: Float32Array; rainDelta: Float32Array } {
  const tempDelta = new Float32Array(size);
  const rainDelta = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const summerT = seasonTex[i4] * 2 - 1;
    const winterT = seasonTex[i4 + 1] * 2 - 1;
    const summerR = seasonTex[i4 + 2] * 2 - 1;
    const winterR = seasonTex[i4 + 3] * 2 - 1;
    const springT = (summerT + winterT) * 0.1; // 春秋近似为小幅 delta
    const springR = (summerR + winterR) * 0.3;
    const autumnT = (summerT + winterT) * 0.1;
    const autumnR = (summerR + winterR) * 0.5;
    switch (season) {
      case 'spring': tempDelta[i] = springT; rainDelta[i] = springR; break;
      case 'summer': tempDelta[i] = summerT; rainDelta[i] = summerR; break;
      case 'autumn': tempDelta[i] = autumnT; rainDelta[i] = autumnR; break;
      case 'winter': tempDelta[i] = winterT; rainDelta[i] = winterR; break;
    }
  }
  return { tempDelta, rainDelta };
}
