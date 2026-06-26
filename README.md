# Material Map Generator

基于程序化噪声和构造模拟的地图生成工具，使用 WebGL 渲染，Material Design 3 UI。

## 架构

**Monorepo 结构**（Turborepo + npm workspaces）

```
mapgen/
├── packages/
│   ├── shared/          # 共享引擎模块（TypeScript）
│   │   ├── src/
│   │   │   ├── noise.ts       # 噪声生成（Perlin, Simplex, Value, Worley）
│   │   │   ├── tectonic.ts    # 板块构造
│   │   │   ├── erosion.ts     # 侵蚀模拟
│   │   │   ├── rivers.ts      # 河流生成
│   │   │   ├── regions.ts     # 区域分析
│   │   │   └── index.ts       # 主入口
│   │   ├── dist/              # 编译输出
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/             # 前端应用（TypeScript + Vite）
│       ├── public/
│       │   ├── index.html
│       │   ├── style.css
│       │   ├── shaders/
│       │   │   ├── fs-map.frag
│       │   │   └── vs-quad.vert
│       │   └── favicon.svg
│       ├── src/
│       │   ├── app.ts           # 主应用逻辑
│       │   ├── checkpoint.ts    # 检查点管理
│       │   └── renderer/
│       │       ├── webgl.ts     # WebGL 渲染器
│       │       └── canvas2d.ts  # Canvas2D 渲染器
│       ├── dist/                # 构建输出
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── package.json         # 根配置
├── turbo.json           # Turborepo 配置
└── README.md
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（启动所有包）
npm run dev

# 构建所有包
npm run build

# 仅构建核心库
npm run build --workspace=@mapgen/core

# 仅构建前端
npm run build --workspace=@mapgen/web
```

开发服务器运行在 `http://127.0.0.1:3000`

## 包说明

### @mapgen/core

核心引擎库，包含所有地图生成算法：

- **噪声生成**: Perlin, Simplex, Value, Worley
- **FBM 变体**: 标准, 山脊, 膨胀, 扭曲
- **构造模拟**: 板块生成, 边界计算
- **侵蚀系统**: 水力侵蚀, 湖泊生成
- **河流生成**: 河流网络, 宽度/深度计算
- **区域分析**: 生物群落, 气候计算

### @mapgen/web

前端应用，使用 TypeScript + Vite 构建：

- **WebGL2 渲染**: 高性能 GPU 加速渲染
- **Canvas2D 回退**: 兼容性支持
- **Material Design 3**: 现代化 UI 设计
- **检查点系统**: 保存/恢复生成状态

## 功能特性

- ✅ 多种噪声类型和 FBM 变体
- ✅ 板块构造模拟
- ✅ 水力侵蚀和河流生成
- ✅ 气候系统和生物群落
- ✅ 多种渲染风格（地形、板块、羊皮纸、卫星等）
- ✅ 检查点系统
- ✅ 响应式设计
- ✅ TypeScript 类型安全

## 环境变量

- `MAPGEN_PORT` - 开发服务器端口（默认 3000）

## 技术栈

- **前端**: TypeScript + Vite
- **渲染**: WebGL2 / Canvas2D
- **样式**: Material Design 3 (CSS Custom Properties)
- **构建工具**: Turborepo
- **包管理**: npm workspaces

## 许可证

MIT
