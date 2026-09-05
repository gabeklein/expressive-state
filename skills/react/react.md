# Expressive MVC - React

`@expressive/react` connects State to React with hooks, components, and context.

For core State API (properties, reactivity, lifecycle, events) see `../state/`.
For instructions and reactive helpers (`get`, `set`, `ref`, `map`, `has`, `def`) see `../field/*.md`.
For examples and patterns see `patterns.md`.

## Exports

```ts
export { State, State as default }; // Reexported after augmentation with React features
export { Context, def, get, ref, set }; // re-exported from @expressive/mvc
export { has, map }; // collection instructions, React-aware facades
export { Component }; // React Component class
export { Provider, Consumer }; // Explicit context components
```

## Quick Start

```tsx
import State, { Component, get, set, ref, Provider } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

// Use as JSX directly
<Counter count={5} />;
```

---

## State.use() - Local Component State

Creates a state instance scoped to component lifecycle. Subscribes to updates automatically. Retroactively on base State with React adapter.

```tsx
class Counter extends State {
  count = 0;
  increment() {
    this.count++;
  }
}

function App() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}
```

- Instance is created once and reused across renders.
- Component re-renders when any accessed property changes.
- Instance is destroyed on unmount (context is popped, `set(null)` called).
- Safe in React strict mode (handles double-mount correctly).
- Open the component with a dependency snapshot: destructure the exact values it renders, nested ones included (see [Dependency Snapshots](#dependency-snapshots) below).
- Writes pass through the proxy transparently; `is` is only for retaining the root object alongside sibling destructuring (see [Transparent Writes](#transparent-writes--is) below).
- Nested observable reads are proxied and tracked automatically.

### Constructor arguments

Accepts same arguments as `State.new()` - objects, callbacks:

```tsx
const state = MyState.use({ count: 10 });
const state = MyState.use((self) => {
  /* init, runs once */
});
```

### use() method

Define `use()` on your class to intercept arguments. Called every render, so also useful for encapsulating hooks.

```tsx
class Search extends State {
  query = '';
  results: string[] = [];

  use() {
    const { search } = useLocation();
    this.query = new URLSearchParams(search).get('q') || '';
  }
}

function SearchPage() {
  const { query, results } = Search.use();
  return (
    <div>
      <h1>Results for: {query}</h1>
      {results.map((r) => {
        /* ... */
      })}
    </div>
  );
}
```

This is the bridge for router hooks (`useParams`, `useLocation`, `useNavigate`); the alternative - an outer FC passing params as props - and route-identity guidance are in [patterns.md](patterns.md).

When `use()` is defined, its parameter types become the static .use() argument types. They are passed to method instead of the constructor.

```tsx
class Greeter extends State {
  greeting = '';

  use(props: { name: string }) {
    this.greeting = `Hello, ${props.name}`;
  }
}

function App({ name }: { name: string }) {
  const state = Greeter.use({ name });
  return <p>{state.greeting}</p>;
}
```

### mount() method

Define `mount()` for client-only effects. Called once when the host component
commits, and the function it returns runs on unmount.

```tsx
class Viewport extends State {
  width = 0;

  mount() {
    const measure = () => (this.width = window.innerWidth);

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }
}
```

`mount()` is an **ownership** hook, not an observation one. It runs where a
component creates and destroys the instance - `State.use()` and
`<Component />` - and never on a path that merely reaches an instance owned
elsewhere:

| Reaching an instance          | Owns it | `mount()` |
| ----------------------------- | ------- | --------- |
| `State.use()`                 | yes     | yes       |
| `<Component />`               | yes     | yes       |
| `<Provider for={State}>`      | yes     | yes       |
| `<Provider for={instance}>`   | no      | no        |
| `State.get()`                 | no      | no        |
| `{instance}`                  | no      | no        |
| `State.new()`                 | no host | no        |

A `Provider` decides per entry, so `for={{ Session, theme }}` mounts `Session`
- which it constructed and will destroy - and leaves `theme` alone. Two things
follow from `mount()` belonging to the Provider's own commit:

- Like any parent, it mounts *after* its descendants - React commits bottom-up -
  so a descendant should react to provided state through subscription rather
  than read it imperatively in its own `mount()`.
- Replacing `for` mid-life provides the new State without mounting it. Key the
  Provider (`<Provider key={name} for={Type}>`) to make the swap a fresh mount,
  the same way `key` signals changed identity anywhere else in React.

The excluded paths are all *many-to-one*: any number of components can `.get()`
one instance, or place it as `{instance}`, and each does so for less time than
the instance lives. A hook firing once per observer is not a lifecycle - to
react to an instance from a component that does not own it, subscribe with
`State.get()` or an event.

It also never runs during server render.

Pick the seam by what the work needs:

| Hook       | Phase        | Runs                        | On the server |
| ---------- | ------------ | --------------------------- | ------------- |
| `new()`    | construction | once, synchronously         | yes           |
| `use()`    | render        | every render of the host    | yes           |
| `mount()`  | commit       | once, when the host commits | no            |

Setup that must accompany the instance itself goes in `new()`; anything
touching `window`, timers or subscriptions goes in `mount()`.

### Server render (SSR / RSC)

Expressive components render on the server - `renderToString`, and the SSR pass
of an RSC app (Expressive components are client components) - without touching
the DOM. Effects don't run there, so `mount()` never fires; `new()` and `use()`
do. Three rules keep a render request-safe:

- **Request state goes in a `<Provider>`.** Each render builds its own context,
  so provided instances are isolated - one request never sees another's.
- **A `static global` is process-wide, and *shared across requests* on the
  server** (globals are not sealed - a `global` is trusted to be mutable
  process state like config, flags or a warmed cache). Keep per-request data out
  of it; put that behind a Provider.
- **Resources belong in `mount()` or the request handler, never `new()`.**
  `new()` runs on the server but its returned teardown does not - there is no
  unmount - so a socket or handle opened there leaks. `mount()` is client-only;
  server-side resources are the framework's request scope to open and close.

To render a specific request's data (a path, a session), provide it per-request:
`<Provider for={Session} …>`. The default `Router` is a client-only global for
exactly this reason - on the server it is per-render, so paths never bleed
between requests; provide `<Provider for={Router}>` to render a request's path.

### React Native

Works with no configuration - the adapter imports only `react` and
`react/jsx-runtime`, and Metro resolves it as published. Three boundaries:

- **Jest.** The build is ESM-only and `jest-expo` skips `node_modules`, so the
  import fails to parse until `@expressive` is added to
  `transformIgnorePatterns`:

  ```js
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|@expressive|react-native|@react-native|expo|@expo))'
  ]
  ```

- **`BrowserRouter` is the browser binding** - it reads `window.location`,
  which React Native does not define. Use `Router`, whose path and history are
  in memory.

- **`Link` and `NavLinks` render DOM elements** (`<a>`, `<ul>`) and have no
  native host yet. Drive navigation from `Router` directly and render your own
  `Pressable`.

---

## State.get() - Context Hook

Fetches a state instance from context (provided by `Provider` or `Component`).
Independently subscribes to updates on accessed properties. Also on all State.

```tsx
function Profile() {
  const app = AppState.get();
  return <p>{app.user}</p>;
}
```

### Optional lookup

```tsx
const app = AppState.get(false); // undefined if not in context
```

### Required values & presence boundaries

```tsx
const app = AppState.get(true); // Required<T>, throws if an accessed value is undefined
```

`get(true)` is the child half of a **presence boundary**: the parent owns whether the child renders, and the child asserts that its required values exist. This gives the child a strong contract - no fallback values threaded through its body:

```tsx
function SettingsContent() {
  const { draft } = SettingsState.get();

  return (
    <div className="settings-layout">
      <LocationList />
      {draft && <SettingsEditor />}
    </div>
  );
}

function SettingsEditor() {
  const {
    saveSettings,
    saving,
    draft: {
      bankAccount,
      categoryAccounts,
    },
  } = SettingsState.get(true);
  ...
}
```

Declare gateable fields **optional** (`draft?: SettingsLocation`), not explicitly nullable (`draft: SettingsLocation | null`). The runtime check rejects only strict `undefined`, and TypeScript's `Required<T>` removes `?` optionality but does not strip `null` from a union - an explicitly nullable field silently defeats `get(true)` on both fronts.

### Computed selector

Pass a factory to derive a value. Reruns when deps change, and only re-renders on new result:

```tsx
const name = AppState.get(($) => $.user.name);
```

Factory receives `(current, refresh)` where:

- `current` is a tracking proxy (reads create subscriptions)
- `refresh` is a `ForceRefresh` function (see below)

Return value is the component's render value. `undefined`/`void` is converted to `null`.

### Effect (no re-render)

Return `null` to run a side effect without subscribing to updates:

```tsx
AppState.get(($) => {
  console.log($.user);
  return null;
});
```

### ForceRefresh

The second argument to `State.get()` factories triggers component refresh:

```tsx
const data = AppState.get(($, refresh) => {
  // refresh() - force re-render now
  // refresh(promise) - re-render now and again after promise settles
  // refresh(asyncFn) - re-render before and after async function
  const reload = () => refresh(fetch('/api/data'));
  return { user: $.user, reload };
});
```

### Reactive context

If the upstream instance is replaced in context (e.g., Provider re-created), the hook automatically resubscribes to the new instance and refreshes.

---

## Dependency Snapshots

Open every subscribing component by destructuring the exact reactive values it renders - nested levels included, optional objects defaulted in place:

```tsx
function ReviewNotices() {
  const {
    blocking,
    hasBlocking,
    result: {
      wssDownload: {
        selectedLocationId,
        usedLogin,
      } = {},
    },
  } = ReviewStep.get();
  ...
}
```

This is the architectural norm, not a formatting preference:

1. The component's complete dependency surface is visible at the top - reviewable at a glance.
2. Trapped getters are traversed once, instead of re-walking `review.result.wssDownload.usedLogin` in every expression.
3. Reads create subscriptions. A deep read inside a conditional branch subscribes only on renders where that branch executes (a **conditional subscription**), and reads inside event handlers never subscribe at all. Hoisting reads into the snapshot makes the dependency surface deterministic.

The same rule applies to `this` inside `Component.render()` and subcomponents - rendering shares its subscription plumbing with the hooks.

## Transparent Writes & `is`

Subscription proxies pass assignments through to the real instance. Three shapes cover every case:

```tsx
const form = LoginForm.get();                    // whole object is the only need
onChange={(e) => (form.username = e.target.value)}

const { transfer, confirmed } = ReviewStep.get(); // nested object from a snapshot -
onClick={() => (transfer.step = 'generate')}      // writes are transparent

const { is: review, confirmed } = ReviewStep.get(); // root object + sibling values:
                                                     // only here does `is` earn its place
```

Do not alias `is` merely because something will be written - writes never need the raw instance. Unwrapping nested objects through `is` is noise.

---

## Component Class

`Component` extends `State` and works directly as a React component. See `./component.md` for full details.

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

<Counter count={5} />;
```

Key features:

- State fields become optional JSX props, applied every render.
- `render()` controls output; without it, children pass through a context provider.
- Instances are automatically provided to context for child access via `State.get()`.
- Built-in suspense (`fallback` property/prop) and error boundaries (`catch()` method).
- PascalCase methods become reactive subcomponents.
- Special props: `is` (creation callback), `ref` (instance ref), `fallback` (suspense UI, or `false` to defer to an ancestor boundary).
- Strict mode safe.

---

## Provider & Consumer

```tsx
import { Provider, Consumer } from '@expressive/react';

<Provider for={AppState}><App /></Provider>

// Multiple states
<Provider for={{ app: AppState, user: UserState }}><App /></Provider>

// With instance
<Provider for={existingInstance}><App /></Provider>

// With init callback
<Provider for={AppState} is={(instance) => { instance.user = "Bob"; }}>
  <App />
</Provider>

// With suspense fallback
<Provider for={AppState} fallback={<Loading />}>
  <App />
</Provider>
```

### Provider props

| Prop       | Type                                    | Description                                        |
| ---------- | --------------------------------------- | -------------------------------------------------- |
| `for`      | `State \| State.Type \| Context.Accept` | State instance, class, or map to provide           |
| `is`       | `(instance) => void`                    | Called for each created instance                   |
| `fallback` | `ReactNode`                             | Wraps children in Suspense boundary                |
| `children` | `ReactNode`                             | Content rendered within provider                   |
| `[field]`  | varies                                  | State fields passed as props, merged into instance |

State fields can be passed directly as JSX attributes:

```tsx
<Provider for={AppState} user="Bob">
  <App />
</Provider>
```

Provider creates instances from classes, or uses given instances directly.
Created instances are destroyed on unmount. Given instances are not.

### Consumer

```tsx
<Consumer for={AppState}>{(app) => <p>{app.user}</p>}</Consumer>
```

Consumer uses `State.get()` internally - child function receives a tracking proxy.

---

## Internals: Runtime

Each adapter injects framework hooks into a shared `Runtime` object, allowing the same core logic to work across React and Preact:

```ts
Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  Suspense,
  // plus adapter-specific: dedupe, ErrorBoundary, ignore
});
```
