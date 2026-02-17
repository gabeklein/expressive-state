# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive State is a class-based state management library for reactive UI frameworks.

- `@expressive/state` — framework-agnostic core (State, Observable, Context, instructions)
- `@expressive/react` — React adapter (primary, reference implementation)
- `@expressive/preact` — Preact adapter
- `@expressive/solid` — Solid adapter

Monorepo managed with pnpm workspaces and lerna.

## Repository Structure

```
packages/state/     Core primitives
packages/react/     React adapter (State.use, State.get, State.as, Provider, JSX runtime)
packages/preact/    Preact adapter
packages/solid/     Solid adapter
examples/           Framework usage examples
docs/llm/           Topic-specific reference docs (see below)
```

## Reference Docs

Detailed API docs live in `docs/llm/`. Each file is self-contained — fetch only what you need:

| File                       | Topic                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `docs/llm/core.md`         | State class, reactivity, get/set, lifecycle, events                |
| `docs/llm/react.md`        | React adapter: State.use(), State.get(), State.as(), Provider, JSX |
| `docs/llm/instructions.md` | Instruction system: ref, use, get, set — deep dive                 |
| `docs/llm/patterns.md`     | Common recipes and copy-paste examples                             |
| `docs/llm/bootstrap.md`    | Drop-in snippet for consumer project CLAUDE.md/AGENTS.md           |

## Build, Test, and Dev Commands

```bash
pnpm install          # Install all dependencies
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm build            # Build all packages
pnpm clean            # Clean build artifacts
pnpm push             # Publish packages
```

Per-package tests:

```bash
tsc --noEmit && vitest run --coverage
```

## Test Tooling

- Runner: **Vitest**
- Shared setup: `vitest.setup.ts`
- Root config: `vitest.config.ts` (project-based)
- Package configs extend root
- Coverage policy: **100% thresholds** (branches/functions/lines/statements)
- Helper re-exports: `packages/{state,react,preact}/vitest.ts`

## Working Conventions

- Framework-agnostic behavior belongs in `packages/state`.
- React runtime + typing changes must stay aligned across:
  - `packages/react/src/state.ts`
  - `packages/react/src/jsx-runtime.ts`
  - `packages/react/src/state.test.tsx`
  - `packages/react/src/jsx-runtime.test.tsx`
- Update tests alongside behavioral/type changes.
- Update changelog entries before release when user-facing behavior changes.
- Update to behavior or new features must be accompanied by tests that would fail without the change.
- New features must be accompanied by documentation in `docs/llm/` and examples in `examples/` if major.

## Guardrails

- Do not modify `packages/state` to fix a React-only concern — adapter packages exist for that.
- Do not lower coverage thresholds or skip tests.
- Do not introduce framework-specific imports in `packages/state`.
- Instruction functions (`ref`, `use`, `get`, `set`) are re-exported from each adapter — do not duplicate their implementations.
- The `new()` lifecycle hook is optional; do not add it to classes that don't need it.
- Event dispatch is batched via `setTimeout(0)` — do not assume synchronous propagation.
- `State.new()` both constructs and activates; plain `new State()` does not dispatch the ready event.
