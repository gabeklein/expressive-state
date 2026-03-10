# Context Refactor

## Why

The `Context` class modeled a 1:1 relationship with State, acting as an intermediary for parent-child relationships, provider registries, and consumer subscriptions. This was unnecessary — states should _be_ their own context nodes. The class added indirection without adding value.

## What changed

Replaced the `Context` class with WeakMaps and free functions. Context is now an implicit graph over State instances rather than a parallel object hierarchy.

### Data model

Six WeakMaps replace the old class properties:

- `PARENT` — context parent of a state (moved from state.ts)
- `CHILDREN` — context children of a state
- `PROVIDE` — registry of provided states keyed by type, with explicit/implicit flag
- `CONSUME` — subscriber callbacks waiting for types to appear
- `INPUTS` — previous inputs for diffing in `provides()`
- `CLEANUP` — cleanup callbacks per state

### Public API

- **`find(state, Type, arg2?)`** — lookup by type: upstream (default), downstream (`true`), or subscribe to availability (callback)
- **`provide(from, subject, implicit?)`** — register a state in context; walks to nearest provider root when implicit
- **`provides(from, inputs, forEach?)`** — batch provide with diffing against previous inputs; instantiates classes
- **`detach(state)`** — recursively remove a state and its children from the context graph
- **`parent(state)`** — get context parent
- **`link(parent, child)`** — create parent-child link without registering in PROVIDE

Exported as `include` and `apply` for backwards compatibility with adapter code.

### Utilities

- **`root(state)`** — walk up to nearest ancestor with PROVIDE (used by `provide`, `find` below-mode, and `find` callback-mode)
- **`above(state)`** — collect ancestors upward via PARENT
- **`below(state)`** — BFS downward via CHILDREN
- **`types(state)`** — prototype chain of state's constructor up to State base

### Adapter pattern

React, Preact, and Solid adapters create lightweight boundary States (via `State.new()`) instead of Context instances. These boundary states serve as provider roots, with `provides()` for registration and `detach()` for cleanup.
