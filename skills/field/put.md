# `put` - Unmanaged Storage

```ts
import { put } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Stores a value on the instance without managing it. Reads and writes use plain property syntax, never notify subscribers, and never throw after destroy.

For mechanism and memory - subscription handles, side-pocket data, comparison tokens. Facts the UI observes belong in a managed field.

## Usage

```ts
class JobRunner extends State {
  progress = 0;                              // managed - UI observes
  unwatch = put<(() => void) | null>(null);  // opaque - mechanism

  start(id: string) {
    this.stop();
    this.unwatch = watchJob(id, {
      onProgress: (p) => {
        if (this.get(null)) return;
        this.progress = p.percent;
      }
    });
  }

  stop() {
    const stop = this.unwatch;
    this.unwatch = null;
    stop?.();
  }

  protected new() {
    return () => this.stop();
  }
}
```

Without an initial value the property is `undefined` and typed `T | undefined`. Access never suspends.

```ts
class Form extends State {
  draft = put<Snapshot>();
}
```

## Storage Classes

| Need | Use |
| --- | --- |
| UI-observed state | plain field, `set()` |
| DOM or callback ref | `ref()` |
| Opaque instance memory | `put()` |
| Custom descriptor | `def()` |

Three recurring cases for `put`:

- **Subscription handles** - an unsubscribe function swapped on every restart. A managed field would notify on each swap and throw when a late callback nulls it after destroy.
- **Side-pocket data** - a snapshot held while the user is elsewhere. Nothing should re-render because the pocket was written; restoring writes managed fields explicitly.
- **Comparison tokens** - "what did we last process?" bookkeeping for edge detection.

## Anti-Patterns

- **Don't** store an unsubscribe handle in a managed field - swaps notify, and a null-out after destroy throws.
- **Don't** reach for `#private` for non-reactive storage. Tracked contexts (effects, computed getters, render) receive a derived object, and private-field access from one throws.
- **Don't** use TypeScript `private` to opt out of reactivity - it is compile-time only; the field stays managed.
- **Don't** put form fields, progress, or anything a dependency snapshot lists in `put`.

## Behavior

- Excluded from `state.get()` snapshots, iteration, `Object.keys`, and `ref(this)`.
- Writable after destroy - a late callback may null a handle. Managed fields throw there.
- Assign from methods, where `this` is the instance. A write through the tracking proxy shadows rather than assigns.
- An overlay may assign one - constructor argument, `set({ ... })`, or Component props - with no event dispatched for the key.
- `readonly x = put(...)` blocks authored writes at compile time; overlays still apply.

## Inheritance

Instructions are values, not declarations. A subclass which overrides the field with a plain value gets an ordinary managed property - reactive, and throwing on post-destroy writes. Restate the instruction to keep it:

```ts
class Base extends State {
  handle = put<Socket>();
}

class Sub extends Base {
  handle = put<Socket>();  // not `= someSocket`
}
```

This holds for every instruction; `put` is called out because the silent result is a different storage class.

## Type Signatures

```ts
function put<T>(value: T): T;
function put<T>(): T | undefined;
```
