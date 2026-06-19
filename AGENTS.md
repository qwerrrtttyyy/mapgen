# AGENTS.md — aihtml (Material Map Generator)

## Repo layout

This repo is a version archive. Each `v0/` release is an independent, standalone project — do not assume cross-version imports or shared config.

Active development is at `v0/0.4.x/mapgen_v0.4.1/`. Everything else is historical.

## Editable targets

| Version | Path | Notes |
|---------|------|-------|
| Latest (C/S) | `v0/0.4.x/mapgen_v0.4.1/` | Node.js ESM, `"type": "module"`, `server.js` entry |
| Previous (SPA) | `v0/0.4.x/mapgen_v0.4.0/` | React + TS + Vite, `npm install` required |
| Historical | `v0/0.3.x/…` | Node builtins only, zero external deps |

## v0.4.1 run & config

```sh
# Recommended entry
bash v0/0.4.x/mapgen_v0.4.1/bin/run.sh
# or directly
node v0/0.4.x/mapgen_v0.4.1/server.js
# Hot-reload (Node ≥18): node --watch server.js
```

- Env overrides: `MAPGEN_PORT` (default 8765), `MAPGEN_HOST` (default 127.0.0.1)
- Runtime config in `mapgen.json` — edit it instead of guessing flags
- `bin/setup.sh` fixes permissions and auto-creates `.checkpoints/` and `mapgen.json` if missing
- Server opens browser automatically (`openBrowser: true`); disable in config to suppress
- No `npm install` needed — zero external dependencies

## v0.4.0 commands (only if editing this version)

```sh
cd v0/0.4.x/mapgen_v0.4.0
npm install
npm run check     # tsc -b --noEmit (run before build)
npm run lint
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run preview   # vite preview
```

- `check` is integral to the build pipeline — `build` runs `tsc -b` first, so always verify `check` passes before committing
- Path aliases resolved by `vite-tsconfig-paths`; config lives in `vite.config.ts`
- Zustand 5 store at `src/store/`; TypeScript strict, no `any` patterns used in new code
- Tailwind 3.4 with `postcss.config.cjs`; MD3 tokens via `--md-sys-*` CSP vars

## v0.3.x run

```sh
node v0/0.3.x/mapgen_v0.3.14-pre/server.js
# preview files (dash-preview) are intermediate; stable releases have no suffix
```

## Conventions

- **Do not assume shared Node modules or hoisted packages** between version directories
- Do not run `npm install` at repo root or inside `v0/0.4.1/` (no package.json deps to install)
- v0.4.1 uses `"type": "module"` — `.js`/`.ts` files are ESM by default; CJS requires explicit `.cjs` extension
- Stable releases have no suffix in their directory name; `-pre` / `-preview` / `-solo` suffixes are unmerged branches
