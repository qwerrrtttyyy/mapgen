# AGENTS.md — aihtml (Material Map Generator)

## Project identity

Procedural noise & tectonic simulation tool rendering on WebGL with a Material Design 3 UI. Generates terrain/material maps in the browser.

- **Latest:** `v0/0.4.x/mapgen_v0.4.1/` (Node.js built-in server + checkpoint system)
- **Language:** zh-CN primary
- **Previous:** `v0/0.4.x/mapgen_v0.4.0/` (React + TypeScript + Vite)
- **Previous stable:** `v0/0.3.x/mapgen_v0.3.12-preview.js` (single-file)
- **Runtime:** Node.js only (v0.4.1, v0.3.11–v0.3.14), Node.js + Vite (v0.4.0), browser file:// (≤v0.3.10)
- **Build / test / lint:** v0.4.0 only (vite, tsc, eslint); v0.4.1 has none

## Run

```sh
# v0.4.1 (Node.js built-in server)
cd v0/0.4.x/mapgen_v0.4.1
node server.js
# Opens http://127.0.0.1:8765
# Env: MAPGEN_PORT, MAPGEN_HOST

# v0.4.0 (React + Vite)
cd v0/0.4.x/mapgen_v0.4.0
npm install && npm run dev

# v0.3.x (single-file server)
node v0/0.3.x/mapgen_v0.3.14-pre/server.js
# or: node v0/0.3.x/mapgen_v0.3.12-preview.js
# Env: MAPGEN_PORT, MAPGEN_HOST
```

## Architecture

**Two eras:**

| Era | Structure | Dependencies | Entry |
|-----|-----------|-------------|-------|
| v0.0.x–v0.3.10 | Single `.html` file | None | Open in browser |
| v0.3.11–v0.3.14 | Single `.js` (base64-embedded HTML) or multi-file dir | Node built-ins only | `node server.js` or `node *.js` |
| v0.4.0+ | Multi-file React + TypeScript + Vite | React, Zustand, Tailwind, etc. | `npm run dev` |

### Multi-file releases (v0.3.12+)

```
server.js         # Node HTTP server
public/           # Static assets (HTML, CSS, GLSL shaders)
src/              # Application logic
src/modules/      # i18n, logger, store, utils
bin/              # start.sh, start.ps1
```

### v0.4.0+ (React + Vite)

```
src/
├── components/   # React components (CanvasContainer, ControlPanel, Toast)
├── engine/       # Core algorithms (noise, tectonic, erosion, rivers)
├── hooks/        # React hooks (useWebGL, useMapGeneration, useTheme)
├── renderer/     # WebGL2 / Canvas2D renderers
├── store/        # Zustand state management
├── i18n/         # Internationalization
└── utils/        # Export, storage
```

## Code conventions

- **v0.0.x–v0.3.14:** ES5 style (`var`, function expressions, no `import`/`export`)
- **v0.4.0+:** TypeScript, React functional components, ES modules, Zustand stores
- CSS: Material Design 3 token system via custom properties (`--md-sys-*`, `--md-ref-*`)
- Two UI themes: sidebar (classic) and glass-morphism (`data-ui="modern"`)
- Responsive breakpoints: 860px (tablet), 480px (mobile)

## Version notes

- v0.0.1 maps to v0.0.1 tag; v0.3.0–v0.3.11 all map to same git commit `c7224b0`
- Preview files (dash-preview suffix) are intermediate; stable releases have no suffix
- v0.3.14-pre has no single-file build asset — only multi-file source
- v0.4.0 is a complete rewrite: React 18, WebGL2, Vite 6, Zustand 5
- The repo before v0.4.0 had zero dependencies; v0.4.0 requires `npm install`

## v0.4.0 commands

```sh
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run check    # tsc -b --noEmit
npm run preview  # Vite preview server
```
