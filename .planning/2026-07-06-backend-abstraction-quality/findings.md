# Findings: 后端抽象层 + 模块质量提升

**Date:** 2026-07-06

## Project Context

- 当前为纯前端架构：核心算法在 Web Worker 中运行
- 包结构：`@mapgen/core`（packages/shared）、`@mapgen/web`、`@mapgen/manager`
- `generateMap()` 位于 `packages/shared/src/index.ts`，超过 550 行
- 前端通过 `packages/web/src/core/mapGenWorker.ts` 直接调用 core

## Architecture Decisions

- 采用 Service Provider 适配器模式：
  - `MapGenEngine` 作为前后端统一接口
  - `LocalProvider` 调用本地 Web Worker
  - `RemoteProvider` 调用 REST + SSE 后端
- 后端参考实现：`Hono` + `better-sqlite3` + `msgpackr`
- 新增 `@mapgen/shared-types` 包承载跨边界类型契约

## Risks / Open Issues

- `generateMap` 中河流/生物群系/流域/火山/季节计算交织在 `if (!isBlank)` 分支内，拆分时需先整理数据依赖
- `MapData` 含大量 `Float32Array`，跨进程/网络传输需高效序列化
- 前端 `app.ts` 较重，重构 `actions.ts` 时需注意事件绑定顺序
