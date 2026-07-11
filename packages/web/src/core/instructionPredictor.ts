// 指令预测器：基于历史指令序列，用多阶 n-gram 统计 + 类别转移特征
// 预测下一个最可能出现的指令。
//
// 特征：
// - 多阶 n-gram 频率（1/2/3 阶）
// - 类别转移频率
// - 最近窗口频率（习惯性操作）
// - 时间间隔特征
//
// 权重可由 FaMou 进化优化（通过 updateWeights 注入）
//
// 输出：Top-K 概率分布 + 按倾向性选择的结果

import type {
  PredictionResult,
  PredictionCandidate,
  InstructionSystemConfig,
} from './instructionTypes.js';
import type { MediatorEvent } from './mediator.js';
import type { InstructionStore } from './instructionStore.js';
import { INSTRUCTION_REGISTRY } from './instructionTypes.js';
import { logger } from './logger.js';

/** 可被 FaMou 优化的特征权重 */
export interface PredictionWeights {
  /** 一阶转移频率权重 (A→B) */
  w1_ngram: number;
  /** 二阶模式频率权重 (A,B→C) */
  w2_ngram: number;
  /** 三阶模式频率权重 (A,B,C→D) */
  w3_ngram: number;
  /** 类别转移频率权重 */
  w_category: number;
  /** 最近窗口频率权重（近 N 条中该事件的出现频率） */
  w_recent: number;
  /** 时间间隔周期性权重 */
  w_periodicity: number;
}

/**
 * FaMou 进化优化后的最优权重（实验 exp-20260711213836-eauk8s, 第35代）。
 * 进化发现：3-gram 权重最高（高阶模式最具区分力），1-gram 和周期性几乎无用。
 * combined_score: 0.7475 (Top-3: 85.3%, Top-1: 50.1%)
 */
export const DEFAULT_WEIGHTS: PredictionWeights = {
  w1_ngram: 0.1,
  w2_ngram: 0.8,
  w3_ngram: 5.0,
  w_category: 0.02,
  w_recent: 0.05,
  w_periodicity: 0.0,
};

/** 所有可被预测的指令事件列表（排除噪声事件） */
const PREDICTABLE_EVENTS: MediatorEvent[] = INSTRUCTION_REGISTRY
  .filter(def => !def.noisy)
  .map(def => def.event);

/** 类别→事件集合的查找表 */
const CATEGORY_TO_EVENTS = new Map<string, MediatorEvent[]>();
for (const def of INSTRUCTION_REGISTRY) {
  if (def.noisy) continue;
  const list = CATEGORY_TO_EVENTS.get(def.category) ?? [];
  list.push(def.event);
  CATEGORY_TO_EVENTS.set(def.category, list);
}

/** 事件→类别查找表 */
const EVENT_TO_CATEGORY = new Map<MediatorEvent, string>();
for (const def of INSTRUCTION_REGISTRY) {
  if (!def.noisy) {
    EVENT_TO_CATEGORY.set(def.event, def.category);
  }
}

export class InstructionPredictor {
  private store: InstructionStore;
  private weights: PredictionWeights;
  private config: InstructionSystemConfig;

  // 缓存的 n-gram 统计（在预测前刷新）
  private ngram1Cache: Map<string, number> | null = null;
  private ngram2Cache: Map<string, number> | null = null;
  private ngram3Cache: Map<string, number> | null = null;
  private cacheSequenceLength = -1;

  constructor(store: InstructionStore, weights?: PredictionWeights) {
    this.store = store;
    this.weights = weights ?? { ...DEFAULT_WEIGHTS };
    this.config = store.currentConfig;
  }

  /** 更新权重（由 FaMou 进化结果注入） */
  updateWeights(w: Partial<PredictionWeights>): void {
    this.weights = { ...this.weights, ...w };
    logger.debug('InstructionPredictor: weights updated', this.weights);
  }

  /** 获取当前权重 */
  getWeights(): PredictionWeights {
    return { ...this.weights };
  }

  /**
   * 执行预测：基于当前历史序列末尾，预测下一个最可能的指令。
   * 每条指令后自动调用。
   */
  predict(): PredictionResult | null {
    const allRecords = this.store.getAll();
    if (allRecords.length < 2) return null;

    // 刷新 n-gram 缓存
    this.refreshCache();

    // 取历史事件序列（最近 maxNgramOrder + recent_window 条）
    const recentEvents = allRecords
      .slice(-(this.config.maxNgramOrder + 20))
      .map(r => r.event);

    // 对每个候选事件打分
    const scores = new Map<MediatorEvent, number>();
    const reasons = new Map<MediatorEvent, string[]>();

    for (const candidate of PREDICTABLE_EVENTS) {
      const { score, reason } = this.scoreCandidate(candidate, recentEvents);
      if (score > 0) {
        scores.set(candidate, score);
        reasons.set(candidate, [reason]);
      }
    }

    if (scores.size === 0) return null;

    // 归一化为概率分布（softmax）
    const candidates = this.toProbabilityDistribution(scores, reasons);

    if (candidates.length === 0) return null;

    // 选择：明显倾向则直接选 Top-1，否则在 Top-K 中加权随机
    const selected = this.selectByStrategy(candidates);

    return {
      timestamp: Date.now(),
      historyLength: allRecords.length,
      candidates,
      selected,
    };
  }

  // ── 特征提取 ────────────────────────────────────

  /**
   * 给候选事件打分。
   * 综合 n-gram 频率、类别转移、最近频率、周期性。
   */
  private scoreCandidate(
    candidate: MediatorEvent,
    recentEvents: MediatorEvent[]
  ): { score: number; reason: string } {
    let score = 0;
    let topReason = '';

    // 特征1: 一阶 n-gram (last → candidate)
    if (recentEvents.length >= 1) {
      const last = recentEvents[recentEvents.length - 1];
      const freq = this.lookupNgram(this.ngram1Cache, [last, candidate]);
      const total = this.sumNgramPrefix(this.ngram1Cache, [last]);
      if (freq > 0 && total > 0) {
        const prob = freq / total;
        score += this.weights.w1_ngram * prob;
        if (prob > 0.3) topReason = `1-gram: ${last}→${candidate} (${(prob * 100).toFixed(0)}%)`;
      }
    }

    // 特征2: 二阶 n-gram (last2,last1 → candidate)
    if (recentEvents.length >= 2) {
      const last2 = recentEvents.slice(-2);
      const freq = this.lookupNgram(this.ngram2Cache, [...last2, candidate]);
      const total = this.sumNgramPrefix(this.ngram2Cache, last2);
      if (freq > 0 && total > 0) {
        const prob = freq / total;
        score += this.weights.w2_ngram * prob;
        if (prob > 0.3 && !topReason) topReason = `2-gram: ${last2.join('→')}→${candidate} (${(prob * 100).toFixed(0)}%)`;
      }
    }

    // 特征3: 三阶 n-gram (last3,last2,last1 → candidate)
    if (recentEvents.length >= 3) {
      const last3 = recentEvents.slice(-3);
      const freq = this.lookupNgram(this.ngram3Cache, [...last3, candidate]);
      const total = this.sumNgramPrefix(this.ngram3Cache, last3);
      if (freq > 0 && total > 0) {
        const prob = freq / total;
        score += this.weights.w3_ngram * prob;
        if (prob > 0.3 && !topReason) topReason = `3-gram match (${(prob * 100).toFixed(0)}%)`;
      }
    }

    // 特征4: 类别转移频率
    if (recentEvents.length >= 1) {
      const lastEvent = recentEvents[recentEvents.length - 1];
      const lastCat = EVENT_TO_CATEGORY.get(lastEvent);
      const candCat = EVENT_TO_CATEGORY.get(candidate);
      if (lastCat && candCat) {
        const catFreq = this.categoryTransitionFreq(lastCat, candCat);
        score += this.weights.w_category * catFreq;
      }
    }

    // 特征5: 最近窗口频率（用户习惯性操作）
    const recentWindow = recentEvents.slice(-10);
    const recentCount = recentWindow.filter(e => e === candidate).length;
    const recentProb = recentCount / recentWindow.length;
    score += this.weights.w_recent * recentProb;

    // 特征6: 周期性（检查是否有固定间隔重复模式）
    const periodicity = this.computePeriodicity(candidate, recentEvents);
    if (periodicity > 0) {
      score += this.weights.w_periodicity * periodicity;
    }

    if (!topReason) topReason = `score=${score.toFixed(3)}`;

    return { score, reason: topReason };
  }

  // ── n-gram 辅助 ─────────────────────────────────

  private refreshCache(): void {
    const len = this.store.length;
    if (len === this.cacheSequenceLength) return; // 缓存有效
    this.cacheSequenceLength = len;
    this.ngram1Cache = this.store.computeNgram(1);
    this.ngram2Cache = this.store.computeNgram(2);
    this.ngram3Cache = this.store.computeNgram(3);
  }

  private lookupNgram(
    cache: Map<string, number> | null,
    events: MediatorEvent[]
  ): number {
    if (!cache) return 0;
    const key = events.join('→');
    return cache.get(key) ?? 0;
  }

  /** 统计某前缀下所有后缀的总频次 */
  private sumNgramPrefix(
    cache: Map<string, number> | null,
    prefix: MediatorEvent[]
  ): number {
    if (!cache) return 0;
    const prefixStr = prefix.join('→');
    let total = 0;
    for (const [key, count] of cache) {
      const parts = key.split('→');
      const keyPrefix = parts.slice(0, prefix.length).join('→');
      if (keyPrefix === prefixStr) total += count;
    }
    return total;
  }

  // ── 类别转移统计 ────────────────────────────────

  private categoryTransitionFreq(fromCat: string, toCat: string): number {
    const allRecords = this.store.getAll();
    let fromCount = 0;
    let matchCount = 0;
    for (let i = 1; i < allRecords.length; i++) {
      const prevCat = EVENT_TO_CATEGORY.get(allRecords[i - 1].event);
      const currCat = EVENT_TO_CATEGORY.get(allRecords[i].event);
      if (prevCat === fromCat) {
        fromCount++;
        if (currCat === toCat) matchCount++;
      }
    }
    return fromCount > 0 ? matchCount / fromCount : 0;
  }

  // ── 周期性检测 ──────────────────────────────────

  /** 检测候选事件是否在历史中有周期性出现模式 */
  private computePeriodicity(
    candidate: MediatorEvent,
    recentEvents: MediatorEvent[]
  ): number {
    // 找出该事件最近出现的间隔
    const positions: number[] = [];
    for (let i = recentEvents.length - 1; i >= 0; i--) {
      if (recentEvents[i] === candidate) positions.push(i);
    }
    if (positions.length < 2) return 0;

    // 计算间隔的方差，方差小则周期性强
    const intervals: number[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      intervals.push(positions[i] - positions[i + 1]);
    }
    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (avgInterval === 0) return 0;

    const variance = intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / avgInterval; // 变异系数
    // cv 越小越周期，映射到 [0, 1]
    return Math.max(0, 1 - cv);
  }

  // ── 概率分布 ────────────────────────────────────

  private toProbabilityDistribution(
    scores: Map<MediatorEvent, number>,
    reasons: Map<MediatorEvent, string[]>
  ): PredictionCandidate[] {
    // softmax 归一化
    const maxScore = Math.max(...scores.values());
    let sumExp = 0;
    const expScores = new Map<MediatorEvent, number>();
    for (const [evt, s] of scores) {
      const exp = Math.exp(s - maxScore); // 数值稳定
      expScores.set(evt, exp);
      sumExp += exp;
    }

    const candidates: PredictionCandidate[] = [];
    for (const [evt, exp] of expScores) {
      const probability = exp / sumExp;
      const reasonList = reasons.get(evt) ?? [];
      candidates.push({
        event: evt,
        probability,
        reason: reasonList[0] ?? 'unknown',
      });
    }

    // 按概率降序排序
    candidates.sort((a, b) => b.probability - a.probability);

    // 截取 Top-K
    return candidates.slice(0, this.config.topK);
  }

  // ── 选择策略 ────────────────────────────────────

  /**
   * 选择策略：
   * - Top-1 与 Top-2 概率差 > dominanceThreshold → 直接选 Top-1
   * - 否则在 Top-K 中按概率加权随机选择
   */
  private selectByStrategy(candidates: PredictionCandidate[]): MediatorEvent | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].event;

    const top1 = candidates[0];
    const top2 = candidates[1];

    // 明显倾向
    if (top1.probability - top2.probability > this.config.dominanceThreshold) {
      return top1.event;
    }

    // 加权随机选择
    const rand = Math.random();
    let cumulative = 0;
    for (const c of candidates) {
      cumulative += c.probability;
      if (rand < cumulative) return c.event;
    }
    return candidates[0].event;
  }
}
