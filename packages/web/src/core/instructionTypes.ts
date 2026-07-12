// 指令类型定义：将 mediator 事件映射为可预测的指令序列
// 并非所有 mediator 事件都是用户指令——系统生成的事件（如 generating.completed）
// 是用户指令的确定性后果，不应参与预测。

import type { MediatorEvent, MediatorEventPayload } from './mediator.js';

// ── 指令分类 ──────────────────────────────────────

/** 指令来源：用户主动发起 vs 系统自动产生 */
export type InstructionSource = 'user' | 'system';

/** 指令类别：用于特征提取和聚类 */
export type InstructionCategory =
  | 'generation' // 地图生成相关
  | 'parameter' // 参数调整
  | 'selection' // 选区操作
  | 'editor' // 编辑器操作
  | 'navigation' // 视图导航（悬停、右键菜单）
  | 'checkpoint' // 检查点操作
  | 'export' // 导出操作
  | 'laser' // 激光工具
  | 'debug' // 调试面板
  | 'overlay' // 叠加层切换
  | 'other'; // 其他

// ── 指令-事件映射 ──────────────────────────────────

/**
 * 指令定义表：哪些 mediator 事件被记录为指令，及其分类和来源。
 * 未列在此表中的事件将被指令记录器忽略。
 */
export interface InstructionDef {
  /** 对应的 mediator 事件名 */
  event: MediatorEvent;
  /** 指令来源 */
  source: InstructionSource;
  /** 指令类别 */
  category: InstructionCategory;
  /** 是否为高频噪声事件（true 则默认不记录，可配置开启） */
  noisy?: boolean;
}

/**
 * 指令定义注册表。
 * 仅包含有意义的用户指令和关键系统事件。
 * 噪声事件（render.request, progress, render.frame, map.hover, trail.update, picker.update）
 * 默认不记录。
 */
export const INSTRUCTION_REGISTRY: InstructionDef[] = [
  // ── 生成 ──
  { event: 'generate.request', source: 'user', category: 'generation' },
  { event: 'generating.started', source: 'system', category: 'generation' },
  { event: 'generating.completed', source: 'system', category: 'generation' },
  { event: 'generating.failed', source: 'system', category: 'generation' },
  { event: 'randomSeed.request', source: 'user', category: 'generation' },
  { event: 'regenerate.phase', source: 'system', category: 'generation' },

  // ── 参数 ──
  { event: 'params.changed', source: 'user', category: 'parameter', noisy: true },
  { event: 'params.committed', source: 'user', category: 'parameter' },

  // ── 选区 ──
  { event: 'selection.changed', source: 'user', category: 'selection', noisy: true },
  { event: 'selection.clear', source: 'user', category: 'selection' },

  // ── 编辑器 ──
  { event: 'editor.committed', source: 'user', category: 'editor' },
  { event: 'editor.mode.changed', source: 'user', category: 'editor' },
  { event: 'editor.vector.update', source: 'user', category: 'editor', noisy: true },

  // ── 导航 ──
  { event: 'map.contextmenu', source: 'user', category: 'navigation' },

  // ── 检查点 ──
  { event: 'checkpoint.save.request', source: 'user', category: 'checkpoint' },
  { event: 'checkpoint.restore.request', source: 'user', category: 'checkpoint' },
  { event: 'checkpoint.delete.request', source: 'user', category: 'checkpoint' },
  { event: 'checkpoint.updated', source: 'system', category: 'checkpoint' },

  // ── 导出 ──
  { event: 'export.request', source: 'user', category: 'export' },
  { event: 'export.dialog.open', source: 'user', category: 'export' },

  // ── 激光 ──
  { event: 'laser.mode.set', source: 'user', category: 'laser' },
  { event: 'laser.toggle', source: 'user', category: 'laser' },
  { event: 'laser.selection.done', source: 'system', category: 'laser' },

  // ── 调试 ──
  { event: 'debug.toggle', source: 'user', category: 'debug' },
  { event: 'debug.open', source: 'user', category: 'debug' },
  { event: 'debug.close', source: 'user', category: 'debug' },

  // ── 叠加层 ──
  { event: 'overlay.toggle', source: 'user', category: 'overlay' },
  { event: 'names.updated', source: 'system', category: 'overlay' },

  // ── 噪声事件（默认不记录，可配置开启） ──
  { event: 'render.request', source: 'system', category: 'other', noisy: true },
  { event: 'render.frame', source: 'system', category: 'other', noisy: true },
  { event: 'progress', source: 'system', category: 'other', noisy: true },
  { event: 'map.hover', source: 'user', category: 'navigation', noisy: true },
  { event: 'trail.update', source: 'system', category: 'other', noisy: true },
  { event: 'picker.update', source: 'system', category: 'other', noisy: true },
];

// ── 指令记录 ──────────────────────────────────────

/** 单条指令记录 */
export interface InstructionRecord {
  /** 自增序号 */
  id: number;
  /** 指令事件名 */
  event: MediatorEvent;
  /** 来源 */
  source: InstructionSource;
  /** 类别 */
  category: InstructionCategory;
  /** 记录时间戳（ms） */
  timestamp: number;
  /** 距上一条指令的间隔（ms），首条为 0 */
  deltaMs: number;
  /** 事件 payload 的摘要（仅记录关键信息，不存完整 payload） */
  payloadSummary: Record<string, unknown>;
}

// ── 预测结果 ──────────────────────────────────────

/** 单个预测候选 */
export interface PredictionCandidate {
  /** 预测的指令事件名 */
  event: MediatorEvent;
  /** 概率值 [0, 1] */
  probability: number;
  /** 该预测的依据（如 "n-gram freq" / "category transition"） */
  reason: string;
}

/** 完整预测结果 */
export interface PredictionResult {
  /** 预测时的时间戳 */
  timestamp: number;
  /** 当前历史序列长度 */
  historyLength: number;
  /** Top-K 候选（按概率降序） */
  candidates: PredictionCandidate[];
  /** 被选中的指令（按概率加权选择或跟随倾向） */
  selected: MediatorEvent | null;
}

// ── 配置 ──────────────────────────────────────────

/** 指令系统配置 */
export interface InstructionSystemConfig {
  /** 是否记录噪声事件 */
  recordNoisy: boolean;
  /** 最大序列长度（超出后丢弃最早的记录） */
  maxSequenceLength: number;
  /** 是否持久化到 localStorage */
  persist: boolean;
  /** localStorage 键名 */
  storageKey: string;
  /** n-gram 的最大阶数（1=一阶转移, 2=二阶模式, ...） */
  maxNgramOrder: number;
  /** Top-K 预测数量 */
  topK: number;
  /** 明显倾向的阈值：Top-1 与 Top-2 概率差超过此值则直接选择 Top-1 */
  dominanceThreshold: number;
}

/** 默认配置 */
export const DEFAULT_CONFIG: InstructionSystemConfig = {
  recordNoisy: false,
  maxSequenceLength: 5000,
  persist: true,
  storageKey: 'mapgen:instruction-log',
  maxNgramOrder: 3,
  topK: 3,
  dominanceThreshold: 0.2,
};

// ── 辅助函数 ──────────────────────────────────────

/** 从 registry 构建事件→定义的查找表 */
const REGISTRY_MAP = new Map<MediatorEvent, InstructionDef>(
  INSTRUCTION_REGISTRY.map(def => [def.event, def])
);

/** 查询事件是否为已注册指令 */
export function getInstructionDef(event: MediatorEvent): InstructionDef | undefined {
  return REGISTRY_MAP.get(event);
}

/** 判断事件是否应被记录（考虑噪声过滤） */
export function shouldRecord(event: MediatorEvent, config: InstructionSystemConfig): boolean {
  const def = REGISTRY_MAP.get(event);
  if (!def) return false;
  if (def.noisy && !config.recordNoisy) return false;
  return true;
}

/**
 * 从 mediator 事件 payload 提取摘要信息。
 * 仅保留关键字段，避免存储大数组或纹理数据。
 */
export function extractPayloadSummary(
  event: MediatorEvent,
  payload: MediatorEventPayload[MediatorEvent] | undefined
): Record<string, unknown> {
  if (payload == null) return {};

  switch (event) {
    case 'params.changed':
      return { key: (payload as MediatorEventPayload['params.changed']).key };
    case 'selection.changed':
      return {
        plateCount: (payload as MediatorEventPayload['selection.changed']).plates.length,
        regionCount: (payload as MediatorEventPayload['selection.changed']).regions.length,
      };
    case 'editor.mode.changed':
      return { mode: (payload as MediatorEventPayload['editor.mode.changed']).mode };
    case 'editor.committed':
      return { phase: (payload as MediatorEventPayload['editor.committed']).phase };
    case 'progress':
      return {
        fraction: (payload as MediatorEventPayload['progress']).fraction,
        label: (payload as MediatorEventPayload['progress']).label,
      };
    case 'laser.mode.set':
      return { mode: payload as MediatorEventPayload['laser.mode.set'] };
    case 'checkpoint.restore.request':
      return { id: payload as MediatorEventPayload['checkpoint.restore.request'] };
    case 'checkpoint.delete.request':
      return { id: payload as MediatorEventPayload['checkpoint.delete.request'] };
    case 'picker.update': {
      const p = payload as MediatorEventPayload['picker.update'];
      return { plateId: p.plateId, elevation: p.elevation };
    }
    case 'map.contextmenu':
      return {
        x: (payload as MediatorEventPayload['map.contextmenu']).x,
        y: (payload as MediatorEventPayload['map.contextmenu']).y,
      };
    default:
      return {};
  }
}
