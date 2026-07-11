---
name: gen-test
description: Generate tests for a file following project conventions. Use when adding new modules or features.
disable-model-invocation: true
---

## Mapgen Test Conventions

Generate tests for: $ARGUMENTS

### Project patterns
- Test framework: Vitest (via Turborepo)
- Test file location: `packages/*/src/__tests__/` alongside source
- Test file naming: `*.test.ts` (e.g., `noise.test.ts`)
- Existing test patterns: look at `packages/shared/src/__tests__/` and `packages/web/src/__tests__/` for reference

### Process
1. Read the source file to understand its API
2. Identify key functions/classes to test
3. Generate tests matching project conventions
4. Place the test file in the appropriate `__tests__` directory
5. Verify with `npm test` or `npx turbo run test --filter=<package>`