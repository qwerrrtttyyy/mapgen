# MapGen 重构与优化设计方案

## 1. 项目目标与验收标准

### 1.1 核心目标
将 MapGen 从功能验证版升级为**高性能、可切换主题、移动端友好、安全可信**的浏览器端地图生成器。重点解决：主线程阻塞、动画掉帧、移动端触控体验差、加载慢、DOM XSS 风险点、算法可扩展性差等问题。

### 1.2 验收标准（可量化）
| 指标 | 当前基线 | 目标 |
|---|---|---|
| 512×512 生成耗时 | ~624 ms | ≤ 350 ms |
| 初始加载时间 | ~3.35 s | ≤ 1.8 s |
| 渲染帧率 | ~60 FPS | 稳定 60 FPS（复杂样式不跌破 55） |
| 首次内容绘制 | 无数据 | ≤ 1.0 s |
| 主线程阻塞 | 生成期间 UI 冻结 | 生成期间 UI 保持响应 |
| Lighthouse 性能分 | 未测 | ≥ 85（移动端） |
| 安全检查 | innerHTML 多处使用、无 CSP | 高危/中危 XSS 入口清零，CSP 落地 |

## 2. 架构重构

### 2.1 引入 Web Worker 生成管线
将 `@mapgen/core` 的 `generateMap` 迁移到 Web Worker 执行。主线程仅负责：参数序列化、进度事件转发、结果纹理上传。这样拖拽滑块、展开面板、启动器动画在生成期间不会卡顿。

Worker 内部保持纯函数：接收 `MapParams` + `AbortSignal`（可选），返回 `MapData` + 阶段检查点。主线程通过 `postMessage` 传递 `Transferable` 的 `Float32Array`，避免大数据拷贝。

### 2.2 渲染循环与业务逻辑解耦
当前 `app.ts` 直接调用 `renderer.render()` 并混有事件绑定。新增 `RenderLoop` 类统一 `requestAnimationFrame`，支持 `pause()` / `resume()`。只有在 uniforms 脏标记为 true 或地图数据更新时才触发重绘，避免连续多次 `render.request` 导致重复绘制。

### 2.3 模块职责重新划分
- `packages/shared`: 纯算法，增加 `spatial/`（空间索引）、`structs/`（队列/缓存）子模块。
- `packages/web/worker`: 地图生成 Worker 入口。
- `packages/web/src/render`: 渲染器 + 渲染循环。
- `packages/web/src/ui`: 组件化所有面板，统一主题入口。
- `packages/web/src/perf`: FPS 计数器、生成耗时 profiler。

## 3. 性能与动画优化

### 3.1 WebGL 渲染优化
- **Uniform 批处理**：`render()` 中当前逐个调用 `setUniform`。改为在参数变化时预计算 uniforms 对象，一次 `gl.useProgram` 后批量写入，减少 JS→GPU 调用次数。
- **纹理上传去重**：地图数据未改变时，切换渲染风格不重新 `uploadMapData`；仅更新风格相关 uniforms。
- **Mipmap 与降级**：对 512 以上尺寸使用 `NEAREST_MIPMAP_LINEAR` 缩放预览；移动设备默认限制最大尺寸为 384。
- **VAO/Program 缓存**：当前已缓存，保持不变；新增 `destroy()` 时释放所有 `WebGLTexture` 与 `WebGLBuffer`。

### 3.2 动画与交互帧率
- 所有 CSS 动画使用 `transform` 和 `opacity`，启用 `will-change` 但限制在动画元素上。
- 启动器退场、抽屉展开、检查点列表增删统一使用 CSS transition，避免 `setTimeout` 驱动样式。
- 为 `prefers-reduced-motion` 提供即时切换，无动画残留。
- 激光指针与光标跟随使用 `pointermove` 节流 + `requestAnimationFrame`，避免每像素都触发 uniforms 更新。

### 3.3 渐进式生成与预览
Worker 每完成一个阶段（tectonic/elevation/erosion/...）向主线程发送一次轻量预览纹理。主线程可选择性渲染低分辨率预览，让用户在等待完整结果时就能看到地形轮廓，感知速度提升。

## 4. 算法优化

### 4.1 噪声系统缓存
当前 `createNoise` 每次重新计算排列/梯度表。新增 `NoiseCache` 以 `(seed, noiseType)` 为 key 缓存排列表；相同种子重复生成时直接复用，预计节省 10%–20% 初始化时间。

### 4.2 侵蚀模拟向量化
将 `hydraulicErosion` 中逐点随机采样改为按块分治：先计算全局梯度场，再使用 `Float32Array` 批量更新沉积/侵蚀量。减少函数调用开销与边界检查次数。

### 4.3 河流生成优先级队列
河流当前按固定数量生成。引入最小堆（`BinaryHeap`）按海拔+湿度优先级选择源头，保证高湿度山区优先成河，结果更自然，同时避免全数组扫描。

### 4.4 空间索引
区域分析 `analyzeRegions` 引入四叉树/均匀网格，用于快速邻居查找与河流-区域交点查询。为大尺寸地图（512+）降低 O(n²) 邻居搜索。

## 5. 数据结构增强

### 5.1 新增核心数据结构
| 结构 | 用途 | 位置 |
|---|---|---|
| `LRUCache<K, V>` | 噪声表、纹理、检查点缩略图缓存 | `packages/shared/src/structs/lru.ts` |
| `BinaryHeap<T>` | 河流源头优先级、任务调度 | `packages/shared/src/structs/heap.ts` |
| `RingBuffer<T>` | 参数历史/撤销栈 | `packages/web/src/structs/ringBuffer.ts` |
| `QuadTree` | 区域、河流、触控点空间查询 | `packages/shared/src/spatial/quadtree.ts` |
| `SpatialGrid` | 均匀网格加速边界/河流查询 | `packages/shared/src/spatial/grid.ts` |

### 5.2 MapData 扩展
在现有 `plateTex/elevTex/moistTex/riverTex/tempTex` 基础上，可选附带 `normalTex`（法线贴图）与 `biomeTex`，供新渲染风格使用；通过 `MapDataLite` 与 `MapDataFull` 两种视图减少 Worker→主线程传输量。

## 6. UI 设计：Aurora Cartographer 主题系统

### 6.1 设计方向
采用 **"极光制图师"** 美学：深邃宇宙背景、半透明玻璃面板、极光青绿与星云紫罗兰点缀、精致衬线/等宽字体混排。提供一键切换的 **"Parchment Explorer"** 羊皮纸浅色主题，保留专业制图感。

### 6.2 主题切换机制
- 所有颜色、阴影、圆角、动画时长通过 CSS 自定义属性 `--mg-*` 管理，完全替代当前 `--md-sys-*` 硬编码。
- `ThemeManager` 在 `document.documentElement` 上切换 `data-theme="aurora" | "parchment"`，并持久化到 `localStorage`。
- 启动器增加主题预览卡片，用户可在进入主界面前选定主题。

### 6.3 组件级 UI 改造
- **启动器**：全屏沉浸式卡片，左侧大字号标题+动态地图预览，右侧预设网格，底部进度环+开始按钮。新增"最近种子"、"随机灵感"、"教程提示"。
- **参数面板**：从长抽屉改为可折叠卡片组，使用悬浮标签与实时数值徽章；滑动条带动态光晕。
- **顶部栏**：精简为浮岛式工具栏，包含主题切换、生成、导出、撤销、帮助。
- **检查点面板**：横向滚动卡片带缩略图，悬停显示元数据，删除使用滑动删除（移动端）/淡出（桌面端）。
- **工具提示**：替换 `innerHTML` 为 DOM 构建；支持富文本通过安全模板函数。

### 6.4 字体与排版
- 标题：`"Space Grotesk"` 或 `"Outfit"`（通过 Google Fonts 按需加载，带 SRI）。
- 数值/种子：`"JetBrains Mono"`。
- 正文：系统无衬线字体降级栈。

## 7. 移动端与加载优化

### 7.1 移动端体验
- 抽屉从左侧滑出改为底部 sheet（屏幕高度 ≤ 600 px 时），保留拇指操作区。
- 地图交互支持双指缩放、单指平移、双击选中板块。
- 触摸设备默认隐藏高级光照面板，通过"高级"开关展开。
- 输入控件最小点击区域 44 × 44 px。

### 7.2 加载速度
- **代码分割**：Vite 动态导入 `renderer/webgl.ts`、各 UI 面板、启动器，仅首页必需代码优先加载。
- **Shader 内联**：将 `fs-map.frag` 通过 Vite `?raw` 导入为字符串，省一次网络请求。
- **Service Worker**：使用 Vite PWA 模式缓存静态资源与检查点元数据，支持离线启动。
- **预加载关键资源**：`index.html` 增加 `<link rel="preload">` 用于首屏字体与主 CSS。
- **检查点压缩**：保存前使用 `JSON.stringify` + 自定义游程编码（RLE）对 Float32Array 进行压缩，降低 IndexedDB 占用。

## 8. 安全加固

### 8.1 内容安全策略
在 `index.html` 添加 `<meta http-equiv="Content-Security-Policy">`：
- `default-src 'self'`
- `script-src 'self'`（不允许 `unsafe-inline`/`unsafe-eval`）
- `style-src 'self' 'unsafe-inline'`（仅允许内联样式，因为主题系统需要）
- `img-src 'self' blob:`（支持导出与缩略图）
- `connect-src 'self'`

### 8.2 DOM XSS 清零
- 将 `Tooltip.show/pin` 的 `innerHTML` 改为基于 `DocumentFragment` 的安全构建。
- `CheckpointPanel.refresh` 中当前使用 `innerHTML = ''` 清空，改为 `replaceChildren()`。
- `Launcher` 初始模板字符串中的 `${options.title}` 等插值改为 DOM 构建或经过 HTML 转义。
- 禁止任何 `eval`/`new Function`/字符串 `setTimeout`；JSON 解析使用 `JSON.parse` 并校验模式。

### 8.3 存储安全
- `localStorage`/`IndexedDB` 读取的检查点数据必须校验版本号与字段类型，避免损坏数据导致崩溃。
- 不再将用户输入的检查点名称直接写入 HTML；统一使用 `textContent`。

## 9. 启动器扩展

### 9.1 新功能
- **预设增强**：地形类型（岛屿/大陆/山脉/群岛）、气候类型（温带/干旱/寒带）、艺术风格（地形/卫星/羊皮纸/低多边形）。
- **实时预览**：选中预设时，Worker 后台生成 64×64 微缩地图并显示为缩略图。
- **最近种子**：展示最近 5 个成功生成的种子，点击直接填充。
- **随机灵感**：一键生成 evocative 地名/种子组合，增加趣味性。
- **跳过逻辑**：保留"不再显示"选项，但新增"按住 Shift 点击图标跳过启动器"。

### 9.2 性能
启动器本身按需渲染，预设缩略图使用 `OffscreenCanvas` 或独立 Worker，避免阻塞主线程的入场动画。

## 10. 测试与度量

### 10.1 新增测试
- 单元测试：LRU、BinaryHeap、QuadTree、噪声缓存。
- 集成测试：Worker 生成管线端到端（使用 Vitest + `vite-plugin-web-worker` 模拟）。
- 性能回归：扩展 `benchmark.mjs` 记录每次构建的生成耗时与 FPS，输出 JSON。
- 视觉回归：Playwright 截图对比主题切换、启动器、移动布局。

### 10.2 持续度量
在 `packages/web/src/perf` 中内置 `PerfMonitor`，默认关闭，可通过 URL 参数 `?perf=1` 开启，实时显示 FPS、生成耗时、内存占用。

## 11. 实施顺序建议
1. Worker 生成管线 + RenderLoop（最大性能收益）。
2. WebGL 渲染优化 + 动画帧率。
3. 算法优化（噪声缓存、侵蚀向量化、优先级队列）。
4. 主题系统 + UI 组件改造。
5. 移动端适配 + 加载优化。
6. 数据结构扩展。
7. 启动器扩展。
8. 安全加固。
9. 测试与回归验证。
