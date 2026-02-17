# Expressive State — React Adapter

The `@expressive/react` package. Connects State to React with hooks, components, and a custom JSX runtime.

```bash
npm install @expressive/react
```

## State.use() — Local Component State

Creates a state instance scoped to the component lifecycle. Subscribes to updates automatically.

```typescript
import State from '@expressive/react';

class Counter extends State {
  count = 0;
  increment() { this.count++; }
}

function App() {
  const counter = Counter.use();
  return <button onClick={counter.increment}>{counter.count}</button>;
}
```

### Accepting Props via `use()` Method

Define a `use()` method on your class to receive arguments from the hook:

```typescript
class Greeter extends State {
  greeting = "";

  use(props: { name: string }) {
    this.greeting = `Hello, ${props.name}`;
  }
}

function App({ name }: { name: string }) {
  const state = Greeter.use({ name });
  return <p>{state.greeting}</p>;
}
```

The `use()` method is called every render.

## State.get() — Context Hook

Fetches a state instance from context (provided upstream via `Provider` or `State.as()`).

```typescript
class AppState extends State {
  user = "Alice";
}

function Profile() {
  const app = AppState.get();
  return <p>{app.user}</p>;
}
```

### Computed Values

Pass a factory to derive values with automatic subscriptions:

```typescript
function UserName() {
  const name = AppState.get(($) => $.user);
  return <span>{name}</span>;
}
```

Only re-renders when accessed properties change.

### Optional Lookup

```typescript
const app = AppState.get(false); // undefined if not provided
```

### Effect (No Re-render)

Return `null` from the factory to run a side effect without subscribing:

```typescript
AppState.get(($) => {
  console.log("User:", $.user);
  return null;
});
```

### Manual Refresh

The second argument is a refresh trigger for async flows:

```typescript
const data = AppState.get(($, refresh) => {
  const reload = () => refresh(fetch("/api/data"));
  return { user: $.user, reload };
});
```

## State.as() — Component Factory

Converts a State class into a React component.

### With Render Function

```typescript
const CounterView = Counter.as((props, self) => (
  <div>
    <p>{self.count}</p>
    <button onClick={self.increment}>+1</button>
  </div>
));

// State fields are accepted as props
<CounterView count={5} />
```

### With Custom Props

```typescript
interface LabelProps {
  label: string;
}

const LabeledCounter = Counter.as((props: LabelProps, self) => (
  <div>
    <label>{props.label}</label>
    <span>{self.count}</span>
  </div>
));

<LabeledCounter label="Score" count={0} />
```

### With Default Props (Provider Pattern)

```typescript
const CounterProvider = Counter.as({ count: 0 });

// Wraps children, provides state to context
<CounterProvider>
  <ChildComponent />
</CounterProvider>
```

### Chaining Defaults

```typescript
const WithDefaults = LabeledCounter.as({ label: "Default" });
```

### Special Component Props

All `.as()` components accept:

- `is` — callback receiving the state instance on creation
- `fallback` — React node shown during Suspense
- `children` — standard React children

```typescript
<CounterView
  is={(counter) => console.log("created", counter)}
  fallback={<Loading />}
/>
```

## Provider & Consumer

```typescript
import { Provider, Consumer } from '@expressive/react';

// Provide state to descendants
<Provider for={AppState}>
  <App />
</Provider>

// Multiple states
<Provider for={{ app: AppState, user: UserState }}>
  <App />
</Provider>

// With initialization callback
<Provider for={AppState} forEach={(instance) => {
  instance.user = "Bob";
}}>
  <App />
</Provider>

// Consumer
<Consumer for={AppState}>
  {(app) => <p>{app.user}</p>}
</Consumer>
```

## Custom JSX Runtime

Use State classes directly as JSX elements by configuring the JSX import source:

```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/react"
  }
}
```

Then any State class with appropriate fields works as a component:

```typescript
class Card extends State {
  title = "";
  children?: ReactNode;
}

// Use directly in JSX — no .as() needed
<Card title="Hello">
  <p>Content</p>
</Card>
```

The JSX runtime automatically wraps State classes, providing them to context and rendering children.

## Exports

```typescript
// Main
export { State as default } from '@expressive/react';

// Re-exported from @expressive/state
export { Context, Observable, get, use, ref, set };

// React-specific
export { Provider, Consumer };
```
