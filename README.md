# Material Map Generator

基于程序化噪声与板块构造模拟的地图生成工具。**v0.4.1 全面采用 C/S 架构**，支持一键启动与服务端生成。

[GitHub](https://github.com/qwerrrtttyyy/mapgen) | [Releases](https://github.com/qwerrrtttyyy/mapgen/releases)

---

## 快速开始（v0.4.1）

```bash
cd v0/0.4.x/mapgen_v0.4.1
node server.js
# 浏览器打开 http://127.0.0.1:8765
```

或一键脚本：

```bash
bash v0/0.4.x/mapgen_v0.4.1/bin/run.sh
```

或 npm：

```bash
cd v0/0.4.x/mapgen_v0.4.1
npm run setup   # 依赖检查与修复
npm start       # 启动服务器
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAPGEN_PORT` | `8765` | 服务器端口 |
| `MAPGEN_HOST` | `127.0.0.1` | 绑定地址 |
| `MAPGEN_CONFIG` | `./mapgen.json` | 配置文件路径 |

---

## v0.4.1 特性（最新）

### 一键脚本
- **`bin/run.sh`** — 自动检测 Node.js ≥ 16，通过 nvm/fnm 自动安装，端口回退，自动打开浏览器
- **`bin/setup.sh`** — 依赖修正：检查 Node.js/npm/项目结构/磁盘空间/端口/脚本权限

### C/S 架构
- **服务端生成**: `POST /api/generate` — 服务端执行地图生成算法，复用前端 engine 模块
- **SSE 实时进度**: `GET /api/events` — 服务端推送生成进度事件
- **配置持久化**: `mapgen.json` — 支持运行时读写配置
- **健康监控**: `GET /api/health` — 运行时间、内存、检查点数量
- **端口回退**: 默认端口被占用时自动 +1 重试
- **架构切换**: UI 可随时切换"服务端生成" / "浏览器本地生成"

### 检查点系统
- 保存/恢复/删除中间生成状态
- 支持 tectonic / elevation / erosion / climate / rivers / full 各阶段
- 数据持久化至服务端 `.checkpoints/` 目录

### 渲染
- WebGL2 GPU 渲染（Canvas2D 自动降级）
- 10 种渲染风格：地形 / 板块 / 羊皮纸 / 卫星 / 低多边形 / 地形详情 / 生物群落 / 等高线 / 浮雕 / Azgaar

### 零依赖
- 纯 Node.js 内置模块：`http`, `fs`, `path`, `zlib`, `crypto`
- 无需 npm install

---

## 目录结构

```
v0/0.4.x/mapgen_v0.4.1/
├── server.js            # HTTP 服务器（C/S 架构）
├── mapgen.json          # 服务器配置
├── package.json         # npm scripts
├── bin/
│   ├── run.sh           # 一键启动脚本
│   ├── setup.sh         # 依赖修正脚本
│   ├── start.sh         # 快捷启动
│   └── start.ps1        # Windows 启动
├── public/
│   ├── index.html       # UI 入口
│   ├── style.css        # MD3 样式
│   ├── js/
│   │   ├── app.js       # 主应用逻辑（C/S 模式切换）
│   │   ├── checkpoint.js
│   │   └── engine/      # 地图生成引擎
│   │       ├── noise.js, tectonic.js, erosion.js
│   │       ├── rivers.js, regions.js, index.js
│   │   └── renderer/
│   │       ├── webgl.js  # WebGL2 渲染器
│   │       └── canvas2d.js
│   └── shaders/
│       ├── fs-map.frag  # 10 种渲染风格
│       └── vs-quad.vert
└── .checkpoints/        # 检查点数据目录
```

---

## 历史版本

| 版本 | 架构 | 依赖 | 启动 |
|------|------|------|------|
| v0.4.1 | C/S (Node.js + browser) | 零依赖 | `node server.js` |
| v0.4.0 | React + Vite + TypeScript | npm | `npm run dev` |
| v0.3.14 | Node.js + multi-file | 零依赖 | `node server.js` |
| v0.3.12 | 单文件 Node.js | 零依赖 | `node *.js` |
| v0.0.x–v0.3.10 | 单文件 HTML | 无 | 浏览器打开 |

---

## 渲染风格

| 索引 | 风格 | 描述 |
|------|------|------|
| 0 | 地形 | 蓝白渐变高程图 |
| 1 | 板块 | 大陆/海洋分色 |
| 2 | 羊皮纸 | 复古手绘风格 |
| 3 | 卫星 | 卫星照片风格 |
| 4 | 低多边形 | 简约几何 |
| 5 | 地形详情 | 细节丰富的地形 |
| 6 | 生物群落 | 按生态类型着色 |
| 7 | 等高线 | contour lines |
| 8 | 浮雕 | 浮雕阴影效果 |
| 9 | Azgaar | 参考 Azgaar fantasy map |

---

## License

MIT
