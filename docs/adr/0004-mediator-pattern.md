# ADR-0004: Mediator 模式协调 UI 子系统

## Status

Accepted — 2026-06-26

## Context

mapgen 前端（`packages/web`）有 9+ 个 UI 子系统需要协调：

- Renderer（WebGL2 / Canvas2D / p5）
- ParamPanel（参数面板）
- Toolbar（工具栏）
- ProgressView（生成进度）
- CheckpointPanel（检查点面板）
- MapInteraction（鼠标交互）
- EditorController（编辑器）
- NameOverlay（名称叠加层）
- CheckpointManager（检查点管理）
- Launcher（启动器）
- LaserController（激光工具）
- DebugPanel（调试面板）

如果让这些子系统直接互相引用，会形成 N×N 的网状依赖，任何新增/删除子系统都要改多个文件。项目选择纯 TypeScript（无 React/Vue 框架），需要一个替代的状态协调机制。

## Decision

采用 **Mediator 设计模式**，实现在 `packages/web/src/core/mediator.ts`（278 行）。

### 架构

```
                    ┌─────────────┐
                    │  Mediator   │
                    │   Bridge    │
                    └──────┬──────┘
                           │
          ┌────────┬───────┼────────┬────────┐
          │        │       │        │        │
     Renderer  Toolbar  Editor  Launcher  ...
          │        │       │        │
          └────────┴───────┴────────┴────────┘
                  (Colleagues 不直接通信)
```

### 核心设计

1. **Colleague 接口**：每个子系统继承 `Colleague` 基类，通过 `this.mediator.emit(event, payload)` 发事件，通过 `on(event, handler)` 收事件

2. **强类型事件**：`MediatorEventPayload` 映射类型定义了 36 种事件及其 payload 类型：
   ```typescript
   type MediatorEventPayload = {
     'render.request': void;
     'params.changed': { key: keyof UIParams; value: UIParams[keyof UIParams] };
     'generating.completed': { mapData: MapData; checkpoints?: number[] };
     // ... 33 more
   }
   ```
   TypeScript 判别联合保证 `emit('params.changed', ...)` 的第二个参数类型正确

3. **MediatorBridge 单例**：`bus` 是全局单例，所有 Colleague 通过 `bus.emit()` / `bus.on()` 通信

4. **名称注册**：每个 Colleague 有 `ColleagueName`（如 `'renderer'`、`'toolbar'`），用于调试与日志

## Consequences

### 正面
- **解耦**：Colleague 之间无直接引用，新增/删除/替换子系统只改 Mediator 注册，不改其他 Colleague
- **类型安全**：36 种事件全部强类型，emit/on 的 payload 类型编译期校验，typo 立即报错
- **可测试**：每个 Colleague 可独立实例化，mock Mediator 即可单元测试
- **可替换**：未来把 Toolbar 换成 React 组件，只要 emit/on 相同事件即可，无需改其他 Colleague

### 负面
- **事件流追踪困难**：一个事件可能触发 5 个 handler，调试时需要 grep 事件名找所有 listener，不如 React DevTools 直观
- **事件膨胀**：36 种事件且持续增长，新事件名需严格命名规范（`<source>.<action>` 如 `laser.selection.done`）
- **无响应式更新**：UI 状态变更需手动 `emit('render.request')` 触发重绘，不如 React/Vue 的自动脏标记

### 中性
- Mediator 是单例，测试间需手动 reset（`resetMediator()` 函数）

## Alternatives Considered

### 1. React + useState/useReducer
- **优点**：响应式 UI，组件树自动 diff 更新，生态成熟
- **否决原因**：项目作者选择纯 TypeScript + DOM 操作，避免 React 运行时（~40KB gzipped）的体积开销；WebGL 画布渲染与 React VDOM 模型不匹配（画布是命令式 API，React 无法 diff 像素）

### 2. Redux / Zustand 集中式状态
- **优点**：单一状态树，时间旅行调试，中间件生态
- **否决原因**：mapgen 的状态不是问题（`appState.ts` 已有单一 state 对象），问题是子系统协调；Redux 的 reducer 模型对高频渲染事件（`render.request` 每帧触发）过于笨重

### 3. RxJS / Observable
- **优点**：事件流组合强大（debounce、throttle、merge、scan）
- **否决原因**：学习曲线陡，团队不熟悉；36 种事件用 RxJS 会过度抽象；Mediator 的 emit/on 已足够

### 4. EventEmitter（Node 风格）
- **优点**：极简，无类型
- **否决原因**：无类型安全，事件名 typo 运行时才报错；payload 类型全靠注释维护，等于没类型

## References

- [Gamma, E. et al. (1994). "Design Patterns: Elements of Reusable Object-Oriented Software"](https://en.wikipedia.org/wiki/Design_Patterns) — Mediator 模式原始描述
- [packages/web/src/core/mediator.ts](../../packages/web/src/core/mediator.ts) — 实现
- [packages/web/src/core/eventBus.ts](../../packages/web/src/core/eventBus.ts) — EventBus 单例
- [packages/web/src/app.ts](../../packages/web/src/app.ts) — Colleague 实例化与注册
