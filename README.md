# Material Map Generator v0.0.1

基于程序化噪声和构造模拟的地图生成工具，使用 WebGL 渲染，Material Design 3 UI。

## 架构

**Monorepo 结构**（Turborepo + npm workspaces）

```
mapgen/
├── packages/
│   ├── shared/          # 共享引擎模块
│   │   ├── src/
│   │   │   ├── noise.js       # 噪声生成（Perlin, Simplex, Value, Worley）
│   │   │   ├── tectonic.js    # 板块构造
│   │   │   ├── erosion.js     # 侵蚀模拟
│   │   │   ├── rivers.js      # 河流生成
│   │   │   ├── regions.js     # 区域分析
│   │   │   └── index.js       # 主入口
│   │   └── package.json
│   ├── server/          # Node.js 服务端
│   │   ├── server.js
│   │   ├── mapgen.json
│   │   └── package.json
│   └── web/             # 纯 HTML+CSS+JS 前端
│       ├── public/
│       │   ├── index.html
│       │   ├── style.css
│       │   ├── shaders/
│       │   │   ├── fs-map.frag
│       │   │   └── vs-quad.vert
│       │   └── js/
│       │       ├── app.js
│       │       ├── checkpoint.js
│       │       └── renderer/
│       │           ├── webgl.js
│       │           └── canvas2d.js
│       └── package.json
├── package.json         # 根配置
├── turbo.json           # Turborepo 配置
└── README.md
```

## 运行

```bash
# 安装依赖
npm install

# 开发模式（启动所有包）
npm run dev

# 仅启动服务端
cd packages/server
npm start

# 构建所有包
npm run build
```

服务端默认运行在 `http://127.0.0.1:8765`

## 环境变量

- `MAPGEN_PORT` - 服务端端口（默认 8765）
- `MAPGEN_HOST` - 服务端地址（默认 127.0.0.1）

## 功能

- **多种噪声类型**: Perlin, Simplex, Value, Worley
- **FBM 变体**: 标准, 山脊, 膨胀, 扭曲
- **构造模拟**: 板块生成, 边界计算
- **侵蚀系统**: 水力侵蚀, 湖泊生成, 河流网络
- **气候系统**: 温度, 湿度, 生物群落
- **渲染风格**: 地形, 板块, 羊皮纸, 卫星, 低多边形, 生物群落, 等高线, 浮雕, Azgaar
- **检查点系统**: 保存/恢复生成状态
- **C/S 架构**: 服务端生成 + SSE 实时进度

## 技术栈

- **前端**: 纯 HTML + CSS + JavaScript (ES6 Modules)
- **渲染**: WebGL2 / Canvas2D
- **服务端**: Node.js (HTTP, SSE)
- **构建工具**: Turborepo
- **包管理**: npm workspaces

## 许可证

MIT
