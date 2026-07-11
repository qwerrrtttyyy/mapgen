## Objective
<!-- READONLY: Prepare init.py, evaluator.py, and prompt.md for a Famou evolutionary task -->

## 1. Task Definition

- **Core problem**: Optimize the feature weight vector for an instruction sequence predictor in a map generation tool. The predictor uses multi-order n-gram statistics, category transitions, recency, and periodicity features to forecast the next user instruction. The goal is to find the 6-dimensional weight vector that maximizes Top-3 prediction accuracy on held-out instruction sequences.

- **Input**:
  - `data/instruction_log.json` — simulated instruction sequences (70 sessions, ~4300 records)
  - Candidate solution is a Python file (`init.py` / evolved `solution.py`) that outputs a JSON weight vector to stdout

- **Output**: stdout JSON with 6 float fields:
  ```json
  {"w1_ngram": 1.0, "w2_ngram": 1.0, "w3_ngram": 0.5, "w_category": 0.5, "w_recent": 0.3, "w_periodicity": 0.1}
  ```

- **Primary optimization objective**: Maximize Top-3 hit rate — for each position in each sequence (starting from index 3), use the weights to score all candidate events, take the top 3, and check if the actual next event is among them. The combined score = 0.7 * top3_accuracy + 0.3 * top1_accuracy.

- **Key metrics and formulas**:
  - For each candidate event at position i, compute:
    - `score = w1*f1_ngram + w2*f2_ngram + w3*f3_ngram + wc*f_category + wr*f_recent + wp*f_periodicity`
  - Softmax normalize scores to probabilities
  - Top-3 accuracy = fraction of positions where actual next event is in top-3 by score
  - Top-1 accuracy = fraction where actual next event is top-1

## 2. Data Description

- **Data source**: `data/instruction_log.json`
- **Schema**: 
  ```json
  {
    "total_sequences": 70,
    "total_records": 4309,
    "sequences": [
      [
        {"event": "generate.request", "category": "generation", "source": "user", "deltaMs": 0, "timestamp": 1700000000000},
        {"event": "generating.started", "category": "generation", "source": "system", "deltaMs": 1234, "timestamp": 1700000001234},
        ...
      ],
      ...
    ]
  }
  ```
- **Events**: 25 mediator event types (18 user, 7 system), grouped into 9 categories
- **Data quality**: Clean simulated data, no missing values. Some events are rare (selection.clear: 0.3%, generating.failed: 0.7%)

## 3. Constraints and Evaluation Basis

- **Hard constraints**:
  - All 6 weights must be present in the output JSON
  - All weights must be numeric (int or float)
  - Output must be valid JSON parseable by `json.loads()`
  
- **Soft constraints / optimization targets**:
  - Maximize combined_score = 0.7 * top3_accuracy + 0.3 * top1_accuracy
  - Weights should be in range [-5.0, 5.0] (clamped if outside)
  
- **Quality measurement**: The evaluator computes the combined_score by running the prediction algorithm with the candidate's weights on all sequences. Higher is better.

## 4. Initial Solution Direction

- **Baseline**: Equal weights `[1.0, 1.0, 1.0, 1.0, 1.0, 1.0]` — all features equally weighted
- **Expected improvement direction**: 2-gram and 1-gram features likely matter most (user behavior has strong sequential patterns); periodicity likely matters least. The optimal weights may emphasize w1_ngram and w2_ngram heavily while reducing w3_ngram, w_periodicity.

## 5. Supplementary Information

- The prediction algorithm mirrors the TypeScript implementation in `packages/web/src/core/instructionPredictor.ts`
- n-gram order: 1, 2, 3 (prefix lengths 1, 2, 3 respectively)
- Recent window: last 10 events
- Category transitions: frequency of category(i-1) → category(i)
- Periodicity: coefficient of variation of inter-arrival intervals
- 4 user behavior patterns are embedded in the data: explorer, editor, exporter, debugger
