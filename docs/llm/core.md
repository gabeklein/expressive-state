# Expressive State — Core

The `@expressive/state` package. Framework-agnostic state management built on classes.

## Creating State

```ts
import State from '@expressive/state';

class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }
}
```

### Instantiation

```ts
// Static constructor — creates AND activates (dispatches ready event)
const counter = Counter.new();

// With initial values
const counter = Counter.new({ count: 10 });

// With an ID
const counter = Counter.new('my-counter');
```

> `new Counter()` constructs but does NOT activate. Always prefer `Counter.new()`.

## Properties & Reactivity

Assign class fields normally. Any property write triggers a batched update event.

```ts
class App extends State {
  name = 'World';
  count = 0;
}

const app = App.new();
app.name = 'Alice'; // queues an update
app.count = 1; // queues another
// both flush together via setTimeout(0)
```

## get() — Read & Subscribe

Multiple overloads on the instance method:

```ts
// Export all current values as plain object
const values = state.get();

// Tracked effect — re-runs when accessed properties change
const stop = state.get((current) => {
  console.log(current.count); // subscribes to `count`
});

// Get a single property value
const count = state.get('count');

// Watch a single property
const stop = state.get('count', (key, source) => {
  console.log('count is now', source.count);
});

// Check if destroyed
const dead = state.get(null); // boolean

// Register destroy callback
const stop = state.get(null, () => {
  console.log('state destroyed');
});
```

### Effect Details

```ts
state.get(function (current, update) {
  // `this` is the state instance
  // `current` is a tracking proxy — property reads create subscriptions
  // `update` is a Set of keys that changed (empty on first run)

  console.log(current.count);

  // Optional: return a callback for fine-grained control
  return (event) => {
    // event: true = update pending, false = cancelled, null = destroyed
  };
});
```

## set() — Write & Listen

```ts
// Merge values
state.set({ count: 5, name: 'Bob' });

// Await pending update flush
await state.set();

// Dispatch a named event
state.set('customEvent');

// Set a single property (unchecked)
state.set('count', 42);

// Listen to all updates
const stop = state.set((key, source) => {
  console.log('updated:', key);
});

// Destroy the state
state.set(null);
```

## Lifecycle

```ts
class App extends State {
  // Optional — called after activation
  protected new() {
    console.log('ready');

    // Optional — return cleanup function
    return () => {
      console.log('destroyed');
    };
  }
}
```

Constructor args (`State.Args`) accept strings (ID), objects (initial values), and callbacks:

```ts
class App extends State {
  value = '';

  constructor(...args: State.Args) {
    super(...args);
  }
}

const app = App.new({ value: 'hello' });
```

## Observable / Event System

State extends Observable. The event system is also usable standalone.

```ts
import { addListener, watch, event } from '@expressive/state';

// Subscribe to updates
const stop = addListener(state, (key, source) => {
  console.log('event:', key);
});

// Auto-tracking effect (like state.get(effect))
const stop = watch(state, (current) => {
  console.log(current.count);
});

// Manual dispatch
event(state, 'myEvent');
```

### Event Semantics

| Value                        | Meaning                    |
| ---------------------------- | -------------------------- |
| `true`                       | Ready / initial activation |
| `false`                      | Update flush completed     |
| `null`                       | Destroyed (terminal)       |
| `string \| symbol \| number` | Property or custom event   |

All events are batched and flushed via `setTimeout(0)`.

## Context

Hierarchical state lookup. States can find each other through shared context.

```ts
import { Context } from '@expressive/state';

const ctx = new Context({ AppState, UserState });
const app = ctx.get(AppState); // fetch by class
const child = ctx.push({ ChildState }); // nested context
child.pop(); // destroy child context
```

Context is primarily used through the `get()` instruction (see `instructions.md`) and the React `Provider` component (see `react.md`).

## Static Methods

```ts
// Type guard
Counter.is(unknown); // => boolean

// Global listener for all instances of a class
const stop = Counter.on((key, source) => {
  console.log('any counter updated');
});
```

## The `is` Property

Every state has a circular `is` reference to itself. Useful after destructuring:

```ts
const { count, is: counter } = Counter.new();
counter.increment();
```
