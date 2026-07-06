# Changelog

All notable changes to the Material Map Generator.

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

### 项目结构概览

| 指标 | 数值 |
|------|------|
| TypeScript 文件 | 49 个 (core 20 + web 29) |
| 测试文件 | 11 个 |
| 测试用例 | 72 个 |
| 总代码行数 | ~7,878 行 (不含测试) |
| 测试代码行数 | 1,337 行 |

### 核心功能模块 (@mapgen/core)

1. **噪声系统** (`noise.ts`): Perlin/Simplex/Value/Worley + FBM 变体
2. **板块构造** (`tectonic.ts`): Voronoi 板块生成、边界计算、碰撞检测
3. **侵蚀系统** (`erosion.ts`): 水力侵蚀、湖泊生成、河流网络
4. **气候系统** (`regions.ts`): 温度、湿度、生物群落分带
5. **洋流系统** (`oceanCurrents.ts`): 风驱动表面流 + Ekman 漂移 + 西边界强化
6. **冰盖系统** (`ice.ts`): 动态冰盖扩张 + 冰川侵蚀
7. **生物群系** (`biomes.ts`): Köppen-Geiger 32 类分类
8. **流域分析** (`watershed.ts`): D8 流向 + 排水盆地 + Strahler 河序
9. **火山系统** (`volcanism.ts`): 热点火山链 + 板缘火山弧
10. **季节系统** (`seasons.ts`): 4 季温度/降水变化
11. **编辑器** (`editor.ts`): 画笔/矢量工具/撤销重做
12. **命名系统** (`naming.ts`): 自动地名生成
13. **纹理打包** (`texturePack.ts`): 多纹理通道编码
14. **下游管线** (`downstream.ts`): 统一编排 9 个子系统

### 前端应用 (@mapgen/web)

- **WebGL2 渲染器**: GPU 加速，支持 19 种渲染风格
- **Material Design 3 UI**: 深色主题、响应式设计
- **Web Worker**: 后台生成不阻塞 UI
- **检查点系统**: localStorage 保存/恢复状态
- **LOD 名称叠加层**: 4 层缩放级别渐进显示

---

## v0.0.2 (2026-06-28)

### 新增：复杂世界式全局生成系统

在 v0.0.1 基础架构上引入 8 个相互耦合的行星级子系统，将地图从"噪声 + 构造"提升为"地球物理仿真"。

#### 世界式生成 v1（行星级气候 + 冰盖）

- **海岸距离场** (`coastline.ts`)：多源 BFS 带符号距离场，驱动大陆度/河口/洋流沿岸影响
- **洋流系统** (`oceanCurrents.ts`)：风驱动表面流 + Ekman 漂移 + 西边界强化（Stommel 简化）+ 暖/寒流温度增量
- **动态冰盖** (`ice.ts`)：极地高海拔冰盖扩张（浅冰近似流动）+ 海冰 + 冰川侵蚀（U 型谷拓宽）
- **气候增强** (`regions.ts`)：大陆度修正 + 洋流沿岸温度 + Hadley cell 强化（ITCZ 增湿 / 副热带高压沙漠带）+ 季风
- **惰性生成** (`lazyGen.ts`)：视野局部高分辨率重算（双线性上采样 + 高频 FBM + 局部山峰检测）

#### 世界式生成 v2（本轮新增 4 子系统）

- **Köppen-Geiger 生物群系** (`biomes.ts`)：32 类生物群系（A/B/C/D/E 五带 + 高山带 M + 特殊生态 X），替换原 15 类简单分类
- **流域分析** (`watershed.ts`)：D8 流向 + 排水盆地划分（多源反向 BFS）+ Strahler 河序（1-7 级）+ 大陆分水岭标记 + 小盆地合并
- **火山系统** (`volcanism.ts`)：热点火山链（板块漂移方向递减年龄）+ 板缘火山弧（汇聚/离散/转换三类边界）+ 概率场 + 破火山口环形标记
- **季节性气候变差** (`seasons.ts`)：4 季温度/降水 delta（纬度×大陆度×海拔耦合）+ ITCZ 南北移动 + 地中海夏干冬雨 + 解码器

#### 集成

- **下游管线** (`downstream.ts`)：统一编排 coast → currents → climate → ice → biomes → lakes → rivers → watershed → regions → volcanism → seasons，9 个开关可独立控制
- **纹理打包** (`texturePack.ts`)：新增 `packBiomeTex` / `packWatershedTex` / `packVolcanismTex` / `packSeasonTex`
- **地形区检测** (`editor.ts`)：`TerrainDetectOptions` 扩展 volcanoProb/biomeId/streamOrder/basinId，火山检测从孤立山峰启发式升级为概率场驱动
- **MapData 字段**：新增 `biomeTex` / `watershedTex` / `volcanismTex` / `seasonTex` / `volcanoSites` / `hotspots`
- **可视化** (`fs-map.frag` + `webgl.ts`)：洋流条纹（style 17）+ 冰盖覆盖（style 18）着色器
- **LOD 名称叠加层** (`NameOverlay.ts`)：4 层缩放级别渐进显示 + 高缩放惰性生成山峰标注
- **检查点** (`checkpoint.ts`)：保存/恢复 currentTex / iceTex / coastDist
- **UI 开关**：5 个世界式开关（洋流/冰盖/季风/大陆度/Hadley）

### 测试

- 测试用例从 44 增至 **72**（11 个测试文件）
- 新增 `biomes.test.ts` (9) / `watershed.test.ts` (6) / `volcanism.test.ts` (6) / `seasons.test.ts` (7)

### 验证

- typecheck: 3/3 通过
- build: 2/2 通过（web 49 modules）
- tests: 72/72 通过

---

## v0.0.1 (2026-06-26)

### 架构重写

从旧版单体架构完全重写为 **Monorepo**（Turborepo + npm workspaces）：

| 组件 | 旧架构 | 新架构 |
|------|--------|--------|
| 组织方式 | 扁平目录 | `packages/shared` + `packages/web` |
| 构建工具 | 无统一构建 | Turborepo 增量构建 |
| 核心引擎 | 内联 JS | `@mapgen/core` 独立 TypeScript 包 |
| 前端 | 原生 JS + HTML | TypeScript + Vite |
| 类型安全 | 无 | 全量 TypeScript strict mode |
| 渲染 | 单一 Canvas2D | WebGL2 主渲染 + Canvas2D 回退 |

### 新增

- **WebGL2 渲染器**：GPU 加速，支持 9 种渲染风格
  - 地形、板块、羊皮纸、卫星、低多边形、生物群落、等高线、浮雕、Azgaar
- **Material Design 3 UI**：CSS Custom Properties 令牌系统，深色主题
- **启动器面板**：预设参数选择、进度条、跳过选项
- **激光选区工具**：板块边界拖拽选择
- **光标悬停**：板块高亮
- **检查点系统**：localStorage 保存/恢复生成状态
- **响应式设计**：移动端侧边栏抽屉、触摸手势支持
- **TypeScript 全量类型安全**：`@mapgen/core` + `@mapgen/web` 均 strict mode

### 改进

- 噪声算法：Perlin、Simplex、Value、Worley 四种类型
- FBM 变体：标准、山脊、膨胀、扭曲
- 构造模拟：板块生成、边界计算、碰撞检测
- 侵蚀系统：水力侵蚀、湖泊生成、河流网络
- 气候系统：温度、湿度、生物群落分带
- 构建速度：Turborepo 缓存 + 并行构建

### 修复

- 修复 plateTex 纹理通道错位（boundary 读取错误通道）
- 修复 u_moistureTex uniform 命名不一致导致纹理未绑定
- 修复 distToSegment 除零 NaN（laserStart=laserEnd=[0,0] 时画布异常）
- 修复 u_plateTotal 未映射导致选中高亮失效
- 修复 launcher 动画结束后内容不可见（黑屏）
- 修复移动端 drawer 入场动画覆盖隐藏样式（挡住地图）

---

## 旧版 (v0.2.8 - v0.4.3)

旧版采用单体架构，支持 Canvas2D 渲染、C/S 架构等。

详见 [GitHub Releases](https://github.com/qwerrrtttyyy/mapgen/releases)。

> **注意**：v0.0.1 是对旧版代码库的完全重写，非增量升级。旧版源码保留在 `v0/` 目录中作为参考。