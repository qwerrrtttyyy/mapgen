# ADR-0006: generateMap 6 阶段管线架构

## Status

Accepted — 2026-07-06

## Context

v0.0.1 的 `generateMap` 函数是一个 590 行的巨型函数，包含噪声生成、板块构造、高程计算、侵蚀、气候、河流、区域分析、纹理打包等所有逻辑。问题：

1. **不可测试**：590 行函数无法单独测试某个阶段（如「只测气候」需 mock 前 4 个阶段）
2. **不可中断**：无法在中途取消生成（没有自然的 checkpoint 点）
3. **不可调试**：bug 出在「河流」阶段时，无法只重跑该阶段，必须从头开始
4. **不可扩展**：新增阶段（如「火山」）需修改巨型函数，易引入回归
5. **进度报告粗糙**：只能报告「正在生成」，无法报告「板块构造 30% → 高程 45%」

docs/archive/REFACTORING_PLAN.md 明确要求「拆分巨型导出文件（553 行 → 模块化）」，specs/mapgen-v2/design.md 要求 pipeline 分阶段。

## Decision

将 `generateMap` 拆分为 **6 阶段 pipeline**，每阶段是独立函数，定义在 `packages/core/src/pipeline/` 目录下：

### 阶段划分

| 阶段 | 文件 | 输入 | 输出 | 权重 |
|------|------|------|------|------|
| 1. tectonic | `tectonicStage.ts` | seed, params | plates, plateId, plateDist, boundary | 8 |
| 2. elevation | `elevationStage.ts` | tectonic state | elevation, slope, ridge, ridgeMask | 22 |
| 3. climate | `climateStage.ts` | tectonic + elevation | temperature, moisture, rainfall, currents, ice, coastDist | 24 (coastline 4 + currents 5 + climate 9 + ice 6) |
| 4. river | `riverStage.ts` | tectonic + climate | rivers, lakes, biomes, watershed, volcanism, seasons | 22 (biomes 3 + watershed 4 + volcanism 3 + seasons 3 + lakes 3 + rivers 7) |
| 5. region | `regionStage.ts` | tectonic + climate + river | regions, names | 4 (regions 4 + naming 2) |
| 6. packing | `packingStage.ts` | all above | MapData (11 packed textures) | 1 |

### 主函数（从 590 行 → 60 行）

```typescript
export function generateMap(params: MapParams, onProgress?: ProgressCallback) {
  // 1. 板块构造
  const tectonic = runTectonicStage(width, height, seed, params);
  // 2. 高程 + 侵蚀
  const elevState = runElevationStage(width, height, seed, params, tectonic);
  // 3. 气候（含海岸线、洋流、冰盖）
  const climate = runClimateStage(width, height, seed, params, tectonic, elevState);
  // 4. 河流（含湖泊、生物群系、流域、火山、季节）
  const riverState = runRiverStage(width, height, seed, params, tectonic, climate);
  // 5. 区域分析 + 命名
  const regionState = runRegionStage(width, height, seed, params, tectonic, climate, riverState);
  // 6. 纹理打包
  const mapData = runPackingStage(width, height, seed, params, tectonic, climate, riverState, regionState);
  return { mapData, checkpoints: { tectonic, elevation, climate, rivers } };
}
```

### 进度报告

`PHASE_WEIGHTS` 表定义了 16 个子阶段的权重（如上表所示），`advance()` 函数累加权重并回调 `onProgress(fraction, phaseName)`，UI 端 ProgressView 显示精确百分比。

### Checkpoint 系统

每个阶段输出一份深拷贝（`new Float32Array(state.xxx)`）存入 `checkpoints` 对象，UI 端的 CheckpointPanel 可在阶段完成后恢复任意中间状态，无需重新生成。

## Consequences

### 正面
- **可测试**：每个 stage 独立导出，可单独调用与测试（已有 21 个测试文件覆盖各阶段）
- **可中断**：每个 stage 边界是自然的 checkpoint 点（当前未实现 abort，但架构已支持）
- **可调试**：bug 出在某阶段时，可只重跑该阶段（传入前序阶段的 checkpoint）
- **可扩展**：新增阶段只需新增 `xxxStage.ts` 并在 `generateMap` 中插入一行
- **精确进度**：16 个子阶段的权重让进度条精确反映生成进度
- **代码量减少**：`generateMap` 从 590 行 → 60 行，总代码量虽因拆分略增但可读性大幅提升

### 负面
- **阶段间数据传递**：每个 stage 需接收前序所有 state（如 `riverStage` 接收 4 个参数），函数签名较长
- **类型定义**：每阶段需定义 `XxxState` 接口（如 `TectonicState`、`ElevationState`），类型文件增多
- **TypedArray 共享**：阶段间传递 `Float32Array` 是引用传递，若下游修改会影响上游 checkpoint（已通过深拷贝 `new Float32Array()` 规避）

### 中性
- `pipeline/typedArrays.ts` 提供统一的 TypedArray 创建函数，规避 TS 5.7+ 泛型不兼容（P1-6 待清理）

## Alternatives Considered

### 1. 保持单函数，仅提取辅助函数
- **优点**：改动最小
- **否决原因**：仍无法独立测试阶段；590 行函数依然不可维护

### 2. Promise 链 / async-await
- **优点**：每阶段返回 Promise，可自然 `await`
- **否决原因**：生成是 CPU 密集型同步计算，async 不会并行化，反而增加微任务开销；Web Worker 中同步执行更简单

### 3. Event-driven pipeline（每阶段 emit 事件触发下一阶段）
- **优点**：松耦合，可插入中间件
- **否决原因**：生成是线性流程（A → B → C → ...），事件驱动过度抽象；调试时事件流难追踪

### 4. 类继承（BaseStage → TectonicStage extends BaseStage）
- **优点**：OOP 风格，可共享 base 逻辑
- **否决原因**：阶段间差异大，共享逻辑少；函数式组合更适合纯数据变换

## References

- [docs/archive/REFACTORING_PLAN.md](../../docs/archive/REFACTORING_PLAN.md) — 重构计划
- [specs/mapgen-v2/design.md](../../specs/mapgen-v2/design.md) §1 架构总览 — pipeline 设计
- [packages/core/src/pipeline/](../../packages/core/src/pipeline/) — 6 个 stage 实现
- [packages/core/src/index.ts](../../packages/core/src/index.ts) — generateMap 主函数（60 行）
- [P0-1 修复](https://github.com/qwerrrtttyyy/mapgen/pull/34) — PR #34，种子可重现性
