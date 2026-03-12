# Expressive State — React Adapter

`@expressive/react` — connects State to React with hooks, components, and custom JSX runtime.

## State.use() — Local Component State

Creates a state instance scoped to component lifecycle. Auto-subscribes to updates.

```ts
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

Define `use()` on your class to receive arguments (called every render):

```ts
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

## State.get() — Context Hook

Fetches state from context (via `Provider` or `State.as()`).

```ts
function Profile() {
  const app = AppState.get();
  return <p>{app.user}</p>;
}
```

### Computed Values

Pass a factory to derive values — only re-renders when accessed properties change:

```ts
const name = AppState.get(($) => $.user);
```

### Optional Lookup

```ts
const app = AppState.get(false); // undefined if not provided
```

### Effect (No Re-render)

Return `null` from factory to run side effect without subscribing:

```ts
AppState.get(($) => { console.log($.user); return null; });
```

### Manual Refresh

Second argument is a refresh trigger for async flows:

```ts
const data = AppState.get(($, refresh) => {
  const reload = () => refresh(fetch('/api/data'));
  return { user: $.user, reload };
});
```

## State.as() — Component Factory

Converts a State class into a React component.

### With Render Function

```ts
const CounterView = Counter.as((props, self) => (
  <div>
    <p>{self.count}</p>
    <button onClick={self.increment}>+1</button>
  </div>
));

<CounterView count={5} /> // state fields accepted as props
```

### With Custom Props

```ts
interface LabelProps { label: string; }

const LabeledCounter = Counter.as((props: LabelProps, self) => (
  <div>
    <label>{props.label}</label>
    <span>{self.count}</span>
  </div>
));

<LabeledCounter label="Score" count={0} />
```

### With Default Props (Provider Pattern)

```ts
const CounterProvider = Counter.as({ count: 0 });

<CounterProvider>
  <ChildComponent />  {/* provides state to context */}
</CounterProvider>
```

### Chaining Defaults

```ts
const WithDefaults = LabeledCounter.as({ label: 'Default' });
```

### Special Component Props

All `.as()` components accept:
- `is` — callback receiving state instance on creation
- `fallback` — React node shown during Suspense
- `children` — standard React children

```ts
<CounterView
  is={(counter) => console.log("created", counter)}
  fallback={<Loading />}
/>
```

## Provider & Consumer

```ts
<Provider for={AppState}><App /></Provider>

// Multiple states
<Provider for={{ app: AppState, user: UserState }}><App /></Provider>

// With init callback
<Provider for={AppState} forEach={(instance) => { instance.user = "Bob"; }}>
  <App />
</Provider>

<Consumer for={AppState}>
  {(app) => <p>{app.user}</p>}
</Consumer>
```

## Custom JSX Runtime

Use State classes directly as JSX elements:

```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/react"
  }
}
```

```ts
class Card extends State {
  title = "";
  children?: ReactNode;
}

<Card title="Hello"><p>Content</p></Card>  // no .as() needed
```

### render() method

Define a `render()` method to control output. When present, `children` is suppressed from the props type. Access state via `this`.

```ts
class Greeting extends State {
  name = "World";

  render() {
    return <h1>Hello, {this.name}!</h1>;
  }
}

<Greeting name="React" />
```

### Explicit props via `props!:`

Declare `props!: {}` to accept arbitrary props not managed as state fields. Available as `this.props` in `render()`.

```ts
class Article extends State {
  props!: { children: ReactNode; className?: string };

  render() {
    return <article className={this.props.className}>{this.props.children}</article>;
  }
}
```

The JSX runtime auto-wraps State classes, providing them to context and rendering children.

## Exports

```ts
export { State as default } from '@expressive/react';
export { Context, Observable, get, use, ref, set }; // re-exported from @expressive/state
export { Provider, Consumer };                       // React-specific
```
