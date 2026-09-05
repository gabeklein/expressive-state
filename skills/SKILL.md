---
name: expressive-mvc
description: Class-based reactive state management for React (Expressive MVC). Use when writing or refactoring React state - converting useState/useEffect/useMemo hooks, fixing prop drilling, choosing state ownership (State vs Component, has-pool domain rows, region controllers), dependency snapshots, presence boundaries with get(true), Provider/context, async suspense, router - and when auditing a codebase for fit.
---

# Expressive MVC

Class-based reactive state for React. State classes define reactive properties, computed values, async data, and context - all as plain class fields using instruction helpers.

## Packages

| Package              | Status    | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `@expressive/react`  | Published | React adapter. Primary import for State, Component, instructions. |
| `@expressive/mvc`    | Published | Framework-agnostic core. Rarely imported directly.                |
| `@expressive/preact` | Private   | Thin wrapper over React adapter via preact/hooks. Prerelease.     |
| `@expressive/router` | Published | Host-agnostic, class-based router built on MVC.                   |

### Installing

For a React app, `@expressive/react` is the only install:

```bash
npm install @expressive/react
```

`@expressive/mvc` arrives as its dependency - **do not add it to `package.json` as well.** Import `State`, `Component`, and every instruction (`set`, `get`, `ref`, `map`, `has`, `def`) from `@expressive/react`; the adapter re-exports the core. Install `@expressive/mvc` directly only when writing host-agnostic code that must not depend on a UI adapter - a shared domain package, a Node service, or a new adapter. Add `@expressive/router` alongside the adapter when you want routing.

React Native and Expo need no extra install and no configuration. Three boundaries, in [react/react.md](react/react.md#react-native): `jest-expo` needs `@expressive` in `transformIgnorePatterns`, `BrowserRouter` is the browser binding - use `Router` on native - and `Link`/`NavLinks` render DOM elements, so drive navigation from `Router` directly.

## Start With Ownership, Not APIs

The most common failure when adopting this library is translating hooks one-for-one before deciding who owns each behavior. Resolve ownership first; APIs come second.

For every stateful concern, pick exactly one owner:

- **`Component`** - state intrinsic to one display subtree: controls, panels, editors, review/confirm surfaces. Usually defines `render()`. Fields, handlers, and rendering live on one class. The app/route entrypoint is one even when `render()` only composes: it owns construction (replica + region State fields), provides implicitly, and ships last-resort `catch`/`fallback` - `main` just mounts it.
- **`State`** - headless model or workflow: network operations, domain rules, cross-view coordination. Views subscribe via `State.get()` / `State.use()`.
- **Plain function component** - simple presentation, or trivial local UI state. Not everything needs a class.

Concerns include the rows: UI state describing an entry in a collection - selection, status, progress - is its own `State` or `Component` spawned in a `has` pool; actions about item belong on item. Id-keyed fields (`Record<Id, T>`, parallel `Map`s) and `(id, value)` methods are a missing class; subsets are a second pool admitting the same members.

Counter-rules:

- Do not create `FooState` plus `FooView` just because hooks were present. If the behavior and rendering are one unit, `class Foo extends Component` is the refactor.
- Avoid `Component` where a provided `State` suffices - Components carry React instance surface (`props`, `state`, `setState`, `forceUpdate`) that makes `.get()` IntelliSense noisier.
- Prefer an FC over `Component` when state is zero or reducible and no boundary is wanted - a class holding only `get(...)` fields plus `render()` is an FC snapshotting `.get()`.
- A render-less `Component` (children pass through while providing context and boundary placement) is only for cases where React tree placement is the feature: route controllers, progressive boundaries.
- A provided State implicitly provides its child States - prefer `theme = new Theme()` on an existing owner over stacking Providers for every small controller.

## Golden-Path Refactor Algorithm

**Before refactoring existing React code, read [react/refactor.md](react/refactor.md)** - it expands every step with before/after examples and ends with the review checklist. The short form:

1. Identify lifecycle and ownership boundaries before translating any hooks.
2. Separate headless workflow state from display-intrinsic state.
3. Choose `State`, `Component`, or a plain function component for each owner.
4. Give every repeated UI entry own class in a `has` pool; actions about item belong on item.
5. Split unrelated clusters remaining on page State to owned region States `composer = new Composer()`. Bias one concern per class - barrels are deliberate (page orchestrator, pool owner, mounting shell); shed a second concern the moment it appears, growing a feature or refactoring one alike.
6. Provide classes directly `<Provider for={AppState}>` never an instance if only to provide it; the entrypoint Component's own fields provide implicitly - `main` only mounts `<Inbox />`.
7. Move source fields and behavioral methods first; do not mechanically translate setters.
8. Keep shared, semantic derivations as getters; leave single-consumer display derivations in their consuming component.
9. Let contextual children call `.get()` instead of receiving drilled props.
10. At every `.get()` / `.use()`, destructure for exact nested dependency snapshot.
11. May assign thru subscribed proxies; `is` only to retain the root object alongside sibling destructuring.
12. A gated widget mounts unconditionally and gates itself, falling thru when unset; parent gate + `.get(true)` where the parent reads the field for its own content.
13. Split `render()` and long JSX at conditionals and non-interacting siblings into honestly-named local FCs - units you'd delete or move whole; one-op conditionals and formatted scalars stay inline. Consolidate scopes that share dependencies and hold no nested logic.
14. Audit the result against the checklist in [react/refactor.md](react/refactor.md).

For large apps, scope a one-shot conversion to route/page controllers and their domain pools; leave mature leaf widgets on hooks until parent domains stabilize.

Write output in the conventions of [react/style.md](react/style.md). They are opinion, not semantics - but they exist to keep reactive dependencies auditable, and the golden path applies them by default.

## Core API

```tsx
import State, {
  Component,
  ref,
  def,
  get,
  has,
  map,
  set,
  Consumer,
  Provider
} from '@expressive/react';
```

### State Class

Extend `State` to define reactive models. Use `State.new()` to construct a root instance - it constructs *and* activates, which plain `new` does not. Bare `new` is correct in one place: a class field on another State (`theme = new Theme()`), where the owner adopts and activates the child, and destroys it in turn.

```tsx
class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }
}

const counter = Counter.new();
counter.count; // 0
counter.increment();
counter.count; // 1
```

Properties assigned in the class body are reactive - updates notify subscribers. Methods are auto-bound.

### Instructions & Reactive Helpers

Field initializers that configure reactive behavior. Each has multiple overloads - fetch the reference when a task needs them.

| Helper  | Use for                                                                                                | Reference                  |
| ------- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| `set()` | Defaults, placeholders (suspend until assigned), lazy/async factories (suspense), setter callbacks and validation | [field/set.md](field/set.md) |
| `get()` | Context lookup between States - required or optional upstream, downstream collection                   | [field/get.md](field/get.md) |
| `ref()` | Mutable refs (`.current`), ref callbacks with cleanup, ref proxies                                      | [field/ref.md](field/ref.md) |
| `map()` | Reactive `Map` field - keyed entries or a keyed spawner, with owned `State` members and direct render    | [field/map.md](field/map.md) |
| `has()` | Owned collections - an ordered list of values, or a pool of spawned members. Pools are for per-item UI state (selection, progress, row actions). Class first (`has(Row)`); factory when the seed isn't the init | [field/has.md](field/has.md) |
| `def()` | Low-level custom property behavior                                                                      | [field/def.md](field/def.md) |

For **computed values**, declare a normal class getter - getters on a State subclass are auto-promoted to memoized, dependency-tracked properties. See [state/computed.md](state/computed.md) for tracking rules and when a derivation should *not* be a getter.

Do not pass a bare promise to `set()`. Use `set(() => promise)` or `set(async () => value)` so work starts during activation/access instead of construction.

```tsx
class UserProfile extends State {
  userId = set<string>();

  user = set(async () => {
    const res = await fetch(`/api/users/${this.userId}`);
    return res.json();
  });

  email = set('', (value) => {
    if (!value.includes('@')) throw false;
  });

  get displayName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
}
```

### React Hooks

```tsx
// Local state - creates instance, owns lifecycle, subscribes to accessed fields
function MyComponent() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}

// Context state - reads nearest Provider, subscribes reactively
function Child() {
  const { count } = Counter.get();
  return <span>{count}</span>;
}

// An instance you already hold - place it; it renders and subscribes itself
function Parent({ counter }: { counter: Counter }) {
  return <section>{counter}</section>;
}
```

Static `.use()` and `.get()` are React hooks - call unconditionally at the top of a component or `render()`, never inside branch, event handlers, or loops. They build green when misused and crash at runtime. (Instance method get is not a hook.)

Use `State.use()` when the component should create and own the instance. Use `State.get()` when the instance comes from context. To render an instance you already hold, make it a `Component` and place as `{instance}` - subscription belongs to the placed instance, not the surrounding function. See [react/react.md](react/react.md) for overloads (optional lookup, required values, computed selector).

## The Dependency Snapshot

Open every subscribing component by destructuring the exact reactive values it renders - nested ones included. Nested observable reads are proxied and tracked automatically, so nested destructuring subscribes to child fields; a child reached through a parent proxy needs no separate subscription.

```tsx
function OrderSummary() {
  const {
    status,
    customer: {
      name,
      address: {
        city,
      } = {},
    },
  } = Order.get();

  return <p>{name} ({city ?? 'no address'}) - {status}</p>;
}
```

This is the norm, not a preference:

1. The component's complete dependency surface is visible at the top - reviewable at a glance.
2. Each trapped getter is traversed once, instead of re-walking `order.customer.address.city` in every expression.
3. Reads create subscriptions. A deep read buried in a conditional branch subscribes only on renders where that branch runs - a **conditional subscription**. Hoisting reads into the snapshot makes the dependency surface deterministic.

Optional nested objects take in-place defaults (`= {}`) rather than a separate unwrap step. The same rule applies to `this` inside `Component.render()` and subcomponents - injected parents (`inbox = get(Inbox)`) are read thru that snapshot, never a second `Inbox.get()`.

## Transparent Writes

Subscription proxies pass assignments through to the real instance - no unwrapping needed:

```tsx
const form = LoginForm.get();          // whole object is the only need - take it directly

<input
  value={form.username}
  onChange={(e) => (form.username = e.target.value)}
/>
```

Nested objects reached through a snapshot are equally writable:

```tsx
const { transfer, confirmed } = ReviewStep.get();

<button onClick={() => (transfer.step = 'generate')} disabled={!confirmed} />
```

Use `is` **only** when retaining the root object alongside sibling values from the same snapshot:

```tsx
const { is: review, confirmed, hasBlocking } = ReviewStep.get();
```

Do not unwrap every writable object through `is` - that is the most common misuse.

## Presence Boundaries & `get(true)`

Default: a self-contained widget mounts unconditionally, reads its own context, and falls thru when its reason to render is unset - a parent read existing only to gate belongs in the widget. The secondary shape, when the parent reads the field for its own content: parent gates, child asserts with `get(true)`:

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
  } = SettingsState.get(true); // Required<T> - throws if an accessed value is undefined

  return <section className="settings-editor">...</section>;
}
```

This gives the child a strong contract - no fallback values threaded through its body. Declare gateable fields **optional** (`draft?: SettingsLocation`), not `| null`: the runtime check rejects only `undefined`, and `Required<T>` does not strip `null` from a union (see [react/react.md](react/react.md)). Both shapes in full: [react/refactor.md](react/refactor.md) step 12.

## Provider & Context

Pass the State class directly. If no preconfiguration or external ownership is needed, do not create an instance only to provide it:

```tsx
<Provider for={TransferState}>
  <TransferPage />
</Provider>
```

Provide an instance only when it is genuinely owned elsewhere:

```tsx
const counter = Counter.use();
<Provider for={counter}>
  <Child />
</Provider>
```

Multiple states: `<Provider for={{ app: AppState, user: UserState }}>`. See [react/react.md](react/react.md) for `is` callbacks, fallback, and field props.

## Component Class

A `Component` is a `State` that renders itself. It provides context automatically and supports suspense/error boundaries.

```tsx
class CounterView extends Component {
  count = 0;

  increment() {
    this.count++;
  }

  render() {
    const { count, increment } = this;
    return <button onClick={increment}>{count}</button>;
  }
}

<CounterView />;

const counter = CounterView.new();
<>{counter}</>;
```

Activated Component instances are React elements and may be rendered directly,
including from an array. Their external owner retains lifecycle ownership, so
unmount detaches without destroying them. See
[react/component.md](react/component.md) for details.

PascalCase methods become reactive subcomponents - but they are **extension points**, not a general decomposition tool. The test: would a subclass reasonably replace or wrap this renderer? If not, use a freestanding function component that calls `MyComponent.get()`. See [react/component.md](react/component.md).

## Rules & Counter-Rules

Every broad rule here has a locality constraint. Apply both halves. When auditing a result, weigh findings by the severity labels defined in [react/refactor.md](react/refactor.md) - invariant, default, heuristic, style - and never fail a heuristic on its numerical signal alone.

| Rule                                                        | Counter-rule                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reactive fields are assigned directly                       | Keep a method when the write validates, normalizes, coordinates fields, or triggers behavior. Delete methods whose body is only `this.x = value`. |
| Derived values become getters                               | Only when shared by multiple consumers, semantic to the domain, expensive, or a deliberate part of the state's API/introspection surface. Single-consumer display derivations live in the consuming component - but judge meaning, not reference counts. |
| Contextual components read via `.get()`                     | Pure presentation components may still take plain props. Context replaces drilled *state*, not every value.                          |
| PascalCase subcomponents compose renders                    | Only for genuine extension points a subclass would replace or wrap. Implementation scopes are freestanding FCs using `.get()`.        |
| Extract long conditional JSX (~10+ lines or ~5+ levels)     | Keep branches together when they share dependencies, read locally, and contain no nested logic.                                      |
| `is` retains the raw instance                               | Only alongside sibling destructuring from the same snapshot. Writes through proxies are transparent; nested objects need no unwrapping. |
| State about a collection entry lives on the entry's class   | Payload keys that never drive UI stay as one `info` subobject on the member - a reactive field without a reader is pure cost.           |

## File Reference

Fetch these for detailed documentation when the task requires deeper knowledge. **Read `react/refactor.md` in full before any hook-migration or refactor task.**

### Design intent

- [design.md](design.md) - why the library is shaped this way: classes hold models not views, the "MVC" mapping, the two-verb `get`/`set` surface, render composition as a designated seam, typed lifecycle hooks, transparent writes. **Read before characterizing a design choice as accidental.** For positioning against alternatives (Zustand, Jotai, MobX, Redux Toolkit, plain Context), see [expressive.dev/llm/comparisons.md](https://expressive.dev/llm/comparisons.md).

### Golden path

- [react/refactor.md](react/refactor.md) - the refactor algorithm expanded: ownership triage, mechanical-setter and prop-drilling anti-patterns, single-consumer getters, dependency snapshots and conditional subscriptions, presence boundaries, restrained `is`, subcomponent overuse, extract-then-consolidate, review checklist
- [react/style.md](react/style.md) - style profile: snapshot formatting, affirmative conditions, render fallthrough vs operational guards

### State (core)

- [state/state.md](state/state.md) - State class, instantiation, properties, methods, events, context
- [state/get.md](state/get.md) - Instance `.get()` method: read values, run effects, context lookup
- [state/set.md](state/set.md) - Instance `.set()` method: write values, listen to updates, events, destroy
- [state/computed.md](state/computed.md) - Reactive class getters: tracking, caching, inheritance, suspense, when a derivation should stay local
- [state/lifecycle.md](state/lifecycle.md) - Construction, activation, operation, destruction phases
- [state/context.md](state/context.md) - Context system, global root, home context, ownership rules
- [state/types.md](state/types.md) - TypeScript type aliases and utility types

### Instructions & Reactive Helpers

- [field/set.md](field/set.md) - Property descriptors, defaults, factories, setter callbacks
- [field/get.md](field/get.md) - Context lookup: upstream, downstream, callbacks
- [field/ref.md](field/ref.md) - Mutable refs, ref proxy, callbacks
- [field/map.md](field/map.md) - Reactive `Map`: keyed entries, keyed spawner, owned members, direct render
- [field/has.md](field/has.md) - Owned collections: reactive lists and spawned pools
- [field/def.md](field/def.md) - Low-level custom property behavior

### React

- [react/react.md](react/react.md) - use(), State.use(), State.get() (optional lookup, required values `get(true)`, computed selector), Provider, Consumer, transparent writes, ForceRefresh
- [react/component.md](react/component.md) - Component class, props, children, render composition, subcomponent extension points, error boundaries
- [react/patterns.md](react/patterns.md) - Recipes: forms, async, domain-row and form-chip pools, region controllers, router bridge, host-agnostic model + view adapter, presence boundary, contextual children, debounce, effects

### Router

- [router/router.md](router/router.md) - `@expressive/router`: nested `Route` declarations, lexical matching, `Router`/`BrowserRouter` navigation state, the reactive `query` record + derived `url`, and `Link`/`NavLinks`/`Redirect`

### Examples

- [examples/basic.md](examples/basic.md) - Complete working examples from simple to intermediate
- [examples/audit.md](examples/audit.md) - Guide for evaluating whether Expressive MVC fits a codebase

**Runnable examples** live at `https://expressive.dev/examples/<group>/<name>` and serve every source file of a working program as plain HTML - fetchable without JavaScript. These are optional enrichment: this skill is complete offline, and [examples/basic.md](examples/basic.md) covers the core patterns inline. When you have network access and want a full reference implementation of a specific feature - rather than a snippet - fetch the matching page:

| Group | Pages |
| --- | --- |
| `featured` | `forms`, `kanban`, `spreadsheet`, `stopwatch`, `tictactoe` |
| `essentials` | `counter`, `computed`, `fetch`, `async` |
| `component` | `props`, `subcomponents`, `lifecycle`, `injection`, `headless`, `suspense`, `boundary`, `custom` |
| `composition` | `nested`, `context`, `concerns`, `extension`, `globals` |
| `instructions` | `set`, `set-factory`, `set-computed`, `get`, `get-downstream`, `ref`, `ref-multiple`, `map`, `map-insert`, `has`, `has-list`, `def` |
| `router` | `overview`, `params`, `query`, `guards`, `nav` |

## Auditing & Evaluation

Audit a conversion as a separate pass, not while authoring - self-audits under-report the author's architecture gaps; a fresh checklist pass over the diff recovers them.

Use [examples/audit.md](examples/audit.md) to assess fit and migration candidates. If migration is approved, follow [react/refactor.md](react/refactor.md) rather than translating hooks mechanically. For recorded design rationale, use [design.md](design.md); for adoption positioning and comparisons, use the website-only [why](https://expressive.dev/llm/why.md) and [comparisons](https://expressive.dev/llm/comparisons.md) pages.
