# Task Plan: 后端抽象层 + 模块质量提升

**Date:** 2026-07-06
**Plan ID:** 2026-07-06-backend-abstraction-quality
**Status:** in_progress

---

## Goal

为 mapgen 引入 `MapGenEngine` 抽象层，实现前后端解耦；提供可选的 Node.js/Hono 参考后端；保持前端独立运行全功能；同步提升核心模块质量。

## Current Phase

Phase 1

## Phases

### Phase 1: 共享类型包 `@mapgen/shared-types`

- [ ] 创建 `packages/shared-types` 包（package.json、tsconfig.json）
- [ ] 定义 `MapParams`、`SerializedMapData`、`GenerationProgress`、`GenerationResult`
- [ ] 定义 `MapGenEngine` 接口
- [ ] 定义 `Result<T>`、`MapGenError`、`ErrorCode`
- [ ] 实现 `serializeMapData` / `deserializeMapData`
- [ ] 配置 monorepo workspace 引用
- **Status:** pending

### Phase 2: 前端引擎抽象层

- [ ] 创建 `packages/web/src/engine/provider.ts`（`MapGenEngine` 接口实现，复用 shared-types）
- [ ] 创建 `LocalProvider`，封装现有 Web Worker 调用
- [ ] 创建 `RemoteProvider`（REST + SSE 客户端）
- [ ] 创建 `factory.ts`，支持 URL/配置切换 local/remote
- [ ] 重构 `packages/web/src/core/actions.ts`：从 `mapGenWorker` 改为注入 `EngineProvider`
- [ ] 重构 `packages/web/src/app.ts`：初始化 provider 并绑定错误处理/降级逻辑
- **Status:** pending

### Phase 3: 后端参考实现 `@mapgen/server`

- [ ] 创建 `packages/server` 包（Hono + better-sqlite3 + msgpackr + zod）
- [ ] 实现 SQLite schema 与初始化
- [ ] 实现 `POST /generate` + 内存任务队列
- [ ] 实现 `GET /jobs/:id`（SSE 进度推送 + JSON 轮询）
- [ ] 实现 `/maps` CRUD（含二进制 `/maps/:id/bin`）
- [ ] 实现 `/presets` 路由
- [ ] 实现序列化/反序列化工具
- [ ] 暴露 OpenAPI 规范或 JSON Schema
- **Status:** pending

### Phase 4: 模块质量提升

- [ ] 拆分 `packages/shared/src/index.ts` 中 `generateMap` 为 pipeline 阶段
- [ ] 类型增强 `eventBus`，添加强类型事件映射
- [ ] 将 `shared` 包补全为 `@mapgen/core` 类型导出
- [ ] 更新 `turbo.json` 依赖关系
- **Status:** pending

### Phase 5: 测试与验证

- [ ] shared-types 序列化往返测试
- [ ] LocalProvider 集成测试
- [ ] RemoteProvider 契约测试（msw mock）
- [ ] server 路由测试（Hono test helper）
- [ ] 全栈 typecheck 通过
- [ ] 前端 `npm run dev` 默认本地模式正常生成地图
- [ ] 后端 `npm run dev:server` 可独立启动并通过健康检查
- **Status:** pending

### Phase 6: 交付

- [ ] 更新根 README / AGENTS.md 中的架构描述
- [ ] 确认构建产物 web 仍为纯静态文件
- [ ] 提交并汇总变更
- **Status:** pending

## Key Questions

1. 本地模式 `LocalProvider` 的 `saveMap` 是否写入 IndexedDB 或仅 localStorage？
   - 决定：先使用 localStorage + 下载 JSON，后续可扩展 IndexedDB。
2. `RemoteProvider` 在连接失败时是否自动降级到本地？
   - 决定：支持，通过 `fallback: true` 配置，默认开启。
3. server 是否支持并发生成任务？
   - 决定：P1 使用单线程顺序队列，保证简单稳定；后续可扩展 Worker 池。

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Service Provider 适配器模式 | 解耦前后端，本地/远程切换透明，易扩展新后端 |
| Node.js + Hono + SQLite | 轻量、单文件数据库、零额外服务依赖、跨运行时兼容 |
| REST + SSE | 简单通用，易调试，可被任何语言后端实现 |
| MessagePack 二进制传输 | 大地图序列化效率高，避免 base64 膨胀 |
| `Result<T>` 错误模式 | 强制调用方处理错误，替代不可控的 throw |
| 新增 `@mapgen/shared-types` 包 | 前后端共享契约，避免循环依赖 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` 执行失败（换行/选项解析错误） | 1 | 手动创建 `.planning` 目录与计划文件 |

## Notes

- 前端默认行为保持不变：`npm run dev` 只启动 web，全功能可用。
- 后端为可选：`npm run dev:all` 同时启动前后端。
- 设计文档：[docs/superpowers/specs/2026-07-06-backend-abstraction-quality-design.md](../../docs/superpowers/specs/2026-07-06-backend-abstraction-quality-design.md)
