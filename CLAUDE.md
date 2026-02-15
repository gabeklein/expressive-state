# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Expressive MVC is a class-based state management library for reactive UI frameworks. The core package (`@expressive/state`) provides framework-agnostic reactive primitives, with framework-specific adapters for React, Preact, and Solid.

## Architecture

### Monorepo Structure

This is a Lerna-managed monorepo with pnpm workspaces:

- `packages/state/` - Core framework-agnostic reactive state primitives
- `packages/react/` - React adapter (main published package: `@expressive/react`)
- `packages/preact/` - Preact adapter
- `packages/solid/` - Solid.js adapter
- `examples/` - Example applications demonstrating usage

### Core Architecture

The system is built on three foundational components:

1. **State** (`packages/state/src/state.ts`) - Base class that users extend. Manages:
   - Property access tracking via Proxy
   - Parent-child state relationships (nested States)
   - Lifecycle hooks (`new()` method for initialization, cleanup)
   - Value export/import (flattening state to plain objects)
   - WeakMaps for internal state: `STATE`, `NOTIFY`, `PARENT`, `METHODS`, `ID`

2. **Control/Observable** (`packages/state/src/control.ts`) - Event dispatch system:
   - `addListener()` - Subscribe to state changes
   - `watch()` - Auto-recomputing effects based on accessed properties
   - `event()` - Trigger updates (batched via `DISPATCH` set and setTimeout)
   - Event types: `true` (ready), `false` (update complete), `null` (destroyed), or property key
   - `PENDING` and `PENDING_KEYS` WeakMaps track queued events

3. **Context** (`packages/state/src/context.ts`) - Dependency injection:
   - Hierarchical context system using prototypal inheritance
   - `Context.push()` creates child contexts
   - `Context.get()` retrieves States by class type (uses Symbol keys)
   - `LOOKUP` WeakMap associates States with their Context

### Instruction System

The `packages/state/src/instruction/` directory contains "exotic values" - special property types:

- **`ref`** - Mutable references (like React refs) with `.current` property
- **`use`** - Instanciates instructions, creates child State
- **`get`** - Dependency injection for context.
  - `get(Type)` - Fetch upstream State from context (required)
  - `get(Type, false)` - Fetch upstream State (optional, may be undefined)
  - `get(Type, true)` - Collect downstream States (returns frozen array)
  - `get(Type, callback)` - Upstream with lifecycle callback (non-reactive)
  - `get(Type, true, callback)` - Downstream with lifecycle callback
- **`set`** - Custom setters with validation/transformation

These are used as property initializers in State classes and get special handling during export/import.

### Framework Adapters

Each adapter (`packages/react/`, etc.) provides:

1. **Adapter pattern** (`state.ts`) - Abstract interface for framework hooks
2. **State extensions**:
   - `State.use()` - Hook to create/subscribe to State instance
   - `State.get()` - Hook to consume State from context
   - `State.as()` - Convert State to component
3. **Context components** (`context.ts`):
   - `Provider` - Provides States to component tree
   - `Consumer` - Consumes States with render props
4. **JSX runtime** (React only) - Custom JSX transform for enhanced patterns

The React adapter is the primary/reference implementation.

## Common Commands

### Build & Test

```bash
# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Build specific package
cd packages/state && pnpm build
cd packages/react && pnpm build

# Test specific package
cd packages/state && pnpm test
cd packages/react && pnpm test

# Type-check without running tests
cd packages/state && pnpm tsc --noEmit
```

### Development Workflow

```bash
# Install dependencies
pnpm install

# Clean all node_modules (if needed)
pnpm clean

# Run tests with coverage
cd packages/state && jest --collectCoverage
```

### Publishing

```bash
# Publish to npm (maintainers only)
pnpm push
```

This runs `lerna publish --conventional-commits --no-private` which:

- Versions packages based on conventional commits
- Creates git tags
- Publishes to npm
- Skips examples (marked as private)

## Key Patterns & Conventions

### State Lifecycle

States follow this lifecycle:

1. Constructor calls `prepare()` to set up method binding
2. Constructor calls `init()` to process args and call user's `new()` method
3. Optional `new()` method runs - can return cleanup function
4. State becomes "ready" - emits `true` event, removes `onReady` placeholder
5. On destruction, emits `null` event, runs cleanup functions

### Update Batching

All updates are batched via `event()` in `control.ts`:

- Property changes queue keys in `PENDING_KEYS`
- Single setTimeout(0) processes all pending updates
- Listeners receive both individual property events and a final `false` event

### Method Binding

State methods are auto-bound to their instance via `METHOD` WeakMap:

- First access creates and caches a bound version
- Destructured methods maintain correct `this` context
- Essential for passing methods as event handlers

### The `is` Property

Every State has a non-enumerable `is` property that references itself:

- Allows write access after destructuring
- Can read properties "silently" (without subscribing)
- Example: `const { value, is } = MyState.use(); is.value = 'new'`

### React Integration

The React adapter uses:

- `Layers` context for Context propagation
- `Pragma` object to abstract React hooks (useState, useEffect)
- `watch()` from core to detect accessed properties and trigger re-renders
- Module augmentation to add methods to State class

## Testing Notes

- Tests use Jest with SWC for TypeScript
- Each source file has a corresponding `.test.ts` file
- Coverage is tracked and should remain at 100%
- React tests use `@testing-library/react`
- Tests import from source directly (not built dist)

## Important Implementation Details

1. **Property Access Tracking**: The `watch()` function creates a proxy that records accessed properties and subscribes to only those properties.

2. **Context Inheritance**: Contexts use prototypal inheritance (`Object.create(this)`) to create child contexts. Symbol keys prevent collisions.

3. **Async Handling**: States can throw Promises during initialization - the system catches and handles them via `.then()`.

4. **WeakMaps for Privacy**: All internal state uses WeakMaps to avoid polluting State instances and enable garbage collection.

5. **Export System**: The `EXPORT` variable tracks special value types during state serialization to handle exotic values correctly.

6. **React v19 Compatibility**: Recently updated to support React 19 (see git history around v0.71.0).
