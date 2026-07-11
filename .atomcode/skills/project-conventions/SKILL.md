---
name: project-conventions
description: Code style and patterns for the mapgen monorepo. Apply when writing or reviewing code.
user-invocable: false
---

## Mapgen Monorepo Conventions

### Package structure
- `packages/shared/` — Core algorithms (noise, tectonic, erosion, rivers, regions)
- `packages/shared-types/` — Cross-boundary type contracts and serialization
- `packages/web/` — Frontend app (TypeScript + Vite, WebGL/Canvas2D)
- `packages/server/` — Optional backend (Hono)

### Naming conventions
- TypeScript interfaces: PascalCase, no `I` prefix
- Type aliases: PascalCase (e.g., `MapParams`, `MapData`)
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case
- Test files: `*.test.ts` in `__tests__/` directories

### Import rules
- Use path aliases from package tsconfig when available
- Cross-package imports: use package name (`@mapgen/shared`, `@mapgen/shared-types`)
- No barrel imports that cause circular dependencies

### Code style
- TypeScript strict mode enabled
- Prefer `map` / `filter` / `reduce` over manual loops
- Use `Result<T, E>` pattern for fallible operations in shared-types
- All WebGL shaders use GLSL ES 3.00 (`#version 300 es`)
- CSS uses Material Design 3 token system (`--md-sys-*`, `--md-ref-*`)

### Forbidden
- No `any` types (use `unknown` if needed)
- No `console.log` in production code
- No direct mutation of function parameters
- No synchronous file I/O in the frontend