# Context Map

```
mapgen/
├── package.json         # Root config, workspace orchestration
├── AGENTS.md            # Agent instructions, architecture, commands
├── docs/
│   ├── agents/          # Agent skill configs
│   └── adr/             # Architecture decision records
├── packages/
│   ├── shared/          → CONTEXT.md (core engine)
│   ├── shared-types/    → CONTEXT.md (type contracts)
│   ├── web/             → CONTEXT.md (frontend)
│   ├── manager/         → CONTEXT.md (CLI)
│   └── server/          → CONTEXT.md (backend)
```

See `docs/agents/domain.md` for the full multi-context layout rules.
