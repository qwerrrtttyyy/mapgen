# MapGen 项目发现记录

## 性能基线（benchmark.mjs）
| 指标 | 结果 | 备注 |
|---|---|---|
| 128×128 生成耗时 | ~46 ms | 主线程同步生成 |
| 256×256 生成耗时 | ~154 ms | 主线程同步生成 |
| 384×384 生成耗时 | ~340 ms | 主线程同步生成 |
| 512×512 生成耗时 | ~624 ms | 主线程同步生成，明显阻塞 UI |
| 初始加载时间 | ~3.35 s | 含启动器、Shader 拉取、检查点加载 |
| 渲染帧率 | ~60 FPS | 简单样式可维持 |

## 安全审查发现
| 规则 ID | 严重度 | 位置 | 说明 |
|---|---|---|---|
| JS-XSS-001 | 中 | `packages/web/src/ui/tooltip.ts:14,31` | `innerHTML` 用于显示提示内容 |
| JS-XSS-001 | 中 | `packages/web/src/ui/checkpointPanel.ts:100` | `innerHTML = ''` 清空列表（风险较低） |
| JS-XSS-001 | 中 | `packages/web/src/launcher/launcher.ts:37` | 模板字符串插值构建 DOM |
| CSP | 低 | `packages/web/index.html` | 无 Content-Security-Policy |

## 代码结构发现
- `app.ts` 直接调用 `generateMapAction()` 同步生成，阻塞主线程。
- `WebGLRenderer.render()` 每帧逐个设置 uniform，存在优化空间。
- `uploadMapData` 每次生成均重新上传全部纹理，即使数据未变。
- 当前无单元测试框架配置，需要新增测试基础设施。
- `index.html` 中参数表单为硬编码 HTML，维护成本高。

## 优化进展
- 阶段 3 渲染优化已完成：
  - `RenderLoop` 统一 `requestAnimationFrame`，避免无效重绘。
  - `WebGLRenderer.setUniforms()` 批量写入 uniforms 并缓存，跳过未变更值。
  - `WebGLRenderer.uploadMapData()` 通过 `MapData` 引用去重，切换样式不再重复上传纹理。
- 阶段 4 算法优化已完成：
  - `NoiseCache` 跨调用复用噪声引擎，256×256 生成 136ms（+17%）。
  - 侵蚀向量化：预计算邻居偏移 + 合并蒸发/降水，38.3ms（-18%）。
  - 河流优先级队列：BinaryHeap 替代 sort + 预计算邻居偏移。
- 阶段 5 主题系统已完成：
  - dark/light/aurora 三主题，`data-theme` 属性切换，保留原 MD3 主题。
- 阶段 6 移动端与加载已完成：
  - 44px 触控目标、safe-area-inset、触控设备 hover 优化。
  - Shader `?raw` 内联消除首屏 fetch 请求。
- 阶段 7 启动器扩展已完成：
  - 新增 9 个预设 + 最近种子功能 + innerHTML DOM 构建。
- 阶段 8 安全加固已完成：
  - CSP meta 标签 + tooltip/launcher innerHTML 清零，DOM XSS 风险消除。

## 设计决策
- 采用 Web Worker 将生成逻辑移出主线程。
- 引入统一 RenderLoop 管理重绘，减少无效绘制。
- 使用 CSS 自定义属性实现双主题，避免大量样式重写。
- 新增 LRUCache、BinaryHeap、RingBuffer、SpatialGrid/QuadTree 等数据结构。
