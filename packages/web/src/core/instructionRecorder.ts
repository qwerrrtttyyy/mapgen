// 指令记录器：作为 Colleague 注册到 mediator，
// 订阅所有已注册的指令事件，将事件记录到 InstructionStore。
//
// 本模块是 PR #41 指令预测系统的精简版——只保留记录功能，
// 不含预测器（InstructionPredictor）和提前准备器（InstructionPreparator）。
//
// 目的：先收集真实用户行为数据，验证 n-gram 分布后再决定是否上线预测器。
// 详见 PR #41 review 建议。
//
// 职责：
// - 订阅 mediator 事件
// - 过滤噪声事件（可配置）
// - 记录到 store
// - 防抖持久化到 localStorage
//
// 启用方式：仅在 DEV 模式下启用（见 app.ts 初始化代码）

import { Colleague, type MediatorEvent, type MediatorEventPayload } from './mediator.js';
import { bus } from './eventBus.js';
import { logger } from './logger.js';
import { InstructionStore } from './instructionStore.js';
import {
  INSTRUCTION_REGISTRY,
  shouldRecord,
  type InstructionSystemConfig,
} from './instructionTypes.js';

export class InstructionRecorder extends Colleague {
  private store: InstructionStore;
  private unsub: (() => void)[] = [];
  private saveTimer: number | null = null;
  private readonly SAVE_DEBOUNCE_MS = 2000;

  constructor(config?: Partial<InstructionSystemConfig>) {
    super('instructionRecorder');
    this.store = new InstructionStore(config);
  }

  /** 初始化：订阅所有已注册事件 */
  bind(): void {
    const useMediator = this.mediator != null;

    for (const def of INSTRUCTION_REGISTRY) {
      const handler = (payload: unknown): void => {
        this.onEvent(def.event, payload);
      };

      if (useMediator) {
        this.unsub.push(
          this.subscribe(
            def.event,
            handler as (payload: MediatorEventPayload[typeof def.event]) => void
          )
        );
      } else {
        this.unsub.push(bus.on(def.event, handler));
      }
    }

    logger.info(
      `InstructionRecorder: subscribed to ${INSTRUCTION_REGISTRY.length} events (mediator=${useMediator})`
    );
  }

  /** 事件处理：记录到 store */
  private onEvent(event: MediatorEvent, payload: unknown): void {
    const config = this.store.currentConfig;
    if (!shouldRecord(event, config)) return;

    // 记录到 store
    const record = this.store.record(event, payload as MediatorEventPayload[MediatorEvent]);
    if (!record) return;

    logger.debug(
      `InstructionRecorder: recorded #${record.id} "${event}" (delta=${record.deltaMs}ms)`
    );

    // 防抖保存
    this.scheduleSave();
  }

  /** 防抖保存到 localStorage */
  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.store.saveToStorage();
      this.saveTimer = null;
    }, this.SAVE_DEBOUNCE_MS);
  }

  // ── 公共 API ────────────────────────────────────

  getStore(): InstructionStore {
    return this.store;
  }

  /** 导出训练数据 JSON（用于离线分析） */
  exportTrainingData(): string {
    return this.store.exportJSON();
  }

  /** 获取统计信息 */
  getStats(): ReturnType<InstructionStore['getStats']> {
    return this.store.getStats();
  }

  /** 清空所有数据 */
  clear(): void {
    this.store.clear();
    logger.info('InstructionRecorder: cleared all records');
  }

  /** 立即保存 */
  flush(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.store.saveToStorage();
  }

  destroy(): void {
    this.flush();
    this.unsub.forEach(u => u());
    this.unsub = [];
  }
}
