# Material Map Generator v0.0.3-pre Release Notes

## 📦 发布信息

- **版本**: v0.0.3-pre (pre-release)
- **发布日期**: 2026-07-05
- **类型**: Pre-release (发布候选)
- **性能优化**: 底层设置优化，提升运行速度

## ✅ 验证状态

| 检查项 | 状态 | 详情 |
|--------|------|------|
| Typecheck | ✅ 通过 | 3/3 packages |
| Build | ✅ 通过 | 2/2 packages |
| Tests | ✅ 通过 | 72/72 test cases |

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| TypeScript 文件 | 49 个 |
| - @mapgen/core | 20 个模块 |
| - @mapgen/web | 29 个模块 |
| 测试文件 | 11 个 |
| 测试用例 | 72 个 |
| 源代码行数 | ~7,878 行 |
| 测试代码行数 | 1,337 行 |

## 🔧 核心引擎 (@mapgen/core)

### 基础系统
1. **noise.ts** - 噪声生成引擎
   - 4 种噪声类型：Perlin, Simplex, Value, Worley
   - 4 种 FBM 变体：Standard, Ridged, Billow, Warp

2. **tectonic.ts** - 板块构造模拟
   - Voronoi 板块生成
   - 边界计算与类型识别
   - 碰撞检测

3. **erosion.ts** - 侵蚀系统
   - 水力侵蚀模拟
   - 湖泊生成
   - 河流网络

4. **regions.ts** - 气候区域分析
   - 温度/湿度计算
   - 生物群落分带

### 行星级子系统 (v0.0.2+)
5. **oceanCurrents.ts** - 洋流系统
   - 风驱动表面流
   - Ekman 漂移
   - 西边界强化 (Stommel 简化)

6. **ice.ts** - 冰盖动力学
   - 极地冰盖扩张
   - 海冰形成
   - 冰川侵蚀 (U 型谷)

7. **biomes.ts** - Köppen-Geiger 生物群系
   - 32 类生物群系分类
   - A/B/C/D/E 五带 + 高山带 M + 特殊生态 X

8. **watershed.ts** - 流域分析
   - D8 流向算法
   - 排水盆地划分
   - Strahler 河序 (1-7 级)
   - 大陆分水岭标记

9. **volcanism.ts** - 火山系统
   - 热点火山链
   - 板缘火山弧
   - 概率场驱动
   - 破火山口标记

10. **seasons.ts** - 季节性气候
    - 4 季温度/降水变化
    - ITCZ 南北移动
    - 地中海式气候

### 工具系统
11. **editor.ts** - 交互式编辑器
    - 画笔工具
    - 矢量工具
    - 撤销/重做栈

12. **naming.ts** - 自动命名系统
    - 板块命名
    - 地形区命名

13. **texturePack.ts** - 纹理打包
    - 多通道纹理编码
    - GPU 优化格式

14. **downstream.ts** - 生成管线编排
    - 统一调度 9 个子系统
    - 可独立开关控制

## 🌐 前端应用 (@mapgen/web)

### 渲染引擎
- **WebGL2 渲染器**: GPU 加速
- **19 种渲染风格**:
  - 地形、板块、羊皮纸、卫星
  - 低多边形、生物群落、等高线
  - 浮雕、Azgaar、洋流条纹、冰盖覆盖等

### UI 系统
- **Material Design 3**: 深色主题支持
- **响应式设计**: 移动端适配
- **启动器面板**: 预设参数选择
- **侧边栏抽屉**: 触摸手势支持

### 高级功能
- **Web Worker**: 后台生成不阻塞 UI
- **检查点系统**: localStorage 持久化
- **LOD 名称叠加层**: 4 层缩放渐进显示
- **激光选区工具**: 板块边界拖拽

## 📝 变更日志

详见 [CHANGELOG.md](./CHANGELOG.md)

## 🚀 使用方式

### 开发模式
```bash
bun install
bun run dev
```

### 构建生产版本
```bash
bun run build
# 输出至 packages/web/dist/
```

### 运行测试
```bash
bun run test
# 72 个测试用例全部通过
```

### 类型检查
```bash
bun run typecheck
```

## 📄 许可证

MIT License

## 👥 作者

qwerrrtttyyy
