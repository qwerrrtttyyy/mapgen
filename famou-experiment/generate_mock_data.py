#!/usr/bin/env python3
"""
生成模拟指令序列数据，模拟用户在 mapgen 地图生成器中的真实操作模式。
输出: data/instruction_log.json
"""

import json
import random
import os
import sys

# ── 事件定义（与 instructionTypes.ts 中的 INSTRUCTION_REGISTRY 对齐） ──

# 用户指令（可预测目标）
USER_EVENTS = [
    "generate.request",
    "randomSeed.request",
    "params.committed",
    "selection.clear",
    "editor.committed",
    "editor.mode.changed",
    "map.contextmenu",
    "checkpoint.save.request",
    "checkpoint.restore.request",
    "checkpoint.delete.request",
    "export.request",
    "export.dialog.open",
    "laser.mode.set",
    "laser.toggle",
    "debug.toggle",
    "debug.open",
    "debug.close",
    "overlay.toggle",
]

# 系统事件（记录但不作为预测目标）
SYSTEM_EVENTS = [
    "generating.started",
    "generating.completed",
    "generating.failed",
    "regenerate.phase",
    "checkpoint.updated",
    "laser.selection.done",
    "names.updated",
]

# 事件→类别映射
EVENT_CATEGORY = {
    "generate.request": "generation",
    "randomSeed.request": "generation",
    "generating.started": "generation",
    "generating.completed": "generation",
    "generating.failed": "generation",
    "regenerate.phase": "generation",
    "params.committed": "parameter",
    "selection.clear": "selection",
    "editor.committed": "editor",
    "editor.mode.changed": "editor",
    "map.contextmenu": "navigation",
    "checkpoint.save.request": "checkpoint",
    "checkpoint.restore.request": "checkpoint",
    "checkpoint.delete.request": "checkpoint",
    "checkpoint.updated": "checkpoint",
    "export.request": "export",
    "export.dialog.open": "export",
    "laser.mode.set": "laser",
    "laser.toggle": "laser",
    "laser.selection.done": "laser",
    "debug.toggle": "debug",
    "debug.open": "debug",
    "debug.close": "debug",
    "overlay.toggle": "overlay",
    "names.updated": "overlay",
}

# ── 操作模式定义 ──
# 模拟真实用户的行为模式：不同模式有不同的指令转移概率

PATTERNS = {
    # 模式1: 新手探索 — 频繁生成、调参、切换风格
    "explorer": {
        "weight": 0.3,
        "transitions": {
            "generate.request": [("generating.started", 1.0)],
            "generating.started": [("generating.completed", 0.95), ("generating.failed", 0.05)],
            "generating.completed": [("params.committed", 0.4), ("randomSeed.request", 0.2), ("overlay.toggle", 0.15), ("generate.request", 0.1), ("export.dialog.open", 0.05), ("checkpoint.save.request", 0.1)],
            "generating.failed": [("params.committed", 0.6), ("generate.request", 0.4)],
            "params.committed": [("generate.request", 0.6), ("params.committed", 0.2), ("overlay.toggle", 0.2)],
            "randomSeed.request": [("generate.request", 1.0)],
            "overlay.toggle": [("params.committed", 0.3), ("generate.request", 0.3), ("overlay.toggle", 0.2), ("editor.mode.changed", 0.2)],
            "editor.mode.changed": [("editor.committed", 0.7), ("params.committed", 0.3)],
            "editor.committed": [("generate.request", 0.4), ("editor.committed", 0.3), ("overlay.toggle", 0.3)],
            "export.dialog.open": [("export.request", 0.6), ("generate.request", 0.4)],
            "export.request": [("generate.request", 0.3), ("checkpoint.save.request", 0.3), ("overlay.toggle", 0.4)],
            "checkpoint.save.request": [("checkpoint.updated", 1.0)],
            "checkpoint.updated": [("generate.request", 0.5), ("overlay.toggle", 0.5)],
            "selection.clear": [("editor.mode.changed", 0.5), ("generate.request", 0.5)],
            "map.contextmenu": [("editor.mode.changed", 0.5), ("selection.clear", 0.5)],
            "laser.toggle": [("laser.mode.set", 0.7), ("generate.request", 0.3)],
            "laser.mode.set": [("laser.selection.done", 1.0)],
            "laser.selection.done": [("generate.request", 0.5), ("editor.committed", 0.5)],
            "debug.toggle": [("debug.open", 0.5), ("debug.close", 0.5)],
            "debug.open": [("debug.close", 1.0)],
            "debug.close": [("generate.request", 1.0)],
            "checkpoint.restore.request": [("checkpoint.updated", 1.0)],
            "checkpoint.delete.request": [("checkpoint.updated", 1.0)],
            "regenerate.phase": [("params.committed", 0.5), ("generate.request", 0.5)],
            "names.updated": [("overlay.toggle", 0.5), ("generate.request", 0.5)],
        },
        "start_events": ["generate.request", "params.committed", "randomSeed.request"],
    },

    # 模式2: 专业编辑 — 编辑地形、检查点频繁
    "editor": {
        "weight": 0.3,
        "transitions": {
            "generate.request": [("generating.started", 1.0)],
            "generating.started": [("generating.completed", 0.98), ("generating.failed", 0.02)],
            "generating.completed": [("editor.mode.changed", 0.5), ("checkpoint.save.request", 0.2), ("params.committed", 0.15), ("overlay.toggle", 0.15)],
            "generating.failed": [("generate.request", 1.0)],
            "editor.mode.changed": [("editor.committed", 0.9), ("selection.clear", 0.1)],
            "editor.committed": [("editor.committed", 0.3), ("editor.mode.changed", 0.2), ("checkpoint.save.request", 0.2), ("overlay.toggle", 0.15), ("generate.request", 0.15)],
            "checkpoint.save.request": [("checkpoint.updated", 1.0)],
            "checkpoint.updated": [("editor.committed", 0.4), ("editor.mode.changed", 0.3), ("checkpoint.restore.request", 0.15), ("generate.request", 0.15)],
            "checkpoint.restore.request": [("checkpoint.updated", 1.0)],
            "checkpoint.delete.request": [("checkpoint.updated", 1.0)],
            "params.committed": [("generate.request", 0.7), ("editor.mode.changed", 0.3)],
            "overlay.toggle": [("editor.committed", 0.5), ("editor.mode.changed", 0.5)],
            "selection.clear": [("editor.mode.changed", 1.0)],
            "map.contextmenu": [("editor.mode.changed", 0.7), ("selection.clear", 0.3)],
            "generate.request": [("generating.started", 1.0)],
            "randomSeed.request": [("generate.request", 1.0)],
            "export.dialog.open": [("export.request", 0.7), ("editor.committed", 0.3)],
            "export.request": [("editor.committed", 0.5), ("checkpoint.save.request", 0.5)],
            "laser.toggle": [("laser.mode.set", 1.0)],
            "laser.mode.set": [("laser.selection.done", 1.0)],
            "laser.selection.done": [("editor.committed", 0.7), ("generate.request", 0.3)],
            "regenerate.phase": [("editor.mode.changed", 0.5), ("generate.request", 0.5)],
            "debug.toggle": [("debug.open", 0.5), ("debug.close", 0.5)],
            "debug.open": [("debug.close", 1.0)],
            "debug.close": [("editor.mode.changed", 1.0)],
            "names.updated": [("overlay.toggle", 1.0)],
        },
        "start_events": ["generate.request", "editor.mode.changed", "checkpoint.restore.request"],
    },

    # 模式3: 导出导向 — 生成后快速调整并导出
    "exporter": {
        "weight": 0.2,
        "transitions": {
            "generate.request": [("generating.started", 1.0)],
            "generating.started": [("generating.completed", 0.97), ("generating.failed", 0.03)],
            "generating.completed": [("params.committed", 0.3), ("overlay.toggle", 0.2), ("export.dialog.open", 0.3), ("randomSeed.request", 0.2)],
            "generating.failed": [("params.committed", 0.7), ("generate.request", 0.3)],
            "params.committed": [("generate.request", 0.5), ("export.dialog.open", 0.3), ("params.committed", 0.2)],
            "randomSeed.request": [("generate.request", 1.0)],
            "overlay.toggle": [("generate.request", 0.4), ("params.committed", 0.3), ("export.dialog.open", 0.3)],
            "export.dialog.open": [("export.request", 0.8), ("generate.request", 0.2)],
            "export.request": [("checkpoint.save.request", 0.4), ("generate.request", 0.3), ("params.committed", 0.3)],
            "checkpoint.save.request": [("checkpoint.updated", 1.0)],
            "checkpoint.updated": [("generate.request", 0.4), ("params.committed", 0.3), ("overlay.toggle", 0.3)],
            "editor.mode.changed": [("editor.committed", 0.8), ("params.committed", 0.2)],
            "editor.committed": [("generate.request", 0.5), ("export.dialog.open", 0.5)],
            "selection.clear": [("generate.request", 0.5), ("params.committed", 0.5)],
            "map.contextmenu": [("selection.clear", 0.5), ("params.committed", 0.5)],
            "generate.request": [("generating.started", 1.0)],
            "laser.toggle": [("laser.mode.set", 1.0)],
            "laser.mode.set": [("laser.selection.done", 1.0)],
            "laser.selection.done": [("generate.request", 1.0)],
            "regenerate.phase": [("params.committed", 0.5), ("generate.request", 0.5)],
            "debug.toggle": [("debug.open", 0.5), ("debug.close", 0.5)],
            "debug.open": [("debug.close", 1.0)],
            "debug.close": [("generate.request", 1.0)],
            "checkpoint.restore.request": [("checkpoint.updated", 1.0)],
            "checkpoint.delete.request": [("checkpoint.updated", 1.0)],
            "names.updated": [("overlay.toggle", 1.0)],
        },
        "start_events": ["generate.request", "params.committed", "export.dialog.open"],
    },

    # 模式4: 调试/开发 — 频繁切换 debug 面板
    "debugger": {
        "weight": 0.2,
        "transitions": {
            "generate.request": [("generating.started", 1.0)],
            "generating.started": [("generating.completed", 0.9), ("generating.failed", 0.1)],
            "generating.completed": [("debug.toggle", 0.4), ("params.committed", 0.3), ("overlay.toggle", 0.3)],
            "generating.failed": [("debug.toggle", 0.5), ("params.committed", 0.5)],
            "debug.toggle": [("debug.open", 0.5), ("debug.close", 0.5)],
            "debug.open": [("params.committed", 0.3), ("generate.request", 0.3), ("debug.close", 0.4)],
            "debug.close": [("generate.request", 0.5), ("params.committed", 0.5)],
            "params.committed": [("generate.request", 0.5), ("debug.toggle", 0.3), ("params.committed", 0.2)],
            "overlay.toggle": [("debug.toggle", 0.4), ("generate.request", 0.3), ("params.committed", 0.3)],
            "editor.mode.changed": [("editor.committed", 0.7), ("debug.toggle", 0.3)],
            "editor.committed": [("generate.request", 0.5), ("debug.toggle", 0.5)],
            "randomSeed.request": [("generate.request", 1.0)],
            "export.dialog.open": [("export.request", 0.7), ("debug.toggle", 0.3)],
            "export.request": [("generate.request", 0.5), ("debug.toggle", 0.5)],
            "checkpoint.save.request": [("checkpoint.updated", 1.0)],
            "checkpoint.updated": [("debug.toggle", 0.4), ("generate.request", 0.6)],
            "selection.clear": [("debug.toggle", 0.3), ("generate.request", 0.7)],
            "map.contextmenu": [("debug.toggle", 0.3), ("selection.clear", 0.7)],
            "laser.toggle": [("laser.mode.set", 1.0)],
            "laser.mode.set": [("laser.selection.done", 1.0)],
            "laser.selection.done": [("generate.request", 1.0)],
            "regenerate.phase": [("debug.toggle", 0.5), ("generate.request", 0.5)],
            "checkpoint.restore.request": [("checkpoint.updated", 1.0)],
            "checkpoint.delete.request": [("checkpoint.updated", 1.0)],
            "names.updated": [("overlay.toggle", 1.0)],
        },
        "start_events": ["generate.request", "debug.toggle", "params.committed"],
    },
}


def generate_sequence(pattern_name: str, length: int) -> list:
    """生成一条指令序列"""
    pattern = PATTERNS[pattern_name]
    transitions = pattern["transitions"]
    start_events = pattern["start_events"]

    events = []
    current = random.choice(start_events)
    events.append(current)

    for _ in range(length - 1):
        nexts = transitions.get(current)
        if not nexts:
            current = random.choice(start_events)
            events.append(current)
            continue

        r = random.random()
        cumulative = 0
        chosen = nexts[0][0]
        for evt, prob in nexts:
            cumulative += prob
            if r < cumulative:
                chosen = evt
                break
        events.append(chosen)
        current = chosen

    return events


def events_to_records(events: list, start_time: int) -> list:
    """将事件列表转换为完整的记录格式"""
    records = []
    ts = start_time
    for i, evt in enumerate(events):
        cat = EVENT_CATEGORY.get(evt, "other")
        source = "system" if evt in SYSTEM_EVENTS else "user"
        delta = random.randint(200, 5000) if i > 0 else 0
        ts += delta
        records.append({
            "event": evt,
            "category": cat,
            "source": source,
            "deltaMs": delta,
            "timestamp": ts,
        })
    return records


def main():
    random.seed(42)

    all_sequences = []
    base_time = 1700000000000  # 基准时间戳 (ms)

    # 为每种模式生成多条序列
    seq_id = 0
    for pattern_name, pattern_def in PATTERNS.items():
        num_sessions = 15
        for i in range(num_sessions):
            length = random.randint(30, 80)
            events = generate_sequence(pattern_name, length)
            records = events_to_records(events, base_time + seq_id * 1000000)
            all_sequences.append(records)
            seq_id += 1

    # 也可以生成混合模式序列（用户中途切换行为模式）
    for i in range(10):
        length = random.randint(50, 100)
        events = []
        pattern_names = list(PATTERNS.keys())
        current_pattern = random.choice(pattern_names)
        remaining = length
        while remaining > 0:
            chunk = min(remaining, random.randint(10, 30))
            events.extend(generate_sequence(current_pattern, chunk))
            remaining -= chunk
            if remaining > 0:
                current_pattern = random.choice(pattern_names)
        records = events_to_records(events[:length], base_time + seq_id * 1000000)
        all_sequences.append(records)
        seq_id += 1

    # 统计
    total = sum(len(s) for s in all_sequences)
    event_counts = {}
    for s in all_sequences:
        for r in s:
            event_counts[r["event"]] = event_counts.get(r["event"], 0) + 1

    output = {
        "description": "Simulated instruction sequences for mapgen predictor weight optimization",
        "generator": "generate_mock_data.py",
        "total_sequences": len(all_sequences),
        "total_records": total,
        "event_counts": event_counts,
        "sequences": all_sequences,
    }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "instruction_log.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Generated {len(all_sequences)} sequences, {total} total records")
    print(f"Event distribution:")
    for evt, count in sorted(event_counts.items(), key=lambda x: -x[1]):
        print(f"  {evt:35s} {count:5d} ({count/total*100:.1f}%)")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
