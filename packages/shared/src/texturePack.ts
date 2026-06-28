// 纹理打包：MapData 各 RGBA 纹理的通道布局知识与打包逻辑。
// 内聚此处，消除 app.ts 中 repackAllTextures/repackMoistTempRiver 的重复 + UI 层耦合。
// 通道布局（与 fs-map.frag 对齐）：
//   elevTex:  R=elevation  G=slope  B=ridge  A=ridgeMask
//   moistTex: R=moisture   G=rainfall  B=temperature  A=tempZone/4
//   riverTex: R=riverMask  G=riverWidth  B=riverDepth  A=lakes
//   tempTex:  R=temperature  G=tempZone/4  B=biome/15  A=0
//   plateTex: R=plateId/plateCount  G=plateType(0/1)  B=boundary  A=plateDist
//             （packAllTextures 保留 R/G，清零 B/A——boundary/plateDist 在 repack 路径不重算）

import type { MapData } from './index.js';

const INV4 = 0.25;
const INV13 = 1 / 15;

/** 15 种生物群系分类（与 tempTex 通道 B 编码一致）。 */
export function classifyBiome(elev: number, temp: number, moist: number, seaLevel: number, snowLine: number): number {
  if (elev <= seaLevel) return 0;
  if (temp < snowLine && elev > 0.6) return 1;
  if (elev > 0.7) return 2;
  if (temp < -0.3) return 3;
  if (temp < 0.1) return moist > 0.3 ? 4 : 5;
  if (temp < 0.35) return moist > 0.5 ? 6 : 5;
  if (temp < 0.55) {
    if (moist > 0.7) return 7;
    if (moist > 0.5) return 8;
    if (moist > 0.3) return 9;
    return 10;
  }
  if (moist > 0.7) return 11;
  if (moist > 0.45) return 12;
  if (moist > 0.2) return 13;
  return 14;
}

/** 从 RGBA 打包纹理提取单通道。 */
export function extractChannel(tex: Float32Array, channel: number, size: number): Float32Array {
  const arr = new Float32Array(size);
  for (let i = 0; i < size; i++) arr[i] = tex[i * 4 + channel];
  return arr;
}

/** 从 plateTex 通道 R 还原 plateId（乘回 plateCount）。 */
export function extractPlateId(plateTex: Float32Array, plateCount: number, size: number): Float32Array {
  const plateId = new Float32Array(size);
  for (let i = 0; i < size; i++) plateId[i] = Math.round(plateTex[i * 4] * plateCount);
  return plateId;
}

export interface TexturePackParams {
  seaLevel: number;
  snowLine: number;
  plateCount: number;
}

/**
 * 全量重打包：高程+气候+河流+温度（plateTex 的 plateId/boundary 保留不动，仅清零 plateDist 通道）。
 * 用于 elevation / editor-elevation 等完整下游重算分支。
 */
export function packAllTextures(
  md: MapData,
  elevation: Float32Array, slope: Float32Array, ridge: Float32Array, ridgeMask: Float32Array,
  moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array,
  riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array,
  p: TexturePackParams,
): void {
  const size = md.width * md.height;
  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const elev = elevation[i];
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * INV4;

    // plateTex: plateId(i4) 与 boundary(i4+1) 保留；plateDist(i4+3) 此 phase 不重算故清零
    md.plateTex[i4 + 2] = 0;
    md.plateTex[i4 + 3] = 0;
    md.elevTex[i4] = elev;
    md.elevTex[i4 + 1] = slope[i];
    md.elevTex[i4 + 2] = ridge[i];
    md.elevTex[i4 + 3] = ridgeMask[i];
    md.moistTex[i4] = moist;
    md.moistTex[i4 + 1] = rainfall[i];
    md.moistTex[i4 + 2] = temp;
    md.moistTex[i4 + 3] = tz;
    md.riverTex[i4] = riverMask[i];
    md.riverTex[i4 + 1] = riverWidth[i];
    md.riverTex[i4 + 2] = riverDepth[i];
    md.riverTex[i4 + 3] = lakes[i];
    md.tempTex[i4] = temp;
    md.tempTex[i4 + 1] = tz;
    md.tempTex[i4 + 2] = classifyBiome(elev, temp, moist, p.seaLevel, p.snowLine) * INV13;
    md.tempTex[i4 + 3] = 0;
  }
}

/**
 * 局部重打包：仅气候+河流+温度（高程/板块纹理不动）。
 * 用于 erosion / climate / rivers 分支——高程已就地写入 elevTex，此处只刷新下游纹理。
 */
export function packClimateRiverTextures(
  md: MapData,
  moisture: Float32Array, rainfall: Float32Array, temperature: Float32Array, tempZone: Float32Array,
  riverMask: Float32Array, riverWidth: Float32Array, riverDepth: Float32Array, lakes: Float32Array,
  p: TexturePackParams,
): void {
  const size = md.width * md.height;
  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    const elev = md.elevTex[i4]; // 高程已由调用方写入
    const temp = temperature[i];
    const moist = moisture[i];
    const tz = tempZone[i] * INV4;
    md.moistTex[i4] = moist;
    md.moistTex[i4 + 1] = rainfall[i];
    md.moistTex[i4 + 2] = temp;
    md.moistTex[i4 + 3] = tz;
    md.riverTex[i4] = riverMask[i];
    md.riverTex[i4 + 1] = riverWidth[i];
    md.riverTex[i4 + 2] = riverDepth[i];
    md.riverTex[i4 + 3] = lakes[i];
    md.tempTex[i4] = temp;
    md.tempTex[i4 + 1] = tz;
    md.tempTex[i4 + 2] = classifyBiome(elev, temp, moist, p.seaLevel, p.snowLine) * INV13;
    md.tempTex[i4 + 3] = 0;
  }
}

/** 仅重写 elevTex（侵蚀/编辑改高程后，slope 需调用方传入重算值）。 */
export function packElevTex(
  md: MapData,
  elevation: Float32Array, slope: Float32Array, ridge: Float32Array, ridgeMask: Float32Array,
): void {
  const size = md.width * md.height;
  for (let i = 0; i < size; i++) {
    const i4 = i * 4;
    md.elevTex[i4] = elevation[i];
    md.elevTex[i4 + 1] = slope[i];
    md.elevTex[i4 + 2] = ridge[i];
    md.elevTex[i4 + 3] = ridgeMask[i];
  }
}
