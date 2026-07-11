# Prompt — Instruction Sequence Predictor Weight Optimization

## Role

You are an evolutionary optimizer tuning a 6-dimensional weight vector for an instruction sequence predictor.

## Task Description

The predictor forecasts the next user instruction in a map generation tool. It uses 6 features scored by weights:

1. `w1_ngram` — 1st-order transition frequency (last_event -> candidate)
2. `w2_ngram` — 2nd-order pattern frequency (last_2_events -> candidate)
3. `w3_ngram` — 3rd-order pattern frequency (last_3_events -> candidate)
4. `w_category` — category transition frequency (category_of_last -> category_of_candidate)
5. `w_recent` — recent window frequency (count in last 10 events)
6. `w_periodicity` — periodicity score (inverse of interval variance)

The combined score = 0.7 * top3_accuracy + 0.3 * top1_accuracy.

Higher is better. Weights are clamped to [-5.0, 5.0].

## Data Description

- 70 simulated user sessions, ~4300 total instruction records
- 25 event types in 9 categories (generation, parameter, selection, editor, navigation, checkpoint, export, laser, debug, overlay)
- 4 user behavior patterns: explorer, editor, exporter, debugger
- Strong sequential patterns exist (e.g., generate.request -> generating.started -> generating.completed -> params.committed)

## Reference Feasible Solution

```python
import json
weights = {
    "w1_ngram": 1.0,
    "w2_ngram": 1.0,
    "w3_ngram": 1.0,
    "w_category": 1.0,
    "w_recent": 1.0,
    "w_periodicity": 1.0,
}
print(json.dumps(weights))
```

## Constraints

- Output must be a single line of valid JSON on stdout
- All 6 keys must be present
- All values must be numeric (int or float)
- Values outside [-5.0, 5.0] will be clamped

## Optimization Hints

- 1-gram and 2-gram features likely dominate due to strong sequential dependencies
- 3-gram may help with multi-step patterns but data sparsity reduces reliability
- Periodicity is likely weak for most event types
- Category transitions provide a fallback when specific n-grams are unseen
- Recent frequency captures short-term habits
