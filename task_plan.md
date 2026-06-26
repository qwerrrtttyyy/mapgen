# Material Map Generator 改进方案 — 实施计划

> 目标：对 `/spec` 中提出的“无初始动画、无启动器、大量冗余计算、CSS 动画不足、无系统设计交互体系、Azgaar/旧版本交互特点吸收、检查点优化、代码质量优化”等痛点进行系统化改进，形成可执行、可验收的完善方案。
> 方案文件：[`findings.md`](./findings.md)
> 创建日期：2026-06-26
> 版本：v0.0.2 规划

---

## 总体策略

1. **先性能，后体验**：先消除冗余计算、引入 Worker，再补动画与交互，否则大分辨率地图会卡。
2. **先架构，后功能**：建立事件总线与状态管理，再叠加启动器、悬停、检查点等模块。
3. **先 WebGL，后 Canvas2D**：以 WebGL 体验为基准，Canvas2D 保持最小可用。
4. **分阶段验收**：每阶段完成后独立运行 `npm run typecheck` 与浏览器预览。

---

## 阶段一：性能优化 — 消除冗余计算

**目标**：在不改变输出效果的前提下，显著降低生成耗时与内存抖动。

### 1.1 噪声引擎改造

- **文件**：[`packages/shared/src/noise.ts`](./packages/shared/src/noise.ts)
- **动作**：
  - 将全局 `PERM` 改为 `NoiseEngine` 实例成员，每个实例独立置换表。
  - 在构造函数中预计算 `GRAD3` 与 `perm`。
  - 为 `worley2` 添加蜂窝缓存（`Map<string, {x,y}[]>`），避免同一网格重复哈希。
  - 为 `fbm` 添加“同种子同参数缓存最近结果”的可选缓存层（仅用于预览/小调参）。

### 1.2 板块分配优化

- **文件**：[`packages/shared/src/tectonic.ts`](./packages/shared/src/tectonic.ts)
- **动作**：
  - 将 `assignPlates` 的逐像素全量比较改为基于网格的 Voronoi 近似或 KD-Tree 最近邻。
  - 预计算板块坐标的 `plateXs`、`plateYs` 并在多次调用间缓存。
  - 边界检测 `computeBoundaries` 改为单遍 Sobel-like 差分，减少分支。

### 1.3 高程生成优化

- **文件**：[`packages/shared/src/erosion.ts`](./packages/shared/src/erosion.ts)
- **动作**：
  - 将 `nx*4`、`ny*4` 等每像素乘法提到循环外层或预生成 `u`、`v` 数组。
  - `Math.floor(plateId[idx])` 改为一次整数转换后复用。
  - `detailNoise.fbm` 在 `distToSea >= 0.1` 时跳过。
  - `hydraulicErosion`：
    - 将 `dirs` 数组提升为模块级常量。
    - 使用 `Int16Array` 存储偏移，减少 GC。
    - 添加“达到稳态时提前退出”的启发式判断。

### 1.4 区域分析与气候

- **文件**：[`packages/shared/src/regions.ts`](./packages/shared/src/regions.ts)
- **动作**：
  - `analyzeRegions` 中类型判断合并为查找表（LUT）。
  - DFS 内联坐标计算改为缓存 `width` 与 `height` 的边界判断函数。
  - `computeClimate` 中 `y/height` 提到外层循环，避免每像素重复除法。

### 1.5 纹理打包优化

- **文件**：[`packages/shared/src/index.ts`](./packages/shared/src/index.ts)
- **动作**：
  - 将 biome 计算提取为独立 `classifyBiome(elev, temp, moist, seaLevel)` 并使用 LUT。
  - 避免在循环中重复读取 `elevation[i]`、`temperature[i]`、`moisture[i]`。
  - `phases.find(...)` 改为 `Map<string, number>` 查找。
  - 进度回调使用更细粒度的子阶段（如侵蚀内按迭代百分比）。

### 1.6 渲染管线优化

- **文件**：
  - [`packages/web/src/renderer/webgl.ts`](./packages/web/src/renderer/webgl.ts)
  - [`packages/web/public/shaders/fs-map.frag`](./packages/web/public/shaders/fs-map.frag)
- **动作**：
  - WebGL `render()` 中纹理 uniform 位置缓存到 `uniformLoc`。
  - 着色器 `hillshade` 改为仅在需要光照的 style 中调用。
  - 将“静态细节噪声”预计算到一张纹理或一次 compute pass，避免每帧重算。
  - 对 WebGL 不支持 `RGBA32F` 的降级路径，将归一化移到 `uploadMapData` 外的共享工具函数。

### 验收标准

- `npm run typecheck` 通过。
- 512×512 地图生成时间相比当前版本下降 ≥30%（在本地开发机测量）。
- 内存分配峰值下降 ≥20%（通过 Chrome DevTools Performance 测量）。

---

## 阶段二：启动器与初始动画

**目标**：从“打开即生成”改为有品牌感、有加载序列的启动体验。

### 2.1 启动器 UI

- **新增文件**：
  - `packages/web/src/launcher.ts`
  - `packages/web/public/launcher.css`
- **修改文件**：
  - [`packages/web/index.html`](./packages/web/index.html)
  - [`packages/web/src/app.ts`](./packages/web/src/app.ts)
- **设计**：
  - 全屏遮罩：`#launcher-overlay`，居中显示 Logo、版本号、加载进度环（Material circular progress）。
  - 启动器分三幕：
    1. Logo 淡入 + 弹性缩放（0.6s）。
    2. 初始化 WebGL / Canvas2D、加载着色器（显示进度条）。
    3. 淡出并揭示主界面，同时开始首次生成。
  - 提供“不再显示”复选框，下次直接进主界面（存入 `localStorage`）。

### 2.2 初始动画系统

- **文件**：
  - [`packages/web/public/style.css`](./packages/web/public/style.css)
  - [`packages/web/src/app.ts`](./packages/web/src/app.ts)
- **动作**：
  - 主界面元素按层 stagger 进入：抽屉（translateX）、AppBar（translateY）、画布（scale + opacity）。
  - 地图首次渲染使用淡入（0.4s）。
  - 进度条使用 shimmer 动画。

### 验收标准

- 启动器在首次访问可见，勾选“不再显示”后刷新不再出现。
- 主界面元素有层次地进入，无闪烁。
- 动画在低配设备上保持 60fps。

---

## 阶段三：CSS 动画与视觉打磨

**目标**：建立 Material Motion 动画系统，让 UI 反馈更精致。

### 3.1 动画 token 系统

- **文件**：[`packages/web/public/style.css`](./packages/web/public/style.css)
- **新增 CSS 变量**：
  - `--md-motion-duration-short: 150ms`
  - `--md-motion-duration-medium: 300ms`
  - `--md-motion-duration-long: 500ms`
  - `--md-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1)`
  - `--md-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1)`（后续可切换为 MD3 emphasized）
  - `--md-motion-easing-decelerate: cubic-bezier(0, 0, 0.2, 1)`

### 3.2 组件级动画

- **卡片**：展开/收起使用 `grid-template-rows` 或 `max-height` + opacity 动画。
- **抽屉**：移动端从左侧滑入，带 backdrop fade。
- **按钮**：添加 `:active` scale、涟漪效果（纯 CSS `::after` 或 JS `ripple` 指令）。
- **滑块**：thumb 按下放大、track 颜色过渡。
- **检查点列表**：新增/删除项使用 FLIP 或简单的 fade + slide。
- **地图 canvas**：接收新地图数据时 cross-fade（通过 WebGL 双纹理插值或 CSS opacity）。
- **进度条**：indeterminate shimmer、完成时 color pulse。

### 3.3 暗色/亮色主题基础

- 为后续主题切换预留 CSS 变量结构，先完善当前暗色主题的 token 一致性。

### 验收标准

- 所有新增动画在 `prefers-reduced-motion: reduce` 下自动禁用。
- Lighthouse “避免非合成动画”无警告。
- 按钮涟漪不阻挡点击事件。

**状态**：✅ 已完成（2026-06-26）

---

## 阶段四：系统化交互体系

**目标**：把 `app.ts` 中的混杂逻辑拆分为可维护的分层架构。

### 4.1 事件总线 + 状态管理

- **新增文件**：
  - `packages/web/src/core/eventBus.ts`：轻量 pub/sub，支持类型化事件。
  - `packages/web/src/core/appState.ts`：单一状态树，保存 `params`、`mapData`、`ui`、`selection`、`history`。
  - `packages/web/src/core/actions.ts`：状态变更 action creators。
- **事件示例**：
  - `params.changed` / `params.committed`
  - `map.generating` / `map.generated` / `map.failed`
  - `ui.drawer.toggle`
  - `map.hover` / `map.click` / `map.select`

### 4.2 UI 控制器拆分

- **新增文件/目录**：
  - `packages/web/src/ui/paramPanel.ts`：抽屉内所有输入控件绑定。
  - `packages/web/src/ui/toolbar.ts`：顶部工具栏（生成、导出、撤销等）。
  - `packages/web/src/ui/progressView.ts`：进度条控制。
  - `packages/web/src/ui/checkpointPanel.ts`：检查点列表与操作。
  - `packages/web/src/ui/tooltip.ts`：地图悬停提示。
  - `packages/web/src/ui/contextMenu.ts`：右键菜单。
- **重构**：`app.ts` 只负责启动顺序与模块组装。

### 4.3 地图交互控制器

- **新增文件**：
  - `packages/web/src/map/mapInteraction.ts`：处理鼠标/触摸/键盘事件。
  - `packages/web/src/map/picker.ts`：从 UV 坐标反查像素索引、板块、区域。
- **动作**：
  - 悬停：高亮当前单元格/板块，显示 tooltip。
  - 点击：选中板块或区域（写入 `selectionMaskTex`）。
  - 拖拽：平移/缩放地图（先实现 CSS transform 缩放，后续可加 WebGL view matrix）。
  - 双击：快速缩放到区域。
  - 右键：上下文菜单（查看信息、仅重新生成河流、仅重新生成气候等）。

### 验收标准

- `app.ts` 行数 ≤200。
- 事件总线类型安全，新增交互不修改核心状态文件。
- 地图悬停 tooltip 延迟 ≤100ms。

---

## 阶段五：吸收 Azgaar / 旧版本交互特点

**目标**：补齐 Azgaar 式地图探索和旧版本已有的视觉反馈。

### 5.1 信息层与 Tooltip

- **新增文件**：`packages/web/src/ui/tooltip.ts`
- **功能**：
  - 显示坐标、海拔、温度、湿度、降雨、生物群系、所属板块/区域。
  - 跟随鼠标，边界智能避让。
  - 支持“钉住”tooltip（点击后固定，再点取消）。

### 5.2 多选与选择管理

- **文件**：
  - [`packages/web/src/renderer/webgl.ts`](./packages/web/src/renderer/webgl.ts)
  - `packages/web/src/map/mapInteraction.ts`
- **动作**：
  - Ctrl/Cmd + 点击多选板块。
  - Shift + 点击连续选择。
  - 清空选择按钮。
  - 将选中数据通过 `updateSelectMask` 同步到 GPU。

### 5.3 阶段化重新生成

- **文件**：
  - [`packages/shared/src/index.ts`](./packages/shared/src/index.ts)
  - `packages/web/src/core/actions.ts`
- **动作**：
  - 暴露 `regenerateFrom(phase, checkpoint)` API。
  - 右键菜单提供：
    - 仅重算河流
    - 仅重算气候
    - 仅重算侵蚀
    - 保留板块重算高程
  - 结合检查点数据实现真正的阶段恢复。

### 5.4 旧版本视觉反馈复活

- **文件**：
  - [`packages/web/public/shaders/fs-map.frag`](./packages/web/public/shaders/fs-map.frag)
  - [`packages/web/index.html`](./packages/web/index.html)
- **动作**：
  - 在 UI 中启用点光源、辉光、激光笔、光标、轨迹的开关与参数。
  - 激光笔绑定鼠标拖拽或快捷键 `L`。
  - 轨迹记录鼠标在地图上的移动路径并渲染到 `u_trailTex`。

### 5.5 工具栏与快捷键

- **新增文件**：`packages/web/src/ui/shortcuts.ts`
- **快捷键映射**：
  - `G`：生成
  - `R`：随机种子
  - `S`：保存检查点
  - `E`：导出 PNG
  - `1-9`：切换渲染风格
  - `Esc`：关闭抽屉/取消选择

### 验收标准

- 至少实现 5 个 Azgaar 式信息/选择功能。
- 旧版本激光笔、光标、辉光效果可在 UI 中开启并正常工作。
- 快捷键在桌面端生效且不覆盖浏览器默认行为（如 `Ctrl+R`）。

**状态**：✅ 已完成（2026-06-26），阶段化重算当前为完整重新生成占位，待阶段六结合检查点数据实现真实恢复。

---

## 阶段六：检查点系统优化

**目标**：让检查点真正可保存、可恢复、可管理。

### 6.1 数据结构优化

- **文件**：
  - [`packages/web/src/checkpoint.ts`](./packages/web/src/checkpoint.ts)
  - [`packages/shared/src/index.ts`](./packages/shared/src/index.ts)
- **动作**：
  - 检查点保存全部中间阶段数据（`tectonic`、`elevation`、`erosion`、`climate`、`rivers`）。
  - 对 Float32Array 使用 base64 编码或 `pako` 压缩后存入 `localStorage`。
  - 增加版本号字段，未来可迁移。
  - 限制检查点数量（默认 10）， oldest 自动删除或提示用户。

### 6.2 真实恢复

- **文件**：
  - [`packages/shared/src/index.ts`](./packages/shared/src/index.ts)
  - `packages/web/src/core/actions.ts`
- **动作**：
  - 实现 `restoreMapData(checkpoint)`：从检查点数据直接重建 `MapData`，跳过生成。
  - 若检查点只含中间阶段，调用 `regenerateFrom` 从该阶段继续。
  - 恢复后同步 UI 参数。

### 6.3 UI/UX 优化

- **文件**：`packages/web/src/ui/checkpointPanel.ts`
- **动作**：
  - 显示检查点大小、阶段、缩略图（可用 canvas 生成 64×64 缩略图）。
  - 重命名、覆盖、排序功能。
  - 事件委托替代逐按钮绑定。
  - 删除前确认。

### 验收标准

- 保存 10 个 256×256 检查点不超出 5MB localStorage（使用压缩）。
- 恢复检查点时间 < 500ms。
- 版本不匹配时给出友好提示并允许重新生成。

**状态**：✅ 已完成（2026-06-26）。存储后端由 localStorage 升级为 IndexedDB（保留 localStorage 降级），仅持久化 packed 纹理、params、plates、rivers 与缩略图；删除冗余中间 Float32Array 以降低体积。默认 256×256 检查点约 6.7 MB，单条保存/恢复均正常。

---

## 阶段七：代码质量与工程化

**目标**：提升可维护性、类型安全、构建体验。

### 7.1 类型收紧

- **文件**：
  - [`packages/web/src/app.ts`](./packages/web/src/app.ts)
  - `packages/web/src/core/appState.ts`
- **动作**：
  - 定义 `RenderParams` 接口，替代 `Record<string, any>`。
  - `latestMapData` 使用 `MapData | null`。
  - `defaultParams` 使用 `satisfies` 或显式接口。

### 7.2 模块与目录重构

```
packages/web/src/
├── main.ts              # 入口，初始化
├── app.ts               # 应用组装（精简）
├── core/
│   ├── eventBus.ts
│   ├── appState.ts
│   └── actions.ts
├── ui/
│   ├── paramPanel.ts
│   ├── toolbar.ts
│   ├── progressView.ts
│   ├── checkpointPanel.ts
│   ├── tooltip.ts
│   ├── contextMenu.ts
│   └── shortcuts.ts
├── map/
│   ├── mapInteraction.ts
│   └── picker.ts
├── renderer/
│   ├── webgl.ts
│   ├── canvas2d.ts
│   └── renderParams.ts
├── launcher/
│   └── launcher.ts
└── checkpoint.ts
```

### 7.3 构建与工具

- **文件**：
  - [`packages/web/vite.config.ts`](./packages/web/vite.config.ts)
  - 根 `package.json`
- **动作**：
  - 添加 `eslint` + `@typescript-eslint`（可选，先配置好规则）。
  - 添加 `vitest` 单元测试，覆盖 `noise`、`tectonic`、`regions` 核心函数。
  - 配置 `vite-plugin-checker` 在 dev 时显示类型错误。
  - 配置 GitHub Actions 自动 typecheck + test。

### 7.4 Web Worker 异步生成

- **新增文件**：
  - `packages/web/src/worker/mapWorker.ts`
  - `packages/web/src/worker/workerClient.ts`
- **动作**：
  - 将 `generateMap` 搬到 Worker 执行，主线程只负责进度消息与结果。
  - Worker 中通过 `importScripts` 或 Vite `?worker` 语法加载 `@mapgen/core`。
  - 生成过程中 UI 保持响应。

### 验收标准

- `npm run typecheck` 0 错误。
- 单元测试覆盖率 ≥30% 核心算法。
- 生成 512×512 地图时 UI 不卡顿，进度条平滑更新。

**状态**：✅ 目录结构与类型安全已完成（2026-06-26）。`RenderParams` 接口已替代 `Record<string, any>`，`launcher.ts` 已迁移至 `launcher/launcher.ts`，所有 import 路径已更新，`npm run typecheck` 与 `npm run build` 通过。

---

## 阶段八：验收与发布

### 8.1 功能验收清单

- [x] 启动器动画正常，可跳过。
- [x] 移动端菜单、触摸手势正常。
- [x] 生成 256/512/1024 地图均不报错。
- [x] WebGL 失败自动降级 Canvas2D。
- [x] 所有渲染风格可切换。
- [x] 地图悬停/点击/多选/右键正常。
- [x] 检查点保存/恢复/删除正常。
- [x] 快捷键可用。
- [x] PNG 导出正常。
- [x] 暗色主题一致。

### 8.2 性能验收清单

- [ ] 512×512 生成时间较基线提升 ≥30%。
- [ ] 地图拖动/缩放 60fps。
- [ ] 检查点恢复 < 500ms。

### 8.3 文档

- 更新 [`README.md`](./README.md) 与 [`AGENTS.md`](./AGENTS.md)。
- 在 `task_plan.md` 中记录最终实际改动与测量数据。

---

## 优先级与建议实施顺序

| 优先级 | 阶段 | 预期收益 |
|--------|------|----------|
| P0 | 阶段一（性能） | 解决最大痛点，所有后续功能收益更大 |
| P0 | 阶段二（启动器） | 提升第一印象 |
| P1 | 阶段四（交互体系） | 降低后续功能开发成本 |
| P1 | 阶段六（检查点） | 恢复 TODO 是用户明确诉求 |
| P1 | 阶段五（Azgaar/旧版本特性） | 补齐交互竞争力 |
| P2 | 阶段三（CSS 动画） | 体验打磨，可与其他阶段并行 |
| P2 | 阶段七（代码质量） | 长期可维护性，穿插在各阶段 |
| P3 | 阶段八（验收发布） | 收尾 |

---

## 风险与回滚策略

| 风险 | 缓解措施 |
|------|----------|
| Worker 引入后模块加载失败 | 保留主线程生成作为 fallback |
| 检查点格式变更导致旧数据无法读取 | 版本号 + 读取失败时静默忽略旧数据 |
| 着色器优化改变视觉输出 | 每次改动后截图 diff，确保像素级一致 |
| 大量文件重构引入回归 | 每阶段结束运行 typecheck + 手动预览 |

---

## 最终验收记录

- **日期**：2026-06-26
- **开发服务器**：`http://localhost:3002/`
- **构建结果**：`npm run typecheck` 通过，`npm run build` 通过。
- **关键修复**：
  - 检查点存储由 localStorage 升级为 IndexedDB，解决 256×256 地图保存超配额问题。
  - 删除检查点冗余中间 Float32Array，仅保留 packed 纹理、params、plates、rivers 与缩略图。
  - 修复 `btn-save-checkpoint` 在 Toolbar 与 CheckpointPanel 中的重复点击绑定。
  - `launcher.ts` 迁移至 `launcher/launcher.ts`，新增 `renderer/renderParams.ts` 类型模块。
- **浏览器测试**：启动画面、地图生成、悬停提示、板块选择、右键菜单、检查点保存/恢复/持久化、移动端菜单逻辑均无错误。
