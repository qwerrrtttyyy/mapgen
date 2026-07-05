# Material Map Generator

[![Version](https://img.shields.io/github/v/release/qwerrrtttyyy/mapgen?label=version)](https://github.com/qwerrrtttyyy/mapgen/releases)
[![License](https://img.shields.io/github/license/qwerrrtttyyy/mapgen)](LICENSE)
[![Build](https://img.shields.io/badge/build-monorepo-blue)](https://github.com/qwerrrtttyyy/mapgen)

基于程序化噪声和板块构造模拟的地图生成工具，使用 WebGL2 渲染，Material Design 3 深色主题 UI。纯前端，无需服务器。v0.0.3-pre 版本优化底层设置以提升运行速度。

## 截图

<img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20screenshot%20of%20a%20procedural%20terrain%20map%20generator%20web%20application%20with%20Material%20Design%203%20dark%20theme%20UI,%20showing%20a%20colorful%20topographic%20world%20map%20with%20oceans,%20continents,%20mountains,%20and%20plate%20boundaries%20rendered%20in%20WebGL2,%20with%20a%20sidebar%20panel%20on%20the%20left%20containing%20generation%20parameters&image_size=landscape_16_9" alt="Map Generator Screenshot" width="800">

## 发行版

| 版本 | 日期 | 说明 |
|------|------|------|
| [v0.0.3-pre](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.3-pre) | 2026-07-05 | 性能优化版 — 底层设置优化，提升运行速度 |
| [v0.0.2](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.2) | 2026-06-28 | 复杂世界式全局生成 — 洋流/冰盖/流域/火山/季节 |
| [v0.0.1](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.0.1) | 2026-06-26 | Monorepo 重写版 — WebGL2 + Material Design 3 |
| [v0.4.3](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.4.3) | 2026-06-19 | 旧版最终版 — 模块化重写 |
| [v0.4.0](https://github.com/qwerrrtttyyy/mapgen/releases/tag/v0.4.0) | 2026-06-14 | 旧版 — React + WebGL2 重构 |

完整历史：[CHANGELOG.md](CHANGELOG.md) · [GitHub Releases](https://github.com/qwerrrtttyyy/mapgen/releases)

## 快速开始

```bash
npm install
npm run dev      # 开发模式 → http://localhost:3000
npm run build    # 生产构建
npm run typecheck # 类型检查
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
│   │       ├── noise.ts       # 噪声生成
│   │       ├── tectonic.ts    # 板块构造
│   │       ├── erosion.ts     # 侵蚀模拟
│   │       ├── rivers.ts      # 河流生成
│   │       └── regions.ts     # 区域分析
│   └── web/             @mapgen/web — 前端应用（TypeScript + Vite）
│       ├── public/
│       │   ├── shaders/       # GLSL ES 3.00 着色器
│       │   └── style.css      # Material Design 3 令牌
│       └── src/
│           ├── app.ts         # 应用主逻辑
│           └── renderer/
│               ├── webgl.ts   # WebGL2 渲染器
│               └── canvas2d.ts # Canvas2D 回退
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

## 许可证

MIT