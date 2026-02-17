# Expressive State — Core

`@expressive/state` — framework-agnostic state management built on classes.

## Creating State

```ts
import State from '@expressive/state';

class Counter extends State {
  count = 0;
  increment() { this.count++; }
}
```

### Instantiation

```ts
const counter = Counter.new();           // creates AND activates
const counter = Counter.new({ count: 10 }); // with initial values
const counter = Counter.new('my-counter');  // with ID
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
app.name = 'Alice'; // queues update
app.count = 1;      // queues another — both flush via setTimeout(0)
```

## get() — Read & Subscribe

```ts
state.get();                    // export all values as plain object
state.get('count');             // get single property
state.get(null);                // check if destroyed (boolean)

// Tracked effect — re-runs when accessed properties change
const stop = state.get((current) => {
  console.log(current.count);
});

// Watch single property
const stop = state.get('count', (key, source) => {
  console.log('count is now', source.count);
});

// Destroy callback
const stop = state.get(null, () => console.log('destroyed'));
```

### Effect Details

```ts
state.get(function (current, update) {
  // `this` = state instance
  // `current` = tracking proxy — reads create subscriptions
  // `update` = Set of changed keys (empty on first run)
  console.log(current.count);

  // Optional: return callback for fine-grained control
  return (event) => {
    // event: true = update pending, false = cancelled, null = destroyed
  };
});
```

## set() — Write & Listen

```ts
state.set({ count: 5 });       // merge values
await state.set();              // await pending flush
state.set('customEvent');       // dispatch named event
state.set('count', 42);        // set single property (unchecked)
state.set(null);                // destroy

// Listen to all updates
const stop = state.set((key, source) => {
  console.log('updated:', key);
});
```

## Lifecycle

```ts
class App extends State {
  protected new() {
    console.log('ready');
    return () => console.log('destroyed'); // optional cleanup
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
```

## Observable / Event System

State extends Observable. Also usable standalone:

```ts
import { addListener, watch, event } from '@expressive/state';

const stop = addListener(state, (key, source) => { /* event */ });
const stop = watch(state, (current) => { /* tracked effect */ });
event(state, 'myEvent'); // manual dispatch
```

### Event Semantics

| Value | Meaning |
|-------|---------|
| `true` | Ready / initial activation |
| `false` | Update flush completed |
| `null` | Destroyed (terminal) |
| `string \| symbol \| number` | Property or custom event |

All events batched and flushed via `setTimeout(0)`.

## Context

Hierarchical state lookup — states find each other through shared context.

```ts
import { Context } from '@expressive/state';

const ctx = new Context({ AppState, UserState });
const app = ctx.get(AppState);
const child = ctx.push({ ChildState });
child.pop(); // destroy child context
```

Primarily used via `get()` instruction (see instructions.md) and React `Provider` (see react.md).

## Static Methods

```ts
Counter.is(unknown);              // type guard => boolean
const stop = Counter.on((key, source) => { /* any instance */ });
```

## The `is` Property

Circular self-reference, useful after destructuring and for silent reads:

```ts
const { count, is: counter } = Counter.new();
counter.increment(); // write access after destructuring

// Silent read — access via `is` bypasses proxy tracking
state.get((current) => {
  console.log(current.value);    // subscribes to 'value'
  console.log(current.is.other); // does NOT subscribe — silent read
});
```
