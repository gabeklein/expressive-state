# `def` - Custom Instruction

Runnable source: [`def`](https://expressive.dev/examples/instructions/def) - a complete working program, served as HTML.

```ts
import { def } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Low-level primitive for defining custom property behavior during initialization. All other instructions (`get`, `set`, `ref`) are built on `def`.

Reach for it when writing your own instruction. For unmanaged storage use [`put`](put.md) - a factory returning void defines an own property the store never sees, but an enumerable one is captured as managed state.

## Usage

```ts
class MyState extends State {
  custom = def((key, subject, state) => {
    // key: property name (string)
    // subject: the state instance
    // state: the internal store (State.Values<T>)
    return { value: computedValue };
  });
}
```

The factory runs during instance initialization (triggered by `State.on`). The property's symbol placeholder is deleted before the factory runs.

## Return Values

The factory can return:

### Nothing (void)

```ts
custom = def((key, subject) => {
  // side effect only, no property configuration
});
```

### Cleanup function

```ts
custom = def((key, subject) => {
  const interval = setInterval(poll, 1000);
  return () => clearInterval(interval); // runs on destroy
});
```

### Configuration object

```ts
custom = def<string>((key, subject) => ({
  value: 'initial', // initial property value
  enumerable: true, // appear in Object.keys()
  get: (subscriber) => v, // custom getter (receives subscriber if in tracked context)
  set: (next, prev) => {}, // custom setter
  destroy: () => {} // cleanup on destruction
}));
```

#### Getter options

- `function`: called on property access, receives the subscriber (or the instance if none)
- `true`: property is required - throws suspense if value not yet set
- `false`: property is optional - returns undefined if not yet set
- `undefined`: no special getter behavior

#### Setter options

- `function`: called on assignment with `(next, prev)`. Throw `false` to reject. Throw `true` to accept silently. Return a transformed value to override.
- `false`: property is read-only (throws on assignment)
- `undefined`: no special setter behavior

## Type Signatures

```ts
function def<T>(factory: def.Factory<T>): T;

type def.Factory<T, M extends State> = (
  this: M,
  key: Extract<State.Field<M>, string>,
  thisArg: M,
  state: State.Values<M>
) => def.Config<T> | (() => void) | void;

interface def.Config<T> extends State.Apply<T> {
  destroy?: () => void;
}
```

## Child State (No Instruction Needed)

Nest states by direct assignment. Children are auto-parented and destroyed with parent.

```ts
class Parent extends State {
  child = new ChildState(); // auto-parented and activated when Parent initializes
}
```
