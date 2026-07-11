# Plan: mapgen P0 Fixes

## 上下文

当前分支: `feature/unify-pipeline-and-fix-volcanism`
起点: `v0.0.3-pre` 版本，Turborepo + npm workspaces monorepo

### 已完工 (基线干净)
- 火山 `volcanismTex` 全局-max → 最近热点高斯衰减 (`packingStage.ts`)
- `basinId` 按 65535 饱和 → 按实际最大 id 归一化 (`packingStage.ts`)
- `generateMap` 从内联编排收敛到 `pipeline/*Stage` (`index.ts`)
- `runDownstreamPipeline` 从内联下游链收敛到 stages (`downstream.ts`)
- 验证: `npm test` 207/207 通过, web + manager typecheck 通过

### 未改动的待修项 (本 plan 目标)

按优先级分三批:

---

## 🚨 P0 — 必须修复

### 1. 服务器入参无上限 → 远程 OOM/DoS

**现象**: `mapWidth/mapHeight/mapSize/plateCount/riverCount/erosionIterations/octaves` 直接传入 `generateMap`，无任何边界校验。`server/src/config.ts` 定义了 `maxResolution=4096` 但从未在 generate 路由强制执行。攻击者可构造 `{"mapWidth":1000000,"mapHeight":1000000}` → 巨大 Float32Array 分配 → 进程 OOM 崩溃。

**涉及文件**:
- `server/src/routes/generate.ts:9` — 接收 body 后直接传参，无校验
- `server/src/services/mapEngine.ts` — `executeGenerationJob` 直接调 `generateMap`
- `server/src/config.ts` — `maxResolution` 定义了但未在生成路径使用
- `shared/src/index.ts:128-135` — `generateMap` 自身也无上限（浏览器侧同理）
- `shared/src/index.ts:43-90` — `MapParams` 接口中这些字段无约束

**修复方案**:
1. 新增 `server/src/validation.ts`，编写参数校验函数：
   - `mapSize / mapWidth / mapHeight <= 4096` (或 `maxResolution`)
   - `plateCount ∈ [2, 64]`
   - `octaves ∈ [1, 12]`
   - `erosionIterations ∈ [0, 2000]`
   - `riverCount ∈ [0, 20000]`
   - `seedStr` 非空 / 长度限制
2. `generate` 路由入口调用校验，违例返回 `400 + { error, field, message }`
3. 同时在 `shared/src/index.ts` 的 `generateMap` 入口加 `Math.min/max` 钳位（防御纵深，浏览器同享）
4. 删掉旧的 `maxResolution` 定义或改为在验证中实际使用

**验证**: curl 发超大地图尺寸应返回 400 而非 crash；浏览器侧设超大值自动 clamp。

---

### 2. 坐标变换与 GPU 不互逆 → 标签偏移

**现象**: WebGL 渲染器按各轴拉伸全屏显示地图 (`a_pos` 占满 NDC)，但客户端的 `mapUvToClient` / `mapPixelToClient` 函数假设等比 letterbox 居中。非方形画布（即绝大部分窗口）下，`NameOverlay`（板块名词标签）、`EditorController.tryRenameAt`（区域重命名命中检测）、矢量工具预览全部偏移。

**涉及文件**:
- `web/src/map/viewport.ts:11-51` — `mapUvToClient` / `mapPixelToClient` / `clientToMapUv` 实现
- `web/src/renderer/webgl.ts:38-44` — GPU 端 u_zoom/u_pan uniform 逻辑
- `web/public/shaders/fs-map.frag:493-494` — 纹理采样公式
- `web/src/renderer/canvas2d.ts:83-104` — Canvas2D 用等比 letterbox（与 overlay 一致，但与 WebGL 不一致）

**修复方案**:
重写 `mapUvToClient` 匹配 GPU 的拉伸公式：
```
sx = ((mapU - 0.5 + panX) * zoom + 0.5) * rect.width;
sy = (1 - mapV - 0.5 + panY) * zoom + 0.5) * rect.height;
```
不再用 `baseScale` 和居中偏移。同时修正 `ny = 1 - mapV` 导致的 Y 轴 pan 符号反转 latent bug（`panY` 在 `ny` 下的符号与 GPU 相反）。

`canvas2d.ts` 的视图变换也统一到同一 stretch 公式，或改为直接复用 viewport.ts。

**验证**: 窗口 resize 为非方形；点击地图四角 → 拾取的位置应与鼠标一致；缩放后标签仍附着在对应板块上。

---

### 3. SSE 进度事件永远发不出

**现象**: `server/src/services/jobQueue.ts` 的 `process()` 同步执行 `executeGenerationJob`，所有 `onProgress` 回调在 `create` 返回 `jobId` 前就已触发完毕。客户端 `EventSource` 挂上时任务已 `completed`，`jobs.ts:38` 只发终态事件 → 进度条永远不动。

**涉及文件**:
- `server/src/services/jobQueue.ts:44,56-70` — 同步执行；`process()` 返回 `void` 用 `this.process()` 未 await
- `server/src/routes/jobs.ts:28-36` — SSE 订阅点读取终态事件
- `web/src/engine/remote.ts:69` — 客户端进度事件 handler

**修复方案**:
1. `executeGenerationJob` 改为异步：把 `generateMap` 包在 `setImmediate` / `setTimeout(0)` 里执行，让 HTTP handler 先返回 `jobId`
2. 或改为存储进度事件到 job 对象，`jobs.ts` 在 SSE 挂上后回放已发生的事件
3. 如用 `setImmediate`，注意同步 + `jobQueue.ts` 的状态机调整（`this.running` guard）

**验证**: curl 发起生成请求后立即开 EventSource 连 `/jobs/:id` → 收到多个 `progress` 事件而非只有一个 `completed`。

---

### 4. SSE `JSON.parse` 无 try/catch

**现象**: `web/src/engine/remote.ts:70,76,85` 三处 URL events 监听器直接 `JSON.parse(e.data)`，服务端发畸形数据或网络波动 → 内部抛未捕获异常；`completed`/`failed` 分支的 `resolve` 在 parse 后永不执行 → Promise 永久挂起。

**涉及文件**:
- `web/src/engine/remote.ts:70 — 第 70 行附近 (progress 事件)`
- `web/src/engine/remote.ts:76 — (completed 事件)`
- `web/src/engine/remote.ts:85 — (failed 事件)`

**修复方案**:
每个事件 handler 改为：
```ts
try {
  const data = JSON.parse(e.data);
  // ...
} catch (parseError) {
  // 走 fail 路径，不让 promise 挂死
  fail(err('MAPGEN_PARSE_ERROR', `Failed to parse SSE event: ${e.data}`));
}
```

**验证**: 手动发畸形 SSE 事件 → 客户端不抛未捕获异常，生成 Promise 正确 rejected。

---

## ⚡ P1 — 下一批

### 5. 服务器无鉴权
- 加简单 token header 校验 或 只绑定 127.0.0.1 + 文档标注"仅可信网络"
- 文件: `server/src/index.ts:23-27`

### 6. Worker cancel 是空操作
- `web/src/workers/mapgen.worker.ts:17-23`: `generateMap` 同步阻塞
- 改 per-phase 检查 `isCancelled` 信号，或 worker 内 yield

### 7. Worker 失败回退锁 UI
- `web/src/core/mapGenWorker.ts:110-124`: 失败后 `runSync()` 主线程重跑
- 改为弹用户错误，不在 rAF 内静默执行全长生成

### 8. `float32ToBase64` 忽略 byteOffset
- `web/src/checkpoint.ts:72-81`: `new Uint8Array(arr.buffer)` → 改成 `new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)`

---

## 🧹 P2 — 顺手清

- 移除 `runClimateStage` 未使用的 `tectonic` 形参 (`shared/src/pipeline/climateStage.ts`)
- 清理 `noise.ts:19` `+ 0` 占位符: `s = (s * 16807 + 0) % 2147483647` → 删 `+ 0`
- 统一双锁文件: 删 `package-lock.json` 或 `bun.lock` (当前 CI 用 bun，但留意 AGENTS.md 写 npm)
- 服务端加全局 `app.onError` 兜底 (`server/src/index.ts`)
- `POST /maps` 校验 body (`server/src/routes/maps.ts:8-11`)
- 删除死路由 `/maps/:id/bin` (`server/src/routes/maps.ts:32-37`)
- 存档 params 改为真实存储 (`server/src/services/mapStorage.ts:22`)

---

## 验收标准 (所有 P0 修完后)

```bash
# 类型检查
npm run typecheck       # 5/5 packages

# 核心测试
npm test                 # 207/207 shared tests + downstream 4/4

# 服务器
npm run build:server     # 构建无错
curl -X POST -d '{"mapWidth":999999,"mapHeight":999999}' ...  # → 400
curl -X POST -d '{"mapWidth":512,"mapHeight":512}' ...        # → 202 + jobId
curl http://localhost:3000/api/v1/jobs/:id                    # → SSE 含 progress 事件

# 前端
npm run dev              # 启动后调整窗口非方形 → 标签不飘移
# 打开 debug 面板观察 SSE 连接事件流
```

---

## 分支与方法

- 全部在 `feature/unify-pipeline-and-fix-volcanism` 分支上继续
- 每项修复独立 commit，消息格式 `fix: 描述 (#编号)`
- 不建议一次修太多，P0 修完后跑 CI + 测试，确认稳定再进 P1

---

注: 本文件由 code review Phase 1 产出，现场审查覆盖 core + web + server + manager。更多细节见 review 报告中的编号条目。
