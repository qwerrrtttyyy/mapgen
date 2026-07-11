// 指令记录器：作为 Colleague 注册到 mediator，
// 订阅所有已注册的指令事件，将事件记录到 InstructionStore，
// 每条指令后触发预测。
//
// 职责：
// - 订阅 mediator 事件
// - 过滤噪声事件（可配置）
// - 记录到 store
// - 触发预测（通过 prediction.update 事件通知其他 Colleague）

import { Colleague, type MediatorEvent, type MediatorEventPayload } from './mediator.js';
import { bus } from './eventBus.js';
import { logger } from './logger.js';
import { InstructionStore } from './instructionStore.js';
import { INSTRUCTION_REGISTRY, shouldRecord, type InstructionSystemConfig } from './instructionTypes.js';
import { InstructionPredictor } from './instructionPredictor.js';

export class InstructionRecorder extends Colleague {
  private store: InstructionStore;
  private predictor: InstructionPredictor;
  private unsub: (() => void)[] = [];
  private saveTimer: number | null = null;
  private readonly SAVE_DEBOUNCE_MS = 2000;

  constructor(config?: Partial<InstructionSystemConfig>) {
    super('instructionRecorder');
    this.store = new InstructionStore(config);
    this.predictor = new InstructionPredictor(this.store);
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
          this.subscribe(def.event, handler as (payload: MediatorEventPayload[typeof def.event]) => void)
        );
      } else {
        this.unsub.push(bus.on(def.event, handler));
      }
    }

    logger.info(`InstructionRecorder: subscribed to ${INSTRUCTION_REGISTRY.length} events (mediator=${useMediator})`);
  }

  /** 事件处理：记录 + 触发预测 */
  private onEvent(
    event: MediatorEvent,
    payload: unknown
  ): void {
    const config = this.store.currentConfig;
    if (!shouldRecord(event, config)) return;

    // 记录到 store
    const record = this.store.record(
      event,
      payload as MediatorEventPayload[MediatorEvent]
    );
    if (!record) return;

    logger.debug(`InstructionRecorder: recorded #${record.id} "${event}" (delta=${record.deltaMs}ms)`);

    // 防抖保存
    this.scheduleSave();

    // 触发预测
    const prediction = this.predictor.predict();
    if (prediction) {
      // 通过 mediator 或 bus 发送预测结果
      this.emitPrediction(prediction);
    }
  }

  /** 发送预测结果事件 */
  private emitPrediction(prediction: import('./instructionTypes.js').PredictionResult): void {
    if (this.mediator) {
      this.send('prediction.update', prediction);
    } else {
      bus.emit('prediction.update', prediction);
    }
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

  getPredictor(): InstructionPredictor {
    return this.predictor;
  }

  /** 导出训练数据 JSON */
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
