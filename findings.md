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

## 设计决策
- 采用 Web Worker 将生成逻辑移出主线程。
- 引入统一 RenderLoop 管理重绘，减少无效绘制。
- 使用 CSS 自定义属性实现双主题，避免大量样式重写。
- 新增 LRUCache、BinaryHeap、RingBuffer、SpatialGrid/QuadTree 等数据结构。
