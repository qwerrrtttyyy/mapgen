# MapGen 重构实施计划

> 基于已批准的 [design.md](design.md)。采用 TDD：每个任务先写测试，再写实现，最后重构。

---

## 阶段 1：基础数据结构（TDD）

### 任务 1.1：实现 LRUCache
**目标**：为噪声表与检查点缩略图提供 O(1) 读写缓存。

**文件**：
- 测试：`packages/shared/src/structs/__tests__/lru.test.ts`
- 实现：`packages/shared/src/structs/lru.ts`

**实现代码**：
```typescript
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const v = this.cache.get(key);
    if (v === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean { return this.cache.has(key); }
  clear(): void { this.cache.clear(); }
}
```

**测试要点**：
- `get` 命中后节点移至最近使用。
- 容量满时淘汰最久未使用。
- `clear` 后为空。

**验证**：`npm run test --workspace=@mapgen/core`

---

### 任务 1.2：实现 BinaryHeap
**目标**：河流源头优先级队列与任务调度。

**文件**：
- 测试：`packages/shared/src/structs/__tests__/heap.test.ts`
- 实现：`packages/shared/src/structs/heap.ts`

**实现代码**：
```typescript
export class BinaryHeap<T> {
  private heap: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return top;
  }

  peek(): T | undefined { return this.heap[0]; }
  get size(): number { return this.heap.length; }

  private bubbleUp(i: number): void {
    const item = this.heap[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(item, this.heap[parent]) >= 0) break;
      this.heap[i] = this.heap[parent];
      i = parent;
    }
    this.heap[i] = item;
  }

  private sinkDown(i: number): void {
    const item = this.heap[i];
    const n = this.heap.length;
    while (true) {
      const left = i * 2 + 1;
      if (left >= n) break;
      const right = left + 1;
      let min = left;
      if (right < n && this.compare(this.heap[right], this.heap[left]) < 0) min = right;
      if (this.compare(item, this.heap[min]) <= 0) break;
      this.heap[i] = this.heap[min];
      i = min;
    }
    this.heap[i] = item;
  }
}
```

**测试要点**：最小堆升序弹出、空堆行为、`peek` 不修改堆。

**验证**：`npm run test --workspace=@mapgen/core`

---

### 任务 1.3：实现 RingBuffer
**目标**：参数历史与撤销栈。

**文件**：
- 测试：`packages/web/src/structs/__tests__/ringBuffer.test.ts`
- 实现：`packages/web/src/structs/ringBuffer.ts`

**实现代码**：
```typescript
export class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  pop(): T | undefined {
    if (this.count === 0) return undefined;
    this.head = (this.head - 1 + this.capacity) % this.capacity;
    this.count--;
    return this.buffer[this.head];
  }

  peek(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  get size(): number { return this.count; }
  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      out.push(this.buffer[idx]);
    }
    return out;
  }
}
```

**测试要点**：容量环绕、push/pop/peek、toArray 顺序。

**验证**：`npm run test --workspace=@mapgen/web`

---

### 任务 1.4：实现 QuadTree 与 SpatialGrid
**目标**：空间索引加速区域/河流查询。

**文件**：
- 测试：`packages/shared/src/spatial/__tests__/quadtree.test.ts`、`grid.test.ts`
- 实现：`packages/shared/src/spatial/quadtree.ts`、`grid.ts`

**实现代码（SpatialGrid）**：
```typescript
export interface PointLike { x: number; y: number; }

export class SpatialGrid<T extends PointLike> {
  private cells: T[][] = [];
  private cols: number;
  private rows: number;

  constructor(private width: number, private height: number, private cellSize: number) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  insert(item: T): void {
    const idx = this.index(item.x, item.y);
    if (idx >= 0) this.cells[idx].push(item);
  }

  queryRadius(x: number, y: number, r: number): T[] {
    const result: T[] = [];
    const minX = Math.max(0, Math.floor((x - r) / this.cellSize));
    const maxX = Math.min(this.cols - 1, Math.floor((x + r) / this.cellSize));
    const minY = Math.max(0, Math.floor((y - r) / this.cellSize));
    const maxY = Math.min(this.rows - 1, Math.floor((y + r) / this.cellSize));
    const r2 = r * r;
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        for (const item of this.cells[cy * this.cols + cx]) {
          const dx = item.x - x, dy = item.y - y;
          if (dx * dx + dy * dy <= r2) result.push(item);
        }
      }
    }
    return result;
  }

  private index(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }
}
```

**QuadTree** 采用标准四叉树实现（边界框+容量+细分）。

**测试要点**：插入与半径查询结果正确、边界外插入不崩溃、QuadTree 细分后查询完整。

**验证**：`npm run test --workspace=@mapgen/core`

---

## 阶段 2：Worker 生成管线

### 任务 2.1：创建 Worker 入口与消息协议
**目标**：在 Worker 中运行 `generateMap`，主线程通过消息通信。

**文件**：
- 实现：`packages/web/src/worker/mapWorker.ts`
- 类型：`packages/web/src/worker/messages.ts`

**messages.ts**：
```typescript
import type { MapParams, MapData } from '@mapgen/core';

export type WorkerRequest =
  | { type: 'generate'; params: MapParams; id: number }
  | { type: 'abort'; id: number };

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: number; phaseName: string }
  | { type: 'complete'; id: number; mapData: MapData }
  | { type: 'error'; id: number; message: string };
```

**mapWorker.ts**：
```typescript
import { generateMap } from '@mapgen/core';
import type { WorkerRequest, WorkerResponse } from './messages.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let currentId: number | null = null;

ctx.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type === 'generate') {
    currentId = req.id;
    try {
      const { mapData } = generateMap(req.params, (progress, phaseName) => {
        ctx.postMessage({ type: 'progress', id: req.id, progress, phaseName } as WorkerResponse);
      });
      const transferable = [
        mapData.plateTex.buffer, mapData.elevTex.buffer, mapData.moistTex.buffer,
        mapData.riverTex.buffer, mapData.tempTex.buffer,
      ];
      ctx.postMessage({ type: 'complete', id: req.id, mapData } as WorkerResponse, transferable);
    } catch (err) {
      ctx.postMessage({ type: 'error', id: req.id, message: String(err) } as WorkerResponse);
    }
  } else if (req.type === 'abort') {
    // 当前实现简单丢弃结果；后续可接入 AbortSignal
    if (currentId === req.id) currentId = null;
  }
});
```

**验证**：Worker 能响应 `generate` 消息并返回 `MapData`。

---

### 任务 2.2：创建 MapGeneratorClient
**目标**：主线程封装 Worker，提供 Promise API 与进度回调。

**文件**：
- 实现：`packages/web/src/core/mapGeneratorClient.ts`
- 测试：`packages/web/src/core/__tests__/mapGeneratorClient.test.ts`（可选，Worker 测试较复杂）

**实现代码**：
```typescript
import type { MapParams, MapData } from '@mapgen/core';
import type { WorkerRequest, WorkerResponse } from '../worker/messages.js';

export class MapGeneratorClient {
  private worker: Worker;
  private id = 0;
  private pending = new Map<number, {
    resolve: (data: MapData) => void;
    reject: (err: Error) => void;
    onProgress?: (p: number, phase: string) => void;
  }>();

  constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') p.onProgress?.(msg.progress, msg.phaseName);
      else if (msg.type === 'complete') {
        this.pending.delete(msg.id);
        p.resolve(msg.mapData);
      } else if (msg.type === 'error') {
        this.pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
    });
  }

  generate(params: MapParams, onProgress?: (p: number, phase: string) => void): Promise<MapData> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ type: 'generate', params, id } as WorkerRequest);
    });
  }

  destroy(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
```

**验证**：在 app.ts 中实例化后可调用 `generate()`，生成期间 UI 不冻结。

---

### 任务 2.3：集成 Worker 到 app.ts
**目标**：替换同步 `generateMapAction` 为异步 Worker 调用。

**文件**：`packages/web/src/app.ts`

**修改点**：
1. 引入 `MapGeneratorClient`。
2. 在 `DOMContentLoaded` 中创建 client：`const generator = new MapGeneratorClient(new URL('../worker/mapWorker.ts', import.meta.url).href);`
3. 监听 `generating.completed` 时改为 client.generate 完成后触发。
4. `ProgressView` 订阅 `generating.progress`。

**关键代码**：
```typescript
const generator = new MapGeneratorClient(new URL('./worker/mapWorker.ts', import.meta.url).href);

bus.on('generate.request', async () => {
  state.isGenerating = true;
  bus.emit('generating.started');
  try {
    const params = toMapParams(state.params);
    const mapData = await generator.generate(params, (progress, phaseName) => {
      bus.emit('generating.progress', { progress, phaseName });
    });
    state.mapData = mapData;
    bus.emit('generating.completed', { mapData });
  } catch (err) {
    bus.emit('generating.failed', String(err));
  } finally {
    state.isGenerating = false;
  }
});
```

**验证**：
- 生成地图时主线程 UI 保持响应。
- 进度条正常更新。
- 浏览器 DevTools Performance 中无长任务。

---

## 阶段 3：渲染优化

### 任务 3.1：实现 RenderLoop
**目标**：统一动画帧调度，避免重复绘制。

**文件**：
- 实现：`packages/web/src/render/renderLoop.ts`
- 测试：`packages/web/src/render/__tests__/renderLoop.test.ts`

**实现代码**：
```typescript
export class RenderLoop {
  private rafId: number | null = null;
  private running = false;
  private needsRender = false;

  constructor(private renderFn: () => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  requestRender(): void {
    this.needsRender = true;
    if (!this.running) this.start();
  }

  private tick = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    if (this.needsRender) {
      this.needsRender = false;
      this.renderFn();
    }
  };
}
```

**验证**：连续调用 `requestRender()` 只触发一次 `renderFn`；`stop()` 取消后续帧。

---

### 任务 3.2：WebGL 批量 Uniform 更新
**目标**：减少 render 中 JS→GPU 调用次数。

**文件**：`packages/web/src/renderer/webgl.ts`、`packages/web/src/renderer/renderParams.ts`

**修改点**：
1. `WebGLRenderer.render(params)` 内部缓存 `lastParams`，仅对变化项调用 `setUniform`。
2. 新增 `uniformsDirty` 标记；`setUniform` 只做差异更新。

**关键代码**：
```typescript
private lastParams: RenderParams = {};

render(params: RenderParams): void {
  // ...bind textures...
  for (const [key, value] of Object.entries(params)) {
    if (!this.paramEqual(this.lastParams[key], value)) {
      this.setUniform(key, value);
      this.lastParams[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  // 始终更新的 uniforms
  this.setUniform('u_resolution', [w, h]);
  this.setUniform('u_time', performance.now() * 0.001);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

private paramEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}
```

**验证**：切换渲染风格时 GPU 命令数（SpectorJS/Chrome）显著减少。

---

### 任务 3.3：纹理去重上传
**目标**：地图数据未变时不重复上传纹理。

**文件**：`packages/web/src/renderer/webgl.ts`

**修改点**：
1. `uploadMapData` 记录 `lastMapDataSignature`（width+height+seed）。
2. 签名相同则跳过全部 `texImage2D`。

**关键代码**：
```typescript
private lastSignature = '';

uploadMapData(data: MapData): void {
  const sig = `${data.width}x${data.height}x${data.seed}`;
  if (sig === this.lastSignature) return;
  this.lastSignature = sig;
  // ...existing upload logic...
}
```

**验证**：连续生成相同种子地图时，第二次不调用 `uploadMapData` 纹理上传。

---

## 阶段 4：算法优化

### 任务 4.1：噪声缓存 NoiseCache
**目标**：相同种子复用噪声排列表。

**文件**：
- 实现：`packages/shared/src/noiseCache.ts`
- 修改：`packages/shared/src/noise.ts` 使用缓存
- 测试：`packages/shared/src/__tests__/noiseCache.test.ts`

**实现代码**：
```typescript
import { LRUCache } from './structs/lru.js';

export interface NoiseTables {
  perm: Uint8Array;
  grad: Float32Array;
}

const cache = new LRUCache<string, NoiseTables>(16);

export function getNoiseTables(seed: number, type: string): NoiseTables {
  const key = `${type}:${seed}`;
  let t = cache.get(key);
  if (!t) {
    t = buildTables(seed, type);
    cache.set(key, t);
  }
  return t;
}

function buildTables(seed: number, type: string): NoiseTables {
  // 将原 createNoise 中的排列/梯度表生成逻辑抽到这里
}
```

**验证**：连续两次 `createNoise(seed, type)` 的表生成耗时第二次接近 0。

---

### 任务 4.2：侵蚀模拟向量化
**目标**：减少 `hydraulicErosion` 中的逐点开销。

**文件**：`packages/shared/src/erosion.ts`

**修改点**：
1. 预计算全局梯度场（两个 `Float32Array`）。
2. 使用块大小 64 的分块循环替代完全随机访问，提高缓存命中率。
3. 内联沉积/侵蚀计算，避免多次函数调用。

**关键代码（骨架）**：
```typescript
function computeGradient(elevation: Float32Array, width: number, height: number): Float32Array {
  const gx = new Float32Array(elevation.length);
  const gy = new Float32Array(elevation.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      gx[i] = (elevation[i + 1] - elevation[i - 1]) * 0.5;
      gy[i] = (elevation[i + width] - elevation[i - width]) * 0.5;
    }
  }
  return gx; // 返回 combined 或分开
}
```

**验证**：侵蚀阶段耗时下降 ≥ 20%；输出与优化前视觉一致（Playwright 截图对比）。

---

### 任务 4.3：河流生成优先级队列
**目标**：按海拔+湿度优先级选择源头。

**文件**：`packages/shared/src/rivers.ts`

**修改点**：
1. 将潜在源头按 `score = elevation * 0.6 + moisture * 0.4` 入堆。
2. 每次 `pop` 一个源头生成河流，直到达到数量上限。

**关键代码**：
```typescript
import { BinaryHeap } from './structs/heap.js';

const heap = new BinaryHeap<{ idx: number; score: number }>((a, b) => b.score - a.score);
// 填充 heap...
while (rivers.length < riverCount && heap.size > 0) {
  const src = heap.pop()!;
  // generate river from src.idx
}
```

**验证**：河流分布更集中于山区与湿润区域；单元测试验证堆顺序。

---

## 阶段 5：主题与 UI

### 任务 5.1：ThemeManager + CSS 设计令牌
**目标**：实现 Aurora / Parchment 双主题切换。

**文件**：
- 实现：`packages/web/src/ui/themeManager.ts`
- 样式：`packages/web/public/theme.css`
- 入口：在 `index.html` 引入 `theme.css`

**theme.css（节选）**：
```css
:root {
  --mg-bg: #0b0c15;
  --mg-surface: rgba(20, 22, 36, 0.78);
  --mg-surface-solid: #141624;
  --mg-primary: #64ffda;
  --mg-accent: #a78bfa;
  --mg-text: #e8eaf6;
  --mg-text-secondary: #9aa0b8;
  --mg-border: rgba(255,255,255,0.10);
  --mg-glass-blur: 18px;
  --mg-radius: 16px;
  --mg-radius-sm: 10px;
  --mg-shadow: 0 12px 40px rgba(0,0,0,0.45);
}

[data-theme="parchment"] {
  --mg-bg: #f5f0e6;
  --mg-surface: rgba(255, 253, 248, 0.86);
  --mg-surface-solid: #fffdf8;
  --mg-primary: #8b5a2b;
  --mg-accent: #2e7d6f;
  --mg-text: #2a2520;
  --mg-text-secondary: #6b6358;
  --mg-border: rgba(0,0,0,0.08);
  --mg-shadow: 0 8px 28px rgba(60,50,30,0.12);
}
```

**themeManager.ts**：
```typescript
const THEME_KEY = 'mapgen:theme';
export type Theme = 'aurora' | 'parchment';

export function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  setTheme(saved ?? 'aurora');
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme') as Theme;
  setTheme(current === 'aurora' ? 'parchment' : 'aurora');
}
```

**验证**：
- 切换主题时所有 UI 颜色即时变化。
- 刷新后主题持久化。

---

### 任务 5.2：重写 index.html 结构
**目标**：适配新主题与组件化布局。

**文件**：`packages/web/index.html`

**修改点**：
1. 引入 Google Fonts（带 SRI）与 `theme.css`。
2. 顶部栏改为浮岛工具栏。
3. 抽屉改为可折叠卡片容器。
4. 保留 `#glCanvas`、`#progress-container`。

**关键结构**：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="style.css">

<div id="app">
  <div id="drawer-backdrop"></div>
  <nav id="drawer" class="glass-panel">
    <div class="drawer-header">
      <h1>MapGen</h1>
      <span class="version">v0.1.0</span>
    </div>
    <div id="param-panels"></div>
    <div id="checkpoint-section"></div>
  </nav>
  <main id="main">
    <header id="app-bar" class="glass-toolbar">
      <button id="menu-toggle" aria-label="菜单">☰</button>
      <span class="title">Aurora Cartographer</span>
      <button id="btn-theme" aria-label="切换主题">🌓</button>
      <button id="btn-generate">生成</button>
      <button id="btn-export">导出</button>
    </header>
    <div id="canvas-container">
      <canvas id="glCanvas"></canvas>
      <div id="progress-container" class="glass-panel">...</div>
    </div>
  </main>
</div>
```

**验证**：页面结构在 DevTools 中正确，无未闭合标签。

---

### 任务 5.3：参数面板组件化
**目标**：将内联 HTML 参数表单改为动态组件。

**文件**：
- 实现：`packages/web/src/ui/paramGroups.ts`
- 修改：`packages/web/src/ui/paramPanel.ts` 读取配置渲染

**实现代码（配置定义）**：
```typescript
export interface ParamGroup {
  id: string;
  title: string;
  fields: ParamField[];
}

export interface ParamField {
  id: keyof UIParams;
  type: 'range' | 'select' | 'checkbox' | 'color' | 'text';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
}

export const PARAM_GROUPS: ParamGroup[] = [
  {
    id: 'world',
    title: '世界',
    fields: [
      { id: 'seedStr', type: 'text', label: '种子' },
      { id: 'mapSize', type: 'select', label: '地图大小', options: [128, 256, 384, 512].map(v => ({ value: v, label: String(v) })) },
      { id: 'plateCount', type: 'range', label: '板块数量', min: 3, max: 20 },
      { id: 'landmass', type: 'range', label: '陆地比例', min: 0.1, max: 0.9, step: 0.05 },
    ],
  },
  // ...更多分组
];
```

**ParamPanel 渲染**：遍历 `PARAM_GROUPS`，用 DOM API 创建折叠卡片与字段，不再依赖 `index.html` 中的硬编码表单。

**验证**：
- 所有原有参数可用。
- 折叠/展开动画流畅。
- 移动端触控正常。

---

### 任务 5.4：工具提示安全改造
**目标**：消除 `Tooltip` 中的 `innerHTML`。

**文件**：`packages/web/src/ui/tooltip.ts`

**实现代码**：
```typescript
export class Tooltip {
  private el: HTMLElement;
  private pinned = false;

  constructor(container: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'map-tooltip';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  show(nodes: (Node | string)[], x: number, y: number): void {
    if (this.pinned) return;
    this.el.replaceChildren(...nodes.map(n => typeof n === 'string' ? document.createTextNode(n) : n));
    this.el.style.display = 'block';
    this.position(x, y);
  }

  pin(nodes: (Node | string)[], x: number, y: number): void {
    this.pinned = true;
    const hint = document.createElement('div');
    hint.className = 'map-tooltip-hint';
    hint.textContent = '再次点击取消固定';
    this.el.replaceChildren(...nodes.map(n => typeof n === 'string' ? document.createTextNode(n) : n), hint);
    this.el.style.display = 'block';
    this.position(x, y);
  }
  // ...其余方法不变
}
```

**验证**：
- 调用方传入字符串或 DOM 节点，不再使用 HTML 字符串。
- 安全扫描无 `innerHTML`。

---

## 阶段 6：移动端与加载优化

### 任务 6.1：响应式布局与底部 Sheet
**目标**：小屏设备抽屉变为底部 sheet。

**文件**：`packages/web/public/style.css`

**关键 CSS**：
```css
@media (max-width: 760px) {
  #drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    width: 100%;
    height: 70vh;
    max-height: 520px;
    border-radius: var(--mg-radius) var(--mg-radius) 0 0;
    transform: translateY(100%);
  }
  #drawer.open { transform: translateY(0); }
}
```

**验证**：Chrome DevTools 移动视图下抽屉从底部滑出。

---

### 任务 6.2：触控交互支持
**目标**：地图支持双指缩放、单指平移、双击选中。

**文件**：`packages/web/src/map/mapInteraction.ts`

**修改点**：
1. 监听 `pointerdown`/`pointermove`/`pointerup`，区分单点/多点。
2. 双指时计算中心与距离，更新 `state.params.pointLightPos` 或未来视图矩阵。
3. 双击触发最近板块选择。

**验证**：在触控设备或 DevTools 模拟中手势有效。

---

### 任务 6.3：代码分割与 Shader 内联
**目标**：减少首屏请求与加载时间。

**文件**：`packages/web/vite.config.ts`、`packages/web/src/app.ts`

**修改点**：
1. Vite 配置 `build.rollupOptions.output.manualChunks` 分离 `vendor`、`ui`、`renderer`。
2. `app.ts` 动态导入 `Launcher`、`ParamPanel` 等非首屏必需模块。
3. Shader 改为 `import fragSrc from './shaders/fs-map.frag?raw';`。

**关键配置**：
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@mapgen/core'],
          ui: ['./src/ui/paramPanel.ts', './src/ui/toolbar.ts', './src/ui/checkpointPanel.ts'],
          render: ['./src/renderer/webgl.ts', './src/renderer/canvas2d.ts'],
        },
      },
    },
  },
});
```

**验证**：
- Network 面板首屏请求数 < 10。
- `benchmark.mjs` 初始加载时间 ≤ 1.8 s。

---

## 阶段 7：启动器扩展

### 任务 7.1：新启动器结构与动画
**目标**：沉浸式全屏启动器，支持主题预览。

**文件**：`packages/web/src/launcher/launcher.ts`、`packages/web/public/style.css`

**修改点**：
1. 使用 DOM API 构建启动器，避免 `innerHTML` 模板字符串。
2. 左侧标题+实时预览区，右侧预设网格。
3. CSS 使用 `backdrop-filter` 实现玻璃拟态。

**验证**：启动器正常显示、动画流畅、无 XSS 模板。

---

### 任务 7.2：预设增强与最近种子
**目标**：扩展 preset 数据与 UI。

**文件**：`packages/web/src/launcher/presets.ts`

**修改点**：
1. 新增 `PresetCategory: 'terrain' | 'climate' | 'style'`。
2. 每个 preset 包含 `previewParams` 用于 64×64 微缩生成。
3. 最近种子从 `localStorage` 读取并渲染为 quick-start 列表。

**验证**：切换 preset 时主界面参数同步；最近种子可点击填充。

---

## 阶段 8：安全加固

### 任务 8.1：添加 CSP
**目标**：通过 meta 标签部署 CSP。

**文件**：`packages/web/index.html`

**修改点**：在 `<head>` 最前加入：
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src-elem 'self' https://fonts.googleapis.com 'unsafe-inline';">
```

**验证**：
- 浏览器控制台无 CSP 违规报告。
- 字体正常加载。

---

### 任务 8.2：DOM XSS 清零
**目标**：移除所有 `innerHTML`、`outerHTML`、`insertAdjacentHTML` 中不可信输入。

**文件**：
- `packages/web/src/ui/checkpointPanel.ts`：`innerHTML = ''` → `this.list.replaceChildren()`。
- `packages/web/src/launcher/launcher.ts`：模板字符串改为 DOM 构建。
- `packages/web/src/ui/tooltip.ts`：已完成。

**验证**：`Grep` 搜索 `.innerHTML`、`.outerHTML`、`.insertAdjacentHTML` 仅保留常量或空字符串清空（可接受）。

---

## 阶段 9：测试与验证

### 任务 9.1：单元测试
**目标**：覆盖新增数据结构。

**文件**：`packages/shared/src/structs/__tests__/*.ts`

**验证**：`npm run test` 全部通过。

---

### 任务 9.2：性能回归测试
**目标**：扩展 benchmark，记录 Worker 引入后的性能。

**文件**：`workspace/benchmark.mjs`

**修改点**：
1. 测量 Worker 生成耗时。
2. 记录 FPS 稳定性。
3. 输出 JSON 到 `benchmark-results.json`。

**验证**：512×512 生成耗时 ≤ 350 ms；FPS 稳定 60。

---

### 任务 9.3：视觉回归测试
**目标**：Playwright 截图对比主题与启动器。

**文件**：`workspace/e2e/visual.spec.ts`

**验证**：`npx playwright test` 通过。

---

## 10. 实施顺序与依赖

| 顺序 | 任务 | 依赖 |
|---|---|---|
| 1 | 1.1–1.4 数据结构 | 无 |
| 2 | 2.1–2.3 Worker 管线 | 无 |
| 3 | 3.1–3.3 渲染优化 | Worker 管线 |
| 4 | 4.1–4.3 算法优化 | 数据结构 |
| 5 | 5.1–5.4 主题 UI | 无 |
| 6 | 6.1–6.3 移动端/加载 | 主题 UI |
| 7 | 7.1–7.2 启动器 | 主题 UI、Worker 管线 |
| 8 | 8.1–8.2 安全 | UI 完成 |
| 9 | 9.1–9.3 测试验证 | 全部 |

---

## 11. 验收清单

- [ ] 512×512 生成 ≤ 350 ms
- [ ] 初始加载 ≤ 1.8 s
- [ ] FPS ≥ 55
- [ ] Worker 生成期间 UI 响应
- [ ] Aurora / Parchment 主题可切换并持久化
- [ ] 移动端抽屉/手势可用
- [ ] CSP 无违规
- [ ] 无高危/中危 XSS 入口
- [ ] 单元测试全部通过
- [ ] benchmark 回归通过
