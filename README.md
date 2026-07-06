# Material Map Generator

[![Version](https://img.shields.io/github/v/release/qwerrrtttyyy/mapgen?label=version)](https://github.com/qwerrrtttyyy/mapgen/releases)
[![License](https://img.shields.io/github/license/qwerrrtttyyy/mapgen)](LICENSE)
[![Build](https://img.shields.io/badge/build-monorepo-blue)](https://github.com/qwerrrtttyyy/mapgen)

基于程序化噪声和板块构造模拟的地图生成工具，使用 WebGL2 渲染，Material Design 3 深色主题 UI。前端可独立运行全功能；可选 Node.js 后端提供 REST + SSE 远程生成与持久化。

## 截图

<img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20screenshot%20of%20a%20procedural%20terrain%20map%20generator%20web%20application%20with%20Material%20Design%203%20dark%20theme%20UI,%20showing%20a%20colorful%20topographic%20world%20map%20with%20oceans,%20continents,%20mountains,%20and%20plate%20boundaries%20rendered%20in%20WebGL2,%20with%20a%20sidebar%20panel%20on%20the%20left%20containing%20generation%20parameters&image_size=landscape_16_9" alt="Map Generator Screenshot" width="800">

## 发行版

| 版本 | 日期 | 说明 |
|------|------|------|
| [v0.0.3-pre](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.3-pre) | 2026-07-05 | 性能优化版 — 底层设置优化，提升运行速度 |
| [v0.0.2](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.2) | 2026-06-28 | 复杂世界式全局生成 — 洋流/冰盖/流域/火山/季节 |
| [v0.0.1](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.1) | 2026-06-26 | Monorepo 重写版 — WebGL2 + Material Design 3 |

完整历史：[CHANGELOG.md](CHANGELOG.md) · [GitHub Releases](https://github.com/qwerrrtttyyy/mapgen/releases)

## 快速开始

```bash
bun install
bun run dev        # 前端开发模式 → http://localhost:3000
bun run dev:server # 后端开发模式 → http://localhost:8787
bun run dev:all    # 同时启动前端 + 后端
bun run build      # 生产构建
bun run build:server # 仅构建后端
bun run typecheck  # 类型检查
bun test           # 运行全部测试
```

## 功能

| 类别 | 功能 |
|------|------|
| 噪声 | Perlin, Simplex, Value, Worley |
| FBM | 标准, 山脊, 膨胀, 扭曲 |
| 构造 | 板块生成, 边界计算, 碰撞检测 |
| 侵蚀 | 水力侵蚀, 湖泊生成, 河流网络 |
| 气候 | 温度, 湿度, 生物群落分带 |
| 渲染 | 地形, 板块, 羊皮纸, 卫星, 低多边形, 生物群落, 等高线, 浮雕, Azgaar |
| 交互 | 板块选区, 激光工具, 光标悬停, 检查点保存/恢复 |
| 界面 | Material Design 3, 深色主题, 响应式布局, 移动端适配 |

## 架构

```
mapgen/
├── packages/
│   ├── shared/          @mapgen/core — 核心引擎（TypeScript）
│   │   └── src/
│   │       ├── pipeline/      # 分阶段生成管线
│   │       ├── noise.ts       # 噪声生成
│   │       ├── tectonic.ts    # 板块构造
│   │       ├── erosion.ts     # 侵蚀模拟
│   │       ├── rivers.ts      # 河流生成
│   │       └── regions.ts     # 区域分析
│   ├── shared-types/    @mapgen/shared-types — 跨边界类型契约与序列化
│   ├── web/             @mapgen/web — 前端应用（TypeScript + Vite）
│   │   ├── public/
│   │   │   ├── shaders/       # GLSL ES 3.00 着色器
│   │   │   └── style.css      # Material Design 3 令牌
│   │   └── src/
│   │       ├── engine/        # MapGenEngine 抽象层（Local/Remote Provider）
│   │       ├── app.ts         # 应用主逻辑
│   │       └── renderer/
│   │           ├── webgl.ts   # WebGL2 渲染器
│   │           └── canvas2d.ts # Canvas2D 回退
│   └── server/          @mapgen/server — 可选参考后端（Hono + in-memory）
│       └── src/
│           ├── routes/        # REST API
│           └── services/      # 任务队列、地图存储
├── turbo.json           # Turborepo 配置
├── CHANGELOG.md         # 更新日志
└── AGENTS.md            # AI Agent 上下文
```

## 技术栈

| 层 | 技术 |
|----|------|
| 语言 | TypeScript (ES2020, strict) |
| 渲染 | WebGL2 / Canvas2D |
| 样式 | Material Design 3 (CSS Custom Properties) |
| 着色器 | GLSL ES 3.00 |
| 构建 | Turborepo + Vite + tsc |
| 包管理 | npm workspaces |
| 后端（可选）| Hono + in-memory 存储 + REST + SSE |

## 许可证

MIT