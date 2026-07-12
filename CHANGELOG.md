# Changelog

All notable changes to the Material Map Generator.

## v0.0.4-pre (2026-07-12)

### 🏗️ 架构重构

- **Pipeline 统一**: `generateMap` 和 `runDownstreamPipeline` 委托给共享 `pipeline/*Stage`，消除 742 行重复内联编排
- **editor.ts 拆分**: 1245 行拆为 5 个子模块（terrainDetection / commandStack / brushes / vectorTools / plateOps），原文件改为 barrel re-export
- **包目录重命名**: `packages/shared` → `packages/core`，与 `@mapgen/core` 对齐
- **指令预测系统**: 多阶 n-gram + 类别转移 + 最近频率 + 周期性特征，FaMou 进化优化权重（Top-3: 85.3%）
- **UI 响应式存储**: `uiOptimizer.ts` — 声明式 DOM 绑定（createStore / bindText / bindNumber 等）

### 🐛 Bug 修复

- **Worker cancel**: 模块级 `currentCancelSignal` 实现正确的生成取消
- **侵蚀 checkpoint**: 在 `runClimateStage` 前保存冰川侵蚀前的高程
- **Viewport Y 轴**: 修复 `mapPixelToClient` 坐标反转，统一为 GPU stretch 公式
- **Worker 错误传播**: 传递真实错误信息而非硬编码字符串，不再静默回退到主线程
- **Checkpoint byteOffset**: `float32ToBase64` 使用 `byteOffset/byteLength` 修复子视图数据损坏
- **SSE JSON.parse**: 所有 SSE 事件处理器加 try/catch，防止畸形数据导致 Promise 挂死
- **CI 修复**: `format:check` / `bun test` → `bun run test` / jsdom 环境加载

### 🔒 安全加固

- **参数校验**: `validation.ts` 防止 OOM/DoS（mapSize ≤ 4096, plateCount 2-64 等）
- **SSE 进度修复**: `setImmediate` 延迟执行，让 HTTP handler 先返回 jobId
- **全局错误处理**: `app.onError` 防止栈信息泄露
- **localhost 绑定**: 默认绑定 `127.0.0.1`，仅本地可达
- **可选 API key**: `MAPGEN_API_KEY` 环境变量启用鉴权
- **non-null 消除**: `filter.tags!` → 局部变量，消除 `!` 断言

### ✅ 测试

- 测试数从 269 增至 **330+**
- shared-types: 30 测试（errors / serialization / base64）
- server: 26 测试（全部 REST 路由 + 参数校验 12 项）
- web: 新增 checkpoint 6 项 + viewport 5 项 + uiOptimizer 22 项
- core: 新增 debug 事件追踪/快照测试

### 📦 部署

- 从 GitHub Pages 迁移到 Cloudflare Pages（直连 GitHub，无需 Secrets）
- Demo: `https://mapgen.pages.dev`

### 📚 文档

- 新增 6 篇 MADR 架构决策记录（FBM / D8 / Köppen / Mediator / WebGL2 / Pipeline）
- CHANGELOG 新增「当前 main 实际值」列，与发版快照区分
- README / AGENTS 包管理器统一为 bun

### 🧹 仓库清理

- `.gitignore` 新增 `.atomcode/`、`.mcp.json`、`famou-experiment/`、lock files
- `.turbo/` 和 `.wrangler/` 位置修复

### 项目结构概览

| 指标            | v0.0.3-pre | v0.0.4-pre |
| --------------- | ---------- | ---------- |
| TypeScript 文件 | 49 个      | 140+ 个    |
| 测试文件        | 11 个      | 30 个      |
| 测试用例        | 72 个      | 330+ 个    |
| 总代码行数      | ~7,878 行  | ~19,000 行 |
| 包数            | 2          | 5          |

---

## v0.0.3-pre (2026-07-06)

### 后端抽象层与模块质量提升

- **新增 `@mapgen/shared-types`**: 跨边界类型契约、`Result<T>` 错误处理、`MapData` Base64 序列化
- **新增 `@mapgen/server`**: 可选参考后端（Hono + in-memory 存储）
  - REST API：`/api/v1/health`、`/api/v1/generate`、`/api/v1/jobs/:id`、`/api/v1/maps`、`/api/v1/presets`
  - SSE 进度推送：`progress` / `completed` / `failed` 事件
- **前端引擎抽象层**:
  - `MapGenEngine` 统一接口：生成、保存、加载、列表、删除、能力查询
  - `LocalProvider`: Web Worker 本地生成 + localStorage 持久化
  - `RemoteProvider`: REST + SSE 远程生成 + 后端持久化
  - `createEngineProvider` / `getEngineProvider` 工厂与缓存
- **核心引擎重构**:
  - `generateMap` 拆分为 pipeline 阶段：`tectonicStage` / `elevationStage` / `climateStage` / `riverStage` / `regionStage` / `packingStage`
  - 新增 `packages/shared/src/pipeline/typedArrays.ts` 统一 TypedArray 创建，规避 TS 5.7+ 泛型不兼容
- **测试修复与增强**:
  - 修复 `connectedComponents`、`coastline`、`downstream`、`slope` 测试与当前实现不匹配
  - 新增 `server.test.ts` 后端健康检查与任务创建测试
- **代码质量验证**:
  - ✅ typecheck: 5/5 通过
  - ✅ build: 5/5 通过
  - ✅ tests: 213/213 通过（core 185 + manager 25 + shared-types 1 + server 2）

### 重构与发布准备

- **版本升级**: monorepo 及所有包升级至 v0.0.3-pre
- **包管理器迁移**: 从 npm 迁移到 Bun，删除 `package-lock.json`，使用 `bun.lock`

### 视觉与高优先级修复

- **启动器阻塞修复**: 移除 `await launcher.waitForHide()` 死等
- **检查点入口修复**: 顶部工具栏新增"检查点"按钮
- **缩放/平移重构**: 从 CSS transform 迁移到渲染器内部实现
- **坐标系统一**: 全部使用 `clientToMapUv` / `mapPixelToClient`
- **WebGL 着色器修复**: `fs-map.frag` 中 `azgaarColor` 函数参数修复

### CSS 大扩展

- **设计 Token 体系**: 完整 `--md-sys-*` / `--md-ref-*` 令牌
- **主题切换**: 暗色/亮色主题，持久化到 localStorage
- **响应式布局**: 1024px / 768px / 480px 断点

---

## v0.0.2 (2026-06-28)

### 新增：复杂世界式全局生成系统

在 v0.0.1 基础架构上引入 8 个相互耦合的行星级子系统。

#### 世界式生成 v1（行星级气候 + 冰盖）

- **海岸距离场** (`coastline.ts`)：多源 BFS 带符号距离场
- **洋流系统** (`oceanCurrents.ts`)：风驱动表面流 + Ekman 漂移 + 西边界强化
- **动态冰盖** (`ice.ts`)：极地高海拔冰盖扩张 + 冰川侵蚀
- **气候增强** (`regions.ts`)：大陆度修正 + Hadley cell 强化 + 季风
- **惰性生成** (`lazyGen.ts`)：视野局部高分辨率重算

#### 世界式生成 v2

- **Köppen-Geiger 生物群系** (`biomes.ts`)：32 类分类
- **流域分析** (`watershed.ts`)：D8 流向 + Strahler 河序
- **火山系统** (`volcanism.ts`)：热点火山链 + 板缘火山弧
- **季节性气候变差** (`seasons.ts`)：4 季温度/降水 delta

---

## v0.0.1 (2026-06-26)

### 架构重写

从旧版单体架构完全重写为 **Monorepo**（Turborepo + npm workspaces）。

- **WebGL2 渲染器**: GPU 加速，9 种渲染风格
- **Material Design 3 UI**: CSS Custom Properties 令牌系统
- **TypeScript 全量类型安全**: strict mode

---

## 旧版 (v0.2.8 - v0.4.3)

详见 [GitHub Releases](https://github.com/qwerrrtttyyy/mapgen/releases)。

> **注意**：v0.0.1 是对旧版代码库的完全重写，非增量升级。
