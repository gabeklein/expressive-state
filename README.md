<p align="center">
  <img height="90" src=".github/logo.svg" alt="Expressive Logo"/>
  <h1 align="center">
    Expressive State
  </h1>
</p>

<h4 align="center">
  Class-based reactive state management for modern UI frameworks
</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/state"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Fstate.svg"></a>
  <img src="https://img.shields.io/badge/Coverage-100%25-brightgreen.svg">
  <a href="https://join.slack.com/t/expressivejs/shared_invite/zt-s2j5cdhz-gffKn3bTATMbXf~iq4pvHg" alt="Join Slack">
    <img src="https://img.shields.io/badge/Slack-Come%20say%20hi!-blueviolet" />
  </a>
</p>

<p align="center">
  Define classes to power UI by extending <code>State</code>.<br/>
  Built-in hooks manage renders automatically for any data.<br/>
  When properties change, your components update too.<br/>
</p>

<br />

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Features](#key-features)
  - [Simple Updates](#simple-updates)
  - [Async Operations](#async-operations)
  - [Shared State via Context](#shared-state-via-context)
  - [Composable States](#composable-states)
  - [Fine-Grained Reactivity](#fine-grained-reactivity)
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Reusable Classes](#reusable-classes)
- [Core Concepts](#core-concepts)
- [Instructions](#instructions)
- [React Integration](#react-integration)
- [Advanced Features](#advanced-features)
- [Framework Support](#framework-support)
- [CI/CD Pipeline](#cicd-pipeline)

<br />

## Overview

Expressive State is a reactive state management library built around classes. It provides framework-agnostic reactive primitives with dedicated adapters for React, Preact, and Solid.

**Why Expressive?**

- **Class-based**: Leverage TypeScript's class features for type-safe, self-documenting state
- **Reactive**: Automatic fine-grained subscriptions - components only re-render when accessed properties change
- **Portable**: State logic lives in classes, not components - easy to test and reuse
- **Context-aware**: Built-in dependency injection via hierarchical contexts
- **Framework-agnostic**: Core primitives work anywhere; framework adapters provide integration

<br />

## Installation

```bash
npm install @expressive/react
```

```ts
import State from '@expressive/react';
```

> For other frameworks, use `@expressive/preact`, `@expressive/solid`, or the core `@expressive/state` package.

<br />

## Quick Start

1. **Create a State class** with your values and methods
2. **Use `State.use()`** in a component to create an instance
3. **Destructure properties** you need - this automatically subscribes to them
4. **Update via assignment** - components re-render automatically

<br />

Simply define a custom State -

```tsx
import State from '@expressive/react';

class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}
```

\- and use it in a component!

```tsx
function CounterWidget() {
  const { count, increment, decrement } = Counter.use();

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

It's that simple! <a href="https://codesandbox.io/s/github/gabeklein/expressive-state/tree/main/examples/counter?file=/src/Counter.tsx" target="_blank">Try it in a sandbox →</a>

<br />

## Key Features

### Simple Updates

State management is portable because values are held in an object. Updates may originate from anywhere with a reference to the model.

```tsx
class Control extends State {
  count = 0;
  message = 'Hello';

  increment() {
    this.count++;
  }
}
```

```tsx
function MyComponent() {
  const { is: control, count, message, increment } = Control.use();

  return (
    <div>
      <p onClick={() => (control.count += 10)}>Count: {count}</p>
      <p onClick={() => (control.message = 'Updated!')}>Message: {message}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

<sup><a href="https://codesandbox.io/s/github/gabeklein/expressive-state/tree/main/examples/simple?file=/src/Demo.tsx" target="_blank">View in CodeSandbox</a></sup>

> The reserved property `is` loops back to the instance, helpful to update values after destructuring.

<br/>

### Async Operations

With no additional libraries, Expressive makes async operations simple. Just use regular async functions!

```tsx
class Control extends State {
  agent = 'Bond';
  remaining = 30;
  dead?: boolean = undefined;

  // Called when State is created.
  new() {
    const timer = setInterval(() => {
      const remains = this.remaining--;

      if (remains === 0) {
        this.dead = Math.random() > 0.5;
        clearInterval(timer);
      }
    }, 1000);

    // Cleanup runs when State is destroyed
    return () => clearInterval(timer);
  }

  async getNewAgent() {
    const res = await fetch('https://randomuser.me/api?nat=gb&results=1');
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  }
}
```

```tsx
function Situation() {
  const { agent, dead, remaining, getNewAgent } = Control.use();

  if (dead === true) return <h2>Mission failed!</h2>;
  if (dead === false) return <h2>Mission successful!</h2>;

  return (
    <div>
      <p>
        Agent {agent}, you have {remaining} seconds!
      </p>
      <button onClick={getNewAgent}>Get another agent</button>
    </div>
  );
}
```

<sup><a href="https://codesandbox.io/s/github/gabeklein/expressive-state/tree/main/examples/async?file=/src/Control.tsx" target="_blank">View in CodeSandbox</a></sup>

<br/>

### Shared State via Context

React adapter exports `Provider` and adds static `get()` to all State. Your classes act as their own key and confer full types.

```tsx
import State, { Provider } from '@expressive/react';

class SharedData extends State {
  foo = 0;
  bar = 0;
}

function App() {
  return (
    <Provider for={SharedData}>
      <Foo />
      <Bar />
    </Provider>
  );
}

function Foo() {
  const { foo, is } = SharedData.get();
  return (
    <div>
      <p>Foo: {foo}</p>
      <button onClick={() => is.bar++}>Increment Bar</button>
    </div>
  );
}

function Bar() {
  const { bar, is } = SharedData.get();
  return (
    <div>
      <p>Bar: {bar}</p>
      <button onClick={() => is.foo++}>Increment Foo</button>
    </div>
  );
}
```

**Use `Consumer` for render props:**

```tsx
import { Consumer } from '@expressive/react';

function UserDisplay() {
  return (
    <Consumer for={User}>
      {(user) => (
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      )}
    </Consumer>
  );
}
```

<sup><a href="https://codesandbox.io/s/github/gabeklein/expressive-state/tree/main/examples/context?file=/src/Demo.tsx" target="_blank">View in CodeSandbox</a></sup>

<br/>

### Composable States

States can contain other states, for clean composition.

```tsx
class Address extends State {
  street = '';
  city = '';
  zip = '';
}

class UserProfile extends State {
  name = 'John';
  email = 'john@example.com';
  address = new Address();

  toggleTheme() {
    this.darkMode = !this.darkMode;
  }
}

function ProfileEditor() {
  const { name, email, address, is } = UserProfile.use();

  return (
    <div>
      <input value={name} onChange={(e) => (is.name = e.target.value)} />
      <input value={email} onChange={(e) => (is.email = e.target.value)} />
      <input
        value={address.street}
        onChange={(e) => (address.is.street = e.target.value)}
      />
    </div>
  );
}
```

> Child states automatically trigger updates in parent components when they change.

<br/>

### Fine-Grained Reactivity

Components only re-render when properties they access change. Nested states enable precise subscriptions.

```tsx
class UserData extends State {
  profile = new Profile();
  settings = new Settings();
  notifications = 0;
}

class Profile extends State {
  name = 'John';
  email = 'john@example.com';
}

class Settings extends State {
  theme: 'light' | 'dark' = 'light';
}
```

```tsx
function UserProfile() {
  const {
    profile: { name, is: profile },
    notifications,
    is
  } = UserData.use();

  // Only re-renders when name or notifications change
  return (
    <div>
      <input value={name} onChange={(e) => (profile.name = e.target.value)} />
      <span>{notifications} notifications</span>
      <button onClick={() => is.notifications++}>+1</button>
    </div>
  );
}

function ThemeToggle() {
  const {
    settings: { theme, is: settings }
  } = UserData.use();

  // Only re-renders when theme changes - profile/notifications don't affect this!
  return (
    <button
      onClick={() => (settings.theme = theme === 'light' ? 'dark' : 'light')}>
      {theme} mode
    </button>
  );
}
```

<sup><a href="https://codesandbox.io/s/github/gabeklein/expressive-state/tree/main/examples/nested?file=/src/Demo.tsx" target="_blank">View in CodeSandbox</a></sup>

<br/>

### Lifecycle Hooks

> [!IMPORTANT]
> These methods are _not_ defined on the State prototype.
> Instead, they are picked up by .new() and .use() when present in your class.

Define a `new()` method to run logic when a controller is created. Return a cleanup function to run when it's destroyed.

_In React Only_ the `use()` method is called on **every render**, perfect for interfacing with external hooks.

```tsx
import { useNavigate } from 'react-router-dom';

class Timer extends State {
  elapsed = 0;
  interval: any;

  // Called once when the controller is created
  new() {
    this.interval = setInterval(() => {
      this.elapsed++;
    }, 1000);

    // Cleanup function runs when component unmounts
    return () => clearInterval(this.interval);
  }

  // Called every render - use this to interface with external hooks
  use() {
    const navigate = useNavigate();

    if (this.elapsed >= 10) {
      navigate('/completed');
    }
  }
}
```

```tsx
function RedirectTimer() {
  const { elapsed } = Timer.use();

  return <p>Redirecting in {10 - elapsed} seconds...</p>;
}
```

<br/>

### Reusable Classes

Capture shared behavior as reusable classes and extend them as needed. This makes logic reusable, easy to document and share!

```tsx
// Define a reusable query pattern
abstract class Query<T> extends State {
  abstract url: string;

  data: T | null = null;
  loading = false;
  error: Error | null = null;

  async fetch() {
    this.loading = true;
    this.error = null;

    try {
      const res = await fetch(this.url);
      this.data = await res.json();
    } catch (e) {
      this.error = e as Error;
    } finally {
      this.loading = false;
    }
  }
}
```

Extend it for specific use cases

```tsx
class UserQuery extends Query<User> {
  url = '/api/user';
}
```

Or use it directly with initialization

```tsx
function UserProfile({ userId }: { userId: string }) {
  const query = Query.use<User>({
    url: `/api/users/${userId}`
  });

  useEffect(() => {
    query.fetch();
  }, [userId]);

  if (query.loading) return <Spinner />;
  if (query.error) return <ErrorDisplay />;
  return <UserCard user={query.data!} />;
}
```

<br />

## Core Concepts

<br/>

### State Class

`State` is the base class you extend to create reactive state. All properties become reactive - assigning new values automatically triggers updates.

```ts
class Session extends State {
  username = '';
  isLoggedIn = false;

  login(name: string) {
    this.username = name;
    this.isLoggedIn = true;
  }
}
```

**Creating instances:**

```ts
  // In React components, use the hook
function App() {
  const state = Session.use();

  return <div>{state.username}</div>;
}

// Outside React, use State.new()
const state = Session.new();
```

**Methods are auto-bound**, so destructuring works safely:

```tsx
const { login, logout } = Session.use();
<button onClick={logout}>Logout</button>; // ✅ `this` is correct
```

<br/>

### The `is` Property

Every State has a non-enumerable `is` property that references itself. Useful for write access after destructuring:

```tsx
const { name, is } = Profile.use();
<input value={name} onChange={(e) => (is.name = e.target.value)} />;
```

**Silent reads** - access properties through `is` without subscribing:

```ts
state.get((proxy) => {
  console.log(proxy.value); // Subscribes to updates
  console.log(proxy.is.value); // Does NOT subscribe - "silent" read
});
```

<br/>

### Subscriptions & Effects

The `get()` method creates reactive effects that automatically re-run when accessed properties change:

```ts
const state = MyState.new();

state.get((current) => {
  console.log('Values:', current.foo, current.bar);
  // Only re-runs when foo or bar change (fine-grained)
});
```

**Effect cleanup:**

```ts
state.get((current) => {
  const interval = setInterval(() => {
    console.log(current.value);
  }, 1000);

  return () => clearInterval(interval);
});
```

**Subscribe to specific properties:**

```ts
// Watch a single property
state.get('username', (key, thisArg) => {
  console.log('Username changed:', thisArg.username);
});

// Get current value
const username = state.get('username');

// Subscribe to destruction
state.get(null, () => {
  console.log('State destroyed');
});
```

<br/>

### Lifecycle Methods

#### `new()` - Initialization

Runs once when your State is created:

```ts
class Timer extends State {
  elapsed = 0;

  new() {
    const interval = setInterval(() => {
      this.elapsed++;
    }, 1000);

    return () => clearInterval(interval);
  }
}
```

#### `use()` - Render-time Hook (React only)

Runs on every render - perfect for integrating external hooks:

```ts
import { useNavigate } from 'react-router-dom';

class Navigation extends State {
  use() {
    const navigate = useNavigate();
    if (this.shouldRedirect) {
      navigate('/dashboard');
    }
  }
}
```

<br />

## Instructions

Instructions are special property initializers that provide advanced functionality. They run during State construction and define custom getters/setters.

<br/>

### `ref` - Mutable References

Create ref-compatible properties similar to React's `useRef`:

```ts
import { ref } from '@expressive/react';

class VideoPlayer extends State {
  videoElement = ref<HTMLVideoElement>();

  play() {
    this.videoElement.current?.play();
  }
}

// In component:
<video ref={player.videoElement}>
  <source src="movie.mp4" />
</video>;
```

**With callbacks:**

```ts
class AutoFocus extends State {
  input = ref<HTMLInputElement>((element) => {
    element.focus();
    return () => element.blur();
  });
}
```

**Ref proxies** - create refs for all properties:

```ts
class Form extends State {
  name = '';
  email = '';
  fields = ref(this);
}

// Usage:
form.fields.name.current = 'John';
form.fields.email.get((email) => console.log(email));
```

<br/>

### `set` - Smart Setters & Computed Values

Provides validation, transformation, computed values, and async initialization.

**Validation & Callbacks:**

```ts
import { set } from '@expressive/react';

class SignupForm extends State {
  username = set('', (newValue, oldValue) => {
    console.log('Changed:', oldValue, '->', newValue);
    // Return false to reject the update
    if (newValue.length < 3) return false;
  });
}
```

**Required Values (Suspense):**

```ts
class UserProfile extends State {
  // Throws Suspense if accessed before set
  userId = set<string>();

  // Optional - returns undefined
  avatar = set<string>(() => fetchAvatar(), false);
}
```

**Lazy Factories:**

```ts
class Expensive extends State {
  // Computed on first access
  data = set(() => expensiveComputation());

  // Async - suspends until resolved
  remoteData = set(async () => {
    const res = await fetch('/api/data');
    return res.json();
  });
}
```

**Computed Values:**

Reactive properties that update automatically:

```ts
class Cart extends State {
  items = [
    { price: 10, quantity: 2 },
    { price: 15, quantity: 1 }
  ];

  // Recomputes when items change
  total = set(this, (state) =>
    state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  // Or use method reference
  tax = set(true, this.calculateTax);

  calculateTax() {
    return this.total * 0.08;
  }
}
```

**Access previous value:**

```ts
class Accumulator extends State {
  input = 0;

  sum = set(this, function (state) {
    const previous = this.sum; // Current value
    return previous + state.input;
  });
}
```

<br/>

### `get` - Dependency Injection

Fetch States from context hierarchy:

```ts
import { get } from '@expressive/react';

class Dashboard extends State {
  // Required - throws if not found
  userService = get(UserService);

  // Optional - may be undefined
  analytics = get(AnalyticsService, false);

  // Collect all downstream instances
  widgets = get(Widget, true);
}
```

**Lifecycle callbacks:**

```ts
class Child extends State {
  parent = get(Parent, (parent, thisChild) => {
    console.log('Parent available:', parent);
    return () => console.log('Cleanup');
  });
}
```

**Downstream collection with callbacks:**

```ts
class ParentList extends State {
  items = get(ListItem, true, (item, thisList) => {
    console.log('Item registered:', item);

    // Return false to prevent registration
    if (!item.isValid) return false;

    // Or return cleanup
    return () => console.log('Item removed:', item);
  });
}
```

<br/>

### `use` - Child State Instances

Create child State instances:

```ts
import { use } from '@expressive/react';

class App extends State {
  theme = use(Theme);

  auth = use(Auth, (auth) => {
    auth.initialize();
  });
}
```

<br />

## React Integration

### State.use()

Primary hook for using States in React:

```tsx
// Create new instance
const counter = Counter.use();

// Pass initial values
const form = Form.use({
  username: 'john',
  email: 'john@example.com'
});

// Pass initialization callback
const timer = Timer.use((t) => {
  t.startAt(Date.now());
});
```

<br/>

### State.get()

Consume States from context:

```tsx
function ProfileEditor() {
  const user = UserService.get();
  return <input value={user.name} />;
}
```

<br/>

### Provider & Consumer

**Provider** - provide States to descendants:

```tsx
import { Provider } from '@expressive/react';

<Provider for={UserService}>
  <Dashboard />
</Provider>

// Multiple States
<Provider for={{ UserService, ThemeService, AuthService }}>
  <App />
</Provider>

// Provide instances
<Provider for={Theme.new({ mode: 'dark' })}>
  <App />
</Provider>

// With forEach callback
<Provider
  for={Logger}
  forEach={(logger) => {
    logger.log('Mounted');
    return () => logger.log('Unmounted');
  }}>
  <App />
</Provider>

// With Suspense
<Provider
  for={AsyncDataService}
  fallback={<LoadingSpinner />}
  name="Data Boundary">
  <DataDisplay />
</Provider>
```

**Consumer** - alternative using render props:

```tsx
import { Consumer } from '@expressive/react';

<Consumer for={UserService}>
  {(user) => (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )}
</Consumer>;
```

<br />

## Advanced Features

### Suspense Integration

States integrate seamlessly with React Suspense:

```tsx
class SuspendingResource extends State {
  // Throws Suspense until resolved
  data = set(async () => {
    const res = await fetch('/api/data');
    return res.json();
  }, true);
}

function DataDisplay() {
  const { data } = SuspendingResource.use();
  return <div>{data.value}</div>;
}

// Wrap with Suspense:
<Suspense fallback={<Loading />}>
  <DataDisplay />
</Suspense>;
```

<br/>

### Nested State Reactivity

Child updates trigger parent subscriptions:

```tsx
const user = UserProfile.new();

user.get((current) => {
  // Re-runs when user.address.city changes!
  console.log('City:', current.address.city);
});

user.address.city = 'New York'; // Triggers effect
```

<br/>

### State Export/Import

Extract and restore state values:

```tsx
class Form extends State {
  username = '';
  email = '';
  password = '';
}

const form = Form.new();

// Export to plain object
const values = form.get();
// { username: '', email: '', password: '' }

// Save to localStorage
localStorage.setItem('draft', JSON.stringify(values));

// Restore later
const draft = JSON.parse(localStorage.getItem('draft')!);
form.set(draft);
```

**Export handles exotic values:**

```ts
class Complex extends State {
  normalValue = 'foo';
  refValue = ref<string>();
  computedValue = set(this, (s) => s.normalValue.toUpperCase());
}

const exported = state.get();
// {
//   normalValue: 'foo',
//   refValue: null,        // Ref extracts .current
//   computedValue: 'FOO'   // Computed provides result
// }
```

<br />

## Framework Support

Expressive provides first-class support for multiple frameworks:

**React**

```bash
npm install @expressive/react
```

```tsx
import State from '@expressive/react';
import { Provider, Consumer } from '@expressive/react';
```

**Preact**

```bash
npm install @expressive/preact
```

**Solid**

```bash
npm install @expressive/solid
```

**Framework-Agnostic Core**

```bash
npm install @expressive/state
```

```ts
import { State, watch, Context } from '@expressive/state';

const state = State.new();
watch(state, (current) => {
  console.log('Value:', current.value);
});
```

<br />

## CI/CD Pipeline

This repository uses a staged, two-phase release pipeline:

1. **Feature → `staging`**: Staging validation runs (`Build` + `Coverage`).
2. **`staging` → `main` PR**: Main gate enforces branch policy, ancestry protection, and test/build validation.
3. **Push to `main`**: release-please opens or updates a release PR.
4. **Merge release PR**: Stable publish runs from `main` committed package versions.
5. **Canary**: Manual workflow dispatch (`channel=canary`) publishes canary versions.

Workflows:

- Main gate and release PR automation: [.github/workflows/merge.yml](.github/workflows/merge.yml)
- Staging validation: [.github/workflows/staging.yml](.github/workflows/staging.yml)
- Stable/canary publishing: [.github/workflows/publish.yml](.github/workflows/publish.yml)

---

<h2 align="center">Community & Support</h2>

<p align="center">
  <a href="https://join.slack.com/t/expressivejs/shared_invite/zt-s2j5cdhz-gffKn3bTATMbXf~iq4pvHg">Join our Slack</a> •
  <a href="https://github.com/gabeklein/expressive-state/issues">Report Issues</a> •
  <a href="https://github.com/gabeklein/expressive-state">GitHub</a>
</p>

<p align="center">
  <sub>Built with ❤️ by the Expressive team</sub>
</p>
