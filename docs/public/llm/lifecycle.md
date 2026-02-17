# Lifecycle & Internals — Expressive State

Deep reference for State lifecycle, teardown, error handling, and effect scheduling.

## Lifecycle Phases

| Phase | Trigger | What Happens | State Ready? |
|-------|---------|--------------|:---:|
| Construction | `new MyState()` | `prepare()` + `init()` — listeners registered, nothing activated | NO |
| Activation | `State.new()` calls `event(instance)` | Properties managed, constructor args executed, `new()` hook called | YES |
| Operation | Property assignment | Batched updates via `setTimeout(0)`, effects re-run | YES |
| Destruction | `state.set(null)` | Children destroyed first, listeners called, state frozen | DESTROYED |

> **Always use `State.new()` not `new State()`.** The `new` keyword alone does not activate — properties aren't managed until the ready event fires.

## Construction: prepare()

`prepare(state)` (state.ts):
1. Generates unique ID: `${ClassName}-${uid()}` (6-char random)
2. Walks prototype chain collecting parent classes
3. Processes static `State.on()` listeners
4. Creates method descriptors with auto-binding getters
5. Caches method sets per class in `METHODS` WeakMap

## Construction: init()

`init(state, ...args)` (state.ts):
1. Creates empty state record in `STATE` WeakMap
2. Registers a listener for the **ready event** (`key === true`) that:
   - Manages all own properties (creates reactive getters/setters)
   - Processes constructor arguments in order:
     - `string` → sets instance ID
     - `function` → called with `this` context; return value becomes cleanup
     - `object` → assigned to state properties
     - `Promise` → caught and logged if rejected
     - `array` → flattened and re-processed
   - Registers destruction listener

## Activation: event()

`State.new()` calls `event(instance)` which emits the ready event (`key = true`).

This triggers the listener from `init()`, completing initialization:
- All properties get reactive descriptors
- Constructor args execute
- Child states with `PARENT` relationship are activated
- The `new()` hook runs

## The `new()` Hook

```ts
class Timer extends State {
  elapsed = 0;

  protected new() {
    // Runs once after all properties are initialized.
    // Child states are already set up at this point.
    const id = setInterval(() => this.elapsed++, 1000);

    // Return cleanup — called on destruction
    return () => clearInterval(id);
  }
}
```

- Called during ready event, after all properties managed
- Return `void` — no cleanup needed
- Return `() => void` — cleanup function for destruction

## Property Management

When a property is managed (during ready event):

```ts
// Getter: reads from STATE record, calls follow() for proxy observation
// Setter: calls update(), auto-parents child State instances

if (value instanceof State && !PARENT.has(value)) {
  PARENT.set(value, target);
  event(value); // activate child
}
```

Child states assigned as properties are automatically parented and activated.

## Destruction

`state.set(null)` triggers:

1. **Children destroyed first** — iterates all child states where `PARENT.get(child) === self`, calls `child.set(null)`
2. **All listeners notified** — emit `key = null` to every listener
3. **Effect cleanups run** — cleanup functions called with `null`
4. **`new()` cleanup called** — returned function from `new()` invoked
5. **State frozen** — `Object.freeze(state)` prevents further updates

```ts
// Post-destruction, any update throws:
// "Tried to update {state}.{key} but state is destroyed."
```

### Ordering guarantee

Children are always destroyed before parents. In nested contexts, destruction happens inner-to-outer.

## Event System

### Event keys

| Key | Meaning |
|-----|---------|
| `true` | Ready event — state initialized |
| `false` | Batch complete — all pending property updates flushed |
| `string/number` | Property update |
| `null` | Destruction |

### Batching

All property updates in the same tick are batched:

```ts
state.foo = 1;  // enqueue: setTimeout(() => flush(), 0)
state.bar = 2;  // just add to pending keys
state.baz = 3;  // just add to pending keys
// → single flush with all 3 keys
```

Implementation: `DISPATCH` Set + `PENDING_KEYS` WeakMap. First update schedules `setTimeout(0)`. Subsequent updates add to pending set. Single flush emits `key = false` with accumulated keys.

### Value equality

Updates are skipped when new value === previous value:

```ts
state.foo = state.foo; // no-op, no event emitted
```

## Effect System (watch / get with callback)

### Execution flow

1. Effect callback receives a **proxy** of the state
2. Property accesses on proxy are tracked in a `watch` Set
3. Only tracked properties trigger re-runs
4. Re-runs are queued asynchronously via `enqueue()`
5. Previous cleanup runs before re-invocation

### Cleanup semantics

Effect cleanup functions receive a signal argument:

| Argument | Meaning |
|----------|---------|
| `true` | Effect re-running (dependency changed) |
| `false` | Effect cancelled (manual unsubscribe) |
| `null` | State destroyed |

### Suspense in effects

If an effect throws a Promise, the effect is paused:

```ts
state.get((current) => {
  const value = current.pendingProp; // throws Suspense if not yet set
  console.log(value); // only runs after resolved
});
```

The Promise resolution re-invokes the effect.

## Context Hierarchy

Contexts use prototype chains for inheritance:

```ts
const parent = new Context({ stateA });
const child = parent.push({ stateB });
// child inherits stateA, adds stateB
```

- `Context.get(Type)` walks the prototype chain
- `push()` creates child via `Object.create(parent)`
- `pop()` deletes symbol keys, runs cleanup, destroys owned states
- States are registered with symbol keys derived from their class hierarchy

### Implicit child registration

When a state is added to context, its child states (via `PARENT` relationship) are automatically registered too:

```ts
class App extends State {
  theme = new Theme();  // auto-registered in context alongside App
}
```

## Error Handling

### Async errors in constructors

```ts
// Caught and logged, don't prevent state creation
constructor() {
  super(async () => {
    throw new Error('fail'); // logged to console.error
  });
}
```

### Accessing destroyed state

Throws synchronously after `set(null)`.

### Accessing uninitialized required values

Throws a Suspense-compatible error (Promise with Error properties):

```ts
class Test extends State {
  value = set<string>(); // no default
}

const t = Test.new();
t.value; // throws Suspense — resolves when value is assigned
```

If state is destroyed before value is set, the Suspense promise rejects.

### Circular updates

Effects that update properties they read don't re-trigger in the same cycle. The update is processed in the next batch:

```ts
watch(test, ({ foo }) => {
  test.bar = foo; // doesn't cause infinite loop
});
```
