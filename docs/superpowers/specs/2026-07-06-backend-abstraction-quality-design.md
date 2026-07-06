# 设计文档：后端抽象层 + 模块质量提升

**日期：** 2026-07-06
**版本：** v1.0
**状态：** 待审核

---

## 1. 背景与目标

### 1.1 现状

mapgen 当前为纯前端架构：
- `@mapgen/core`（packages/shared）核心算法在浏览器 Web Worker 中运行
- `@mapgen/web` 通过 `mapGenWorker.ts` 直接调用 `generateMap()`
- `@mapgen/manager` CLI 工具，功能独立
- 前后端强耦合：UI 直接依赖 core 的内存数据结构（Float32Array 等）

### 1.2 目标

1. **前后端解耦**：引入抽象层，前端不直接依赖后端实现，可透明切换本地/远程引擎
2. **可选后端连接**：不限制后端技术栈，提供 Node.js/Hono 参考实现 + OpenAPI 规范
3. **前端独立运行**：无后端时全功能可用，与当前行为完全一致
4. **模块质量提升**：统一类型系统、标准化错误处理、拆分过长函数、增强测试覆盖
5. **后端核心功能**：地图持久化存储、高分辨率服务器端生成

---

## 2. 架构设计

### 2.1 整体架构

采用 **Service Provider 适配器模式**：在 core 包与 UI 之间引入统一的 `MapGenEngine` 接口抽象层。

```
┌─────────────────────────────────────────────────────┐
│                   @mapgen/web (UI)                  │
│  ┌───────────────────────────────────────────────┐  │
│  │              EngineProvider (接口)             │  │
│  │  generate() / getProgress() / save() / load() │  │
│  └───────────────┬───────────────────┬───────────┘  │
│                  │                   │              │
│     ┌────────────▼─────┐   ┌─────────▼──────────┐   │
│     │  LocalProvider   │   │  RemoteProvider    │   │
│     │ (Web Worker +    │   │ (REST + SSE,       │   │
│     │  @mapgen/core)   │   │  fetch/EventSource)│   │
│     └──────────────────┘   └────────────────────┘   │
└─────────────────────────────────────────────────────┘
                           │
              ┌────────────▼─────────────┐
              │    @mapgen/server         │
              │  (Hono + @mapgen/core)    │
              │  REST API + SSE + SQLite  │
              └───────────────────────────┘
```

### 2.2 Monorepo 新结构

```
mapgen/
├── packages/
│   ├── shared-types/    # 🆕 共享类型契约（前后端共用，零依赖）
│   │   └── src/
│   │       ├── api.ts          # REST API 请求/响应类型
│   │       ├── engine.ts       # EngineProvider 接口定义
│   │       ├── params.ts       # MapParams 等可序列化类型
│   │       ├── map.ts          # MapData 序列化格式
│   │       ├── errors.ts       # 标准化错误类型
│   │       └── index.ts
│   │
│   ├── shared/          # 核心算法（保持现有，补全类型导出）
│   │   └── src/
│   │       ├── pipeline/       # 🆕 从 generateMap 拆分出的阶段模块
│   │       │   ├── tectonicStage.ts
│   │       │   ├── elevationStage.ts
│   │       │   ├── climateStage.ts
│   │       │   ├── riverStage.ts
│   │       │   ├── packingStage.ts
│   │       │   └── index.ts
│   │       ├── ...现有文件
│   │       └── index.ts        # generateMap 改为调用 pipeline
│   │
│   ├── server/          # 🆕 Node.js 参考后端
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── db/
│   │       │   ├── index.ts
│   │       │   └── schema.sql
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   ├── generate.ts
│   │       │   ├── jobs.ts
│   │       │   ├── maps.ts
│   │       │   └── presets.ts
│   │       ├── services/
│   │       │   ├── jobQueue.ts
│   │       │   ├── mapEngine.ts
│   │       │   └── mapStorage.ts
│   │       └── utils/
│   │           ├── serialization.ts
│   │           └── errors.ts
│   │
│   ├── web/             # 前端改造
│   │   └── src/
│   │       ├── engine/           # 🆕 引擎抽象层
│   │       │   ├── provider.ts   # EngineProvider 接口
│   │       │   ├── local.ts      # LocalProvider
│   │       │   ├── remote.ts     # RemoteProvider
│   │       │   └── factory.ts    # Provider 工厂
│   │       ├── core/
│   │       │   ├── actions.ts    # ⬆️ 改为调用 provider
│   │       │   └── ...其他文件
│   │       └── ...现有其他文件
│   │
│   └── manager/         # 保持不变
│
└── openapi/
    └── mapgen.yaml      # 🆕 OpenAPI 3.1 规范
```

---

## 3. 核心接口设计

### 3.1 EngineProvider 接口

```typescript
// packages/shared-types/src/engine.ts

/** 生成进度 */
export interface GenerationProgress {
  jobId: string;
  phase: string;
  fraction: number;       // 0..1
  phaseLabel: string;
}

/** 生成结果 */
export interface GenerationResult {
  jobId: string;
  mapData: SerializedMapData;
  checkpoints?: Record<string, unknown>;
}

/** 地图元数据 */
export interface MapMeta {
  name?: string;
  tags?: string[];
}

/** 已保存地图引用 */
export interface SavedMapRef {
  id: string;
  createdAt: number;
}

/** 已保存地图摘要 */
export interface SavedMapSummary {
  id: string;
  name: string;
  seed: string;
  width: number;
  height: number;
  createdAt: number;
  tags: string[];
  thumbnail?: string;     // base64 PNG
}

/** 地图列表过滤器 */
export interface MapFilter {
  limit?: number;
  offset?: number;
  search?: string;
  tags?: string[];
}

/** 引擎能力描述 */
export interface EngineCapabilities {
  maxResolution: number;           // 0 表示无限制
  supportsPersistence: boolean;
  supportsAbort: boolean;
  features: string[];              // ['oceanCurrents', 'iceSheet', ...]
}

/**
 * 地图生成引擎接口 - 前后端解耦的核心抽象
 *
 * LocalProvider：在浏览器 Web Worker 中调用 @mapgen/core
 * RemoteProvider：通过 REST + SSE 调用远程后端
 */
export interface MapGenEngine {
  /** 异步生成地图，支持进度回调和取消 */
  generate(
    params: MapParams,
    onProgress?: (progress: GenerationProgress) => void,
    signal?: AbortSignal
  ): Promise<Result<GenerationResult>>;

  /** 保存地图 */
  saveMap(map: SerializedMapData, meta?: MapMeta): Promise<Result<SavedMapRef>>;

  /** 加载地图 */
  loadMap(id: string): Promise<Result<SerializedMapData | null>>;

  /** 列出已保存地图 */
  listMaps(filter?: MapFilter): Promise<Result<SavedMapSummary[]>>;

  /** 删除地图 */
  deleteMap(id: string): Promise<Result<void>>;

  /** 查询引擎能力 */
  getCapabilities(): EngineCapabilities;

  /** 释放资源 */
  dispose(): void;
}
```

### 3.2 Result 类型

```typescript
// packages/shared-types/src/errors.ts

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'JOB_NOT_FOUND'
  | 'GENERATION_FAILED'
  | 'MAP_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'BACKEND_UNAVAILABLE';

export interface MapGenError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Result 类型 - 强制调用方处理错误 */
export type Result<T, E = MapGenError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends MapGenError>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

### 3.3 序列化格式

```typescript
// packages/shared-types/src/map.ts

/** 可 JSON/MessagePack 序列化的 MapData 格式 */
export interface SerializedMapData {
  width: number;
  height: number;
  seed: number;
  plates: Plate[];
  regions: Region[];
  rivers: River[];
  names: NameManifest;
  // TypedArray 字段转为 base64 字符串（JSON模式）或 Buffer（MessagePack模式）
  textures: {
    plateTex: string;       // base64 编码的 Float32Array
    elevTex: string;
    moistTex: string;
    riverTex: string;
    tempTex: string;
    currentTex?: string;
    iceTex?: string;
    coastDist?: string;
    biomeTex?: string;
    watershedTex?: string;
    volcanismTex?: string;
    seasonTex?: string;
  };
  volcanoSites?: VolcanoSite[];
  hotspots?: Hotspot[];
}

/** 工具函数 */
export function serializeMapData(mapData: MapData): SerializedMapData;
export function deserializeMapData(serialized: SerializedMapData): MapData;
```

---

## 4. REST API 设计

**Base URL:** `/api/v1`

### 4.1 健康检查

```
GET /health
→ 200 { status: "ok", version: string, capabilities: EngineCapabilities }
```

### 4.2 地图生成

```
POST /generate
Content-Type: application/json
Body: MapParams
→ 202 { jobId: string, status: "queued" }
     Location: /api/v1/jobs/{jobId}
```

### 4.3 任务查询 + SSE 进度推送

```
GET /jobs/{jobId}
Accept: text/event-stream   → SSE 实时推送
Accept: application/json    → 轮询模式

SSE 事件：
  event: progress   data: { jobId, phase, fraction, phaseLabel }
  event: completed  data: { jobId, result: GenerationResult }
  event: failed     data: { jobId, error: { code, message } }

轮询响应：
→ 200 { jobId, status, progress?, result?, error? }
```

### 4.4 地图持久化

```
POST   /maps            → 保存地图，返回 { id, createdAt }
GET    /maps            → 列表（支持 ?limit=&offset=&search=&tags=）
GET    /maps/{id}       → 加载完整地图数据
GET    /maps/{id}/bin   → 二进制格式（MessagePack）
PATCH  /maps/{id}       → 更新元数据（name, tags）
DELETE /maps/{id}       → 删除
```

### 4.5 预设管理

```
GET    /presets         → 列出所有预设
POST   /presets         → 保存自定义预设
DELETE /presets/{id}    → 删除预设
```

---

## 5. 数据流

### 5.1 本地模式（LocalProvider）

```
UI → actions.ts → LocalProvider.generate()
    → mapGenWorker (Web Worker)
    → @mapgen/core.generateMap()
    → 进度回调通过 postMessage 传回
    → 返回 GenerationResult（LocalProvider 内部直接引用 MapData，零拷贝）
    → 渲染器直接使用 Float32Array
```

> LocalProvider 实现细节：`generate()` 返回的 `GenerationResult.mapData`
> 内部持有原始 `MapData` 引用（不经过序列化/反序列化），
> 仅在 `saveMap()` 等需要持久化的方法中才调用序列化。
> `AbortSignal` 通过 `worker.terminate()` 实现取消。

### 5.2 远程模式（RemoteProvider）

```
UI → actions.ts → RemoteProvider.generate()
    → POST /api/v1/generate → 获取 jobId
    → 建立 EventSource('/api/v1/jobs/{jobId}')
    → SSE 'progress' 事件 → 更新进度条
    → SSE 'completed' 事件 → 反序列化 MapData
    → 渲染器使用反序列化后的 Float32Array
    （连接失败且 fallback=true 时自动降级到 LocalProvider）
```

### 5.3 配置切换

- URL 参数：`?backend=local`（默认）或 `?backend=http://localhost:8787`
- 设置面板：后端地址输入框 + "连接测试"按钮 + "自动降级到本地"开关
- 配置存储在 `localStorage`

---

## 6. 后端参考实现

### 6.1 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js 18+ / Bun | 跨运行时兼容 |
| 框架 | Hono | 轻量、内置 SSE、TypeScript 优先 |
| 存储 | better-sqlite3 | 同步 API、零依赖服务、单文件 |
| 序列化 | msgpackr | 高性能 MessagePack |
| 验证 | Zod | 自动校验 + JSON Schema 生成 |

### 6.2 数据模型

```sql
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  name TEXT,
  seed TEXT NOT NULL,
  params JSON NOT NULL,
  map_data BLOB,
  thumbnail BLOB,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  tags TEXT
);

CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  params JSON NOT NULL,
  builtin INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  params JSON NOT NULL,
  progress REAL DEFAULT 0,
  phase TEXT,
  result BLOB,
  error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
```

---

## 7. 模块质量提升

### 7.1 generateMap 函数拆分

当前 [index.ts](../../packages/shared/src/index.ts) 中 `generateMap` 函数超过 550 行，拆分为独立的 pipeline 阶段：

| 阶段模块 | 职责 | 对应当前代码范围 |
|----------|------|------------------|
| `tectonicStage` | 板块生成、分配、边界计算 | L128-L252 |
| `elevationStage` | 高程生成、侵蚀 | L253-L272 |
| `climateStage` | 海岸线、洋流、气候、冰盖 | L275-L337 |
| `riverStage` | 湖泊、河流生成 | L339-L398（含湖泊、河流、生物群系、流域、火山、季节） |
| `regionStage` | 区域分析、命名 | L400-L435 |
| `packingStage` | 纹理打包 | L437-L535 |

> 注意：当前代码中河流/湖泊/生物群系/流域/火山/季节的计算交织在同一个
> `if (!isBlank)` 分支内。拆分时需要先整理这些阶段的执行顺序和数据依赖，
> 确保每个阶段只依赖前序阶段的输出。climateStage 产出 temperature/moisture/rainfall，
> riverStage 依赖这些产出并产出河流/湖泊/生物群系等。

每个阶段：
- 输入/输出类型明确
- 可独立测试
- 可选择性跳过（已有 `enable*` 开关）

### 7.2 事件总线类型增强

```typescript
// 为 bus 增加强类型事件映射
interface EventMap {
  'render.request': void;
  'generate.request': void;
  'generating.started': void;
  'progress': { fraction: number; label: string };
  'generating.completed': { mapData: MapData };
  'generating.failed': string;
  'selection.changed': { plates: number[]; regions: number[] };
  'export.request': void;
  'params.changed': { key: string; value: unknown };
}
```

### 7.3 actions.ts 重构

从直接调用 Worker 改为依赖注入 EngineProvider：

```typescript
// 改造前
mapGenWorker.generate(params, callback)

// 改造后
const provider = getEngineProvider();  // 从 factory 获取
provider.generate(params, callback)
```

---

## 8. 测试策略

| 层 | 测试类型 | 工具 |
|----|----------|------|
| core 算法 | 单元测试 | vitest（补充边界测试） |
| shared-types | 类型测试 + 序列化往返 | vitest + expect-type |
| LocalProvider | 集成测试（Worker 通信） | vitest + happy-dom |
| RemoteProvider | 契约测试（mock fetch/SSE） | vitest + msw |
| server API | 接口测试 | vitest + Hono test helper |
| E2E | 本地 + 远程模式全流程 | Playwright |

---

## 9. 独立运行保证

- `npm run dev`：只启动 web，全功能可用（默认 LocalProvider）
- `npm run dev:server`：单独启动后端（端口 8787）
- `npm run dev:all`：同时启动前端 + 后端
- web 构建产物为纯静态文件，可直接部署到任意静态托管

---

## 10. 新增依赖

| 包 | 用途 | 位置 |
|----|------|------|
| hono | HTTP 框架 | @mapgen/server |
| better-sqlite3 | SQLite 存储 | @mapgen/server |
| msgpackr | 高效序列化 | @mapgen/server, @mapgen/shared-types |
| zod | 参数校验 | @mapgen/server |
| msw | API mock（开发依赖） | @mapgen/web |

---

## 11. 实施优先级

1. **P0 - shared-types 包**：定义接口契约，所有后续工作依赖此包
2. **P0 - Engine 抽象层 + LocalProvider**：重构 web 的生成调用链路
3. **P1 - server 包**：参考后端实现
4. **P1 - RemoteProvider**：前端远程引擎适配器
5. **P2 - generateMap 拆分**：core 包 pipeline 重构
6. **P2 - 事件总线类型增强**：质量提升
7. **P3 - 持久化 UI**：地图保存/加载界面
8. **P3 - OpenAPI 规范导出**：自动化 API 文档
