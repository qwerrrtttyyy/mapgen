/**
 * @module editor
 * 编辑器子系统入口（barrel）
 *
 * 从原 1245 行 editor.ts 拆分为 5 个子模块（P2-3）：
 * - editorModules/terrainDetection: 地形区自动检测
 * - editorModules/commandStack: 撤销/重做栈
 * - editorModules/brushes: 画笔工具（基础/平滑/噪声/绝对高程/河流/湖泊）
 * - editorModules/vectorTools: 矢量绘制（山脉线/地形多边形）
 * - editorModules/plateOps: 板块操作（拖拽/几何重算）
 *
 * 本文件 re-export 全部公共 API，保持 `import { ... } from './editor.js'`
 * 的导入路径不变，实现零破坏性重构。
 */

export type { DetectedRegion, TerrainDetectOptions } from './editorModules/terrainDetection.js';
export { detectTerrainRegions } from './editorModules/terrainDetection.js';
export {
  SEA_TARGET_OFFSET,
  LAND_TARGET_ELEV,
  LAKE_TARGET_OFFSET,
} from './editorModules/terrainDetection.js';

export type { Command } from './editorModules/commandStack.js';
export { CommandStack } from './editorModules/commandStack.js';

export type {
  BrushTarget,
  FalloffMode,
  BrushShape,
  NoiseBrushParams,
} from './editorModules/brushes.js';
export {
  applyBrushStroke,
  applySmoothBrush,
  applyNoiseBrush,
  applySetElevationBrush,
  applyRiverDraw,
  applyLakeDraw,
} from './editorModules/brushes.js';

export type { VectorTarget } from './editorModules/vectorTools.js';
export { applyVectorMountain, applyVectorPolygon } from './editorModules/vectorTools.js';

export { recomputePlateGeometry, movePlate } from './editorModules/plateOps.js';
