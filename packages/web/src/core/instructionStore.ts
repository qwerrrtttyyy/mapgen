// 指令序列存储：管理指令记录的增删查、持久化、统计筛选
// 职责：序列存储 + localStorage 持久化 + n-gram 统计 + 数据筛选

import type { InstructionRecord, InstructionSystemConfig } from './instructionTypes.js';
import type { MediatorEvent, MediatorEventPayload } from './mediator.js';
import {
  DEFAULT_CONFIG,
  getInstructionDef,
  shouldRecord,
  extractPayloadSummary,
} from './instructionTypes.js';
import { logger } from './logger.js';

export class InstructionStore {
  private records: InstructionRecord[] = [];
  private nextId = 0;
  private config: InstructionSystemConfig;
  private lastTimestamp = 0;

  constructor(config?: Partial<InstructionSystemConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.persist) {
      this.loadFromStorage();
    }
  }

  // ── 核心操作 ────────────────────────────────────

  /**
   * 记录一条指令。
   * @returns 记录成功返回 InstructionRecord，被过滤返回 null
   */
  record(
    event: MediatorEvent,
    payload: MediatorEventPayload[MediatorEvent] | undefined
  ): InstructionRecord | null {
    if (!shouldRecord(event, this.config)) return null;

    const def = getInstructionDef(event);
    if (!def) return null;

    const now = Date.now();
    const deltaMs = this.lastTimestamp > 0 ? now - this.lastTimestamp : 0;
    this.lastTimestamp = now;

    const rec: InstructionRecord = {
      id: this.nextId++,
      event,
      source: def.source,
      category: def.category,
      timestamp: now,
      deltaMs,
      payloadSummary: extractPayloadSummary(event, payload),
    };

    this.records.push(rec);

    // 超出上限则丢弃最早记录
    if (this.records.length > this.config.maxSequenceLength) {
      const drop = this.records.length - this.config.maxSequenceLength;
      this.records.splice(0, drop);
      logger.debug(`InstructionStore: dropped ${drop} old records`);
    }

    return rec;
  }

  /** 获取全部记录（只读引用） */
  getAll(): readonly InstructionRecord[] {
    return this.records;
  }

  /** 获取最近 N 条记录 */
  getRecent(n: number): InstructionRecord[] {
    return this.records.slice(-n);
  }

  /** 获取记录总数 */
  get length(): number {
    return this.records.length;
  }

  /** 获取已记录的指令事件类型集合 */
  getUniqueEvents(): Set<MediatorEvent> {
    const set = new Set<MediatorEvent>();
    for (const r of this.records) set.add(r.event);
    return set;
  }

  // ── 数据筛选 ────────────────────────────────────

  /** 按类别筛选 */
  filterByCategory(category: InstructionRecord['category']): InstructionRecord[] {
    return this.records.filter(r => r.category === category);
  }

  /** 按来源筛选 */
  filterBySource(source: InstructionRecord['source']): InstructionRecord[] {
    return this.records.filter(r => r.source === source);
  }

  /** 按时间范围筛选（ms 时间戳） */
  filterByTimeRange(start: number, end: number): InstructionRecord[] {
    return this.records.filter(r => r.timestamp >= start && r.timestamp <= end);
  }

  /** 筛选用户指令（排除系统事件） */
  getUserInstructions(): InstructionRecord[] {
    return this.records.filter(r => r.source === 'user');
  }

  /**
   * 导出为可序列化格式（用于 FaMou 训练或外部分析）
   * 返回精简数组，只包含训练所需字段。
   */
  exportForTraining(): Array<{
    event: string;
    category: string;
    source: string;
    deltaMs: number;
    timestamp: number;
  }> {
    return this.records.map(r => ({
      event: r.event,
      category: r.category,
      source: r.source,
      deltaMs: r.deltaMs,
      timestamp: r.timestamp,
    }));
  }

  /**
   * 导出为 JSON 字符串（用于下载或传输给 FaMou）
   */
  exportJSON(): string {
    return JSON.stringify({
      config: {
        maxNgramOrder: this.config.maxNgramOrder,
        topK: this.config.topK,
      },
      records: this.exportForTraining(),
      stats: this.getStats(),
    });
  }

  // ── N-gram 统计 ────────────────────────────────

  /**
   * 统计 n-gram 频率。
   * @param order n-gram 阶数（1=一阶转移 A→B，2=二阶模式 A,B→C）
   * @returns Map<"前缀→后缀", 出现次数>
   */
  computeNgram(order: number): Map<string, number> {
    if (order < 1 || order > this.config.maxNgramOrder) {
      logger.warn(`InstructionStore: invalid ngram order ${order}`);
      return new Map();
    }

    const events = this.records.map(r => r.event);
    const counts = new Map<string, number>();

    for (let i = order; i < events.length; i++) {
      const prefix = events.slice(i - order, i).join('→');
      const key = `${prefix}→${events[i]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }

  /**
   * 给定历史序列末尾，预测下一步各事件的频率分布。
   * @param history 最近的指令事件序列（从旧到新）
   * @param order n-gram 阶数
   * @returns Map<事件, 出现次数>
   */
  predictNext(history: MediatorEvent[], order: number): Map<MediatorEvent, number> {
    const result = new Map<MediatorEvent, number>();
    if (history.length < order) return result;

    const prefix = history.slice(-order).join('→');
    const ngram = this.computeNgram(order);

    for (const [key, count] of ngram) {
      // key 格式: "evt1→evt2→...→evtN→target"
      const parts = key.split('→');
      const keyPrefix = parts.slice(0, order).join('→');
      if (keyPrefix === prefix) {
        const target = parts[order] as MediatorEvent;
        result.set(target, (result.get(target) ?? 0) + count);
      }
    }

    return result;
  }

  // ── 统计信息 ────────────────────────────────────

  getStats(): {
    totalRecords: number;
    uniqueEvents: number;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    avgDeltaMs: number;
    maxDeltaMs: number;
    minDeltaMs: number;
    sessionStart: number | null;
    sessionEnd: number | null;
  } {
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalDelta = 0;
    let deltaCount = 0;
    let maxDelta = 0;
    let minDelta = Infinity;

    for (const r of this.records) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
      if (r.deltaMs > 0) {
        totalDelta += r.deltaMs;
        deltaCount++;
        if (r.deltaMs > maxDelta) maxDelta = r.deltaMs;
        if (r.deltaMs < minDelta) minDelta = r.deltaMs;
      }
    }

    return {
      totalRecords: this.records.length,
      uniqueEvents: this.getUniqueEvents().size,
      byCategory,
      bySource,
      avgDeltaMs: deltaCount > 0 ? totalDelta / deltaCount : 0,
      maxDeltaMs: deltaCount > 0 ? maxDelta : 0,
      minDeltaMs: deltaCount > 0 ? minDelta : 0,
      sessionStart: this.records.length > 0 ? this.records[0].timestamp : null,
      sessionEnd: this.records.length > 0 ? this.records[this.records.length - 1].timestamp : null,
    };
  }

  // ── 持久化 ──────────────────────────────────────

  /** 从 localStorage 加载历史记录 */
  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        records: Array<
          Omit<InstructionRecord, 'payloadSummary'> & {
            payloadSummary?: Record<string, unknown>;
          }
        >;
        nextId?: number;
      };
      if (!data.records || !Array.isArray(data.records)) return;
      this.records = data.records.map(r => ({
        ...r,
        payloadSummary: r.payloadSummary ?? {},
      }));
      this.nextId = data.nextId ?? this.records.length;
      if (this.records.length > 0) {
        this.lastTimestamp = this.records[this.records.length - 1].timestamp;
      }
      logger.debug(`InstructionStore: loaded ${this.records.length} records from storage`);
    } catch (err) {
      logger.warn('InstructionStore: failed to load from storage:', err);
    }
  }

  /** 保存到 localStorage（防抖：由调用方控制频率） */
  saveToStorage(): void {
    if (!this.config.persist) return;
    try {
      const data = JSON.stringify({
        records: this.records,
        nextId: this.nextId,
      });
      localStorage.setItem(this.config.storageKey, data);
    } catch (err) {
      logger.warn('InstructionStore: failed to save to storage:', err);
    }
  }

  /** 清空所有记录 */
  clear(): void {
    this.records = [];
    this.nextId = 0;
    this.lastTimestamp = 0;
    if (this.config.persist) {
      try {
        localStorage.removeItem(this.config.storageKey);
      } catch {
        /* ignore */
      }
    }
  }

  /** 更新配置 */
  updateConfig(patch: Partial<InstructionSystemConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  get currentConfig(): InstructionSystemConfig {
    return this.config;
  }
}
