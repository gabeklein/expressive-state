# `get` - Context Lookup Instruction

Runnable source: [`get`](https://expressive.dev/examples/instructions/get) (upstream) and [`get-downstream`](https://expressive.dev/examples/instructions/get-downstream) (collection) - complete programs, served as HTML.

```ts
import { get } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Fetches another State from ambient context hierarchy (upstream or downstream).

## Overloads

### Upstream (required)

```ts
class Child extends State {
  parent = get(ParentState);
}
```

Fetches nearest instance of `ParentState` from context. Throws if not found.

### Upstream (optional)

```ts
class Child extends State {
  maybe = get(ParentState, false);
}
```

Returns `T | undefined`. Does not throw if missing.

### Upstream with callback

```ts
class Child extends State {
  parent = get(ParentState, (parent, self) => {
    console.log('found:', parent);
    return () => console.log('detached');
  });
}
```

Callback runs when upstream is found/replaced. Return function for cleanup (runs on destruction or replacement). Callback receives `(state, subject)`.

### Downstream collection

```ts
class Parent extends State {
  children = get(ChildState, true);
}
```

Returns `readonly T[]`. Collects all instances of type below in context tree. Array updates automatically as children are created/destroyed.

### Downstream collection with callback

```ts
class Parent extends State {
  children = get(ChildState, true, (child, self) => {
    console.log('registered:', child);
    return () => console.log('removed');
  });
}
```

Callback runs for each child. Return `false` to prevent registration. Return a function for cleanup on removal.

### Downstream single (required)

```ts
class Parent extends State {
  child = get(ChildState, true, true);
}
```

Fetches a single downstream child. Throws if not found.

### Downstream single (optional)

```ts
class Parent extends State {
  child = get(ChildState, true, false);
}
```

Returns `T | undefined`. Updates when a matching child appears or is removed.

## Type Signatures

```ts
function get<T extends State>(Type: State.Extends<T>, callback?: get.Callback<T>): T;
function get<T extends State>(Type: State.Extends<T>, required: false): T | undefined;
function get<T extends State>(Type: State.Extends<T>, downstream: true, callback?: get.Callback<T>): T[];
function get<T extends State>(Type: State.Extends<T>, downstream: true, single: true): T;
function get<T extends State>(Type: State.Extends<T>, downstream: true, required: false): T | undefined;

type get.Callback<T> = (state: T, subject: State) => void | boolean | (() => void);
```

## Behavior

- All `get()` properties are **non-enumerable** (hidden from `Object.keys()`, spread, and `ref(this)`).
- Upstream lookups check direct parent first, then siblings under each ancestor (nearest wins), then context hierarchy.
- Siblings under one parent resolve regardless of field order - a required lookup waits for the parent to finish activating before throwing.
- Will not resolve self as own instance.
- Upstream callback is not reactive - it runs once per mount, not on value changes.
- Downstream callbacks run cleanup before both target and recipient are destroyed.
- Downstream collection ignores redundant registrations of the same instance.
- Subclasses match: `get(Base, true)` collects instances of `Base` and its subclasses.
- Superclasses do not match: `get(Derived, true)` will not collect `Base` instances.
