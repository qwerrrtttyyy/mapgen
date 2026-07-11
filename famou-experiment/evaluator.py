#!/usr/bin/env python3
"""
evaluator.py — FaMou 评估器
评估候选权重向量在指令序列预测上的 Top-K 准确率。

接口:
  python evaluator.py <path_to_candidate_solution.py>

候选解决方案 (solution.py) 的输出契约:
  - stdout 输出一行 JSON，包含 6 个 float 字段:
    {"w1_ngram": ..., "w2_ngram": ..., "w3_ngram": ..., "w_category": ..., "w_recent": ..., "w_periodicity": ...}

返回:
  {
    "validity": float,       # 1.0=有效, 0.0=无效
    "combined_score": float, # 越高越好
    "cost_time": float,      # 运行耗时(秒)
    "error_info": str,       # 错误信息，有效时为 ""
  }
"""

import json
import os
import sys
import time
import subprocess
import math
from collections import defaultdict

# ── 路径解析 ──────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "instruction_log.json")

# ── 事件定义（与 instructionTypes.ts 对齐）────────

ALL_EVENTS = [
    "generate.request", "randomSeed.request",
    "generating.started", "generating.completed", "generating.failed", "regenerate.phase",
    "params.committed",
    "selection.clear",
    "editor.committed", "editor.mode.changed",
    "map.contextmenu",
    "checkpoint.save.request", "checkpoint.restore.request", "checkpoint.delete.request",
    "checkpoint.updated",
    "export.request", "export.dialog.open",
    "laser.mode.set", "laser.toggle", "laser.selection.done",
    "debug.toggle", "debug.open", "debug.close",
    "overlay.toggle", "names.updated",
]

EVENT_CATEGORY = {
    "generate.request": "generation", "randomSeed.request": "generation",
    "generating.started": "generation", "generating.completed": "generation",
    "generating.failed": "generation", "regenerate.phase": "generation",
    "params.committed": "parameter",
    "selection.clear": "selection",
    "editor.committed": "editor", "editor.mode.changed": "editor",
    "map.contextmenu": "navigation",
    "checkpoint.save.request": "checkpoint", "checkpoint.restore.request": "checkpoint",
    "checkpoint.delete.request": "checkpoint", "checkpoint.updated": "checkpoint",
    "export.request": "export", "export.dialog.open": "export",
    "laser.mode.set": "laser", "laser.toggle": "laser", "laser.selection.done": "laser",
    "debug.toggle": "debug", "debug.open": "debug", "debug.close": "debug",
    "overlay.toggle": "overlay", "names.updated": "overlay",
}

# 仅预测用户指令（排除系统事件作为预测目标）
PREDICTABLE_EVENTS = [
    "generate.request", "randomSeed.request",
    "params.committed",
    "selection.clear",
    "editor.committed", "editor.mode.changed",
    "map.contextmenu",
    "checkpoint.save.request", "checkpoint.restore.request", "checkpoint.delete.request",
    "export.request", "export.dialog.open",
    "laser.mode.set", "laser.toggle",
    "debug.toggle", "debug.open", "debug.close",
    "overlay.toggle",
]


# ── 预测引擎（镜像 TypeScript 实现）──────────────

class PredictionEngine:
    def __init__(self, sequences):
        self.sequences = sequences
        # 预计算 n-gram 统计
        self.ngram1 = defaultdict(lambda: defaultdict(int))  # {prefix_event: {next_event: count}}
        self.ngram2 = defaultdict(lambda: defaultdict(int))  # {(e1,e2): {next: count}}
        self.ngram3 = defaultdict(lambda: defaultdict(int))  # {(e1,e2,e3): {next: count}}
        self.cat_transitions = defaultdict(lambda: defaultdict(int))  # {cat_from: {cat_to: count}}
        self._build_stats()

    def _build_stats(self):
        for seq in self.sequences:
            events = [r["event"] for r in seq]
            # 1-gram
            for i in range(1, len(events)):
                self.ngram1[events[i-1]][events[i]] += 1
            # 2-gram
            for i in range(2, len(events)):
                key = (events[i-2], events[i-1])
                self.ngram2[key][events[i]] += 1
            # 3-gram
            for i in range(3, len(events)):
                key = (events[i-3], events[i-2], events[i-1])
                self.ngram3[key][events[i]] += 1
            # 类别转移
            for i in range(1, len(events)):
                c_from = EVENT_CATEGORY.get(events[i-1], "other")
                c_to = EVENT_CATEGORY.get(events[i], "other")
                self.cat_transitions[c_from][c_to] += 1

    def _ngram_prob(self, ngram_dict, prefix, candidate, order):
        """计算 n-gram 条件概率 P(candidate | prefix)"""
        if isinstance(prefix, str):
            prefix_key = prefix
        else:
            prefix_key = tuple(prefix)
        nexts = ngram_dict.get(prefix_key, {})
        total = sum(nexts.values())
        if total == 0:
            return 0.0
        return nexts.get(candidate, 0) / total

    def _category_transition_prob(self, from_cat, to_cat):
        total = sum(self.cat_transitions[from_cat].values())
        if total == 0:
            return 0.0
        return self.cat_transitions[from_cat].get(to_cat, 0) / total

    def _recent_freq(self, recent_window, candidate):
        if not recent_window:
            return 0.0
        return recent_window.count(candidate) / len(recent_window)

    def _periodicity(self, candidate, recent_window):
        positions = []
        for i in range(len(recent_window) - 1, -1, -1):
            if recent_window[i] == candidate:
                positions.append(i)
        if len(positions) < 2:
            return 0.0
        intervals = [positions[i] - positions[i+1] for i in range(len(positions) - 1)]
        avg = sum(intervals) / len(intervals)
        if avg == 0:
            return 0.0
        variance = sum((v - avg) ** 2 for v in intervals) / len(intervals)
        cv = math.sqrt(variance) / avg
        return max(0.0, 1.0 - cv)

    def score_candidate(self, candidate, history, weights):
        """给候选事件打分"""
        score = 0.0
        w1 = weights["w1_ngram"]
        w2 = weights["w2_ngram"]
        w3 = weights["w3_ngram"]
        wc = weights["w_category"]
        wr = weights["w_recent"]
        wp = weights["w_periodicity"]

        # 1-gram
        if len(history) >= 1:
            p = self._ngram_prob(self.ngram1, history[-1], candidate, 1)
            score += w1 * p

        # 2-gram
        if len(history) >= 2:
            p = self._ngram_prob(self.ngram2, history[-2:], candidate, 2)
            score += w2 * p

        # 3-gram
        if len(history) >= 3:
            p = self._ngram_prob(self.ngram3, history[-3:], candidate, 3)
            score += w3 * p

        # 类别转移
        if len(history) >= 1:
            last_cat = EVENT_CATEGORY.get(history[-1], "other")
            cand_cat = EVENT_CATEGORY.get(candidate, "other")
            p = self._category_transition_prob(last_cat, cand_cat)
            score += wc * p

        # 最近窗口频率
        recent = history[-10:]
        score += wr * self._recent_freq(recent, candidate)

        # 周期性
        score += wp * self._periodicity(candidate, history[-20:])

        return score

    def evaluate_weights(self, weights, top_k=3):
        """在所有序列上评估权重的 Top-K 准确率"""
        top1_hit = 0
        topk_hit = 0
        total = 0

        for seq in self.sequences:
            events = [r["event"] for r in seq]
            for i in range(3, len(events)):
                history = events[:i]
                actual = events[i]

                # 跳过系统事件作为预测目标
                if actual not in PREDICTABLE_EVENTS:
                    continue

                # 对所有候选打分
                scores = {}
                for cand in PREDICTABLE_EVENTS:
                    s = self.score_candidate(cand, history, weights)
                    if s > 0 or True:  # 保留所有候选（即使得分为0）
                        scores[cand] = s

                if not scores:
                    continue

                # 排序
                ranked = sorted(scores.items(), key=lambda x: -x[1])
                top1 = ranked[0][0]
                topk_events = [r[0] for r in ranked[:top_k]]

                if top1 == actual:
                    top1_hit += 1
                if actual in topk_events:
                    topk_hit += 1
                total += 1

        if total == 0:
            return 0.0, 0.0

        top1_acc = top1_hit / total
        topk_acc = topk_hit / total
        return topk_acc, top1_acc


# ── 评估器主函数 ──────────────────────────────────

def evaluate(path_user_py, task_name="default", timeout=60):
    start_time = time.time()

    # 1. 运行候选脚本
    try:
        proc = subprocess.run(
            [sys.executable, path_user_py],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=SCRIPT_DIR,
        )
    except subprocess.TimeoutExpired:
        return {"validity": 0.0, "combined_score": 0.0, "cost_time": float(timeout),
                "error_info": f"Timeout after {timeout}s"}
    except Exception as e:
        return {"validity": 0.0, "combined_score": 0.0, "cost_time": 0.0,
                "error_info": f"Failed to run: {e}"}

    if proc.returncode != 0:
        return {"validity": 0.0, "combined_score": 0.0, "cost_time": time.time() - start_time,
                "error_info": f"Exit code {proc.returncode}: {proc.stderr[:500]}"}

    # 2. 解析输出
    stdout = proc.stdout.strip()
    try:
        weights = json.loads(stdout)
    except json.JSONDecodeError:
        return {"validity": 0.0, "combined_score": 0.0, "cost_time": time.time() - start_time,
                "error_info": f"Invalid JSON output: {stdout[:200]}"}

    # 3. 校验权重
    required_keys = ["w1_ngram", "w2_ngram", "w3_ngram", "w_category", "w_recent", "w_periodicity"]
    for key in required_keys:
        if key not in weights:
            return {"validity": 0.0, "combined_score": 0.0, "cost_time": time.time() - start_time,
                    "error_info": f"Missing key: {key}"}
        val = weights[key]
        if not isinstance(val, (int, float)):
            return {"validity": 0.0, "combined_score": 0.0, "cost_time": time.time() - start_time,
                    "error_info": f"Key {key} is not numeric: {val}"}

    # Clamp weights to [-5.0, 5.0]
    clamped = {}
    for key in required_keys:
        v = float(weights[key])
        clamped[key] = max(-5.0, min(5.0, v))

    # 4. 加载数据并评估
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return {"validity": 0.0, "combined_score": 0.0, "cost_time": time.time() - start_time,
                "error_info": f"Failed to load data: {e}"}

    sequences = data["sequences"]

    engine = PredictionEngine(sequences)
    top3_acc, top1_acc = engine.evaluate_weights(clamped, top_k=3)

    # 5. 计算综合得分
    combined_score = 0.7 * top3_acc + 0.3 * top1_acc
    cost_time = time.time() - start_time

    return {
        "validity": 1.0,
        "combined_score": combined_score,
        "cost_time": cost_time,
        "error_info": "",
        "top1_accuracy": top1_acc,
        "top3_accuracy": top3_acc,
        "weights": clamped,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python evaluator.py <path_to_candidate_solution.py>")
        sys.exit(1)

    result = evaluate(sys.argv[1])
    print(json.dumps(result, indent=2))
