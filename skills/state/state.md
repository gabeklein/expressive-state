# State - Core Class

```ts
import State from '@expressive/mvc';
```

`@expressive/mvc` - framework-agnostic reactive state management built on classes.

## Creating State

```ts
class Counter extends State {
  count = 0;
  increment() {
    this.count++;
  }
}
```

### Instantiation

```ts
const counter = Counter.new(); // creates AND activates
const counter = Counter.new({ count: 10 }); // with initial values
```

> `new Counter()` constructs but does not activate. Use `Counter.new()` for a root instance. Bare `new` is correct for a child State declared on another State, which adopts and activates it, or when activation must be deferred deliberately.

## Properties & Reactivity

Assign class fields normally. Any property write triggers a batched update event.

```ts
class App extends State {
  name = 'World';
  count = 0;
}

const app = App.new();
app.name = 'Alice'; // queues update
app.count = 1; // queues another - both flush via microtask
```

### Presentation Transitions

```ts
import { pending } from '@expressive/mvc';

await pending(() => {
  app.page = 'settings';
});
```

`pending(work)` runs `work` now and marks the updates it queues non-urgent, resolving once every reader has absorbed them - see [Transitions](../react/component.md#transitions). Under React that waits for presentation, so a replacement which suspends holds the current screen instead of falling back. A free function, not a method: settlement comes from whichever readers the writes touch, and each replays through the scheduler it subscribed with.

With no host registered there is no priority to apply, but the promise still resolves once every subscriber has replayed - awaiting it is how headless code waits out a whole cascade, not just the first flush. Distinct from `state.set()`, which resolves on the next flush of *that* state (see [set.md](set.md)).

`pending()` with no arguments is the reader half. Called inside a replay it returns a release callback, and settlement waits on that rather than on the replay returning - which is how the React adapter holds until it commits. A hand-written `watch` effect can do the same; outside a deferred replay it returns `undefined`.

```ts
watch(state, () => {
  const release = pending();
  animate().then(release);
});
```

### Value Equality

Updates are skipped when new value `===` previous value. No event is emitted.

### Property Iteration

```ts
for (const [key, value] of state) {
  // iterates managed properties
}
```

### Unmanaged Instance Data

Opaque handles - unsubscribe functions, timers, snapshots - are not reactive state: writes should not notify, nor throw thru the managed setter after destroy. TypeScript `private` does not opt out (any enumerable own field is managed); ES `#private` escapes management but re-initializes unsafely on Components. Define the field non-enumerable via `def`:

```ts
import State, { def } from '@expressive/mvc';

function put<T>(initial?: T): T {
  return def((key, self) => {
    Object.defineProperty(self, key, {
      value: initial as T,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }) as T;
}

class Job extends State {
  progress = 0;                              // reactive
  unwatch = put<(() => void) | null>(null);  // unmanaged
}
```

The `def` factory returns void, so no managed property is applied. A destroyed instance is frozen - run cleanup before then: `const stop = this.unwatch; this.unwatch = null; stop?.();`. A handle only lifecycle touches stays simpler as a `new()` closure variable.

## The `is` Property

Circular self-reference. Destructure first to retain instance access alongside values, and usually alias it to the state concept (`is: counter`, `is: form`) rather than keeping a local named `is`.

```tsx
const Component = () => {
  const { is: counter, count } = Counter.use();

  return <button onClick={() => counter.count++}>{count}</button>;
};
```

Also use for silent reads inside effects, or when you want to guarantee the unwrapped instance. `state.is` is always the instance whether or not `state` is a proxy. Idempotent, so `state.is.is` is safe.

```ts
// Silent read - access via `is` bypasses proxy tracking
state.get((current) => {
  console.log(current.value); // subscribes to 'value'
  console.log(current.is.other); // does NOT subscribe - silent read
});
```

## Child States

Nest states by direct assignment. Children are auto-parented, activated, and destroyed with parent.

```ts
class Parent extends State {
  child = new ChildState(); // auto-parented and activated when Parent initializes
}
```

- Replacing a child property destroys the old child (if owned).
- Non-owned children (assigned from outside) survive replacement.
- Setting a child property to `null` destroys the owned child.

## Methods

Methods are auto-bound on first access. Safe to destructure.

```ts
const { increment } = Counter.new();
increment(); // `this` is correctly bound
```

- Overwriting methods works: `test.method = () => 'bar'`.
- `super` calls work across inheritance chains.
- Methods called inside effects do NOT create subscriptions for properties they access.
- `this` inside a method is the instance, never a tracking proxy - so `this === this.is`, and it is safe as a `Map`/`Set` key or for identity comparison. True however the method was reached, including off a proxy handed to an effect or render. The `new()` hook has the same guarantee (see [lifecycle.md](lifecycle.md#the-new-hook)).

## Static Methods

### `State.new()`

Creates and activates a new instance. Accepts `State.Args` - objects (initial values), callbacks (lifecycle), strings (ID).

```ts
const test = Test.new(
  { foo: 1 }, // initial values
  (self) => {
    // lifecycle callback
    return () => {}; // cleanup on destroy
  },
  { bar: 2 } // more initial values
);
```

Arguments are processed in order. Callbacks can return:

- `() => void` - cleanup function, called on destroy
- `object` - merged as initial values
- `array` - flattened and re-processed
- `Promise` - caught and logged if rejected

### `State.is()`

Type guard. Returns true if argument is this class or a subclass.

```ts
Counter.is(SubCounter); // true
Counter.is(OtherState); // false
```

### `State.on()`

Register a callback for any instance creation of this class (or subclasses).

```ts
const stop = Counter.on(function (this: Counter) {
  // runs for every Counter instance on init
  return () => {
    /* cleanup on destroy */
  };
});
```

- Callbacks run in ancestor-first order.
- Same callback registered on parent and child runs only once.
- Returns unsubscribe function.

`on()` is the mix-in for environment-specific activation of a shared class. The domain module stays fields-only - no `window`, DOM, or host APIs at module scope or in `new()`; an adapter module re-exports the class and registers `on()` once, so every instance constructed after that import gets the wiring and environments that never import the adapter never run it. Don't subclass (`class ViewSession extends Session`) and don't construct in the adapter - the consumer owns the instance. Recipe: [patterns.md](../react/patterns.md).

## Constructor Args (`State.Args`)

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | void)[];
```

Accepts nested arrays (flattened at runtime), objects (assigned), and callbacks (lifecycle).

## Observable / Event System

State extends Observable. Also usable standalone:

```ts
import { listener, watch, event, observer, touch } from '@expressive/mvc/observable';

const stop = listener(state, (key, source) => {
  /* event */
});
const stop = watch(state, (current) => {
  /* tracked effect */
});
event(state, 'myEvent'); // manual dispatch
```

Use `observer(target, true)` to opt a custom object into the observable protocol, then use `touch(this, key, value)` in getters so `watch()` and adapter hooks can subscribe to accessed fields.

### Event Semantics

| Value                        | Means                      |
| ---------------------------- | -------------------------- |
| `true`                       | Ready / initial activation |
| `false`                      | Update flush completed     |
| `null`                       | Destroyed (terminal)       |
| `string \| symbol \| number` | Property or custom event   |

All events batched and flushed via `queueMicrotask()`.

## Context

Every active State has a "home context" that determines where its `state.get(Type)` lookups originate. `State.new()` registers to `Context.root` (the global instance) when not already claimed; `new Context(StateClass)` registers to particular context. Home is locked once assigned. Largely advanced/internal.

See [context.md](context.md) for the full Context API, global root semantics, and the `new State()` escape hatch for pre-init context placement.

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).

## String Representation

Each instance gets a unique identifier used by `toString()` and error messages.
