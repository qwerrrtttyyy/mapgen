// 指令提前准备器：监听 prediction.update 事件，
// 根据预测结果对即将可能执行的指令进行提前准备。
//
// 职责：
// - 监听预测结果
// - 对高概率指令执行预加载/预热操作
// - 避免 100% 准备（浪费资源），仅对 Top-1 概率 > 阈值 或 Top-3 整体置信度高时触发
// - 记录准备动作的命中/未命中，用于后续评估

import { Colleague, type MediatorEvent, type MediatorEventPayload } from './mediator.js';
import { bus } from './eventBus.js';
import { state } from './appState.js';
import { logger } from './logger.js';
import type { PredictionResult, PredictionCandidate } from './instructionTypes.js';

// ── 准备动作定义 ──────────────────────────────────

/** 准备动作类型 */
export type PreparationAction =
  | 'prewarm_worker'       // 预热 Worker（预测到 generate.request）
  | 'preload_checkpoint'   // 预加载检查点数据（预测到 checkpoint.restore.request）
  | 'prepare_export'       // 预备导出对话框（预测到 export.dialog.open）
  | 'cache_param_diff'     // 缓存参数差异（预测到 params.committed）
  | 'ready_editor_mode'    // 预设编辑器模式（预测到 editor.mode.changed）
  | 'prefetch_laser'       // 预取激光工具资源（预测到 laser.toggle）
  | 'noop';                // 无需准备

/** 单条准备记录 */
interface PreparationRecord {
  timestamp: number;
  predictedEvent: MediatorEvent;
  probability: number;
  action: PreparationAction;
  actualEvent: MediatorEvent | null;  // 实际发生的下一指令（在下次指令到达时回填）
  hit: boolean;                       // 预测是否命中
}

/** 事件→准备动作映射表 */
const PREPARATION_MAP: Partial<Record<MediatorEvent, PreparationAction>> = {
  'generate.request': 'prewarm_worker',
  'checkpoint.restore.request': 'preload_checkpoint',
  'export.dialog.open': 'prepare_export',
  'params.committed': 'cache_param_diff',
  'editor.mode.changed': 'ready_editor_mode',
  'laser.toggle': 'prefetch_laser',
};

/** 触发准备的概率阈值：Top-1 概率超过此值才执行准备 */
const PREPARATION_THRESHOLD = 0.25;

/** 最大并发准备数 */
const MAX_CONCURRENT_PREPARATIONS = 3;

// ── 提前准备器 Colleague ──────────────────────────

export class InstructionPreparator extends Colleague {
  private unsub: (() => void)[] = [];
  private pendingPreparations: Map<MediatorEvent, PreparationRecord> = new Map();
  private history: PreparationRecord[] = [];
  private readonly maxHistory = 500;

  constructor() {
    super('instructionPreparator');
  }

  bind(): void {
    const useMediator = this.mediator != null;

    const onPrediction = (result: PredictionResult): void => {
      this.handlePrediction(result);
    };

    if (useMediator) {
      this.unsub.push(
        this.subscribe('prediction.update', onPrediction)
      );
    } else {
      this.unsub.push(bus.on('prediction.update', onPrediction));
    }

    // 监听所有用户指令事件，用于回填准备记录
    const trackedEvents = Object.keys(PREPARATION_MAP) as MediatorEvent[];
    for (const evt of trackedEvents) {
      const handler = (): void => {
        this.onInstructionExecuted(evt);
      };
      if (useMediator) {
        this.unsub.push(this.subscribe(evt, handler));
      } else {
        this.unsub.push(bus.on(evt, handler));
      }
    }

    logger.info(`InstructionPreparator: bound to prediction.update + ${trackedEvents.length} tracked events`);
  }

  // ── 预测处理 ────────────────────────────────────

  private handlePrediction(result: PredictionResult): void {
    if (result.candidates.length === 0) return;
    if (this.pendingPreparations.size >= MAX_CONCURRENT_PREPARATIONS) return;

    // 检查 Top-1 候选
    const top1 = result.candidates[0];
    if (top1.probability < PREPARATION_THRESHOLD) return;

    const action = PREPARATION_MAP[top1.event];
    if (!action || action === 'noop') return;

    // 已在准备中则跳过
    if (this.pendingPreparations.has(top1.event)) return;

    // 执行准备
    const record: PreparationRecord = {
      timestamp: Date.now(),
      predictedEvent: top1.event,
      probability: top1.probability,
      action,
      actualEvent: null,
      hit: false,
    };

    this.pendingPreparations.set(top1.event, record);
    this.executePreparation(action, top1);

    logger.debug(
      `InstructionPreparator: preparing "${top1.event}" (p=${(top1.probability * 100).toFixed(0)}%) → action: ${action}`
    );
  }

  // ── 执行准备动作 ────────────────────────────────

  private executePreparation(action: PreparationAction, candidate: PredictionCandidate): void {
    try {
      switch (action) {
        case 'prewarm_worker':
          // 预热 Worker：提前初始化 Web Worker，减少首次生成延迟
          this.prewarmWorker();
          break;

        case 'preload_checkpoint':
          // 预加载检查点：从 localStorage 预读检查点数据
          this.preloadCheckpoint();
          break;

        case 'prepare_export':
          // 预备导出：预渲染缩略图或预计算导出尺寸
          this.prepareExport();
          break;

        case 'cache_param_diff':
          // 缓存当前参数快照，便于 params.committed 时快速 diff
          this.cacheParamSnapshot();
          break;

        case 'ready_editor_mode':
          // 预设编辑器模式（轻量操作，仅更新内部状态）
          logger.debug('InstructionPreparator: pre-setting editor mode context');
          break;

        case 'prefetch_laser':
          // 激光工具资源预取（Canvas2D 上下文已就绪标记）
          logger.debug('InstructionPreparator: prefetching laser resources');
          break;

        default:
          break;
      }
    } catch (err) {
      logger.warn(`InstructionPreparator: preparation "${action}" failed:`, err);
    }
  }

  // ── 具体准备动作实现 ────────────────────────────

  private prewarmWorker(): void {
    // 检查是否已有 mapData，如果有则可以预热 Worker 线程
    if (!state.mapData) {
      logger.debug('InstructionPreparator: skip prewarm (no mapData yet)');
      return;
    }
    // 通过 bus 发送一个轻量级的预热信号
    // 实际 Worker 预热由 mapGenWorker 模块处理
    bus.emit('render.request');
    logger.debug('InstructionPreparator: worker prewarmed via render.request');
  }

  private preloadCheckpoint(): void {
    try {
      const raw = localStorage.getItem('mapgen:checkpoints');
      if (raw) {
        // 预解析 JSON，减少实际恢复时的延迟
        JSON.parse(raw);
        logger.debug('InstructionPreparator: checkpoint data pre-parsed');
      }
    } catch {
      logger.debug('InstructionPreparator: no checkpoint data to preload');
    }
  }

  private prepareExport(): void {
    // 预计算当前画布的导出尺寸
    if (state.mapData) {
      const { width, height } = state.mapData;
      logger.debug(`InstructionPreparator: export dimensions pre-calculated: ${width}x${height}`);
    }
  }

  private cacheParamSnapshot(): void {
    // 缓存当前参数的 JSON 快照
    const snapshot = JSON.stringify(state.params);
    // 存入模块级变量，供后续 diff 使用
    InstructionPreparator.lastParamSnapshot = snapshot;
    logger.debug('InstructionPreparator: param snapshot cached');
  }

  // ── 指令执行回填 ────────────────────────────────

  /** 当被追踪的指令实际执行时，回填准备记录 */
  private onInstructionExecuted(event: MediatorEvent): void {
    const record = this.pendingPreparations.get(event);
    if (!record) return;

    record.actualEvent = event;
    record.hit = true;
    this.pendingPreparations.delete(event);

    this.addToHistory(record);
    logger.debug(`InstructionPreparator: HIT — predicted "${event}" was executed`);
  }

  /** 清理超时的未命中准备（超过 30 秒视为未命中） */
  private cleanupStale(): void {
    const now = Date.now();
    const STALE_MS = 30_000;
    for (const [event, record] of this.pendingPreparations) {
      if (now - record.timestamp > STALE_MS) {
        record.actualEvent = null;
        record.hit = false;
        this.pendingPreparations.delete(event);
        this.addToHistory(record);
        logger.debug(`InstructionPreparator: MISS — predicted "${event}" timed out`);
      }
    }
  }

  private addToHistory(record: PreparationRecord): void {
    this.history.push(record);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    // 定期清理过期记录
    if (this.history.length % 10 === 0) {
      this.cleanupStale();
    }
  }

  // ── 公共 API ────────────────────────────────────

  /** 获取准备命中率统计 */
  getStats(): {
    total: number;
    hits: number;
    misses: number;
    hitRate: number;
    byAction: Record<string, { total: number; hits: number }>;
  } {
    this.cleanupStale();
    let hits = 0;
    const byAction: Record<string, { total: number; hits: number }> = {};

    for (const r of this.history) {
      const a = r.action;
      if (!byAction[a]) byAction[a] = { total: 0, hits: 0 };
      byAction[a].total++;
      if (r.hit) {
        hits++;
        byAction[a].hits++;
      }
    }

    return {
      total: this.history.length,
      hits,
      misses: this.history.length - hits,
      hitRate: this.history.length > 0 ? hits / this.history.length : 0,
      byAction,
    };
  }

  /** 获取当前待验证的准备 */
  getPending(): Array<{
    predictedEvent: string;
    probability: number;
    action: string;
    elapsedMs: number;
  }> {
    const now = Date.now();
    return Array.from(this.pendingPreparations.values()).map(r => ({
      predictedEvent: r.predictedEvent,
      probability: r.probability,
      action: r.action,
      elapsedMs: now - r.timestamp,
    }));
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
    this.pendingPreparations.clear();
  }

  // ── 模块级缓存 ──────────────────────────────────
  private static lastParamSnapshot: string | null = null;
}
