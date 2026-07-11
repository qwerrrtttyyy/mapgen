# AGENTS.md — aihtml (Material Map Generator)

## Project identity

Procedural noise & tectonic simulation tool rendering on WebGL with a Material Design 3 UI. Generates terrain/material maps in the browser.

- **Latest:** `v0.0.3-pre` (Monorepo: Turborepo + Bun workspaces)
- **Changelog:** CHANGELOG.md
- **Language:** zh-CN primary
- **Runtime:** Browser (pure frontend, no server required); optional Bun reference backend
- **Package manager:** Bun ≥ 1.2.0 (see `package.json` → `packageManager` field; `bun.lock` is the source of truth)
- **Build / test / lint:** Turborepo tasks
- **GitHub:** https://github.com/qwerrrtttyyy/mapgen

## Run

```bash
# Install dependencies
bun install

# Development mode (frontend only)
bun run dev

# Development mode (frontend + backend)
bun run dev:all

# Backend only
bun run dev:server

# Build all packages
bun run build

# Build backend only
bun run build:server

# Type check all packages
bun run typecheck

# Run all tests
bun test

# Build specific package
bunx turbo run build --filter=@mapgen/core
bunx turbo run build --filter=@mapgen/web
bunx turbo run build --filter=@mapgen/server
```

Development server runs at `http://127.0.0.1:3000` by default.

## Architecture

**Monorepo structure (Turborepo + Bun workspaces):**

```
mapgen/
├── packages/
│   ├── core/            # Core engine modules (TypeScript) — @mapgen/core
│   │   ├── src/
│   │   │   ├── pipeline/      # Generation pipeline stages
│   │   │   ├── noise.ts       # Noise generation (Perlin, Simplex, Value, Worley)
│   │   │   ├── tectonic.ts    # Plate tectonics
│   │   │   ├── erosion.ts     # Erosion simulation
│   │   │   ├── rivers.ts      # River generation
│   │   │   ├── regions.ts     # Region analysis
│   │   │   └── index.ts       # Main entry
│   │   ├── dist/              # Compiled output
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared-types/    # Cross-boundary type contracts and serialization
│   │   ├── src/
│   │   │   ├── params.ts      # MapParams
│   │   │   ├── map.ts         # MapData / SerializedMapData
│   │   │   ├── engine.ts      # MapGenEngine interface
│   │   │   ├── api.ts         # REST API types
│   │   │   ├── errors.ts      # Result<T> / MapGenError
│   │   │   └── serialization.ts # Base64 float32 codec
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/             # Frontend application (TypeScript + Vite)
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   ├── shaders/
│   │   │   │   ├── fs-map.frag
│   │   │   │   └── vs-quad.vert
│   │   │   └── favicon.svg
│   │   ├── src/
│   │   │   ├── engine/          # MapGenEngine abstraction
│   │   │   │   ├── provider.ts
│   │   │   │   ├── local.ts     # LocalProvider (Web Worker)
│   │   │   │   ├── remote.ts    # RemoteProvider (REST + SSE)
│   │   │   │   └── factory.ts
│   │   │   ├── app.ts           # Main application logic
│   │   │   ├── checkpoint.ts    # Checkpoint management
│   │   │   └── renderer/
│   │   │       ├── webgl.ts     # WebGL renderer
│   │   │       └── canvas2d.ts  # Canvas2D renderer
│   │   ├── dist/                # Build output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── server/          # Optional reference backend (Hono + in-memory)
│       ├── src/
│       │   ├── routes/          # REST routes
│       │   ├── services/        # Job queue, map engine, storage
│       │   ├── db/              # In-memory database
│       │   └── index.ts         # App entry
│       ├── dist/
│       ├── package.json
│       └── tsconfig.json
├── package.json         # Root config
├── turbo.json           # Turborepo config
└── README.md
```

### Package responsibilities

| Package                | Purpose                                                     | Dependencies                                   |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `@mapgen/core`         | Core algorithms (noise, tectonic, erosion, rivers, regions) | None                                           |
| `@mapgen/shared-types` | Cross-boundary type contracts and serialization             | `msgpackr`                                     |
| `@mapgen/web`          | TypeScript + Vite frontend, WebGL/Canvas2D rendering        | `@mapgen/core`, `@mapgen/shared-types`         |
| `@mapgen/server`       | Optional reference backend (Hono + in-memory storage)       | `@mapgen/core`, `@mapgen/shared-types`, `hono` |

## Code conventions

- **TypeScript:** ES2020 target, strict mode enabled
- **CSS:** Material Design 3 token system via custom properties (`--md-sys-*`, `--md-ref-*`)
- **Shaders:** GLSL ES 3.00 (`#version 300 es`)
- **Build:** Vite for frontend, tsc for core library

## Commands

```bash
bun run dev          # Start frontend in dev mode
bun run dev:server   # Start backend in dev mode
bun run dev:all      # Start frontend + backend in dev mode
bun run build        # Build all packages
bun run build:server # Build backend only
bun run typecheck    # Type check all packages
bun test             # Run all tests
```

## Features

- **Noise types:** Perlin, Simplex, Value, Worley
- **FBM variants:** Standard, Ridged, Billowy, Warped
- **Tectonic simulation:** Plate generation, boundary computation
- **Erosion system:** Hydraulic erosion, lake generation, river networks
- **Climate system:** Temperature, moisture, biomes
- **Render styles:** Terrain, Plates, Parchment, Satellite, Low-poly, Biome, Contour, Relief, Azgaar
- **Checkpoint system:** Save/restore generation state (localStorage)
- **Pipeline architecture:** `generateMap` split into tectonic/elevation/climate/river/region/packing stages
- **Backend abstraction:** `MapGenEngine` interface with `LocalProvider` and `RemoteProvider`
- **Optional reference backend:** Hono + in-memory storage, REST + SSE
- **Pure frontend:** No server required, runs entirely in browser

## Tech stack

- **Frontend:** TypeScript + Vite
- **Rendering:** WebGL2 / Canvas2D
- **Styling:** Material Design 3 (CSS Custom Properties)
- **Build tool:** Turborepo
- **Package manager:** Bun workspaces (packageManager: bun@1.2.14)
- **Backend (optional):** Hono + in-memory storage + REST + SSE

## License

MIT

## Agent skills

### Issue tracker

Issues are tracked on GitHub Issues; external PRs are also triaged as a request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five standard role strings are used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — `CONTEXT-MAP.md` at root points to per-package `CONTEXT.md` files. See `docs/agents/domain.md`.
