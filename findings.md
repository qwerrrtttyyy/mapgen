# Findings: 视觉审查、高优先级修复与 CSS 扩展

## 历史发现（Bun 迁移 + 立即修复项）

1. 仓库同时存在 `package-lock.json` 与 `bun.lock`，但 `package.json` 声明 `packageManager: npm@10.0.0`。
2. 大量 UI/编辑/检查点组件类已写好但从未在 `app.ts` 中实例化。
3. 检查点相关 DOM ID 在 TS 代码与 HTML 中不一致。
4. `Launcher.shouldShow()` 永远返回 `false`。
5. 撤销/重做、名称显示、缩放等按钮仅更新了 UI 状态，没有触发实际行为。

## 2026-07-05 视觉审查发现

截图位置：`/workspace/.planning/2026-07-05-visual-review_*.png`

### 关键 bug（阻塞初始化）

- **启动器无法自动关闭**
  - 点击“启动”后按钮变为“启动中…”，但覆盖层不再消失。
  - 根因：`app.ts` 中 `await launcher.waitForHide()` 等待的 Promise 永远不会 resolve，`launcher.hide()` 未被调用。
  - 后果：`buildPresetGrid`、`syncUIFromParams`、右侧面板标签切换、所有参数输入事件绑定均未执行。

### 功能缺陷

- **右侧面板标签无法切换**：受启动器阻塞导致事件监听器未注册。
- **检查点入口不可见**：`#checkpoint-popover` 默认 `display: none`，代码中没有触发按钮或 `.show` 类切换逻辑。
- **检查点缩略图黑屏**：Canvas2D 回退模式下缩略图抓取失败或颜色空间错误。
- **撤销/重做按钮始终禁用**：尚无编辑历史，但结合启动器 bug 会让用户误以为整体未初始化。

### 视觉/体验不足

- 当前主题偏深色 Material Design 3，但视觉层次较弱，面板与背景对比度不足。
- 地图区域名称标签（如“北湾”“西北海”）为简单白色文字，无背景/描边，复杂地形上可读性差。
- 启动器、Toast、Tooltip 等 overlay 组件缺少进入/退出动效。
- 缺少暗/亮主题切换。
- 缺少响应式布局，移动端无法使用。
- 按钮、滑块、卡片缺少 hover/focus/active 微交互。

## 决策

- 先修复启动器阻塞与检查点入口两个致命 bug。
- 将缩放从 CSS transform 改为在渲染器内应用，避免像素化与坐标偏差。
- 启动一次较大的 CSS 扩展：设计 token 体系、主题切换、全局动效、组件样式统一、响应式骨架。
