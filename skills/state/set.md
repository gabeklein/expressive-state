# `state.set()` - Write & Listen

Instance method on State for writing values, dispatching events, listening to updates, destroying state, and defining properties.

All write-side operations share this one verb so the library's instance surface stays at two methods (`get`/`set`), leaving the rest of the namespace to the model's own fields. Overloads dispatch on the kind of the first argument, and each form is individually typed (see [design.md](../design.md)).

## Overloads

### Await pending flush

```ts
set(): State.Updated<this>
```

Returns a promise-like array of keys updated in the current batch. Resolves when flush completes. If no update is outstanding, resolves to an empty array.

This is one state's next flush. To wait on the whole cascade a write sets off - every subscriber, including readers of other states - use `pending(work)` ([state.md](state.md#presentation-transitions)).

Also triggers activation if state was created with `new` (not `State.new()`).

```ts
const updated = await state.set();
// ['foo', 'bar'] - keys that changed
```

### Merge values

```ts
set(assign?: State.Assign<this>, silent?: boolean): State.Updated<this>
```

Merges properties from object into state. Only known properties and methods are applied; unknown keys are ignored. The `is` property is always ignored.

This makes `set(values)` the wire-snapshot ingest: a host payload may be a superset - extra keys drop, missing keys stay untouched. `undefined` / `null` present in the bag *do* write, so don't pad. On a subclassable class the ingest call is `this.set(msg.values as State.Assign<Session>)` (the cast below); never hand-roll an `apply()`/`pick` loop over declared fields.

```ts
state.set({ count: 5 }); // merge, triggers events
state.set({ count: 5 }, true); // merge silently (no events, no throw if destroyed)
```

Silent mode is useful during teardown - returns without throwing if state is destroyed.

Methods can be replaced via set:

```ts
state.set({
  method() {
    return this.value + 1; // `this` is bound correctly
  }
});
```

#### What `Assign<this>` checks

`Assign<T>` is `Record<string, unknown> & { [K in Field<T>]?: ... }`. The intersection means **unknown keys are not rejected** at the type level (they're ignored at runtime); the only call-site protection is **value-type-correctness of declared fields**:

```ts
state.set({ count: 'no' }); // error - count is a number
state.set({ kount: 5 });    // OK to the type-checker - unknown key, ignored at runtime
```

#### Self-calls under polymorphic `this`

Calling `this.set({ field }, ...)` from **inside a subclassable class** fails to type-check:

```ts
class Base extends State {
  path = '/';
  go() {
    this.set({ path: '/x' }, true);
    //        ^ Type '{ path: string }' is not assignable to 'Assign<this>'
  }
}
```

Inside the class body `this` is the polymorphic `this` type, so `this[K]` is unresolved and TS cannot verify the literal's value types - and that value-check is the *only* thing `Assign<this>` enforces. Every `keyof this`-based alternative fails identically (a generic-inferred parameter, `Partial<Values<this>>`, even the keyed-pair `set('path', v)` - the string literal isn't provably `keyof this`).

The fix is a cast to the concrete class, which loses **no real safety** - the value-check it bypasses was never available under polymorphic `this`:

```ts
(this as Base).set({ path: '/x' }, true);
```

This is a TypeScript limitation (mapped types over polymorphic `this`), not an mvc bug. External callers on a concrete instance (`base.set({ path })`) type-check normally. No looser parameter type can both accept the literal *and* value-check it when `this` is unresolved - it's pick-one, so the cast is the idiomatic escape hatch.

### Listen to updates

```ts
set(callback: State.OnEvent<this>): () => boolean
```

Callback fires for every property assignment that changes a value, and for explicit event dispatches. Receives `(key, source)` where key is a string, number, or symbol.

Returns an unsubscribe function (returns `true` if removed, `false` if already inactive).

```ts
const stop = state.set((key, source) => {
  console.log('updated:', key);
});
```

Callback fires synchronously on each assignment. If callback returns a function, that function is called once when the batch settles (deduped across multiple assignments in same tick). If the settled callback throws, the error is logged.

Return `null` from callback to auto-unsubscribe.

### Dispatch event

```ts
set(key: State.Event<this>): State.Updated<this>
```

Dispatches a named event without changing any value. Useful for signaling internal changes (e.g., array mutation) or custom events.

```ts
state.set('count'); // force update event for 'count'
state.set('myEvent'); // dispatch custom string event
state.set(Symbol('ev')); // dispatch symbol event
state.set(42); // dispatch number event
```

### Destroy

```ts
set(status: null): void
```

Terminates the state. Children are destroyed first (inner-to-outer ordering). All listeners are notified with `null`. Cleanup functions run. State is frozen afterward.

```ts
state.set(null);
```

After destruction:

- Property assignment throws: `"Tried to update {state}.{key} but state is destroyed."`
- Silent updates (`state.set(assign, true)`) return without throwing.

### Listen to specific event

```ts
set<K extends State.Event<this>>(event: K | null, callback: State.OnEvent<this>): () => boolean
```

Register a callback for a specific property key or event. Pass `null` to listen for destruction.

```ts
const stop = state.set('count', (key, source) => {
  console.log('count changed');
});

state.set(null, (key, source) => {
  console.log('destroyed');
});
```

Return `null` from callback to auto-unsubscribe after first invocation.

### Define property (descriptor)

```ts
set<K extends State.Event<this>>(key: K, config: State.Define<this, K>): State.Updated<this>
```

Define or update a managed property using a descriptor config. If the property already has a reactive getter/setter, only `value` is accepted (other fields throw). If the property does not exist, it is created as a new reactive property.

```ts
state.set('foo', { value: 'bar' }); // update value (bypasses setter)
state.set('bar', { value: 'hello', set: false }); // define read-only property
state.set('baz', { value: 'hidden', enumerable: false }); // define non-enumerable property
state.set('child', { value: new ChildState() }); // registers child state
```

Config fields:

- `value` - initial or updated value
- `get` - custom getter function, `true` (required/suspense), or `false` (optional)
- `set` - custom setter function or `false` (read-only)
- `enumerable` - whether property appears in `Object.keys()` (default `true`)

New properties defined this way are fully reactive and trackable in effects.

## Type Signatures

```ts
type OnEvent<T extends State> = (
  this: T,
  key: Signal<T>,
  source: T
) => void | (() => void) | null;

type Assign<T> = Record<string, unknown> & {
  [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
    ? (this: T, ...args: A) => R
    : T[K];
};

type Updated<T extends State> = readonly Event<T>[] &
  PromiseLike<readonly Event<T>[]>;

type Apply<T = any> = {
  value?: T;
  get?: ((source: State) => T) | boolean;
  set?: Setter<T> | boolean;
  enumerable?: boolean;
};
```
