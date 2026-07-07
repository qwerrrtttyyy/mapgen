# 设计文档：核心引擎重构与UI组件化

**日期：** 2026-07-07
**版本：** v1.0
**状态：** 待审核
**前身：** [backend-abstraction-quality-design.md](./2026-07-06-backend-abstraction-quality-design.md)

---

## 1. 背景与目标

### 1.1 现状盘点

代码审查发现的关键问题：

| 问题 | 位置 | 影响 |
|------|------|------|
| `generateMap` 600+行内联实现 | `packages/shared/src/index.ts` | 不可测试、不可中断、checkpoint效率低 |
| 类型重复定义5处 | types.ts / index.ts / typedArrays.ts / appState.ts / mapEngine.ts | 维护成本高、类型不一致 |
| pipeline/已有6个stage但未集成 | `packages/shared/src/pipeline/` | 半成品代码、维护负担 |
| 无运行时参数验证 | 前端无、后端Zod不共享 | 异常输入导致崩溃 |
| LocalProvider硬编码Worker依赖 | `packages/web/src/engine/local.ts` | 无法mock测试 |
| app.ts超过1000行DOM操作 | `packages/web/src/app.ts` | 维护困难、组件无法复用 |
| checkpoint深拷贝所有纹理 | `generateMap` 内structuredClone | 内存浪费（每checkpoint约10MB+） |

### 1.2 设计决策（已确认）

- **类型统一方案**：所有共享类型定义归 `@mapgen/shared-types`，`@mapgen/core` 依赖它
- **UI技术选型**：原生TypeScript + 轻量组件基类模式，零外部框架
- **API兼容策略**：渐进废弃（新API并行，旧API标记@deprecated）
- **实施路径**：Pipeline编排器优先 → 参数验证 → DI/Provider改进 → UI组件化 → 后端对齐

### 1.3 目标

1. **完成pipeline集成**：将已有的6个stage + 新增10个stage整合到统一的编排器中
2. **类型系统统一**：所有跨包类型定义在 `@mapgen/shared-types`
3. **参数验证**：前后端共用Zod schema，运行时验证输入
4. **错误标准化**：统一Result<T>类型和错误码
5. **依赖注入**：Engine/Worker支持mock，提升可测试性
6. **内存优化**：checkpoint改为引用式快照，消除不必要的深拷贝
7. **UI组件化**：将app.ts拆分为可独立测试的组件树
8. **向后兼容**：旧API保持可用，标记@deprecated

---

## 2. 架构总览

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                  @mapgen/web (UI)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │         UI Components (原生TS组件基类)         │  │
│  │  Toolbar / Sidebar / Canvas / StatusBar       │  │
│  └───────────────────┬───────────────────────────┘  │
│  ┌───────────────────▼───────────────────────────┐  │
│  │  Core (Store / Actions / AppState)            │  │
│  └───────────────────┬───────────────────────────┘  │
│  ┌───────────────────▼───────────────────────────┐  │
│  │  Engine Provider (DI容器)                     │  │
│  │  ┌─────────────┐    ┌──────────────────┐     │  │
│  │  │ LocalProvider│   │ RemoteProvider   │     │  │
│  │  │ (Web Worker)│    │ (REST + SSE)     │     │  │
│  │  └─────────────┘    └──────────────────┘     │  │
│  └───────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────┐
│              @mapgen/shared-types                   │
│  params / map / errors / engine / validation / api  │
│              (类型唯一来源 + Zod schema)             │
└───────────────────────────┬─────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                   ┌──────────▼──────────┐
│ @mapgen/core   │                   │ @mapgen/server      │
│ PipelineOrch-  │                   │ Hono + REST + SSE   │
│ estrator + 16  │                   │ (复用shared-types   │
│ stages         │                   │  Zod验证)           │
└────────────────┘                   └─────────────────────┘
```

### 2.2 Monorepo 最终结构

```
mapgen/
├── packages/
│   ├── shared-types/         # ⬆️ 类型唯一来源
│   │   └── src/
│   │       ├── params.ts         # MapParams（从Zod推导）
│   │       ├── map.ts            # MapData/Plate/Region/River/...
│   │       ├── texture.ts        # TextureReaders/Writers
│   │       ├── engine.ts         # MapGenEngine接口+相关类型
│   │       ├── errors.ts         # Result<T>/MapGenError/ErrorCode
│   │       ├── validation.ts     # Zod schemas + validateParams()
│   │       ├── api.ts            # REST API types
│   │       ├── serialization.ts  # 序列化/反序列化
│   │       └── index.ts
│   │
│   ├── shared/               # ⬆️ Pipeline重构完成
│   │   └── src/
│   │       ├── pipeline/         # 🆕 管线框架
│   │       │   ├── Stage.ts
│   │       │   ├── PipelineContext.ts
│   │       │   ├── PipelineOrchestrator.ts
│   │       │   ├── CheckpointManager.ts
│   │       │   ├── factory.ts         # createDefaultPipeline()
│   │       │   ├── tectonicStage.ts
│   │       │   ├── elevationStage.ts
│   │       │   ├── erosionStage.ts    # 🆕 从elevation拆分
│   │       │   ├── coastlineStage.ts  # 🆕
│   │       │   ├── currentsStage.ts   # 🆕
│   │       │   ├── climateStage.ts
│   │       │   ├── iceStage.ts        # 🆕
│   │       │   ├── biomesStage.ts     # 🆕
│   │       │   ├── lakesStage.ts      # 🆕
│   │       │   ├── riversStage.ts
│   │       │   ├── watershedStage.ts  # 🆕
│   │       │   ├── volcanismStage.ts  # 🆕
│   │       │   ├── seasonsStage.ts    # 🆕
│   │       │   ├── regionsStage.ts
│   │       │   ├── namingStage.ts     # 🆕
│   │       │   └── packingStage.ts
│   │       ├── noise.ts / tectonic.ts / erosion.ts / ...  # 算法（不变）
│   │       ├── types.ts          # ⬇️ 仅re-export, @deprecated
│   │       └── index.ts          # generateMap委托pipeline，新增createPipeline()
│   │
│   ├── web/                  # ⬆️ UI组件化
│   │   └── src/
│   │       ├── ui/               # 🆕 组件层
│   │       │   ├── Component.ts      # 轻量组件基类
│   │       │   ├── toolbar/
│   │       │   ├── sidebar/cards/
│   │       │   ├── canvas/
│   │       │   ├── statusbar/
│   │       │   └── dialogs/
│   │       ├── core/             # 核心状态层
│   │       │   ├── store.ts         # 🆕 轻量响应式Store
│   │       │   ├── appState.ts      # ⬆️ 基于Store重构
│   │       │   └── actions.ts       # ⬆️ 使用Provider Result
│   │       ├── engine/           # ⬆️ DI改进
│   │       │   ├── provider.ts      # MapGenEngine接口
│   │       │   ├── local.ts         # ⬆️ DI+Result+Worker抽象
│   │       │   ├── remote.ts        # ⬆️ Result+Zod响应验证
│   │       │   ├── factory.ts
│   │       │   ├── EngineDeps.ts    # 🆕 DI容器
│   │       │   └── worker.ts        # 🆕 Worker接口抽象
│   │       ├── renderer/         # 不变
│   │       ├── mapGenWorker.ts   # ⬆️ 使用新Pipeline API
│   │       └── app.ts            # ⬇️ 瘦身为App类组件编排
│   │
│   └── server/               # ⬆️ 类型对齐
│       └── src/
│           └── ...               # 使用@mapgen/shared-types类型和Zod
│
└── docs/superpowers/
    ├── specs/                    # 设计文档
    └── plans/                    # 实施计划
```

---

## 3. 类型系统统一设计

### 3.1 包依赖关系调整

**调整前**：
```
@mapgen/shared-types → @mapgen/core  (shared-types依赖core)
@mapgen/web → @mapgen/core + @mapgen/shared-types
```

**调整后**：
```
@mapgen/core → @mapgen/shared-types  (core依赖shared-types)
@mapgen/web → @mapgen/core + @mapgen/shared-types
@mapgen/server → @mapgen/core + @mapgen/shared-types
```

`@mapgen/shared-types` 成为最底层包，无内部依赖。

### 3.2 shared-types 完整类型清单

```typescript
// packages/shared-types/src/params.ts

// 枚举类型
export type NoiseType = 'perlin' | 'simplex' | 'value' | 'worley';
export type FbmVariant = 'standard' | 'ridged' | 'billowy' | 'warped';
export type RenderStyle = 'terrain'|'plates'|'parchment'|'satellite'|'lowpoly'
                          |'biome'|'contour'|'relief'|'azgaar';
export type SeaMode = 'auto' | 'land' | 'water' | 'mixed';

// 子参数接口（保持现有字段）
export interface NoiseParams { scale; octaves; persistence; lacunarity; noiseType; fbmVariant; warpStrength; }
export interface TectonicParams { plateCount; plateMovementSpeed; orogenicStrength; continentalDrift; }
export interface ErosionParams { erosionStrength; erosionIterations; depositionRate; thermalErosion; }
export interface RiverParams { riverCount; minRiverLength; riverErosion; lakeDensity; }
export interface ClimateParams { temperatureBias; rainfallBias; hadleyStrength; rainShadowStrength; }
export interface BiomeParams { biomeDetail; biomeEdgeSoftness; }
export interface WorldParams { oceanCurrentStrength; iceSheetCoverage; monsoonStrength; continentality; }
export interface DebugParams { showWireframe; showGrid; debugNoise; showBoundaries; }

export interface MapParams {
  // 基础
  width: number; height: number; seed: string|number; renderStyle: RenderStyle;
  stylePreset: string; seaLevel: number; seaMode: SeaMode; blankMode: boolean;
  // 子对象
  noise: NoiseParams; tectonic: TectonicParams; erosion: ErosionParams;
  rivers: RiverParams; climate: ClimateParams; biomes: BiomeParams;
  world: WorldParams; debug: DebugParams;
  // 世界式开关
  enableOceanCurrents: boolean; enableIceSheet: boolean; enableMonsoons: boolean;
  enableContinentality: boolean; enableBiomes: boolean; enableWatersheds: boolean;
  enableVolcanism: boolean; enableSeasons: boolean;
}
```

```typescript
// packages/shared-types/src/map.ts

export interface Plate {
  id: number; isOceanic: boolean; centerX: number; centerY: number;
  vx: number; vy: number; elevation: number; boundaryType: number;
}

export interface Region {
  id: number; type: TerrainType; elevation: number; moisture: number;
  centerX: number; centerY: number; area: number; plateId: number; name?: string;
}

export interface River {
  id: number; length: number; sourceX: number; sourceY: number;
  mouthX: number; mouthY: number; width: number;
}

export interface VolcanoSite { x: number; y: number; height: number; type: string; plateId: number; }
export interface Hotspot { x: number; y: number; strength: number; }
export interface NameManifest { plates: PlateName[]; regions: RegionName[]; }

export interface MapData {
  width: number; height: number; seed: number;
  plates: Plate[]; regions: Region[]; rivers: River[];
  // 纹理（直接Float32Array，非序列化格式）
  plateTex: Float32Array; elevTex: Float32Array; moistTex: Float32Array;
  tempTex: Float32Array; riverTex: Float32Array;
  coastDist?: Float32Array; currentTex?: Float32Array; iceTex?: Float32Array;
  biomeTex?: Float32Array; watershedTex?: Float32Array; volcanismTex?: Float32Array;
  seasonTex?: Float32Array;
  // 元数据
  names: NameManifest; volcanoSites: VolcanoSite[]; hotspots: Hotspot[];
  seaLevel: number; snowLine: number; treeLine: number;
  params: MapParams;
}

export type TerrainType = 'ocean'|'coast'|'lowland'|'highland'|'mountain'
                         |'desert'|'forest'|'tundra'|'ice'|'wetland'|'plateau';
```

```typescript
// packages/shared-types/src/texture.ts

// 纹理读写工具（迁移自pipeline/typedArrays.ts）
export class TextureReaders {
  static size; static plateId; static plateBoundary; // ... 所有通道getter
}

export class TextureWriters {
  static setPlateId; static setPlateBoundary; // ... 所有通道setter
}

// 纹理通道常量
export const TEX_CHANNELS = {
  plateTex: { id: 0, boundary: 1, boundaryType: 2, plateDist: 3 },
  elevTex: { elevation: 0, slope: 1, ridge: 2, ridgeMask: 3 },
  moistTex: { moisture: 0, rainfall: 1, biome: 2, tempZone: 3 },
  // ...
} as const;
```

```typescript
// packages/shared-types/src/engine.ts

export interface GenerationProgress {
  jobId: string; phase: string; fraction: number; phaseLabel: string;
}
export interface GenerationResult { jobId: string; mapData: MapData; checkpoints?: Record<string, PartialMapData>; }
export interface MapMeta { name?: string; tags?: string[]; }
export interface SavedMapRef { id: string; createdAt: number; }
export interface SavedMapSummary { id: string; name: string; seed: string; width: number; height: number; createdAt: number; tags: string[]; thumbnail?: string; }
export interface MapFilter { limit?: number; offset?: number; search?: string; tags?: string[]; }
export interface EngineCapabilities { maxResolution: number; supportsPersistence: boolean; supportsAbort: boolean; features: string[]; }

export interface MapGenEngine {
  generate(params: MapParams, onProgress?: (p: GenerationProgress) => void, signal?: AbortSignal): Promise<Result<GenerationResult>>;
  saveMap(map: MapData, meta?: MapMeta): Promise<Result<SavedMapRef>>;
  loadMap(id: string): Promise<Result<MapData | null>>;
  listMaps(filter?: MapFilter): Promise<Result<SavedMapSummary[]>>;
  deleteMap(id: string): Promise<Result<void>>;
  getCapabilities(): EngineCapabilities;
  dispose(): void;
}
```

```typescript
// packages/shared-types/src/errors.ts

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'GENERATION_ABORTED' | 'GENERATION_FAILED' | 'OUT_OF_MEMORY'
  | 'MAP_NOT_FOUND' | 'CHECKPOINT_NOT_FOUND'
  | 'NETWORK_ERROR' | 'TIMEOUT' | 'BACKEND_UNAVAILABLE' | 'SERVER_ERROR'
  | 'STORAGE_ERROR' | 'STORAGE_QUOTA_EXCEEDED';

export interface MapGenError { code: ErrorCode; message: string; cause?: unknown; details?: Record<string, unknown>; }
export type Result<T, E = MapGenError> = { ok: true; value: T } | { ok: false; error: E };
export function ok<T>(value: T): Result<T>;
export function err<E extends MapGenError>(error: E): Result<never, E>;
export class MapGenException extends Error { constructor(error: MapGenError); }
export function unwrap<T>(result: Result<T>): T;
```

### 3.3 过渡方案

`@mapgen/core/src/types.ts` 在过渡期内保留，内容改为 re-export：

```typescript
// packages/shared/src/types.ts
/**
 * @deprecated Import types from @mapgen/shared-types instead
 */
export * from '@mapgen/shared-types';
```

原 `@mapgen/core/src/index.ts` 中内联定义的类型同样处理。

---

## 4. Pipeline 编排器设计

### 4.1 PipelineContext

```typescript
// packages/shared/src/pipeline/PipelineContext.ts

export interface PipelineContext {
  readonly params: Readonly<MapParams>;
  readonly width: number; readonly height: number; readonly size: number;
  readonly rng: () => number;

  plates: Plate[]; regions: Region[]; rivers: River[];

  textures: Partial<TextureSet>;

  _scratch: {
    flowDir?: Int8Array;
    accumulation?: Float32Array;
    flux?: Float32Array;
    [key: string]: Float32Array | Int8Array | undefined;
  };

  metadata: {
    seaLevel: number; snowLine: number; treeLine: number;
    volcanoSites: VolcanoSite[]; hotspots: Hotspot[]; names: NameManifest;
  };
}

type TextureSet = {
  plateTex: Float32Array; elevTex: Float32Array; moistTex: Float32Array;
  tempTex: Float32Array; riverTex: Float32Array; coastDist: Float32Array;
  currentTex: Float32Array; iceTex: Float32Array; biomeTex: Float32Array;
  watershedTex: Float32Array; volcanismTex: Float32Array; seasonTex: Float32Array;
};
```

**延迟纹理分配**：纹理只在首次需要时由stage创建，避免空白模式(blankMode)或禁用世界式特性时的内存浪费。

### 4.2 Stage 接口

```typescript
// packages/shared/src/pipeline/Stage.ts

export interface StageProgress {
  stage: string; stageLabel: string;
  fractionInStage: number; overallFraction: number;
}

export interface Stage {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly dependsOn: readonly string[];

  isEnabled(params: MapParams): boolean;

  run(
    ctx: PipelineContext,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal
  ): void | Promise<void>;
}
```

### 4.3 16个阶段定义

| Stage ID | 标签 | 权重 | 依赖 | 纹理产出 | 文件状态 |
|----------|------|------|------|---------|---------|
| tectonic | 板块构造 | 0.08 | - | plateTex | 已有 |
| elevation | 高程生成 | 0.22 | tectonic | elevTex | 已有 |
| erosion | 水力侵蚀 | 0.16 | elevation | elevTex(修改) | 🆕拆分 |
| coastline | 海岸线 | 0.04 | elevation | coastDist | 🆕 |
| currents | 洋流系统 | 0.05 | coastline | currentTex | 🆕 |
| climate | 气候计算 | 0.09 | coastline,currents | tempTex, moistTex | 已有 |
| ice | 冰盖生成 | 0.06 | climate | iceTex | 🆕 |
| biomes | 生物群系 | 0.03 | climate,ice | biomeTex | 🆕 |
| lakes | 湖泊生成 | 0.03 | erosion,climate | elevTex(修改), riverTex | 🆕 |
| rivers | 河流网络 | 0.07 | lakes,erosion | riverTex | 已有 |
| watershed | 流域分析 | 0.04 | rivers | watershedTex | 🆕 |
| volcanism | 火山活动 | 0.03 | tectonic,elevation | volcanismTex | 🆕 |
| seasons | 季节变化 | 0.03 | climate | seasonTex | 🆕 |
| regions | 区域分析 | 0.04 | biomes,volcanism | regions[] | 已有 |
| naming | 自动命名 | 0.02 | regions | names | 🆕 |
| packing | 纹理打包 | 0.01 | * | - | 已有 |

**拓扑排序验证**：
- tectonic → elevation → erosion → coastline → currents → climate → ice → biomes → regions → naming → packing
- erosion → lakes → rivers → watershed（并行于climate链路）
- tectonic → volcanism（并行）
- climate → seasons（并行）

### 4.4 PipelineOrchestrator

```typescript
// packages/shared/src/pipeline/PipelineOrchestrator.ts

export interface PipelineRunOptions {
  onProgress?: (progress: StageProgress) => void;
  signal?: AbortSignal;
  checkpointLabels?: Set<string>;
}

export class PipelineOrchestrator {
  private stages = new Map<string, Stage>();

  register(stage: Stage): this;

  async run(params: MapParams, seed: number, options?: PipelineRunOptions): Promise<MapData>;

  private createContext(params: MapParams, seed: number): PipelineContext;
  private sortStages(enabled: Stage[]): Stage[];  // Kahn拓扑排序
  private validateDag(): void;                   // 循环依赖检测
  private assembleResult(ctx: PipelineContext): MapData;
}
```

**关键实现细节**：

1. **拓扑排序（Kahn算法）**：保证依赖阶段先于依赖方执行
2. **权重累计进度**：overallFraction = (已完成阶段权重和 + frac * 当前阶段权重) / 总启用阶段权重
3. **AbortSignal检查**：每个阶段执行前和阶段内关键点检查 signal.throwIfAborted()
4. **空白模式跳过**：isEnabled() 返回 false 的阶段被完全跳过

### 4.5 Checkpoint 内存优化

**现状问题**：`structuredClone(mapData)` 深拷贝所有 Float32Array，每个 checkpoint 占用约 10MB(512x512)。

**新方案：引用式快照 + 单向写入保证**

```typescript
// packages/shared/src/pipeline/CheckpointManager.ts

interface Checkpoint {
  label: string;
  plates: Plate[];          // 浅拷贝数组（小对象）
  regions: Region[];
  rivers: River[];
  metadata: PipelineContext['metadata'];
  textureRefs: Map<string, Float32Array>;  // 引用，非拷贝
}

export class CheckpointManager {
  private checkpoints = new Map<string, Checkpoint>();

  /**
   * 创建轻量快照。
   * 安全保证：管线阶段只追加写入新纹理或修改自己"拥有"的通道，
   * 不会修改前序阶段已完成的纹理通道。因此只保存引用即可安全恢复。
   */
  snapshot(label: string, ctx: PipelineContext): void {
    this.checkpoints.set(label, {
      label,
      plates: ctx.plates.map(p => ({...p})),
      regions: ctx.regions.map(r => ({...r})),
      rivers: ctx.rivers.map(r => ({...r})),
      metadata: { /* 浅拷贝metadata字段 */ },
      textureRefs: new Map(
        Object.entries(ctx.textures).filter(([, v]) => v) as [string, Float32Array][]
      ),
    });
  }

  /**
   * 恢复到checkpoint：重建ctx，复用未修改的纹理。
   */
  restore(label: string): PipelineContext;

  has(label: string): boolean;
  clear(): void;
}
```

**纹理所有权规则**（文档化，约束stage实现）：

| 纹理 | 主要写入阶段 | 可被后续阶段修改 |
|------|------------|----------------|
| plateTex | tectonic | ❌ 不可修改 |
| elevTex | elevation, erosion, lakes | ✅ 侵蚀和湖泊可修改高程 |
| coastDist | coastline | ❌ |
| currentTex | currents | ❌ |
| tempTex, moistTex | climate | ❌ |
| iceTex | ice | ❌ |
| biomeTex | biomes | ❌ |
| riverTex | rivers | ❌ |
| watershedTex | watershed | ❌ |
| volcanismTex | volcanism | ❌ |
| seasonTex | seasons | ❌ |

此规则保证checkpoint引用安全。如果某个阶段确实需要修改前序纹理，由该阶段负责创建副本（copy-on-write）。

### 4.6 工厂函数与入口

```typescript
// packages/shared/src/pipeline/factory.ts

export function createDefaultPipeline(): PipelineOrchestrator {
  const pipeline = new PipelineOrchestrator();
  [
    new TectonicStage(),
    new ElevationStage(),
    new ErosionStage(),
    new CoastlineStage(),
    new CurrentsStage(),
    new ClimateStage(),
    new IceStage(),
    new BiomesStage(),
    new LakesStage(),
    new RiversStage(),
    new WatershedStage(),
    new VolcanismStage(),
    new SeasonsStage(),
    new RegionsStage(),
    new NamingStage(),
    new PackingStage(),
  ].forEach(s => pipeline.register(s));
  return pipeline;
}

// 支持自定义阶段组合
export function createPipeline(customStages?: Stage[]): PipelineOrchestrator;
```

```typescript
// packages/shared/src/index.ts（重构后）

import { createDefaultPipeline } from './pipeline/factory';

/**
 * @deprecated Use createPipeline() for better control over stages,
 *             progress reporting, checkpoints, and cancellation.
 */
export function generateMap(
  params: MapParams,
  seed: number,
  progressCallback?: (phase: string, fraction: number, phaseLabel?: string) => void
): MapData {
  const pipeline = createDefaultPipeline();
  // 同步桥接：pipeline.run是async的，但旧API是同步的
  // 实际执行所有stage都是同步的（内部无await），直接执行即可
  let result: MapData | undefined;
  const runPromise = pipeline.run(params, seed, {
    onProgress: p => progressCallback?.(p.stage, p.overallFraction, p.stageLabel),
  }).then(r => { result = r; });
  // 由于所有stage都是纯CPU计算且无await，promise在同一事件循环内resolve
  // 使用Atomics.wait在Worker中安全等待，或直接调用内部runSync
  if (!result) {
    throw new Error('Pipeline should have completed synchronously');
  }
  return result;
}

export { createDefaultPipeline as createPipeline } from './pipeline/factory';
```

**同步API兼容说明**：所有stage都是同步CPU计算（无IO、无await），`pipeline.run()` 虽然返回Promise但实际是同步完成的。在重构中，可以添加一个 `runSync()` 方法供旧的同步 `generateMap` 调用，避免微任务调度开销。

---

## 5. 参数验证与错误处理

### 5.1 Zod Schema

```typescript
// packages/shared-types/src/validation.ts

import { z } from 'zod';

// 约束常量
export const CONSTRAINTS = {
  minSize: 64, maxSize: 4096,
  minOctaves: 1, maxOctaves: 10,
  sizeWarningThreshold: 1024 * 1024,
} as const;

// 子schema
const NoiseParamsSchema = z.object({
  scale: z.number().positive().default(0.008),
  octaves: z.number().int().min(1).max(10).default(6),
  persistence: z.number().min(0.1).max(0.9).default(0.55),
  lacunarity: z.number().min(1.5).max(3.5).default(2.1),
  noiseType: z.enum(['perlin','simplex','value','worley']).default('simplex'),
  fbmVariant: z.enum(['standard','ridged','billowy','warped']).default('ridged'),
  warpStrength: z.number().min(0).max(2).default(0.5),
});

// ... TectonicParamsSchema, ErosionParamsSchema 等（同理）

export const MapParamsSchema = z.object({
  width: z.number().int().min(64).max(4096).default(512),
  height: z.number().int().min(64).max(4096).default(512),
  seed: z.union([z.string(), z.number()]).default(''),
  renderStyle: z.enum([...]).default('terrain'),
  stylePreset: z.string().default('subtle-continents'),
  seaLevel: z.number().min(-1).max(1).default(0.04),
  seaMode: z.enum(['auto','land','water','mixed']).default('auto'),
  blankMode: z.boolean().default(false),

  noise: NoiseParamsSchema.default({}),
  tectonic: TectonicParamsSchema.default({}),
  // ... 其他子对象

  enableOceanCurrents: z.boolean().default(true),
  // ... 其他开关
}).passthrough();

// 验证结果类型
export interface ValidationError {
  path: string; message: string;
  code: 'too_small'|'too_big'|'invalid_type'|'invalid_enum'|'custom';
}

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: ValidationError[] };

// 验证函数
export function validateParams(input: unknown): ValidationResult<MapParams>;
export function normalizeParams(input: Partial<MapParams>): MapParams;
```

**跨字段警告**（不阻止生成，但提示用户）：
- 尺寸 > 1024×1024 且 octaves > 6：性能警告
- plateCount > 30：性能警告
- erosionIterations > 100：性能警告

### 5.2 错误码使用规范

| 错误码 | 触发场景 | 来源 |
|--------|---------|------|
| VALIDATION_ERROR | 参数不合法 | validateParams() |
| GENERATION_ABORTED | AbortSignal触发 | PipelineOrchestrator |
| GENERATION_FAILED | 阶段执行异常 | Stage.run() |
| OUT_OF_MEMORY | Float32Array分配失败 | Context创建时 |
| NETWORK_ERROR | fetch失败/网络断开 | RemoteProvider |
| TIMEOUT | 请求超时 | RemoteProvider |
| BACKEND_UNAVAILABLE | 后端连接失败且无fallback | RemoteProvider |
| MAP_NOT_FOUND | loadMap(id)不存在 | Provider |
| STORAGE_QUOTA_EXCEEDED | localStorage/IndexedDB满 | LocalProvider.saveMap |

---

## 6. 依赖注入设计

### 6.1 Worker 抽象

```typescript
// packages/web/src/engine/worker.ts

export interface MapGenWorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((ev: { data: WorkerResponse }) => void) | null;
  onerror: ((ev: ErrorEvent) => void) | null;
}

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'generate'; id: string; params: MapParams; seed: number }
  | { type: 'abort'; id: string }
  | { type: 'dispose' };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; id: string; phase: string; fraction: number; label: string }
  | { type: 'checkpoint'; id: string; label: string; data: Partial<MapData> }
  | { type: 'complete'; id: string; mapData: MapData }
  | { type: 'error'; id: string; error: MapGenError };
```

### 6.2 DI 容器

```typescript
// packages/web/src/engine/EngineDeps.ts

export interface EngineDeps {
  createWorker(): MapGenWorkerLike;
  storage: StorageAdapter;
  fetchImpl: typeof fetch;
  eventSourceFactory: (url: string) => EventSource;
  logger?: { log: (...args: any[]) => void; error: (...args: any[]) => void };
}

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const localStorageAdapter: StorageAdapter = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  remove: (k) => localStorage.removeItem(k),
};

const defaultDeps: EngineDeps = {
  createWorker: () => new Worker(new URL('../mapGenWorker.ts', import.meta.url), { type: 'module' }),
  storage: localStorageAdapter,
  fetchImpl: (...args) => fetch(...args),
  eventSourceFactory: (url) => new EventSource(url),
  logger: console,
};

let currentDeps: EngineDeps = { ...defaultDeps };

export function configureDeps(deps: Partial<EngineDeps>): void {
  currentDeps = { ...defaultDeps, ...deps };
}

export function getDeps(): EngineDeps {
  return currentDeps;
}

// 测试工具：重置为默认依赖
export function resetDeps(): void {
  currentDeps = { ...defaultDeps };
}
```

### 6.3 LocalProvider 重构要点

```typescript
// packages/web/src/engine/local.ts

export class LocalProvider implements MapGenEngine {
  private worker: MapGenWorkerLike | null = null;
  private pendingJobs = new Map<string, PendingJob>();
  private jobCounter = 0;

  constructor(private deps: EngineDeps = getDeps()) {
    this.ensureWorker();
  }

  async generate(
    params: MapParams,
    onProgress?: (p: GenerationProgress) => void,
    signal?: AbortSignal
  ): Promise<Result<GenerationResult>> {
    // 1. 参数验证（在主线程快速失败）
    const validation = validateParams(params);
    if (!validation.ok) {
      return err(createError('VALIDATION_ERROR', '参数验证失败', { errors: validation.errors }));
    }

    const id = `job-${++this.jobCounter}`;
    const seed = this.resolveSeed(validation.value.seed);

    return new Promise((resolve) => {
      this.pendingJobs.set(id, { resolve, onProgress, signal });

      signal?.addEventListener('abort', () => {
        this.deps.logger?.log('Job aborted, terminating worker');
        this.worker?.postMessage({ type: 'abort', id });
        // terminate worker and recreate for next job
        this.worker?.terminate();
        this.worker = null;
        const job = this.pendingJobs.get(id);
        if (job) {
          this.pendingJobs.delete(id);
          job.resolve(err(createError('GENERATION_ABORTED', '生成已取消')));
        }
        this.ensureWorker();
      }, { once: true });

      this.ensureWorker();
      this.worker!.postMessage({ type: 'generate', id, params: validation.value, seed });
    });
  }

  // ... 其他方法使用 this.deps.storage 等
}
```

---

## 7. UI 组件化设计

### 7.1 组件基类

```typescript
// packages/web/src/ui/Component.ts

export abstract class Component<T extends HTMLElement = HTMLElement> {
  protected el: T;
  private handlers: Array<{ target: EventTarget; type: string; listener: EventListener; options?: any }> = [];
  private children: Component[] = [];
  private _mounted = false;

  constructor(protected parent: HTMLElement | Component | null = null) {
    this.el = this.createRootElement();
  }

  protected abstract createRootElement(): T;
  get element(): T { return this.el; }
  isMounted(): boolean { return this._mounted; }

  protected listen<K extends keyof HTMLElementEventMap>(
    target: EventTarget, type: K,
    listener: (ev: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener as EventListener, options);
    this.handlers.push({ target, type, listener: listener as EventListener, options });
  }

  protected addChild<C extends Component>(child: C, container?: HTMLElement): C {
    (container ?? this.el).appendChild(child.el);
    this.children.push(child);
    if (this._mounted && !child._mounted) {
      child._mounted = true;
      child.onMount();
      child.mountChildren();
    }
    return child;
  }

  mount(container?: HTMLElement): void {
    const parentEl = container ?? (this.parent instanceof Component ? this.parent.el : this.parent);
    parentEl?.appendChild(this.el);
    this._mounted = true;
    this.onMount();
    this.mountChildren();
  }

  private mountChildren(): void {
    this.children.forEach(c => {
      if (!c._mounted) {
        c._mounted = true;
        c.onMount();
        c.mountChildren();
      }
    });
  }

  unmount(): void {
    this.children.forEach(c => c.unmount());
    this.handlers.forEach(({ target, type, listener, options }) =>
      target.removeEventListener(type, listener, options));
    this.children = [];
    this.handlers = [];
    this.onUnmount();
    this.el.remove();
    this._mounted = false;
  }

  protected $<E extends HTMLElement = HTMLElement>(sel: string): E | null { return this.el.querySelector(sel); }
  protected $$<E extends HTMLElement = HTMLElement>(sel: string): NodeListOf<E> { return this.el.querySelectorAll(sel); }

  onMount(): void {}
  onUnmount(): void {}
}
```

**特性**：
- 自动事件监听清理：`this.listen()` 注册的事件在unmount时自动移除
- 自动子组件生命周期管理：addChild注册的子组件自动mount/unmount
- 作用域DOM查询：`this.$()` 在组件根元素内查询，避免全局选择器冲突

### 7.2 轻量响应式 Store

```typescript
// packages/web/src/core/store.ts

export class Store<T> {
  private value: T;
  private listeners = new Set<(v: T, old: T) => void>();

  constructor(initial: T) { this.value = initial; }

  get(): T { return this.value; }
  set(v: T): void {
    if (Object.is(this.value, v)) return;
    const old = this.value; this.value = v;
    this.listeners.forEach(l => l(v, old));
  }
  update(fn: (cur: T) => T): void { this.set(fn(this.value)); }
  subscribe(fn: (v: T, old: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function derived<S extends any[], D>(
  stores: { [K in keyof S]: Store<S[K]> },
  compute: (...values: S) => D
): Store<D> {
  const values = stores.map(s => s.get()) as S;
  const result = new Store(compute(...values));
  stores.forEach((s, i) => {
    s.subscribe(() => {
      const newValues = stores.map(s => s.get()) as S;
      result.set(compute(...newValues));
    });
  });
  return result;
}
```

### 7.3 组件树结构

```
MapGenApp (app.ts)
├── Toolbar (ui/toolbar/Toolbar.ts)
│   ├── SidebarToggleButton
│   ├── GenerateButton
│   ├── BackendSelector
│   ├── StylePicker
│   ├── ViewportToolbar
│   └── ExportMenu
├── CanvasHost (ui/canvas/CanvasHost.ts)
│   └── CanvasOverlay (名称标注层)
├── Sidebar (ui/sidebar/Sidebar.ts)
│   ├── SeedCard
│   ├── PresetsCard
│   ├── TerrainCard
│   ├── NoiseCard
│   ├── TectonicCard
│   ├── ErosionCard
│   ├── RiversCard
│   ├── ClimateCard
│   ├── BiomesCard
│   ├── WorldFeaturesCard
│   └── DebugCard
└── StatusBar (ui/statusbar/StatusBar.ts)
    ├── ProgressBar
    ├── StatusLabel
    ├── SizeLabel
    ├── BackendLabel
    └── TimerLabel
```

### 7.4 AppState（基于Store）

```typescript
// packages/web/src/core/appState.ts

export interface GenerationStatus {
  state: 'idle'|'generating'|'error'|'completed';
  progress: number; phase: string; phaseLabel: string;
  error?: string; elapsedMs?: number;
}

export interface AppState {
  params: Store<MapParams>;
  mapData: Store<MapData|null>;
  generationStatus: Store<GenerationStatus>;
  backendUrl: Store<string>;
  backendCapabilities: Store<EngineCapabilities|null>;
  zoom: Store<number>;
  renderStyle: Store<RenderStyle>;
  sidebarCollapsed: Store<boolean>;
  canvasSize: Store<{width:number; height:number}>;
}
```

### 7.5 组件绑定模式

每个Card组件模式统一：

```typescript
// 模板：ui/sidebar/cards/XxxCard.ts
export class XxxCard extends Component<HTMLDivElement> {
  private unsubs: Array<()=>void> = [];

  protected createRootElement(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'card xxx-card';
    el.innerHTML = `...静态HTML模板...`;
    return el;
  }

  onMount(): void {
    const state = getAppState();
    // 1. 获取DOM引用
    // 2. 初始化UI值
    // 3. 绑定DOM事件 → state.params.update()
    // 4. 订阅store变化 → 更新DOM
  }

  onUnmount(): void {
    this.unsubs.forEach(u => u());
  }
}
```

### 7.6 重构后 app.ts 示例

```typescript
// packages/web/src/app.ts

class MapGenApp {
  private toolbar!: Toolbar;
  private sidebar!: Sidebar;
  private canvasHost!: CanvasHost;
  private statusBar!: StatusBar;
  private engine!: MapGenEngine;

  async init(): Promise<void> {
    configureDeps({});

    const defaults = getDefaultParams();
    createAppState(defaults);

    const root = document.getElementById('app')!;
    this.toolbar = new Toolbar();
    this.canvasHost = new CanvasHost();
    this.sidebar = new Sidebar();
    this.statusBar = new StatusBar();

    this.toolbar.mount(root);
    this.canvasHost.mount(root);
    this.sidebar.mount(root);
    this.statusBar.mount(root);

    this.engine = createEngineProvider();
    await this.restoreCheckpoint();

    if (!getAppState().mapData.get()) {
      requestAnimationFrame(() => this.generate());
    }
  }

  async generate(): Promise<void> {
    const state = getAppState();
    const params = state.params.get();
    state.generationStatus.set({ state:'generating', progress:0, phase:'', phaseLabel:'' });

    const result = await this.engine.generate(
      params,
      (p) => state.generationStatus.update(s => ({
        ...s, progress:p.fraction, phase:p.phase, phaseLabel:p.phaseLabel
      })),
    );

    if (result.ok) {
      state.mapData.set(result.value.mapData);
      state.generationStatus.set({ state:'completed', progress:1, phase:'done', phaseLabel:'完成' });
    } else {
      state.generationStatus.set({ state:'error', progress:0, phase:'error',
        phaseLabel:'错误', error:result.error.message });
    }
  }
}

const app = new MapGenApp();
app.init();
```

---

## 8. 后端对齐

### 8.1 类型导入变更

```typescript
// packages/server/src/services/mapEngine.ts 改造后
import type { MapParams, MapData, GenerationProgress, Result } from '@mapgen/shared-types';
import { validateParams, createError, ok, err } from '@mapgen/shared-types';
import { createPipeline } from '@mapgen/core';

// 不再在server内重复定义MapParams/MapData
// 使用validateParams替代自定义Zod schema
```

### 8.2 API响应类型

```typescript
// packages/shared-types/src/api.ts

export namespace ApiV1 {
  // GET /health
  export type HealthResponse = { status: string; version: string; capabilities: EngineCapabilities };

  // POST /generate
  export type GenerateRequest = MapParams;
  export type GenerateResponse = { jobId: string; status: 'queued' };

  // GET /jobs/{id}
  export type JobStatus =
    | { jobId: string; status: 'queued'|'processing'; progress: GenerationProgress }
    | { jobId: string; status: 'completed'; result: { mapData: SerializedMapData } }
    | { jobId: string; status: 'failed'; error: MapGenError };

  // Maps CRUD
  export type CreateMapRequest = { mapData: SerializedMapData; meta?: MapMeta };
  export type CreateMapResponse = SavedMapRef;
  export type ListMapsResponse = SavedMapSummary[];
  // ...
}
```

---

## 9. 实施路线

### 阶段1：类型统一 + Pipeline框架（P0）

| 步骤 | 内容 | 验证 |
|------|------|------|
| 1.1 | 在shared-types新增texture.ts/validation.ts/api.ts，补全类型定义 | `npm run typecheck -w @mapgen/shared-types` |
| 1.2 | 创建Stage/PipelineContext/PipelineOrchestrator/CheckpointManager | 编译通过 |
| 1.3 | 改造现有6个stage实现Stage接口 | 单元测试通过 |
| 1.4 | 新createPipeline() API + runSync() | 能生成地图 |
| 1.5 | 旧generateMap委托createPipeline（保持同步API） | 现有所有测试通过 |
| 1.6 | @mapgen/core/src/types.ts改为re-export，标记deprecated | 无类型错误 |

**验收标准**：
- `npm test -w @mapgen/core` 全部通过
- `npm run dev` 可正常生成地图（行为与重构前一致）
- 无TypeScript类型错误

### 阶段2：补齐10个缺失Stages（P0）

按顺序逐个从原generateMap提取：
1. erosionStage（从elevationStage拆分侵蚀循环）
2. coastlineStage（海岸距离场）
3. currentsStage + iceStage + biomesStage + lakesStage + watershedStage + volcanismStage + seasonsStage + namingStage

**验收标准**：
- 每个stage有独立单元测试
- 快照测试：新旧pipeline对相同seed生成相同结果（允许浮点精度误差<0.01）
- 所有enable*开关正确控制stage执行

### 阶段3：DI + Provider改进（P1）

| 步骤 | 内容 |
|------|------|
| 3.1 | 创建EngineDeps.ts/worker.ts |
| 3.2 | 重构LocalProvider（DI、Result类型、参数验证） |
| 3.3 | 重构RemoteProvider（Result类型、Zod响应验证） |
| 3.4 | 重构mapGenWorker使用新Pipeline API |
| 3.5 | 更新actions.ts使用Result返回 |

**验收标准**：
- LocalProvider单元测试（使用mock worker）
- RemoteProvider单元测试（使用mock fetch/EventSource）
- 本地生成功能正常

### 阶段4：Store + UI组件化（P1）

| 步骤 | 内容 |
|------|------|
| 4.1 | 创建store.ts和Component基类 |
| 4.2 | 重构appState.ts为Store-based |
| 4.3 | 实现Toolbar/StatusBar/CanvasHost组件 |
| 4.4 | 实现Sidebar和所有Card组件 |
| 4.5 | 重构app.ts为MapGenApp类 |

**验收标准**：
- UI功能与重构前完全一致
- 无内存泄漏（组件unmount后事件监听器正确清理）
- Lighthouse性能评分不下降

### 阶段5：后端对齐（P2）

**验收标准**：
- server使用shared-types统一类型
- API层使用共享Zod schema验证
- `npm run dev:all` 前后端联调正常

---

## 10. 测试策略

| 测试层 | 工具 | 覆盖范围 |
|--------|------|---------|
| Stage单元测试 | vitest | 每个stage的输入/输出契约 |
| Pipeline集成测试 | vitest | 完整管线端到端、取消、checkpoint恢复 |
| 快照对比测试 | vitest | 新旧pipeline输出一致性 |
| 参数验证测试 | vitest | Zod schema边界值、跨字段警告 |
| LocalProvider测试 | vitest + mock Worker | 消息协议、取消、错误处理 |
| RemoteProvider测试 | vitest + msw | HTTP/SSE协议、降级逻辑 |
| Component测试 | vitest + happy-dom | 渲染、事件绑定、store订阅 |
| Server API测试 | vitest + Hono test helper | REST端点、验证、错误码 |
| E2E测试 | Playwright | 本地模式、远程模式、导出 |

---

## 11. 新增/修改依赖

| 包 | 操作 | 位置 | 用途 |
|----|------|------|------|
| zod | 新增依赖 | @mapgen/shared-types | 参数验证schema |
| zod | 升级/已存在 | @mapgen/server | 复用shared-types的schema |

不新增其他运行时依赖。所有UI组件、Store、DI容器均为原生TypeScript实现。

---

## 12. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 新pipeline输出与旧generateMap不一致 | 中 | 高 | 快照对比测试，逐stage迁移验证 |
| 旧API同步/异步桥接问题 | 低 | 中 | 添加runSync()同步方法，Worker中不使用await |
| 组件基类事件清理遗漏 | 低 | 中 | 提供listen()辅助方法强制自动清理 |
| 类型循环依赖 | 中 | 中 | shared-types无内部依赖，core→shared-types单向 |
| Checkpoint引用被错误修改 | 低 | 高 | 文档化纹理所有权规则，fuzz测试恢复 |

---

## 13. 不在本次范围内的功能

以下内容保持现状，不在本次重构中变更：
- 渲染器实现（WebGL/P5/Canvas2D）
- 噪声/构造/侵蚀/气候等核心算法逻辑
- 编辑器子系统（v2规划）
- 地图持久化UI界面
- 后端SQLite存储实现
