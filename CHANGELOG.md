# Changelog

All notable changes to the Material Map Generator.

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