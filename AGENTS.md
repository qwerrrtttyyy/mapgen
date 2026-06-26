# AGENTS.md — aihtml (Material Map Generator)

## Project identity

Procedural noise & tectonic simulation tool rendering on WebGL with a Material Design 3 UI. Generates terrain/material maps in the browser.

- **Latest:** `v0.0.1` (Monorepo: Turborepo + npm workspaces)
- **Language:** zh-CN primary
- **Runtime:** Node.js (server) + Browser (client)
- **Build / test / lint:** Turborepo tasks
- **GitHub:** https://github.com/qwerrrtttyyy/mapgen

## Run

```bash
# Install dependencies
npm install

# Development mode (all packages)
npm run dev

# Start server only
cd packages/server && npm start

# Build all packages
npm run build
```

Server runs at `http://127.0.0.1:8765` by default.

## Architecture

**Monorepo structure (Turborepo + npm workspaces):**

```
mapgen/
├── packages/
│   ├── shared/          # Shared engine modules
│   │   ├── src/
│   │   │   ├── noise.js       # Noise generation (Perlin, Simplex, Value, Worley)
│   │   │   ├── tectonic.js    # Plate tectonics
│   │   │   ├── erosion.js     # Erosion simulation
│   │   │   ├── rivers.js      # River generation
│   │   │   ├── regions.js     # Region analysis
│   │   │   └── index.js       # Main entry
│   │   └── package.json
│   ├── server/          # Node.js server
│   │   ├── server.js
│   │   ├── mapgen.json
│   │   └── package.json
│   └── web/             # Pure HTML+CSS+JS frontend
│       ├── public/
│       │   ├── index.html
│       │   ├── style.css
│       │   ├── shaders/
│       │   │   ├── fs-map.frag
│       │   │   └── vs-quad.vert
│       │   └── js/
│       │       ├── app.js
│       │       ├── checkpoint.js
│       │       └── renderer/
│       │           ├── webgl.js
│       │           └── canvas2d.js
│       └── package.json
├── package.json         # Root config
├── turbo.json           # Turborepo config
└── README.md
```

### Package responsibilities

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@mapgen/shared` | Core algorithms (noise, tectonic, erosion, rivers, regions) | None |
| `@mapgen/server` | HTTP server, SSE progress, checkpoint API, server-side generation | `@mapgen/shared` |
| `@mapgen/web` | Pure HTML+CSS+JS frontend, WebGL/Canvas2D rendering | `@mapgen/shared` |

## Code conventions

- **JavaScript:** ES6 modules, `import`/`export`, no TypeScript
- **CSS:** Material Design 3 token system via custom properties (`--md-sys-*`, `--md-ref-*`)
- **Shaders:** GLSL ES 3.00 (`#version 300 es`)
- **No build step for frontend:** Pure HTML+CSS+JS served directly

## Commands

```bash
npm run dev      # Start all packages in dev mode
npm run build    # Build all packages
npm run start    # Start all packages
npm run lint     # Lint all packages
npm run test     # Test all packages
```

## Environment variables

- `MAPGEN_PORT` - Server port (default: 8765)
- `MAPGEN_HOST` - Server host (default: 127.0.0.1)

## Features

- **Noise types:** Perlin, Simplex, Value, Worley
- **FBM variants:** Standard, Ridged, Billowy, Warped
- **Tectonic simulation:** Plate generation, boundary computation
- **Erosion system:** Hydraulic erosion, lake generation, river networks
- **Climate system:** Temperature, moisture, biomes
- **Render styles:** Terrain, Plates, Parchment, Satellite, Low-poly, Biome, Contour, Relief, Azgaar
- **Checkpoint system:** Save/restore generation state
- **C/S architecture:** Server-side generation + SSE real-time progress

## Tech stack

- **Frontend:** Pure HTML + CSS + JavaScript (ES6 Modules)
- **Rendering:** WebGL2 / Canvas2D
- **Server:** Node.js (HTTP, SSE)
- **Build tool:** Turborepo
- **Package manager:** npm workspaces

## License

MIT
