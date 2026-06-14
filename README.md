# Material Map Generator

基于程序化噪声与板块构造模拟的高性能地图生成工具。

[在线演示](https://qwerrrtttyyy.github.io/mapgen) | [Releases](https://github.com/qwerrrtttyyy/mapgen/releases)

## 特性

### 核心引擎
- **程序化噪声**: Simplex / Perlin / Value / Worley 四种噪声算法
- **FBM 变体**: Standard / Ridged / Billowy / Domain Warp
- **板块构造模拟**: 支持 4-32 个板块，自动生成大陆/海洋边界
- **水力侵蚀**: 真实的侵蚀与沉积模拟
- **河流网络**: 自动生成流向湖泊或海洋的河流系统

### 渲染管线
- **WebGL2 GPU 渲染**: 高性能 WebGL2 着色器渲染
- **Canvas2D 降级**: 当 WebGL2 不可用时自动切换
- **10 种渲染风格**: 低多边形、地形高程、板块着色、羊皮卷、卫星视图、地形详情、生物群落、等高线、地形浮雕、Azgaar 风格

### 交互系统
- **激光指针**: 点击选中板块
- **流光轨迹**: 鼠标拖拽产生光效
- **光标系统**: 实时显示海拔、温度、湿度信息
- **触控缩放**: 支持移动设备双指缩放/平移

### 数据管理
- **本地存储**: IndexedDB 保存/加载地图
- **多格式导出**: PNG / JPEG / WebP / JSON
- **双语界面**: 中文 / English
- **双主题**: Modern / Classic

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite
- **状态管理**: Zustand
- **渲染**: WebGL2 (原生, 无 Three.js)
- **样式**: Tailwind CSS
- **图标**: Lucide React

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run check
```

## Termux 支持

在 Android 上使用 [Termux](https://termux.com/) 一键配置：

```bash
# 一键安装 Node.js + Git + 项目（推荐）
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) termux

# 或使用专用脚本
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/termux.sh)
```

配置完成后运行：
```bash
cd ~/mapgen
npm run dev
```

> Termux 浏览器访问 `http://localhost:5173`

## 一键脚本

无需克隆仓库，任何人可直接运行：

```bash
# 查看帮助
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh)

# 安装依赖
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) install

# 类型检查
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) check

# 构建生产版本
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) build

# 启动开发服务器
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) dev

# 预览生产版本
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) preview

# 克隆仓库到本地
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) clone

# 列出所有 Release
bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) releases

# 创建 Release (需设置 GITHUB_TOKEN)
GITHUB_TOKEN=ghp_xxx bash <(curl -sL ...) release v0.4.0
```

## 项目结构

```
src/
├── engine/           # 地图生成引擎
│   ├── noise.ts      # 噪声算法
│   ├── tectonic.ts   # 板块构造
│   ├── erosion.ts    # 水力侵蚀
│   ├── rivers.ts     # 河流生成
│   └── regions.ts    # 地形区分析
├── renderer/         # 渲染管线
│   ├── webgl.ts      # WebGL2 渲染器
│   ├── canvas2d.ts   # Canvas2D 降级
│   └── shaders/      # GLSL 着色器
├── components/       # React 组件
├── hooks/           # 交互逻辑
├── store/           # Zustand 状态
├── utils/           # 工具函数
└── i18n/            # 国际化
```

## 渲染风格预览

| 风格 | 描述 |
|------|------|
| 低多边形 | 简约几何风格 |
| 地形高程 | 蓝白渐变高程图 |
| 板块着色 | 大陆/海洋分色 |
| 羊皮卷 | 复古手绘风格 |
| 卫星视图 | 卫星照片风格 |
| 地形详情 | 细节丰富的地形 |
| 生物群落 | 按生态类型着色 |
| 等高线 |  contour lines |
| 地形浮雕 | 浮雕阴影效果 |
| Azgaar 风格 | 参考 Azgaar fantasy map |

## 参数说明

### 生成参数
- `seed`: 随机种子，支持任意字符串
- `mapSize`: 地图尺寸 (512 / 1024 / 2048)
- `plateCount`: 板块数量 (4-32)
- `landmass`: 陆地比例 (0.1-0.9)
- `noiseType`: 噪声类型
- `fbmType`: FBM 变体
- `octaves`: 倍频数 (1-10)
- `seaLevel`: 海平面高度
- `erosionStrength`: 侵蚀强度

### 渲染参数
- `style`: 渲染风格 (0-9)
- `showBoundaries`: 显示板块边界
- `showRivers`: 显示河流水系
- `showContours`: 显示等高线
- `lightAngle`: 光照角度

## License

MIT
