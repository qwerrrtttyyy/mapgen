# MapGen 重构任务计划

## 项目目标
将 MapGen 升级为高性能、可切换主题、移动端友好、安全可信的浏览器端地图生成器。

## 当前阶段
全部阶段完成。

## 阶段清单

### 阶段 1：基础数据结构（TDD）
- [x] 1.1 设计文档编写
- [x] 1.2 实现 LRUCache（含测试）
- [x] 1.3 实现 BinaryHeap（含测试）
- [x] 1.4 实现 RingBuffer（含测试）
- [x] 1.5 实现 SpatialGrid（含测试）

### 阶段 2：Worker 生成管线
- [x] 2.1 定义 Worker 消息协议
- [x] 2.2 实现 mapWorker.ts
- [x] 2.3 实现 MapGeneratorClient
- [x] 2.4 集成到 app.ts

### 阶段 3：渲染优化
- [x] 3.1 实现 RenderLoop
- [x] 3.2 WebGL 批量 uniform 更新
- [x] 3.3 纹理去重上传

### 阶段 4：算法优化
- [x] 4.1 噪声缓存 NoiseCache
- [x] 4.2 侵蚀向量化
- [x] 4.3 河流优先级队列

### 阶段 5：主题与 UI
- [x] 5.1 ThemeManager + theme.css
- [x] 5.2 重写 index.html（CSP + viewport-fit + 主题切换按钮）
- [x] 5.3 参数面板组件化（已有 ParamPanel）
- [x] 5.4 工具提示安全改造（DOM API 替代 innerHTML）

### 阶段 6：移动端与加载
- [x] 6.1 响应式布局与底部 Sheet（增强 @media + safe-area-inset）
- [x] 6.2 触控交互支持（44px 触控目标 + 触控设备 hover 优化）
- [x] 6.3 代码分割与 Shader 内联（?raw 导入 + build target）

### 阶段 7：启动器扩展
- [x] 7.1 新启动器结构与动画（innerHTML 安全改造 + DOM 构建）
- [x] 7.2 预设增强与最近种子（新增 9 个预设 + 最近种子功能）

### 阶段 8：安全加固
- [x] 8.1 添加 CSP（meta 标签）
- [x] 8.2 DOM XSS 清零（tooltip + launcher innerHTML 清零）

### 阶段 9：测试与验证
- [x] 9.1 单元测试（77 个全部通过）
- [x] 9.2 类型检查与构建验证（全部通过）
- [x] 9.3 性能回归测试（NoiseCache +17%，侵蚀 -18%）

## 决策记录
- 使用 Web Worker 运行地图生成，保持主线程响应。
- 主题系统使用 CSS 自定义属性 `--mg-*`，支持 Aurora / Parchment。
- 安全策略采用 CSP meta 标签 + DOM 构建替代 innerHTML。
- 数据结构优先实现，供后续算法与缓存使用。

## 错误记录
| 错误 | 尝试 | 解决方案 |
|---|---|---|
| Worker error 事件未监听 | 1 | 在 MapGeneratorClient 中添加 error/messageerror 监听，rejectAll 所有挂起请求 |
| 无 | - | - |
