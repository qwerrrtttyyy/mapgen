# AGENTS.md — aihtml (Material Map Generator)

## Project identity

Procedural noise & tectonic simulation tool rendering on WebGL with a Material Design 3 UI. Generates terrain/material maps in the browser.

- **Latest:** `v0.0.1` (Monorepo: Turborepo + npm workspaces)
- **Changelog:** CHANGELOG.md
- **Language:** zh-CN primary
- **Runtime:** Browser (pure frontend, no server required)
- **Build / test / lint:** Turborepo tasks
- **GitHub:** https://github.com/qwerrrtttyyy/mapgen

## Run

```bash
# Install dependencies
npm install

# Development mode (all packages)
npm run dev

# Build all packages
npm run build

# Type check all packages
npm run typecheck

# Build specific package
npm run build --workspace=@mapgen/core
npm run build --workspace=@mapgen/web
```

Development server runs at `http://127.0.0.1:3000` by default.

## Architecture

**Monorepo structure (Turborepo + npm workspaces):**

```
mapgen/
├── packages/
│   ├── shared/          # Shared engine modules (TypeScript)
│   │   ├── src/
│   │   │   ├── noise.ts       # Noise generation (Perlin, Simplex, Value, Worley)
│   │   │   ├── tectonic.ts    # Plate tectonics
│   │   │   ├── erosion.ts     # Erosion simulation
│   │   │   ├── rivers.ts      # River generation
│   │   │   ├── regions.ts     # Region analysis
│   │   │   └── index.ts       # Main entry
│   │   ├── dist/              # Compiled output
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/             # Frontend application (TypeScript + Vite)
│       ├── public/
│       │   ├── index.html
│       │   ├── style.css
│       │   ├── shaders/
│       │   │   ├── fs-map.frag
│       │   │   └── vs-quad.vert
│       │   └── favicon.svg
│       ├── src/
│       │   ├── app.ts           # Main application logic
│       │   ├── checkpoint.ts    # Checkpoint management
│       │   └── renderer/
│       │       ├── webgl.ts     # WebGL renderer
│       │       └── canvas2d.ts  # Canvas2D renderer
│       ├── dist/                # Build output
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── package.json         # Root config
├── turbo.json           # Turborepo config
└── README.md
```

### Package responsibilities

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@mapgen/core` | Core algorithms (noise, tectonic, erosion, rivers, regions) | None |
| `@mapgen/web` | TypeScript + Vite frontend, WebGL/Canvas2D rendering | `@mapgen/core` |

## Code conventions

- **TypeScript:** ES2020 target, strict mode enabled
- **CSS:** Material Design 3 token system via custom properties (`--md-sys-*`, `--md-ref-*`)
- **Shaders:** GLSL ES 3.00 (`#version 300 es`)
- **Build:** Vite for frontend, tsc for core library

## Commands

```bash
npm run dev        # Start all packages in dev mode
npm run build      # Build all packages
npm run typecheck  # Type check all packages
```

## Features

- **Noise types:** Perlin, Simplex, Value, Worley
- **FBM variants:** Standard, Ridged, Billowy, Warped
- **Tectonic simulation:** Plate generation, boundary computation
- **Erosion system:** Hydraulic erosion, lake generation, river networks
- **Climate system:** Temperature, moisture, biomes
- **Render styles:** Terrain, Plates, Parchment, Satellite, Low-poly, Biome, Contour, Relief, Azgaar
- **Checkpoint system:** Save/restore generation state (localStorage)
- **Pure frontend:** No server required, runs entirely in browser

## Tech stack

- **Frontend:** TypeScript + Vite
- **Rendering:** WebGL2 / Canvas2D
- **Styling:** Material Design 3 (CSS Custom Properties)
- **Build tool:** Turborepo
- **Package manager:** npm workspaces

## License

MIT
