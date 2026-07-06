# Session Progress

## 2026-07-05

- [x] 完成仓库问题分析
- [x] 创建 task_plan.md / findings.md / progress.md
- [x] Phase 1: Bun 迁移
  - 切换 packageManager 为 bun@1.2.14
  - 删除 package-lock.json，保留 bun.lock
  - 更新 README.md / AGENTS.md 命令为 bun
  - bun install / typecheck / build / test 全绿
- [x] Phase 2: UI/编辑/检查点接线修复
  - 修复 checkpointPanel / toolbar 的 DOM ID 为 #cp-list / #btn-save-cp
  - 在 app.ts 实例化 EditorController、NameOverlay、Toolbar、CheckpointPanel
  - 撤销/重做按钮读取 EditorController.canUndo/canRedo
  - 名称显示开关通过 overlay.toggle 事件控制 NameOverlay
  - 缩放按钮修改 state.zoom 并通过 CSS transform 应用到 canvas 与名称层
  - 画笔半径/强度实时同步到 EditorController
  - 启动器根据 localStorage skip 标记显示，点击启动后触发生成
  - app.ts 中新增 checkpoint.save.request / checkpoint.restore.request 处理
- [x] Phase 3: 验证与收尾
  - bun run typecheck ✅
  - bun run build ✅
  - bun test ✅ (72 tests)

## 2026-07-05（续）

- [x] 统一鼠标坐标转换以支持缩放/平移
  - 新增/复用 `packages/web/src/map/viewport.ts`：`clientToMapUv`、`mapUvToClient`、`mapPixelToClient`
  - `MapPicker.pick` 改用 `clientToMapUv`
  - `MapInteraction` / `LaserController` 的 `clientToUv` 改用 `clientToMapUv`
  - `EditorController.toMapPixel` / `mapToScreen` / `screenScale` 改用 viewport 工具
  - `NameOverlay` 移除 CSS transform 缩放，绘制时通过 `mapPixelToClient` 实时计算位置
- [x] 同步名称显示开关初始状态
  - `app.ts` 初始化时设置按钮 active 状态并 emit `overlay.toggle`
- [x] 修复 WebGL 片元着色器编译错误
  - `fs-map.frag` 中 `azgaarColor` 函数引用未定义的 `mapUV`，改为接收 `vec2 uv` 参数
- [x] 构建与测试
  - bun run typecheck ✅
  - bun run build ✅
  - bun test ✅ (72 tests)
- [x] 浏览器视觉验证
  - 启动 dev server（http://localhost:3001/）
  - 保存截图到 `/workspace/.planning/visual-review_*.png`
  - 验证环境不支持 WebGL2，应用回退到 Canvas2D；UI 面板、工具栏、检查点按钮、主题按钮、MiniMap、名称标签均正常初始化
  - 发现 Canvas2D 主画布在 headless 验证环境下未渲染出地形（可能与无 WebGL2 + p5 初始化有关），已在着色器层面修复 Azgaar 风格编译错误

## 2026-07-05（最终收尾）

- [x] CSS 大扩展完成
  - `style.css` 已扩展完整的 Material Design 3 token 体系（`--md-sys-*` / `--md-ref-*`）
  - 新增暗色/亮色主题切换，`data-theme="light"` 全局生效
  - 统一按钮、输入框、滑块、卡片、标签、工具提示等组件样式
  - 添加 overlay 进入/退出动画、hover/focus/active 微交互、滑块进度填充
  - 实现响应式断点（1024px / 768px / 480px），右侧面板在移动端抽屉化，底部工具栏折叠/滚动
  - `app.ts` / `index.html` 已接入主题切换按钮并持久化到 localStorage
- [x] 更新任务计划与进度文件
  - `task_plan.md` 已标记 Phase 1 ~ Phase 4 全部任务为 completed
  - `progress.md` 已补充 CSS 扩展与收尾验证记录
- [x] 清理临时验证脚本
  - 将根目录临时截图脚本 `screenshot_test.mjs`、`screenshot_test.py`、`01-initial-full-page.png` 移入 `.planning/`
  - 避免 `bun test` 误将 Playwright 脚本当作项目测试运行
- [x] 最终验证
  - `bun run typecheck` ✅
  - `bun run build` ✅
  - `bun run test` ✅ (72 tests)
