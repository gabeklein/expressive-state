# CLAUDE.md

This file provides guidance for working in this repository.

## Overview

Expressive State is a class-based state management library for reactive UI frameworks.

- `@expressive/state` provides framework-agnostic state, observable, context, and instruction primitives.
- `@expressive/react` is the primary adapter and reference implementation.
- `@expressive/preact` and `@expressive/solid` provide additional framework adapters.

The repo is a pnpm workspace managed with lerna.

## Repository Structure

- `packages/state/` — core primitives (`State`, `Observable`, `Context`, instructions)
- `packages/react/` — React adapter (`State.use`, `State.get`, `State.as`, context components, JSX runtime)
- `packages/preact/` — Preact adapter
- `packages/solid/` — Solid adapter
- `examples/` — framework usage examples

## Core Architecture

### 1) State (`packages/state/src/state.ts`)

`State` is the base class users extend.

Key responsibilities:

- lifecycle initialization with optional `new()` hook
- managed field assignment and updates via overloaded `set(...)`
- reactive reads and effects via overloaded `get(...)`
- export/import-safe value handling for instruction/exotic values
- internal privacy via WeakMaps (`STATE`, `PARENT`, `METHOD`, etc.)

Behavioral note:

- object assignment through `set({ ... })` triggers `event(self)` before merge assignment.

### 2) Observable/Event system (`packages/state/src/observable.ts`)

Provides:

- `addListener()` for subscriptions
- `watch()` for dependency-tracked effects
- `event()` for dispatching updates

Event semantics:

- `true` → ready/initial
- `false` → update flush completed
- `null` → destroyed/terminal
- `string | symbol | number` → keyed update

Dispatch is batched through a shared queue and flushed with `setTimeout(0)`.

### 3) Context (`packages/state/src/context.ts`)

Hierarchical state lookup and dependency wiring.

Typical flow:

- create nested contexts with `push()`
- resolve instances by class with `get()`
- register/unregister instances with provider boundaries

### 4) Instructions (`packages/state/src/instruction/`)

Special initializers used in state fields:

- `ref` — mutable reference object/value holder
- `use` — create child/derived state instructions
- `get` — context lookup and upstream/downstream dependency behavior
- `set` — custom assignment pipeline/validation behavior

## React Adapter Notes

Primary files:

- `packages/react/src/state.ts`
- `packages/react/src/context.ts`
- `packages/react/src/jsx-runtime.ts`

### `ReactState.as(...)` current shape

`State.as` supports both render-based and default-prop-based forms:

- `State.as((props, self) => ReactNode)`
- `State.as({ ...defaultStateProps })`

Returned component types are extensible class components and can chain defaults, for example `Renderable.as({ ... })`.

Typing highlights:

- `Props<T>` filters component-safe state fields
- `ComponentProps<T>` includes `is`, `fallback`, and `children`
- prop/state overlap is validated by `PropsValid`/`PropsConflicting`
- React-facing component contract is modeled by `Component<P>`

Runtime notes:

- generated class names are prefixed with `React`
- state/context wiring uses `Layers` + `provide(...)`
- `Component` is not exported from `packages/react/src/component` (module removed)

## Build, Test, and Dev Commands

From repo root:

```bash
pnpm install
pnpm test
pnpm test:watch
pnpm build
pnpm clean
pnpm push
```

Per-package tests generally run:

```bash
tsc --noEmit && vitest run --coverage
```

## Test Tooling

- Test runner: Vitest
- Shared setup: `vitest.setup.ts`
- Root config/projects: `vitest.config.ts`
- Package configs extend/merge from root config
- Helper re-exports:
  - `packages/state/vitest.ts`
  - `packages/react/vitest.ts`
  - `packages/preact/vitest.ts`

Coverage policy remains 100% thresholds (branches/functions/lines/statements).

## Working Conventions

- Keep framework-agnostic behavior in `packages/state`.
- Keep React runtime behavior and typing changes aligned across:
  - `packages/react/src/state.ts`
  - `packages/react/src/jsx-runtime.ts`
  - `packages/react/src/state.test.tsx`
  - `packages/react/src/jsx-runtime.test.tsx`
- Prefer updating tests together with behavioral/type changes.
- If user-facing behavior changes, update changelog entries before release.
