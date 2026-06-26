# Material Map Generator 改进方案 — 代码审计发现

> 审计范围：`packages/shared/src/*`、`packages/web/src/*`、`packages/web/public/*`
> 审计日期：2026-06-26
> 工具：直接源码阅读 + Grep 扫描；计划使用 semble 但因 `SSL: UNEXPECTED_EOF_WHILE_READING` 网络错误未能索引，已改用本地搜索。

---

## 1. 项目现状

- 已成功转为纯前端 TypeScript + Vite + Turborepo 架构。
- 核心算法在 `@mapgen/core`，渲染与 UI 在 `@mapgen/web`。
- 渲染支持 WebGL2（主）与 Canvas2D（降级）。
- 已具备移动端菜单与触摸滑动支持。

---

## 2. 关键问题发现

### 2.1 大量冗余计算

| 位置 | 问题 | 影响 |
|------|------|------|
| `noise.ts` | `NoiseEngine` 使用全局单例 `PERM`；切换噪声类型/种子时会覆盖全局置换表，多实例并发不安全 | 不可并行、结果可预测性差 |
| `noise.ts` | `worley2` 每像素执行 9 次 `_hash`、取模、开方；无缓存 | 大尺度地图极慢 |
| `erosion.ts:generateElevation` | 对每个像素都重新计算 `nx*4`、`ny*4`、`nx*16`、`ny*16`、`nx*12` 等缩放后的 UV；`Math.floor(plateId[idx])` 重复 | 每像素多十次浮点运算 |
| `erosion.ts:hydraulicErosion` | 每轮迭代重复创建 `dirs` 数组；内层 8 方向搜索无早期退出；`elev` 在循环中通过 `idx+dirs[d]` 随机访问 | CPU cache 不友好，大量重复边界检查 |
| `tectonic.ts:assignPlates` | 每个像素对全部板块做距离平方比较，O(N×W×H) | 板块数 >10 时明显变慢 |
| `regions.ts:analyzeRegions` | 对每个像素进行类型判断；在 DFS 内部重复 `nx = ni % width` 等计算 | 重复分支、边界计算冗余 |
| `index.ts` | 纹理打包循环中重复读取 `elevation[i]`、`temperature[i]`、`moisture[i]` 并重复计算 biome 逻辑 | 重复内存读取与分支 |
| `index.ts` | `phases.find(x => x.name === phaseName)` 每次 `advance` 线性搜索 | 微不足道但可优化 |
| `fs-map.frag` | `hillshade` 每像素 8 次 texture 采样；部分 style 中即使关闭光照仍会计算 | GPU 开销随分辨率线性增长 |
| `fs-map.frag` | 所有 style 都执行一次完整的 `fbmNoise` 细节叠加，即使参数未变 | 每帧重复相同噪声 |

### 2.2 无启动器与初始动画

- 应用直接进入主界面并立即触发 `generate()`，没有启动画面、没有加载序列。
- `#progress-container` 仅在生成时显示，首次加载突兀。
- 无品牌/版本介绍动画。

### 2.3 CSS 动画薄弱

- 当前仅有：
  - `.arrow` 旋转 0.2s
  - `.btn` opacity 0.15s
  - `#progress-bar` width 0.1s
- 没有卡片展开/收起缓动、抽屉滑入、按钮涟漪、骨架屏、地图淡入等现代 Material Design 动效。

### 2.4 缺乏系统设计交互体系

- 交互代码全部集中在 `app.ts` 一个文件中：
  - 参数读取、UI 绑定、生成逻辑、检查点、移动端菜单、导出。
- 没有事件总线、没有状态管理、没有分层的 UI 控制器。
- 选中/悬停、工具提示、上下文菜单、快捷键、撤销/重做均未建立。

### 2.5 地图交互缺失（对比 Azgaar / 旧版本）

- 无法点击/悬停查看地块、板块、区域信息。
- 无法框选、多选、缩放、平移地图。
- 没有工具提示（tooltip）、没有右键菜单、没有状态栏。
- 没有“重新生成仅某阶段”（如只重做河流、只重做气候）的快捷操作。
- 渲染参数（如 `showRivers`）可在不重新生成的情况下更新，但缺少交互式预览/对比模式。

### 2.6 检查点系统待优化

- `CheckpointManager.save` 默认打包 `elevTex`/`moistTex`/`tempTex` 三个 4 通道纹理，数据量巨大。
- 只保存最终结果，未保存中间阶段数据，导致“恢复”目前只能重新生成（见 `app.ts:286` TODO）。
- 没有版本校验、没有压缩、没有大小限制，localStorage 易溢出。
- 删除/恢复按钮逐元素绑定事件，未委托。

### 2.7 代码质量

- `app.ts` 中大量使用 `any`（`latestMapData: any`、`readParams(): Record<string, any>`），失去 TypeScript 优势。
- `defaultParams` 为对象字面量，未使用 `satisfies` 或接口约束。
- `readRenderParams` 在每次渲染前都重新读取全部 DOM，应使用缓存的状态对象。
- `generate()` 中 `await new Promise(r => setTimeout(r, 16))` 仅为让进度条显示，hacky。
- 着色器中 `u_moistureTex` 实际在 TS 中对应 `moistTex` 但名称不一致，增加维护成本。
- WebGL renderer 的 `getUniformLocation` 在 `render()` 中每次都重新获取纹理 uniform，应缓存。
- Canvas2D renderer 每次 `render()` 都创建临时 canvas，应复用。

---

## 3. 外部参考（Azgaar / 旧版本可借鉴点）

- **Azgaar**：
  - 地图悬停显示单元格信息（海拔、温度、湿度、生物群系）。
  - 多种渲染层可叠加切换。
  - 工具栏 + 快捷键 + 右键菜单。
  - 历史/撤销、参数预设、导入导出 JSON。
- **旧版本（v0.4.x）**：
  - 可能具备激光笔、轨迹、光标交互（`laserActive`、`trailEnabled`、`cursorActive` 等 uniform 已存在但无 UI 绑定）。
  - 点光源、辉光效果已有 uniform 但功能未在 UI 中启用。

---

## 4. 改进优先级建议

1. **性能**（用户体验最直接）：冗余计算、Web Worker、渲染缓存。
2. **启动体验**：启动器 + 初始动画 + 骨架屏。
3. **交互体系**：事件总线、状态管理、地图悬停/选择、工具提示。
4. **检查点**：阶段化存储、压缩、真实恢复。
5. **代码质量**：类型收紧、模块化、构建优化。
6. **CSS 动画**：Material Motion 规范落地。
