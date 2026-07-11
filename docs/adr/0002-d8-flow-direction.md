# ADR-0002: D8 流向算法用于流域分析

## Status

Accepted — 2026-06-28

## Context

v0.0.2 引入「复杂世界式」全局生成，需要计算排水盆地（watershed）与河流分级（Strahler 河序）。核心需求：

1. **汇流正确性**：水必须从高处流向低处，最终汇入海洋或内陆湖
2. **流域划分**：每个像素必须归属于一个排水盆地，用于命名与区域分析
3. **河流分级**：需要 Strahler 河序（1 级支流 → 2 级 → ... → 主干）来区分大河与小溪
4. **性能**：512×512 = 26 万像素，D8 全图遍历需在 200ms 内完成

specs/mapgen-v2/requirements.md 的 AC-2.1 要求「每条河流从高累积流量源头流向海洋或内陆洼地，途中不出现逆坡爬升」，AC-2.2 要求「两条河流路径相交时汇流为单一下游河道」。

## Decision

采用 **D8（Deterministic Eight-neighbor）流向算法**，实现在 `packages/core/src/watershed.ts`（428 行）。

### 算法步骤

1. **流向计算**：对每个像素，检查 8 个邻居，选择坡度最陡（高程差最大）的方向作为流向。若所有邻居都更高，标记为洼地（pit）
2. **洼地填充**：对洼地执行 Priority-Flood 算法，逐步抬升洼地高程直到找到出口
3. **累积流量**：按拓扑顺序（从高到低）遍历，每个像素的流量 = 自身 1 + 所有流入它的邻居流量之和
4. **Strahler 分级**：从源头开始，1 级河流；当两条同级别河流汇流时，下游级别 +1；不同级别汇流时取较高级别
5. **排水盆地划分**：用连通域标记，所有流向同一出口的像素属于同一盆地

### 数据结构

- `flowDir: Int8Array`（8 方向编码 0-7，-1 为洼地）
- `accumulation: Float32Array`（累积流量）
- `streamOrder: Uint8Array`（Strahler 河序 1-7）
- `basinId: Int32Array`（排水盆地编号）

## Consequences

### 正面
- D8 是水文学行业标准，结果可解释、可验证
- Strahler 河序为命名系统提供了「大河」判定依据（级别 ≥ 3 命名为「XX 江」，1-2 级为「XX 河/溪」）
- 排水盆地编号用于区域检测，每个盆地可独立命名
- Priority-Flood 保证无残留洼地，河流不会「卡住」

### 负面
- D8 只能流向 8 个固定方向，河流走向有轻微「格点化」伪影（在低分辨率地图上可见）
- Int8Array 限制了单图最大像素数（~2^31，实际远超需求）
- 累积流量用 Float32 可能在大图上溢出（>10^38），实际 512×512 最大约 26 万，安全

### 中性
- Strahler 分级最多 7 级（Uint8），地球真实河流最高约 12 级（亚马逊河），地图尺寸足够时可能不够

## Alternatives Considered

### 1. D∞（D-Infinity）流向
- **优点**：流向连续（任意角度），消除格点化伪影
- **否决原因**：实现复杂度翻倍，累积流量计算需多流向分配（每个下游像素分到部分流量），Strahler 分级不适用；性能约慢 3×

### 2. 多流向法（MD∞ / MFD）
- **优点**：更真实的漫流模拟，适合洪泛区分析
- **否决原因**：河流网络不清晰（流量分散到多个方向），无法生成清晰的河流线条

### 3. 物理水文学模拟（Navier-Stokes 简化）
- **优点**：最真实，能模拟侵蚀、沉积、河曲演化
- **否决原因**：计算量远超实时需求（需要时间步迭代，每帧 O(N)）；mapgen 已有 hydraulicErosion 模块做简化侵蚀，流域分析只需静态拓扑

## References

- [O'Callaghan, J.F., Mark, D.M. (1984). "The extraction of drainage networks from digital elevation data"](https://www.sciencedirect.com/science/article/pii/S0734189X8480047X) — D8 原始论文
- [Barnes, R. et al. (2014). "Priority-flood: An optimal depression-filling and watershed-labeling algorithm"](https://arxiv.org/abs/1511.04463)
- [Strahler, A.N. (1957). "Quantitative analysis of watershed geomorphology"](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/TR038i006p00913)
- [specs/mapgen-v2/requirements.md](../../specs/mapgen-v2/requirements.md) — AC-2.1, AC-2.2
- [packages/core/src/watershed.ts](../../packages/core/src/watershed.ts) — 实现
