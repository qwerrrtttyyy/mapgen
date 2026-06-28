// 生物群系分类：Köppen-Geiger 气候分类法简化版 + Whittaker 温度-降水二维分类。
// 替换 texturePack.ts 中原始 classifyBiome（仅 15 类）的简化版，输出更细的 32 类生物群系。
//
// Köppen-Geiger 五大气候带：
//   A 热带（Tcold ≥ 18°C 等价）
//   B 干旱（降水低于阈值）
//   C 温带（0 ≤ Tcold < 18 且 Thot ≥ 10）
//   D 寒带（Thot ≥ 10 且 Tcold < 0）
//   E 极地（Thot < 10）
// 在本库的温度归一化范围 [-1, 1]（赤道 +1、极地 -1）下，阈值线性映射。
//
// 用途：
//   1. texturePack.ts 的 tempTex 通道 B 编码 biomeId/31
//   2. editor.ts detectTerrainRegions 按生物群系细分地形区
//   3. fs-map.frag 的 Biome 渲染样式按 ID 着色

/** 32 类生物群系 ID 与名称（与 fs-map.frag BIOME_COLORS 对齐） */
export type BiomeId =
  | 0  // 深海
  | 1  // 浅海
  | 2  // 热带雨林 (Af)
  | 3  // 热带季风 (Am)
  | 4  // 热带草原 (Aw)
  | 5  // 热带荒漠灌丛 (As)
  | 6  // 热带沙漠 (BWh)
  | 7  // 温带沙漠 (BWk)
  | 8  // 半干旱草原 (BSh)
  | 9  // 半干旱温带草原 (BSk)
  | 10 // 地中海夏旱 (Csa)
  | 11 // 地中海温带 (Csb)
  | 12 // 湿润亚热带 (Cfa)
  | 13 // 海洋性西岸 (Cfb)
  | 14 // 亚寒带西岸 (Cfc)
  | 15 // 温带草原冬干 (Dwa)
  | 16 // 温带草原湿润 (Dfa)
  | 17 // 寒带针叶林 (Dfb/Dfc)
  | 18 // 寒带大陆性 (Dfd)
  | 19 // 极地苔原 (ET)
  | 20 // 极地冰盖 (EF)
  | 21 // 高山苔原（高海拔低温带）
  | 22 // 高山灌丛
  | 23 // 高山草甸
  | 24 // 高山寒漠
  | 25 // 红树林（热带潮间带）
  | 26 // 河岸林地（沿河流域）
  | 27 // 盐沼湿地
  | 28 // 冰川覆盖（landIce > 阈值）
  | 29 // 海冰覆盖
  | 30 // 湖泊水体
  | 31 // 河口三角洲
  ;

export const BIOME_COUNT = 32;
const INV31 = 1 / 31;

/** 生物群系元数据：名称（zh-CN）、所属气候带、是否陆地 */
export interface BiomeInfo {
  id: number;
  name: string;
  /** A/B/C/D/E 五大气候带代号 */
  koppen: 'A' | 'B' | 'C' | 'D' | 'E' | 'M' | 'X';
  /** 是否陆地生物群系 */
  isLand: boolean;
}

export const BIOME_INFO: BiomeInfo[] = [
  { id: 0,  name: '深海',       koppen: 'X', isLand: false },
  { id: 1,  name: '浅海',       koppen: 'X', isLand: false },
  { id: 2,  name: '热带雨林',   koppen: 'A', isLand: true  },
  { id: 3,  name: '热带季风林', koppen: 'A', isLand: true  },
  { id: 4,  name: '热带草原',   koppen: 'A', isLand: true  },
  { id: 5,  name: '热带荒漠灌丛', koppen: 'B', isLand: true },
  { id: 6,  name: '热带沙漠',   koppen: 'B', isLand: true  },
  { id: 7,  name: '温带沙漠',   koppen: 'B', isLand: true  },
  { id: 8,  name: '半干旱草原', koppen: 'B', isLand: true  },
  { id: 9,  name: '半干旱温带草原', koppen: 'B', isLand: true },
  { id: 10, name: '地中海夏旱林', koppen: 'C', isLand: true },
  { id: 11, name: '地中海温带林', koppen: 'C', isLand: true },
  { id: 12, name: '湿润亚热带林', koppen: 'C', isLand: true },
  { id: 13, name: '海洋性阔叶林', koppen: 'C', isLand: true },
  { id: 14, name: '亚寒带雨林', koppen: 'C', isLand: true  },
  { id: 15, name: '温带草原冬干', koppen: 'D', isLand: true },
  { id: 16, name: '温带草原湿润', koppen: 'D', isLand: true },
  { id: 17, name: '寒带针叶林', koppen: 'D', isLand: true  },
  { id: 18, name: '寒带大陆性林', koppen: 'D', isLand: true },
  { id: 19, name: '极地苔原',   koppen: 'E', isLand: true  },
  { id: 20, name: '极地冰盖',   koppen: 'E', isLand: true  },
  { id: 21, name: '高山苔原',   koppen: 'M', isLand: true  },
  { id: 22, name: '高山灌丛',   koppen: 'M', isLand: true  },
  { id: 23, name: '高山草甸',   koppen: 'M', isLand: true  },
  { id: 24, name: '高山寒漠',   koppen: 'M', isLand: true  },
  { id: 25, name: '红树林',     koppen: 'A', isLand: true  },
  { id: 26, name: '河岸林地',   koppen: 'X', isLand: true  },
  { id: 27, name: '盐沼湿地',   koppen: 'X', isLand: true  },
  { id: 28, name: '冰川覆盖',   koppen: 'X', isLand: true  },
  { id: 29, name: '海冰',       koppen: 'X', isLand: false },
  { id: 30, name: '湖泊',       koppen: 'X', isLand: false },
  { id: 31, name: '河口三角洲', koppen: 'X', isLand: true  },
];

export interface BiomeClassifyInput {
  /** 归一化高程 [-1, 1] */
  elevation: Float32Array;
  /** 归一化温度 [-1, 1]（赤道 +1、极地 -1） */
  temperature: Float32Array;
  /** 归一化降水 [0, 1] */
  rainfall: Float32Array;
  /** 归一化湿度 [0, 1]（持水量） */
  moisture: Float32Array;
  /** 海平面 */
  seaLevel: number;
  /** 雪线温度阈值（snowLine 以下且高海拔 → 冰） */
  snowLine: number;
  /** 海岸距离场（陆地正）—— 用于红树林/盐沼 */
  coastDist?: Float32Array;
  /** 河流遮罩 [0,1] —— 用于河岸林地 */
  riverMask?: Float32Array;
  /** 湖泊遮罩 [0,1] */
  lakeMask?: Float32Array;
  /** 陆地冰厚 [0,1] */
  landIce?: Float32Array;
  /** 海冰厚 [0,1] */
  seaIce?: Float32Array;
  /** 高山带阈值（陆地海拔高于此值视为高山气候带，默认 0.7） */
  alpineThreshold?: number;
}

export interface BiomeResult {
  /** 每像素生物群系 ID [0, 31] */
  biomeId: Uint8Array;
  /** 归一化值 [0,1]，可直接打入 tempTex 通道 B */
  biomeNormalized: Float32Array;
}

/**
 * Köppen-Geiger 简化分类。
 *
 * 温度归一化映射：
 *   T ≥ 0.55 ≈ 18°C（热带阈值）
 *   T ≥ 0.10 ≈ 10°C（温带/寒带阈值）
 *   T ≥ -0.30 ≈ 0°C（极地/寒带阈值）
 *   T < -0.30 ≈ 极地冰盖
 *
 * 降水归一化映射：
 *   0~0.15 干旱（B 带）
 *   0.15~0.40 半干旱
 *   0.40~0.70 中等
 *   0.70~1.0 湿润
 *
 * 决策优先级（每像素）：
 *   1. 海洋 → 深海/浅海
 *   2. 海冰 → 海冰
 *   3. 湖泊 → 湖泊
 *   4. 陆地冰厚大 → 冰川
 *   5. 河岸/三角洲/红树林/盐沼 特殊生态
 *   6. 高山带（海拔 > 阈值）→ 高山群系
 *   7. Köppen 主分类
 */
export function classifyBiomes(input: BiomeClassifyInput): BiomeResult {
  const { elevation, temperature, rainfall, moisture, seaLevel } = input;
  const size = elevation.length;
  const biomeId = new Uint8Array(size);
  const biomeNormalized = new Float32Array(size);
  const alpineThreshold = input.alpineThreshold ?? 0.7;
  const shallowSeaMax = seaLevel - 0.15; // 浅海/深海分界

  for (let i = 0; i < size; i++) {
    const elev = elevation[i];
    const temp = temperature[i];
    const rain = rainfall[i];
    const moist = moisture[i];
    let id: number = 0;

    // 1. 海洋
    if (elev <= seaLevel) {
      // 海冰优先
      if (input.seaIce && input.seaIce[i] > 0.4) {
        id = 29;
      } else if (elev > shallowSeaMax) {
        id = 1; // 浅海
      } else {
        id = 0; // 深海
      }
    } else {
      // 陆地
      // 2. 湖泊
      if (input.lakeMask && input.lakeMask[i] > 0.5) {
        id = 30;
      }
      // 3. 冰川
      else if (input.landIce && input.landIce[i] > 0.3) {
        id = 28;
      }
      // 4. 红树林（热带+海岸+潮间带）
      else if (
        input.coastDist && input.coastDist[i] > 0 && input.coastDist[i] < 4 &&
        temp > 0.55 && moist > 0.6
      ) {
        id = 25;
      }
      // 5. 盐沼湿地（温带+低海拔+海岸+高湿）
      else if (
        input.coastDist && input.coastDist[i] > 0 && input.coastDist[i] < 6 &&
        temp > 0.0 && temp < 0.5 && moist > 0.7 && elev < seaLevel + 0.1
      ) {
        id = 27;
      }
      // 6. 河岸林地（沿河）
      else if (input.riverMask && input.riverMask[i] > 0.3 && temp > -0.2) {
        id = 26;
      }
      // 7. 高山气候带（M）
      else if (elev > alpineThreshold) {
        if (temp < -0.2) id = 24; // 高山寒漠
        else if (temp < 0.0) id = 21; // 高山苔原
        else if (moist > 0.5) id = 23; // 高山草甸
        else id = 22; // 高山灌丛
      }
      // 8. Köppen 主分类
      else {
        id = koppenClassify(temp, rain, moist);
      }
    }

    biomeId[i] = id;
    biomeNormalized[i] = id * INV31;
  }

  return { biomeId, biomeNormalized };
}

/** Köppen 五带分类（已扣除高山带与水体） */
function koppenClassify(temp: number, rain: number, moist: number): number {
  // 温度阈值
  const TROPICAL = 0.55; // 18°C 等价
  const TEMPERATE = 0.10; // 10°C 等价
  const FREEZING = -0.30; // 0°C 等价

  // E 极地
  if (temp < FREEZING) {
    return temp < -0.6 ? 20 : 19; // EF 冰盖 / ET 苔原
  }

  // 干旱度判断（B 带）：温度越高、降水越低越干旱
  // 干旱阈值曲线：炎热（T=0.6）时需 P<0.20；寒冷（T=0）时需 P<0.10
  const aridThreshold = 0.05 + Math.max(0, temp) * 0.25;
  const semiAridThreshold = aridThreshold + 0.20;

  if (rain < aridThreshold) {
    // 沙漠（BW）
    return temp > 0.2 ? 6 : 7; // BWh 热带沙漠 / BWk 温带沙漠
  }
  if (rain < semiAridThreshold) {
    // 半干旱（BS）
    return temp > 0.2 ? 8 : 9; // BSh / BSk
  }

  // A 热带
  if (temp >= TROPICAL) {
    if (moist > 0.75) return 2; // Af 热带雨林
    if (moist > 0.55) return 3; // Am 热带季风
    if (moist > 0.30) return 4; // Aw 热带草原
    return 5; // As 热带荒漠灌丛
  }

  // D 寒带（Thot ≥ 10 但 Tcold < 0）
  if (temp < TEMPERATE) {
    // 寒带：降水模式（冬干 Dw / 湿润 Df）
    if (moist < 0.35) return 15; // Dwa/Dwb 温带草原冬干
    if (temp < -0.15) return 18; // Dfd 寒带大陆性
    if (temp < 0.0) return 17; // Dfc/Dfb 寒带针叶林
    return 16; // Dfa 温带草原湿润
  }

  // C 温带（0 ≤ Tcold < 18 且 Thot ≥ 10）
  // 地中海气候（夏旱）：温度高但湿度中等偏低
  if (moist < 0.45) {
    return temp > 0.35 ? 10 : 11; // Csa 地中海夏旱 / Csb 地中海温带
  }
  if (temp > 0.35) return 12; // Cfa 湿润亚热带
  if (temp > 0.15) return 13; // Cfb 海洋性西岸
  return 14; // Cfc 亚寒带西岸
}

/** 由 biomeId 返回归一化值（用于纹理打包） */
export function biomeNormalize(id: number): number {
  return id * INV31;
}

/** 由 biomeId 获取元数据 */
export function getBiomeInfo(id: number): BiomeInfo {
  return BIOME_INFO[id] ?? BIOME_INFO[0];
}
