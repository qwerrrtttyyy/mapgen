# MapGen 重构进度日志

## 2026-06-27
### 已完成
- 完成并保存 [design.md](design.md)。
- 用户批准 design.md。
- 完成并保存 [plan.md](plan.md)、[task_plan.md](task_plan.md)、[findings.md](findings.md)。
- 阶段 1 完成：LRUCache、BinaryHeap、RingBuffer、SpatialGrid（均含测试）。
- 阶段 2 完成：Web Worker 生成管线（mapWorker.ts、messages.ts、MapGeneratorClient）集成到 app.ts。
- 阶段 3.1 完成：RenderLoop 统一动画帧调度。
- 阶段 3.2 完成：WebGLRenderer 批量 uniform 更新与缓存。
  - 新增 `setUniforms()` 批量写入 uniforms，跳过未变更值。
  - `render()` 通过 `setUniforms()` 设置 `u_resolution`、`u_time` 与用户参数。
  - 新增单元测试 5 个，全部通过。

- 阶段 3.3 完成：纹理去重上传。
  - `WebGLRenderer.uploadMapData()` 缓存上一次上传的 `MapData` 引用，相同对象再次传入时直接跳过全部 GL 上传。
  - 新增单元测试 4 个，覆盖首次上传、相同对象跳过、尺寸变化重传、不同对象重传。

### 下一步
- 进入阶段 4：算法优化（4.1 噪声缓存 NoiseCache）。

### Worker 健壮性修复
- `MapGeneratorClient` 新增 `error` / `messageerror` 事件监听，Worker 加载失败或消息反序列化失败时 reject 所有挂起的 generate Promise，避免永久挂起。
- 新增单元测试 5 个，覆盖 error/messageerror/complete/progress/destroy。

### 阶段 4.1 完成：噪声缓存 NoiseCache
- 新增 `packages/shared/src/noiseCache.ts`，基于 LRUCache 以 `(seed, noiseType)` 为 key 复用 NoiseEngine。
- `generateMap` 接受可选 `NoiseCache`，内部 `generatePlates`、`generateElevation`、`generateLakes` 均通过 cache 获取噪声引擎。
- `mapWorker.ts` 维护模块级 `NoiseCache` 实例，跨多次生成复用，相同种子重复生成省去排列表重建。
- 新增单元测试 6 个，覆盖复用、淘汰、一致性、clear。

### 下一步
- 进入阶段 4.2：侵蚀向量化。

### 阶段 4.2 完成：侵蚀向量化
- 新增 `buildNeighborOffsets()` 预计算 8 邻居线性偏移量，内层循环用 `idx + offsets[d]` 替代重复的 `dirs[d*2] + dirs[d*2+1]*width`。
- 合并蒸发（`water *= 0.9`）与降水（`water += 0.01`）为单次遍历 `water = water * 0.9 + 0.01`，减少一次完整数组扫描。
- 新增 `iterations <= 0` 快速返回。
- 新增单元测试 7 个，覆盖不可变性、侵蚀山峰、沉积谷底、低强度收敛、确定性、零迭代。
- 性能：256×256 / 20 次迭代从 46.7ms 降至 38.3ms（约 18% 提升），行为等价。

### 下一步
- 进入阶段 4.3：河流优先级队列（使用 BinaryHeap）。

### 阶段 4.3 完成：河流优先级队列
- 用 BinaryHeap（max-heap）替代 `sources.sort()`，加入 idx 作为 tie-breaker 保持稳定排序。
- 预计算 8 邻居偏移量 `buildNeighborOffsets(width)`，消除内层循环重复分配数组。
- 新增单元测试 6 个。

### 阶段 5 完成：主题与 UI
- 新增 `themeManager.ts`，支持 dark/light/aurora 三主题切换，localStorage 持久化。
- 新增 `theme.css`，用 `:root[data-theme]` 选择器覆盖 CSS 自定义属性，保留原 MD3 主题。
- `index.html` 添加 CSP meta、viewport-fit=cover、主题切换按钮。
- 新增测试 8 个。

### 阶段 6 完成：移动端与加载
- `style.css` 增强 @media：44px 触控目标、safe-area-inset、滑块加大、触控设备 hover 优化。
- `app.ts` shader 从运行时 fetch 改为 `?raw` 内联导入，消除首屏 HTTP 请求。

### 阶段 7 完成：启动器扩展
- `presets.ts` 新增 9 个预设。
- `launcher.ts` 新增"最近种子"功能 + innerHTML 安全改造。
- 新增测试 6 个。

### 阶段 8 完成：安全加固
- CSP meta 标签、tooltip.ts DOM API 改造、mapInteraction.ts format() 返回 string[]。
- 新增测试 10 个。

### 阶段 9 完成：全量验证
- 单元测试：77 个全部通过（core 33 + web 44）。
- typecheck + build：通过。
- 性能：256×256 生成 136ms（带 NoiseCache，+17%），侵蚀 38.3ms（-18%）。
