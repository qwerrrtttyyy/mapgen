#!/usr/bin/env python3
"""
solution_informed.py — 启发式权重（偏好 n-gram，抑制周期性）
用于验证 evaluator 能区分不同质量方案。
"""

import json

if __name__ == "__main__":
    weights = {
        "w1_ngram": 2.0,
        "w2_ngram": 1.5,
        "w3_ngram": 0.3,
        "w_category": 0.8,
        "w_recent": 0.5,
        "w_periodicity": 0.05,
    }
    print(json.dumps(weights))
