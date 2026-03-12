# Framework Adapters — Expressive State

## Package Overview

| Package | Status | Version |
|---------|--------|---------|
| `@expressive/state` | Published | 0.73.x |
| `@expressive/react` | Published | 0.74.x |
| `@expressive/preact` | Private | 0.71.x |
| `@expressive/solid` | Private | 0.71.x |

## React (`@expressive/react`)

Full-featured adapter. Supports React 16.8+ through 19.x.

### Static hooks added to State

```ts
// Create instance in component, auto-subscribe to updates
const state = MyState.use(...args);

// Consume from context
const state = MyState.get();

// Consume with computed selector
const value = MyState.get((current) => current.x + current.y);

// Create component from State class
const Component = MyState.as((props, self) => <div>{self.value}</div>);
```

### JSX runtime

Custom `jsx()` / `jsxs()` functions detect State classes used as JSX elements and automatically create instances:

```tsx
// This works — State classes are valid JSX elements
<MyState foo="bar">
  <ChildComponent />
</MyState>
```

### Pragma system

React adapter injects hooks via a `Pragma` object:

```ts
Pragma.useEffect = React.useEffect;
Pragma.useState = React.useState;
Pragma.createElement = React.createElement;
```

This allows the same core logic to work across React/Preact.

### Suspense

Async `set()` factories integrate with React Suspense automatically:

```tsx
class Data extends State {
  result = set(async () => fetch('/api').then(r => r.json()));
}

// Accessing result before resolved throws Suspense
<Suspense fallback={<Loading />}>
  <DataConsumer />
</Suspense>
```

### Provider / Consumer

```tsx
import { Provider, Consumer } from '@expressive/react';

// Provide state to descendants
<Provider for={MyState}>
  <App />
</Provider>

// Multiple states
<Provider for={{ Auth, Theme, Router }}>
  <App />
</Provider>

// With instance
<Provider for={existingState}>
  <App />
</Provider>

// With suspense fallback
<Provider for={AsyncState} fallback={<Loading />}>
  <App />
</Provider>
```

## Preact (`@expressive/preact`)

Thin wrapper over the React adapter. Patches `Pragma` with Preact's hooks:

```ts
import { useEffect, useState } from 'preact/hooks';
import { createElement } from 'preact';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
```

**API surface is identical to React.** Same `.use()`, `.get()`, `.as()`, Provider, Consumer.

Has its own Provider/Consumer using Preact's context API.

## Solid (`@expressive/solid`)

Standalone implementation — does NOT depend on React adapter.

### Key difference: signal getters

Properties are wrapped as Solid signals. Accessing them requires calling as functions:

```ts
// React / Preact
const { name, age } = MyState.use();
console.log(name, age); // direct values

// Solid
const { name, age } = MyState.use();
console.log(name(), age()); // must call as signal getters
```

### Implementation

Uses `SIGNALS` WeakMap + Proxy:
- Each property gets a `createSignal()` on first access
- Proxy get trap returns signal getter function
- State update listener propagates changes to signals
- Methods and inherited State members pass through unchanged

### Reactive type

```ts
type Reactive<T extends State> = {
  [P in keyof T]:
    P extends keyof State ? T[P] :              // State methods unchanged
    T[P] extends (...args: any) => any ? T[P] : // Functions unchanged
    () => T[P];                                  // Properties become getters
};
```

## Performance Characteristics

### Subscription tracking

Effects receive a **proxy**, not the real state. Property accesses on the proxy are tracked:

```ts
state.get((current) => {
  console.log(current.foo); // tracked — subscribes to 'foo'
  console.log(current.is.bar); // NOT tracked — 'is' bypasses proxy
});

state.foo = 1; // re-runs effect
state.bar = 2; // does NOT re-run (not tracked)
```

### Update batching

All updates in the same tick are batched into a single flush:

```ts
state.a = 1;
state.b = 2;
state.c = 3;
// → single setTimeout(0) fires once, emitting batch event with all 3 keys
```

### Deduplication

- **Value equality**: `state.x = state.x` is a no-op
- **Listener filtering**: listeners with key filters only fire for matching keys
- **Computed caching**: `set(this, ...)` computeds only rerun when accessed dependencies change, tracked via `STALE` WeakSet
- **React render skipping**: `State.get(factory)` compares computed output — same result means no re-render

### Silent updates

```ts
state.set(assign, true); // silent = true — accumulates in PENDING_KEYS
// Next non-silent update flushes everything
```
