# Architecture Decision Records (ADR)

本目录记录 mapgen 项目的架构决策。每篇 ADR 遵循 MADR（Markdown Architecture Decision Records）格式，包含 Context、Decision、Consequences、Alternatives 四个部分。

## 索引

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| [ADR-0001](0001-fbm-noise-selection.md) | FBM 噪声体系选型（Perlin/Simplex/Value/Worley） | Accepted | 2026-06-26 |
| [ADR-0002](0002-d8-flow-direction.md) | D8 流向算法用于流域分析 | Accepted | 2026-06-28 |
| [ADR-0003](0003-koppen-geiger-biomes.md) | Köppen-Geiger 32 类生物群系分类 | Accepted | 2026-06-28 |
| [ADR-0004](0004-mediator-pattern.md) | Mediator 模式协调 UI 子系统 | Accepted | 2026-06-26 |
| [ADR-0005](0005-webgl2-primary-renderer.md) | WebGL2 主渲染器 + Canvas2D/p5 降级 | Accepted | 2026-06-26 |
| [ADR-0006](0006-pipeline-architecture.md) | generateMap 6 阶段管线架构 | Accepted | 2026-07-06 |

## 编写规则

- **新建 ADR**：复制 `0000-template.md`，编号递增，状态设为 Proposed
- **状态流转**：Proposed → Accepted → Superseded（被新 ADR 取代时）
- **不可删除**：ADR 一旦 Accepted 就不删除，被推翻时改为 Superseded 并指向新 ADR
- **聚焦决策**：记录「为什么选这个方案」，不是「怎么实现」（实现细节看代码与 JSDoc）
