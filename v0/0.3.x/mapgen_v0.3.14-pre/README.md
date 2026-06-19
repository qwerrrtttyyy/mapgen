# Material Map Generator

Procedural noise & tectonic simulation map generator. Generate terrain, climate, biome maps with WebGL shaders.

**v0.3.14** — Multi-file architecture. Node.js local server.

## Quick Start

### One-click (recommended)

```bash
# Unix / macOS / Linux / Termux
bash <(curl -sL https://github.com/qwerrrtttyyy/mapgen/releases/download/v0.3.14/start.sh)

# Or clone and run
git clone https://github.com/qwerrrtttyyy/mapgen.git
cd mapgen
node server.js
```

### Windows

```bat
# PowerShell
irm https://github.com/qwerrrtttyyy/mapgen/releases/download/v0.3.14/start.ps1 | iex

# Or clone and run
git clone https://github.com/qwerrrtttyyy/mapgen.git
cd mapgen
node server.js
```

### Single-file release

Download the `.js` file from [Releases](https://github.com/qwerrrtttyyy/mapgen/releases) and run directly:

```bash
curl -LO https://github.com/qwerrrtttyyy/mapgen/releases/download/v0.3.14/mapgen_v0.3.14.js
node mapgen_v0.3.14.js
```

## Features

- Procedural terrain generation (noise / FBM / ridged multifractal)
- Tectonic plate simulation
- Climate system (temperature, moisture, biome)
- Erosion simulation
- Rivers and coastlines
- Mountain ridges and snow lines
- Contour lines
- PNG / JPEG export
- localStorage persistence
- Material Design UI
- i18n / multilingual
- Mobile optimized

## Architecture (v0.3.12+)

```
mapgen/
├── server.js              # Node.js HTTP server
├── package.json           # Package manifest
├── public/                # Static assets
│   ├── index.html         # HTML entry point
│   ├── style.css          # Material Design styles
│   └── shaders/
│       ├── vs-quad.vert   # Vertex shader
│       └── fs-map.frag    # Fragment shader
├── src/
│   ├── config.js          # App bootstrap
│   └── main.js            # Application logic
└── bin/
    ├── start.sh           # Unix / macOS / Linux one-click script
    └── start.ps1          # Windows PowerShell one-click script
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `MAPGEN_PORT` | `8765` | HTTP server port |
| `MAPGEN_HOST` | `127.0.0.1` | HTTP server host |

Example:

```bash
MAPGEN_PORT=8080 MAPGEN_HOST=0.0.0.0 node server.js
```

## Tech Stack

- Node.js (local server)
- HTML5 + CSS3 (Material Design)
- JavaScript (ES6+)
- WebGL2 + GLSL shaders
- No build tools required — runs directly in browser

## Changelog

- **v0.3.14** — Multi-file architecture (server / public / src separation), new WebGL shader loading system, improved HTTP server
- **v0.3.11** — Node.js local server with base64-embedded HTML
- **v0.3.10** — Regions & Labels system, mobile optimization
- **v0.3.5** — Material Design UI, splash loading animation
- **v0.3.3** — Mobile optimized
- **v0.3.0** — Full terrain system (biome, erosion, rivers, contours)

Full release history: [Releases](https://github.com/qwerrrtttyyy/mapgen/releases)

## License

MIT
