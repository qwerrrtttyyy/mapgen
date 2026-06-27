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
