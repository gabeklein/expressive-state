# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive State — class-based reactive state management library.

- `@expressive/state` — framework-agnostic core
- `@expressive/react` — React adapter (primary)
- `@expressive/preact` — Preact adapter
- `@expressive/solid` — Solid adapter (not published yet)

Monorepo: pnpm workspaces + lerna.

## Structure

```
packages/state  - Core primitives
packages/react  - React adapter (.use, .get, .as, Provider, JSX runtime)
packages/preact - Preact adapter
packages/solid  - Solid adapter
examples        - Framework usage examples
.agents         - Topic-specific reference docs (see below)
```

## Reference Docs

Detailed API docs in `.agents/`. Each file is self-contained — fetch only what you need.

> **Read these first.** The `.agents/` docs cover API surface, types, lifecycle, testing patterns, and internals comprehensively. Consult the relevant file before reading source — most questions are answered here without needing to crawl `packages/*/src/`.

- `core.md` State class, reactivity, get/set, lifecycle, events
- `react.md` React adapter: State.use(), .get(), .as(), Provider, JSX
- `instructions.md` Instruction system: ref, use, get, set
- `patterns.md` Common recipes and examples
- `bootstrap.md` Drop-in snippet for consumer CLAUDE.md/AGENTS.md
- `lifecycle.md` Full lifecycle phases, teardown ordering, error handling, effect internals
- `typescript.md` Type system: generics, conditional types, instruction overloads
- `testing.md` Vitest setup, custom matchers, React testing patterns
- `adapters.md` Framework adapters: React, Preact, Solid — API differences & performance

## Commands

```bash
pnpm install        # Install deps
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm build          # Build all packages
pnpm clean          # Clean artifacts
pnpm push           # Publish packages
```

Per-package: `tsc --noEmit && vitest run --coverage`

## Test Tooling

- Runner: **Vitest** with `vitest.setup.ts` and root `vitest.config.ts`
- Package configs extend root; helpers in `packages/{state,react,preact}/vitest.ts`
- Coverage: **100% thresholds** (branches/functions/lines/statements)

## Conventions

- Framework-agnostic logic belongs in `packages/state`.
- React changes must stay aligned across `packages/react/src/{state,jsx-runtime}.{ts,test.tsx}`.
- Update tests alongside behavioral/type changes — tests must fail without the change.
- New major features need `.agents/` docs and `examples/`.
- Update changelog before release for user-facing changes.

## Guardrails

- Don't modify `packages/state` to fix React-only concerns — use adapter packages.
- Don't lower coverage thresholds or skip tests.
- Don't introduce framework-specific imports in `packages/state`.
- Instructions (`ref`, `use`, `get`, `set`) are re-exported from adapters — don't duplicate implementations.
- `new()` lifecycle hook is optional; don't add it unnecessarily.
- Event dispatch is batched via `setTimeout(0)` — not synchronous.
- `State.new()` constructs + activates; plain `new State()` doesn't dispatch ready.
