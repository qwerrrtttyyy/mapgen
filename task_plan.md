> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

# 视觉审查、高优先级修复与 CSS 大扩展

**Goal:** 修复视觉审查发现的致命 bug 与高优先级缺陷，并启动 Material Design 3 风格的 CSS 大扩展（主题、动效、响应式、组件化）。

**Architecture:** 在现有 HTML/TS 结构上做最小功能修复；通过扩展 CSS 设计 token、统一组件样式、增加主题切换与动效系统来提升视觉品质，不重构 JS 架构。

**Tech Stack:** Bun, TypeScript, Vite, CSS Custom Properties, Turborepo

---

## Phase 1: 致命 bug 修复

### Task 1.1: 修复启动器阻塞初始化
- Modify: `/workspace/packages/web/src/app.ts`
- 移除 `await launcher.waitForHide()` 的阻塞等待；改为在生成完成后直接 `launcher.destroy()`，或让 `waitForHide()` 在启动按钮点击时 resolve
- 确保 `buildPresetGrid`、`syncUIFromParams`、标签切换、参数输入等初始化在启动器关闭后立即执行
- Status: completed

### Task 1.2: 修复检查点入口不可见
- Modify: `/workspace/packages/web/src/app.ts`
- 为顶部工具栏的“检查点”按钮（或新增按钮）绑定 click 事件，切换 `#checkpoint-popover` 的 `.show` 类
- Modify: `/workspace/packages/web/public/style.css`
- 为 `#checkpoint-popover.show` 补充显示样式与定位
- Status: completed

### Task 1.3: 修复检查点缩略图黑屏（Canvas2D 回退）
- Modify: `/workspace/packages/web/src/checkpoint.ts`
- 检查 `createThumbnail` 在 Canvas2D renderer 下的数据源与颜色通道；必要时回退到不显示缩略图或修复 RGBA 读取
- Status: completed

---

## Phase 2: 高优先级视觉/功能修复

### Task 2.1: 将缩放从 CSS transform 改为渲染器内实现
- Modify: `/workspace/packages/web/src/renderer/webgl.ts`
- Modify: `/workspace/packages/web/src/renderer/canvas2d.ts`
- Modify: `/workspace/packages/web/src/renderer/p5renderer.ts`
- Modify: `/workspace/packages/web/src/editor/NameOverlay.ts`
- 接收并应用 `state.zoom` / `state.panX` / `state.panY`，避免 CSS transform 导致的像素化与坐标偏差
- Status: completed

### Task 2.2: 改进地图区域名称标签可读性
- Modify: `/workspace/packages/web/src/editor/NameOverlay.ts`
- 为名称标签添加半透明背景、描边或阴影，提升在复杂地形上的可读性
- Status: completed

### Task 2.2b: 统一鼠标坐标转换以支持缩放/平移
- Modify: `/workspace/packages/web/src/map/picker.ts`
- Modify: `/workspace/packages/web/src/map/mapInteraction.ts`
- Modify: `/workspace/packages/web/src/map/laserController.ts`
- Modify: `/workspace/packages/web/src/editor/EditorController.ts`
- Modify: `/workspace/packages/web/src/editor/NameOverlay.ts`
- 统一使用 `/workspace/packages/web/src/map/viewport.ts` 中的 `clientToMapUv` / `mapPixelToClient`，确保 picker、激光、编辑器、名称层在缩放/平移下坐标一致
- Status: completed

### Task 2.3: 修复名称显示开关初始状态同步
- Modify: `/workspace/packages/web/src/app.ts`
- 初始加载时根据 `namesVisible` 设置 NameOverlay.visible 与按钮 active 状态
- Status: completed

### Task 2.4: 修复撤销/重做初始提示
- Modify: `/workspace/packages/web/src/app.ts`
- 初始加载后调用一次 `updateUndoRedo()`，避免按钮长期处于禁用态（编辑后自动启用）
- Status: completed

---

## Phase 3: CSS 大扩展

### Task 3.1: 扩展设计 Token 体系
- Modify: `/workspace/packages/web/public/style.css`
- 新增完整的 `--md-sys-*` / `--md-ref-*` token 集合
- 补充 `--mapgen-*` 应用级 token（半径、阴影、过渡、z-index）
- 定义暗色/亮色主题根变量，并支持 `data-theme="light"` 切换
- Status: completed

### Task 3.2: 全局动效系统
- Modify: `/workspace/packages/web/public/style.css`
- 为 overlay（启动器、Toast、Tooltip、Popover）添加 fade/scale 进入退出动画
- 为按钮、卡片、标签添加 hover/focus/active 微交互
- 为滑块、开关、复选框添加过渡动效
- Status: completed

### Task 3.3: 组件样式统一
- Modify: `/workspace/packages/web/public/style.css`
- 统一 `.panel`、`.toolbar`、`.btn`、`.input`、`.slider`、`.card`、`.chip` 样式
- 统一滚动条、分隔线、工具提示样式
- 为启动器、检查点面板、名称标签、MiniMap 增加精致样式
- Status: completed

### Task 3.4: 响应式布局骨架
- Modify: `/workspace/packages/web/public/style.css`
- 为桌面端、平板、手机定义断点
- 右侧面板在窄屏下可折叠/抽屉化
- 底部工具栏在窄屏下横向滚动或折叠
- Status: completed

### Task 3.5: 主题切换按钮
- Modify: `/workspace/packages/web/index.html`
- 在顶部工具栏添加主题切换按钮
- Modify: `/workspace/packages/web/src/app.ts`
- 绑定按钮切换 `document.documentElement.dataset.theme`
- Modify: `/workspace/packages/web/public/style.css`
- 确保所有颜色使用 token，支持亮/暗切换
- Status: completed

---

## Phase 4: 验证与收尾

### Task 4.1: 构建与类型检查
- Run: `bun run typecheck` ✅
- Run: `bun run build` ✅
- Run: `bun run test` ✅ (72 tests)
- Expected: 全部通过
- Status: completed

### Task 4.2: 浏览器视觉回归验证
- Start dev server: `bun run dev`
- Screenshot: 启动器、主界面、检查点面板、标签切换、主题切换、移动端宽度
- Expected: 无阻塞 bug，视觉层次清晰，动效自然
- Status: completed

---

### Task 2.5: 修复 WebGL 片元着色器编译错误
- Modify: `/workspace/packages/web/public/shaders/fs-map.frag`
- `azgaarColor` 函数引用 `main` 中局部变量 `mapUV`，导致 GLSL 编译失败；改为通过参数传入 `vec2 uv`
- Status: completed

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| WebGL 片元着色器编译失败（azgaarColor 引用未定义 mapUV） | 1 | 将 mapUV 作为 vec2 uv 参数传入 azgaarColor |
| Headless 浏览器验证环境不支持 WebGL2 | - | 应用自动回退 Canvas2D；UI 初始化与事件绑定正常，主画布渲染受限于验证环境 |
