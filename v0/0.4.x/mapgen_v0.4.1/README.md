# Material Map Generator v0.4.3

Procedural noise & tectonic simulation map generator. Generate terrain, climate, biome maps with WebGL shaders.

**v0.4.3** — Mobile-first, protocol switching, headless debugging, test suite.

## Quick Start

```bash
# Recommended: one-click launcher
bash bin/run.sh

# Or directly
node server.js

# Hot-reload (Node ≥18)
node --watch server.js

# Headless mode (no browser open)
HEADLESS=true node server.js
```

## NPX Usage

```bash
# Run directly from GitHub (no install needed)
npx github:qwerrrtttyyy/mapgen

# After npm link:
npx mapgen
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `MAPGEN_PORT` | `8765` | HTTP server port |
| `MAPGEN_HOST` | `127.0.0.1` | HTTP server host |
| `MAPGEN_CONFIG` | `mapgen.json` | Config file path |
| `HEADLESS` | `false` | Skip browser auto-open |
| `CI` | `false` | Implies HEADLESS=true |

Edit `mapgen.json` for persistent config:
```json
{ "port": 8765, "host": "127.0.0.1", "openBrowser": true, "autoPortFallback": true }
```

## Protocol Switching

Toggle between generation modes via UI or API:

```bash
# Server-side generation (C/S mode)
curl -X POST http://127.0.0.1:8765/api/protocol -H 'Content-Type: application/json' -d '{"mode":"server"}'

# Client-side generation (browser-only)
curl -X POST http://127.0.0.1:8765/api/protocol -H 'Content-Type: application/json' -d '{"mode":"client"}'

# Hybrid: server for heavy ops, client for rendering
curl -X POST http://127.0.0.1:8765/api/protocol -H 'Content-Type: application/json' -d '{"mode":"hybrid"}'
```

## Checkpoints

Save/restore generation states via `/api/checkpoints`. Frontend also stores maps in IndexedDB for offline use.

## Debugging

```bash
# One-click diagnostic
node bin/debug.js

# Headless screenshot + browser console capture
node bin/headless-debug.js                    # defaults: http://127.0.0.1:8765
node bin/headless-debug.js http://0.0.0.0:3000 out.png
```

## Testing

```bash
node --test tests/
```

Unit + integration tests use Node.js built-in test runner (no external deps).

## Tech Stack

- Node.js ≥18 (ESM, zero external runtime deps)
- HTML5 + CSS3 (Mobile-first Material Design)
- JavaScript ES modules (client + server)
- WebGL2 + GLSL shaders (terrain rendering)
- No build tools required

## Architecture

```
mapgen_v0.4.3/
├── server.js              # Node.js HTTP server + API + SSE
├── package.json           # bin: mapgen, engines: node >=18
├── mapgen.json            # Runtime config
├── public/
│   ├── index.html         # SPA shell (mobile responsive)
│   ├── style.css          # Material Design + mobile breakpoints
│   ├── shaders/
│   │   ├── vs-quad.vert
│   │   └── fs-map.frag
│   └── js/
│       ├── app.js         # ProgressiveRenderer, interpolation, touch handlers
│       ├── checkpoint.js  # IndexedDB FrontendStore + CheckpointManager
│       └── engine/
│           ├── index.js   # generateMap orchestration
│           ├── noise.js   # Perlin/Simplex/Value/Worley + warped/billowy/ridged/worleyDetail
│           ├── tectonic.js # Plate generation + Voronoi assignment
│           ├── erosion.js  # Sub-pixel inertia-aware hydraulic erosion
│           ├── rivers.js   # River tracing + BFS flood-fill lake generation
│           └── regions.js  # Biome/region classification
├── bin/
│   ├── run.sh             # One-click launcher
│   ├── setup.sh           # Dependency check + fix
│   ├── headless-debug.js  # Puppeteer headless screenshot tool
│   └── debug.js           # One-click diagnostic
└── tests/
    ├── unit/              # noise, tectonic, erosion tests
    └── integration/       # API routes, server lifecycle
```

## Features

- Procedural terrain (Perlin/Simplex/Value/Worley + FBM variants)
- Tectonic plate simulation with collision boundaries
- Sub-pixel inertia-aware hydraulic erosion (port from v0.3.x)
- Climate system (temperature, moisture, biome classification)
- River tracing + flood-fill basin lake generation
- 10 render styles (terrain, plates, parchment, satellite, lowpoly, biome, contour, relief, azgaar, terrain_detail)
- Progressive rendering with LOD for mobile performance
- IndexedDB local save + server checkpoint sync
- Protocol switching (server / client / hybrid)
- Mobile responsive: touch gestures, bottom sheet drawer, pinch zoom
- Headless browser debug + screenshot capture
- Full test suite (node:test, zero deps)

## License

MIT
