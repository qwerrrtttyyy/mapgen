import type { Plate } from './tectonic.js';
import type { River } from './rivers.js';
import type { Region } from './regions.js';
import type { NameManifest } from './naming.js';
import type { VolcanoSite, Hotspot } from './volcanism.js';

// ── MapParams: 单一来源 ───────────────────────────────────────────────
// 从 @mapgen/shared-types re-export，避免在 core 与 shared-types 中双重定义。
// 这是 P0-3 修复：原 core/src/types.ts 与 shared-types/src/params.ts 各定义一份，
// 字段增减需两处同步修改，极易遗漏导致运行时类型不一致。
// type-only re-export 不会引入运行时依赖（仅 tsc 阶段解析）。
// 注意：NoiseType/FbmType 仍由 core/src/noise.ts 本地定义（与 shared-types 的版本
// 是结构等价的 string literal union，TS 视为可互换），暂不强制统一以避免大规模 import 改造。
export type { MapParams } from '@mapgen/shared-types';

export interface MapData {
  width: number;
  height: number;
  plateTex: Float32Array;
  elevTex: Float32Array;
  moistTex: Float32Array;
  riverTex: Float32Array;
  tempTex: Float32Array;
  currentTex?: Float32Array;
  iceTex?: Float32Array;
  coastDist?: Float32Array;
  biomeTex?: Float32Array;
  watershedTex?: Float32Array;
  volcanismTex?: Float32Array;
  seasonTex?: Float32Array;
  volcanoSites?: VolcanoSite[];
  hotspots?: Hotspot[];
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  seed: number;
}

export type ProgressCallback = (progress: number, phaseName: string) => void;
