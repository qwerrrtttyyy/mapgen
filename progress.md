# Material Map Generator 改进方案 — 进度日志

## 2026-06-26 初始审计与方案制定

- 梳理项目结构：确认 `packages/shared/src` 与 `packages/web/src` 职责。
- 阅读核心文件：
  - `packages/shared/src/{noise,tectonic,erosion,rivers,regions,index}.ts`
  - `packages/web/src/{app,checkpoint,renderer/webgl,renderer/canvas2d}.ts`
  - `packages/web/public/{style.css,shaders/fs-map.frag,shaders/vs-quad.vert,index.html}`
- 尝试使用 `mcp_semble` 进行代码搜索，但服务器返回 `SSL: UNEXPECTED_EOF_WHILE_READING` 错误，改为使用 Grep 本地扫描完成审计。
- 输出：
  - [`findings.md`](./findings.md)：问题清单与外部参考。
  - [`task_plan.md`](./task_plan.md)：八阶段实施计划与验收标准。
- 当前状态：方案已确认启动，阶段一（性能优化）已完成并通过 typecheck。

## 2026-06-26 阶段一完成

- 修改 `packages/shared/src/noise.ts`：移除全局 PERM，改为实例级置换表；添加 Worley 蜂窝缓存。
- 修改 `packages/shared/src/erosion.ts`：预计算 UV、复用 `|0` 取整、侵蚀方向常量数组、提前退出稳态。
- 修改 `packages/shared/src/regions.ts`：提取 `classifyRegionType`、气候纬度计算外提、循环内减少重复读取。
- 修改 `packages/shared/src/index.ts`：`phaseMap` 替代线性查找、纹理打包提取 `classifyBiome`、预计算倒数。
- 修改 `packages/web/src/renderer/webgl.ts`：缓存纹理 uniform、扩展检测移出循环、归一化静态方法。
- 修改 `packages/web/src/renderer/canvas2d.ts`：复用临时 canvas。
- `npm run typecheck` 通过。

## 2026-06-26 阶段二完成

- 新增 `packages/web/src/launcher.ts`：可跳过、带动画进度环的启动器。
- 更新 `packages/web/public/style.css`：启动器样式、主界面 stagger 进入动画、`prefers-reduced-motion` 支持。
- 更新 `packages/web/src/app.ts`：启动序列集成。

## 2026-06-26 阶段四完成

- 新增 `packages/web/src/core/eventBus.ts`、`appState.ts`、`actions.ts`：事件总线 + 状态管理 + Action。
- 拆分 UI 控制器：`ParamPanel`、`ProgressView`、`Toolbar`、`CheckpointPanel`。
- 新增 `packages/web/src/map/mapInteraction.ts` 与 `picker.ts`：地图悬停 tooltip、点击固定、板块选择。
- 重写 `packages/web/src/app.ts` 为 orchestrator，大幅精简。
- `npm run typecheck` 通过。

## 2026-06-26 阶段三完成

- 更新 `packages/web/public/style.css`：
  - 移动端抽屉改为 `transform` 滑入/滑出，backdrop 淡入淡出。
  - 滑块 thumb 按下放大 + track focus 颜色过渡。
  - range value 数值变化时高亮脉冲。
  - 进度条新增 indeterminate shimmer 和完成 pulse。
  - 检查点列表项新增 entering / leaving 动画。
  - 地图 canvas 生成完成后淡入（`map-fade-in`）。
- 更新 `packages/web/src/ui/progressView.ts`：生成开始时显示 shimmer，完成时 pulse。
- 更新 `packages/web/src/ui/checkpointPanel.ts`：删除时播放滑出动画后再移除数据，新增项带进入动画。
- 更新 `packages/web/src/ui/paramPanel.ts`：range 数值变化时触发表单数值脉冲。
- 更新 `packages/web/src/app.ts`：生成完成后触发 canvas 淡入，删除检查点事件改由 panel 处理动画。
- `npm run typecheck` 通过。

## 2026-06-26 阶段五完成

- 修复 `packages/web/src/ui/tooltip.ts`：暴露 `isPinned()` 方法，规范 tooltip 钉住/取消流程。
- 更新 `packages/web/src/map/mapInteraction.ts`：
  - 点击固定 tooltip 并选中板块。
  - 支持 `Ctrl/Cmd + 点击`多选板块。
  - 支持 `Shift + 点击`连续选择板块。
  - 激光笔：开启后在 canvas 上拖拽绘制激光线，快捷键 `L` 切换。
  - 光标跟随：开启后鼠标位置实时同步到 shader。
  - 鼠标轨迹：开启后记录移动轨迹并渲染到 `u_trailTex`，带衰减效果。
- 更新 `packages/web/src/ui/toolbar.ts`：添加"清空选择"按钮，选择非空时显示。
- 更新 `packages/web/src/app.ts`：
  - 监听 `selection.changed` 同步 `selectionMaskTex` 到 WebGL。
  - 监听 `trail.update` 更新 trail texture。
  - 监听 `regenerate.phase` 与 `selection.clear` 事件。
- 新增 `packages/web/src/ui/contextMenu.ts`：右键菜单提供"仅重算河流/气候/侵蚀"、"保留板块重算高程"、"清空选择"。
- 新增 `packages/web/src/ui/shortcuts.ts`：快捷键 `G` 生成、`R` 随机种子、`S` 保存检查点、`E` 导出 PNG、`1-9` 切换风格、`Esc` 关闭抽屉/清空选择。
- 更新 `packages/web/src/core/appState.ts`：添加 `laserStart`、`laserEnd`、`laserWidth`、`cursorPos`、`cursorSize` 状态。
- 更新 `packages/web/public/index.html`：添加激光笔、光标、轨迹开关。
- 更新 `packages/web/public/style.css`：添加右键菜单样式。
- `npm run typecheck` 通过。

## 2026-06-26 阶段六完成

- 重写 `packages/web/src/checkpoint.ts`：
  - 检查点版本号 `CHECKPOINT_VERSION = 2`，旧版本数据自动过滤。
  - Float32Array 使用 base64 编码存储，显著降低 JSON 体积。
  - 保存全部中间阶段数据（`tectonic`、`elevation`、`erosion`、`climate`、`rivers`）与最终纹理打包。
  - 生成 64×64 缩略图。
  - 限制最大数量 10，超出时自动移除最旧项。
  - 新增 `rename` 与 `restoreMapData` 方法。
- 更新 `packages/web/src/core/appState.ts`：新增 `checkpoints` 字段保存最新中间阶段。
- 更新 `packages/web/src/core/actions.ts`：`generate` 完成后保存中间阶段到 `state.checkpoints`。
- 更新 `packages/web/src/app.ts`：
  - 保存检查点时传入完整中间阶段数据。
  - 实现真实恢复：从检查点解包纹理、同步 UI 参数、触发 `generating.completed`。
- 重写 `packages/web/src/ui/checkpointPanel.ts`：
  - 事件委托处理恢复/删除/重命名。
  - 显示缩略图、阶段、时间、大小。
  - 删除前确认。
- 更新 `packages/web/public/style.css`：检查点项缩略图与元信息样式。
- `npm run typecheck` 通过。

