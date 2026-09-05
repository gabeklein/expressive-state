# @expressive/react

## 0.85.0

### Minor Changes

- [#294](https://github.com/gabeklein/expressive-mvc/pull/294) [`8860645`](https://github.com/gabeklein/expressive-mvc/commit/88606452917a67308e7e5201eb4f7b45bb5ad573) Raise the React peer range floor to 16.14.

  `>=16.8.0` was never accurate: the adapter imports `react/jsx-runtime`, which
  does not exist before 16.14, so installs on 16.8-16.13 resolved without warning
  and then failed at import. The range now states the version that actually works.

  Documented alongside it: revision validation for concurrent rendering applies on
  React 18+, and is skipped on 16.14-17 because those renderers cannot interrupt a
  render and so have no interleaving to protect against.

### Patch Changes

- [#309](https://github.com/gabeklein/expressive-mvc/pull/309) [`6b57bb2`](https://github.com/gabeklein/expressive-mvc/commit/6b57bb221584ba2435c9e3cfb7668da4f108ea77) Keep context consumers attached to their nearest upstream Provider when nested
  Providers render in sibling branches, including during server rendering.

- [#305](https://github.com/gabeklein/expressive-mvc/pull/305) [`1341292`](https://github.com/gabeklein/expressive-mvc/commit/1341292a185830f02635ecd6dd0269c057052142) Accept assignment to subcomponent fields, so a Component override such as `Sidebar = Sidebar` no longer throws `TypeError: Cannot set property ... which has only a getter` when built with `useDefineForClassFields: false` (the default for any `target` below ES2022).

- [#297](https://github.com/gabeklein/expressive-mvc/pull/297) [`018c15a`](https://github.com/gabeklein/expressive-mvc/commit/018c15a54ea5f01d45b65c236b5c50ccd16002c0) Document React Native and Expo support, and add `react-native` / `expo` keywords.

  No code change - the adapter imports only `react` and `react/jsx-runtime`, so Metro resolves and runs it as published. Releases gate on `native-check.ts`, which installs the published tarballs into a throwaway Expo app (SDK 57, React Native 0.86) and asserts Metro resolution for iOS and Android, a Hermes bytecode build, and class-field semantics under both of Metro's transform paths. A gauntlet exercises the adapter on the iOS simulator and an Android emulator in both Debug and Release builds - on `react-native`-labeled PRs, monthly, or on demand.

  Three boundaries: `jest-expo` needs `@expressive` in `transformIgnorePatterns` because the build is ESM-only, `BrowserRouter` is the browser binding - use `Router` on native - and `Link`/`NavLinks` render DOM elements, so drive navigation from `Router` until canonical elements ([#128](https://github.com/gabeklein/expressive-mvc/issues/128)) give them a native host.

- [#308](https://github.com/gabeklein/expressive-mvc/pull/308) [`f0ea5e5`](https://github.com/gabeklein/expressive-mvc/commit/f0ea5e5d5e7ff9ac68e74f72c23310577834bcbe) Fix an unloadable published dist: `import '@expressive/react'` threw
  `ERR_MODULE_NOT_FOUND` under native Node ESM.

  The build declared `./adapter` external, so `dist/index.js` shipped an
  extensionless `from "./adapter"`. Bundlers tolerate that; Node's ESM resolver
  does not, which broke plain-node and native-ESM SSR consumers - the package
  could only be imported through a bundler. The adapter is already its own entry,
  so dropping the external emits `./adapter.js` with no change to chunking or
  public surface.

- Updated dependencies [[`ae97d53`](https://github.com/gabeklein/expressive-mvc/commit/ae97d531e7f1988d9d0e6956db4485505f03c398), [`37ef4e9`](https://github.com/gabeklein/expressive-mvc/commit/37ef4e95ae19285ca902bafdccdbe9bd6304176a), [`0bdb45f`](https://github.com/gabeklein/expressive-mvc/commit/0bdb45f294f77970569747262bae4fd8bbc35071), [`6b34ad5`](https://github.com/gabeklein/expressive-mvc/commit/6b34ad5d967f3aa678cf47820140a6e81fb5f3e2), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`1ff6c32`](https://github.com/gabeklein/expressive-mvc/commit/1ff6c32b0b4dd44a21d32f6231671e15be21a6f4), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`6c9a626`](https://github.com/gabeklein/expressive-mvc/commit/6c9a62612d34b3dc460676cf788723e72c1cd493), [`519c800`](https://github.com/gabeklein/expressive-mvc/commit/519c8003e6a1cefdad4bb025b11d1d1a3717d4e7), [`139e338`](https://github.com/gabeklein/expressive-mvc/commit/139e3388a9375b4159ec520cfeca34c98f10784d)]:
  - @expressive/mvc@0.84.0

## 0.84.1

### Patch Changes

- [#296](https://github.com/gabeklein/expressive-mvc/pull/296) [`a8570ea`](https://github.com/gabeklein/expressive-mvc/commit/a8570ea4ee3ec61ec377975c9571e1c7625eca6a) Fix `{instance}` placement being tree-shaken out of production bundles.

  `Component.prototype.$$typeof` - the descriptor that lets a Component instance
  render as `{instance}` - is installed by a shared chunk that the published
  `sideEffects` manifest could not name, so bundlers dropped it. Any consumer
  build that shook away `has` and `map` lost placement entirely and threw
  "Objects are not valid as a React child" at render, in production builds only.

  Shared chunks now emit under a `chunk-` prefix and the manifest covers them by
  pattern, so no future chunk can fall outside it. `dist/has.js` and `dist/map.js`
  stay tree-shakeable; the export map and published entry paths are unchanged.

- Updated dependencies [[`25071c7`](https://github.com/gabeklein/expressive-mvc/commit/25071c7d4cd6e57db154a4430ec4f6228a8f2c56), [`3407792`](https://github.com/gabeklein/expressive-mvc/commit/3407792584f2fe07e72777041951e3ab7aad5c8d), [`a4d2011`](https://github.com/gabeklein/expressive-mvc/commit/a4d201152319d845c3df29d9b9769dd864ebcc74), [`9f75bf2`](https://github.com/gabeklein/expressive-mvc/commit/9f75bf2d086a176581815c26940d2647349f728c)]:
  - @expressive/mvc@0.83.1

## 0.84.0

### Minor Changes

- [#284](https://github.com/gabeklein/expressive-mvc/pull/284) [`5ade5bd`](https://github.com/gabeklein/expressive-mvc/commit/5ade5bd5bb9c1e25db182f472fd8749b42c053aa) Host registry moves to `@expressive/mvc/runtime`, and gains a transition seam.

  **Breaking:** the host registry now lives at the new subpath `@expressive/mvc/runtime` - `host()`, `HostRuntime`, the `Host` augmentation manifest, `Fragment`, the introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`), and element creation. `@expressive/mvc/jsx-runtime` is constrained to exactly the transform contract - `jsx`, `jsxs`, `Fragment`, and the `JSX` namespace, which is all `jsxImportSource` resolves there. Imports of anything else from `jsx-runtime` must retarget to `@expressive/mvc/runtime`; likewise adapters extending `Host` must augment `declare module '@expressive/mvc/runtime'` (augmentation cannot follow re-exports regardless). No published pairing breaks - 0.x caret ranges pin every shipped adapter and router to mvc 0.82 - and in-repo consumers are updated in this release.

  **Transition seam:** `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/runtime` exports the implementation. The same `transition(work)` is promoted through the public `@expressive/mvc` and `@expressive/react` barrels, but deliberately not through `jsx-runtime`. The helper runs `work` inline through the host bracket while marking observable writes as non-urgent; affected subscriber callbacks later replay the bracket when the normal microtask dispatch flushes. Immediate host updates and deferred MVC publication therefore share non-urgent priority without promising one atomic transition. Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler), work and subscriber dispatch retain their normal timing.

  `@expressive/react` registers React's `startTransition` as the scheduler. `State.get()`, `State.use()`, Component, and direct collection subscribers therefore receive React Transition priority without moving model mutation or core event dispatch into React. Urgent invalidation upgrades only subscriber work that is already pending for the same watcher; unrelated urgent work does not cancel deferred presentation.

  This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter.

- [#289](https://github.com/gabeklein/expressive-mvc/pull/289) [`d4e8ef5`](https://github.com/gabeklein/expressive-mvc/commit/d4e8ef5253f2fec21f632f0594ece34ce054ce22) **Breaking:** the standalone `use(instance)` hook is removed.

  Every job it did now has a first-class home: a module singleton declares `static global = true` and is read with `State.get()`; a shared instance is provided with `<Provider for={instance}>` and read with `get()`; a child reached through a subscribed parent is tracked by the parent's proxy with no extra hook; a `Component` instance in hand renders directly as `{instance}`. Subscribing to a raw by-reference instance outside any context is deliberately no longer supported - it was the one subscription path that bypassed Expressive-owned seams, and it collided with React 19's own `use()`.

### Patch Changes

- [#278](https://github.com/gabeklein/expressive-mvc/pull/278) [`09191c2`](https://github.com/gabeklein/expressive-mvc/commit/09191c2063c6b409c24b5851f7add72f9af795ba) react is a required peer dependency - no longer marked optional, so npm warns on a missing or mismatched install again.

- [#293](https://github.com/gabeklein/expressive-mvc/pull/293) [`990f943`](https://github.com/gabeklein/expressive-mvc/commit/990f943cec610afbc8c2435848fe57dd49f6ad2b) Prevent concurrent React renders from committing mixed model revisions. Each subscription now exposes a revision counter to `useSyncExternalStore` for pre-commit validation only; presentation still publishes through ordinary React state, so `transition()` dispatch keeps deferred priority. React versions without `useSyncExternalStore` cannot yield mid-render and skip validation entirely.

- Updated dependencies [[`1070ef9`](https://github.com/gabeklein/expressive-mvc/commit/1070ef9246bed552c63196fcb21037bb2108dfd7), [`5ade5bd`](https://github.com/gabeklein/expressive-mvc/commit/5ade5bd5bb9c1e25db182f472fd8749b42c053aa)]:
  - @expressive/mvc@0.83.0

## 0.83.1

### Patch Changes

- [#279](https://github.com/gabeklein/expressive-mvc/pull/279) [`b6be135`](https://github.com/gabeklein/expressive-mvc/commit/b6be135dae3a3d888d5fcce35f7f17bf56fd5618) `State.get()` no longer dispatches a React update before its render attempt has committed. A subscriber whose fiber was discarded pre-commit - a sibling mutating shared state during render, under a Suspense boundary that never resolves - called `setState` on a fiber React had not mounted, producing the dev warning _"Can't perform a React state update on a component that hasn't mounted yet."_ A change arriving before commit is now held and flushed once the fiber commits, so no update is lost.

## 0.83.0

### Minor Changes

- [#265](https://github.com/gabeklein/expressive-mvc/pull/265) [`366ef98`](https://github.com/gabeklein/expressive-mvc/commit/366ef9820c3105de5a6623589a8723e8fe2142a2) Add `mount()`, a commit-phase lifecycle hook for a State whose lifetime a
  component owns - `State.use()`, `<Component />`, and an instance a `Provider`
  constructs. It is called once when that component commits, and the function it
  returns runs on unmount.

  This fills a gap `new()` could not. `new()` runs synchronously at construction,
  which means it also runs during server render, making it the wrong home for
  anything touching `window`, timers, or subscriptions - the workaround being a
  `typeof window === 'undefined'` guard at the top of every such hook. `mount()`
  never runs on the server, and never for an instance no component owns, so
  client-only effects can be written plainly:

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

  `mount()` is deliberately an ownership hook, not an observation one, so it does
  not fire on paths that reach an instance owned elsewhere - `State.get()`,
  placing one as `{instance}`, or `<Provider for={existingInstance}>`. Those are
  many-to-one: any number of components can observe or place a single instance,
  each for less time than the instance lives, and a hook firing once per observer
  would not be a lifecycle. Use `State.get()` or an event to react to an instance
  a component does not own.

  A `Provider` decides per entry, so `for={{ Session, theme }}` mounts the
  `Session` it constructed and leaves the already-live `theme` alone. As with any
  parent, its `mount()` runs after its descendants' - React commits bottom-up -
  and belongs to its own commit, so replacing `for` mid-life provides the new
  State without mounting it; key the Provider to make that a fresh mount.
  `Context.set`'s per-state callback now receives the ownership flag as a second
  argument.

  `new()` and `use()` are unchanged: `new()` stays construction-time setup with a
  teardown, and `use()` stays the render-phase hook that intercepts `State.use()`
  arguments and hosts other hooks.

  Under StrictMode a remount repeats none of the three stages - setup, mount and
  cleanup now share one render counter.

  **Breaking:** `Component.use()` is no longer available. A Component is rendered,
  not used; the static now throws and is typed `never` so the call is rejected at
  compile time. Render one with `<MyComponent />` or `{instance}`, or take a bare
  instance with `MyComponent.new()`.

  **Breaking:** a `Provider`'s `is` callback no longer takes a teardown from its
  return value, which is now ignored and typed `void`. A concise arrow body
  returns whatever it evaluates - `is={x => (mine = x)}` returns the State - and
  that was indistinguishable from an intentional cleanup, so it crashed at
  teardown. Register teardown against the State instead:

  ```tsx
  <Provider for={Session} is={(session) => session.set(null, cleanup)} />
  ```

  `Context.set`'s own callback keeps its optional teardown, and now ignores a
  returned non-function rather than calling it.

- [#251](https://github.com/gabeklein/expressive-mvc/pull/251) [`a89bf57`](https://github.com/gabeklein/expressive-mvc/commit/a89bf570e6136b0aaa1783b8f4b181ecb29b392e) Make root (global) registration opt-in via `static global`.

  Previously any `State.new()` activated outside a Provider registered itself into the process-global root context, becoming resolvable via `get()` from anywhere. This made an accidental global easy to create — a forgotten `<Provider>` would silently land a per-request instance in the shared root, where it persists for the life of the process and (during server render) is shared across every request.

  **Breaking:** a State now registers to the root context only when it declares `static readonly global = true`. Without it, a context-less instance is still fully functional but private — not resolvable via `get()` from elsewhere, and never shared across server-render requests. A private instance can still _read_ declared globals through the root fallback; it simply isn't one. Scope request state with `<Provider>`, or declare a global for a genuine process-wide singleton (e.g. a router, keyboard, or `localStorage` adapter).

  `global` is `readonly` and typed `State.Global` — a boolean, or a resolver `(self) => boolean` evaluated at activation (after props apply) to decide membership per instance or environment (e.g. `() => typeof window !== 'undefined'`). It is declared per class: a subclass that would be global purely by _inheriting_ a `true` **throws on activation** unless it re-declares (`true` to keep it, `false` to opt out), so a global never propagates silently. A bare-literal `false` additionally locks the subtree at compile time — TypeScript rejects a descendant `= true` — a best-effort vendor lockout that a resolver or wide cast can still override. Using a global class inside a `<Provider>` scopes it to that context and never touches the root, so a process-wide default (e.g. `BrowserRouter`) can still be provided per-request.

  A declared global is intentional and long-lived — process-wide, mutable, and shared across requests, including on the server. Keep request-specific data out of it: scope that with a `<Provider>` instead. A non-global that a consumer expects to inject but that was never provided still throws the usual `Could not find <State> in context`, so a missing Provider surfaces at the point of use.

  `@expressive/router`'s `Router` and `BrowserRouter` declare `static readonly global = () => typeof window !== 'undefined'` — a client-side singleton, but _not_ a shared global during server render, so a per-request `path`/`query` can't bleed across requests. Provide a `Router` per-request (via `<Provider>`) to render a specific path on the server.

### Patch Changes

- Updated dependencies [[`366ef98`](https://github.com/gabeklein/expressive-mvc/commit/366ef9820c3105de5a6623589a8723e8fe2142a2), [`a89bf57`](https://github.com/gabeklein/expressive-mvc/commit/a89bf570e6136b0aaa1783b8f4b181ecb29b392e)]:
  - @expressive/mvc@0.82.0

## 0.82.0

### Minor Changes

- [#256](https://github.com/gabeklein/expressive-mvc/pull/256) [`f5f2773`](https://github.com/gabeklein/expressive-mvc/commit/f5f2773362209a4d5c18259ed31e7b106034b52c) Add `has()`, a field instruction for owned reactive collections. With no argument, a falsy value (`null`/`false`, for conditional init), or an iterable, it is an ordered list (`has.List<T>`): positional reads (`get(index)`, ranges, `get(predicate)`), `push`/`put`/`set(index)`/`pop`, with index-and-length precision tracking. With a `State` class or factory, it is a pool (`has.Pool<T, A>`): `add(...args)` spawns through the constructor or factory - forwarding arguments exactly as `Type.new()` accepts them - and returns the member, which is its own identity for `has`/`delete`/eviction. Ownership follows freshness: a fresh (never-activated) `State` member - constructed by a factory or instantiated from a class - is owned, and deleting, clearing, or destroying the owner destroys it, while an already-activated value (`Item.new()`) is a guest, held but never destroyed. Fresh members are parented to the hosting state and activate inside its context; a member that dies evicts itself. Both modes share `map(fn)`/`filter(fn)`/`any`/`all` and snapshot via `get()`. The runtime classes are exposed as `has.List` and `has.Pool` for adapter facades, and can be constructed without an owner for standalone use. Destruction is an eviction concern independent of the parent link.

  In `@expressive/react`, a collection renders directly - `<ul>{this.todos}</ul>` - through a `$$typeof` facade on those prototypes: the collection is one element whose members (each carrying their own identity) render in order, subscribing to collection shape without a manual spread or keys.

- [#240](https://github.com/gabeklein/expressive-mvc/pull/240) [`f003b03`](https://github.com/gabeklein/expressive-mvc/commit/f003b035b329ee8e8bbccab579badfb700b3c787) Add `map()`, a field instruction for shallow reactive maps - the field resolves at activation and the hosting state adopts the map in the same step. With no argument, a falsy value (`null`/`false`, for conditional init), or an iterable of entries, it is a plain keyed map (`map.Insert<K, V>`, extending native `Map`). With a factory function, it is a keyed spawning map (`map.Create<A, V>`, keyed by `A[0]`): `set(...args)` invokes the factory verbatim and stores the result at the first argument, replacing (and destroying, if owned) any previous value. Ownership follows freshness, uniformly across both modes: a fresh (never-activated) `State` value - handed to `set`, constructed by a factory, or present in initial entries - is adopted and destroyed on delete/clear/replace, while an already-activated value (`Item.new()`) is a guest, held but never destroyed. A map held by a `State` field adopts fresh members: parented to the owner, activated inside its context, and destroyed with it; the field is read-only, and a dead `State` value evicts itself from the map. Destruction is an eviction concern independent of the parent link, so the underlying `map.Managed` can be constructed without an owner (`new map.Managed()`) for standalone use. `get()` with no key returns a shallow `ReadonlyMap` snapshot; `keys(fn)` / `values(fn)` / `entries(fn)` return reusable transformed iterables. In `@expressive/react`, a map placed in JSX renders its values directly through a `$$typeof` facade on the `map.Managed` prototype - no manual spread - and treeshakes out when unused.

- [#263](https://github.com/gabeklein/expressive-mvc/pull/263) [`f3b7bbd`](https://github.com/gabeklein/expressive-mvc/commit/f3b7bbd89a6128cf74aaeafb17049d5413097335) **Breaking:** `hot()` is removed. It predated the instruction model and never fit it - a free-standing proxy factory whose reactivity was silently lost the moment the field was reassigned, whose storage was shared with the value passed in, and whose shape (key enumeration, `length` beyond what a read touched) was not tracked at all. `map()` and `has()` now cover the same ground as proper field instructions: resolved at activation, re-entrant on the field, precise per-key/per-index events, owned `State` members, and snapshots.

  Migration:

  - keyed by name (a record) → `map()`: `values = map<string, string>()`, read `values.get('a')`, write `values.set('a', b)`.
  - keyed by position (an array or fixed board) → `has()`: `board = has<string>(Array(9).fill(''))`, read `board.get(i)`, write `board.set(i, value)`.
  - a growing list of owned `State` members → `has(Item)`, seeded from the `new()` hook with `add()`.
  - a plain object of unrelated values that only ever changes wholesale → declare plain fields, or assign a new object.

- [#247](https://github.com/gabeklein/expressive-mvc/pull/247) [`8e34b84`](https://github.com/gabeklein/expressive-mvc/commit/8e34b841177ff85a4aecf6c22c682426ee05ddf8) Give Component instances an overridable identity key and allow activated instances to render directly as React elements, including in arrays. Externally owned instances detach without being destroyed when unmounted.

### Patch Changes

- [#253](https://github.com/gabeklein/expressive-mvc/pull/253) [`dd4a6d4`](https://github.com/gabeklein/expressive-mvc/commit/dd4a6d40758dd3b61f8d17f25a927e5bfb02a63e) Refresh npm metadata: package descriptions and keywords aligned with the project's canonical description. The `@expressive/mvc` readme now directs React users to `@expressive/react` and states that the core arrives as its dependency, correcting a common mistake where both packages get added to `package.json`. Publishing also refreshes the package pages that search engines and answer engines currently cite from older releases.

- [#254](https://github.com/gabeklein/expressive-mvc/pull/254) [`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9) Fix `State.get()` failing to re-render a component when it reads a _nested_ reactive value - a child State's field, or a `map`/`has` entry - through the returned instance. The refresh was gated on the root instance's own change events, which are empty when only a nested value changes, so those updates were dropped (regressed by an earlier "optimized State.get" refactor that replaced a first-run flag with an `if (changed.length)` guard). It now refreshes on any observed change after the initial render, restoring the prior behavior. This lets a function component subscribe to a single nested value (e.g. one map entry) and repaint in isolation.

- [#250](https://github.com/gabeklein/expressive-mvc/pull/250) [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2) Fix instances rendered through a subscriber proxy (such as from their owner's own render) losing element identity on every re-render, causing React to remount their placement and context teardown to destroy the live instance. The element facade now installs on the real instance so all proxies share one identity, and context teardown only destroys instances the context itself constructed.

- Updated dependencies [[`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9), [`dd4a6d4`](https://github.com/gabeklein/expressive-mvc/commit/dd4a6d40758dd3b61f8d17f25a927e5bfb02a63e), [`f5f2773`](https://github.com/gabeklein/expressive-mvc/commit/f5f2773362209a4d5c18259ed31e7b106034b52c), [`f003b03`](https://github.com/gabeklein/expressive-mvc/commit/f003b035b329ee8e8bbccab579badfb700b3c787), [`f3b7bbd`](https://github.com/gabeklein/expressive-mvc/commit/f3b7bbd89a6128cf74aaeafb17049d5413097335), [`8e34b84`](https://github.com/gabeklein/expressive-mvc/commit/8e34b841177ff85a4aecf6c22c682426ee05ddf8), [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2)]:
  - @expressive/mvc@0.81.0

## 0.81.0

### Minor Changes

- [#196](https://github.com/gabeklein/expressive-mvc/pull/196) [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99) Move the low-level observable protocol (`observer`, `touch`, `event`, `listener`, `watch`, `Observer`) off the main entry to a dedicated `@expressive/mvc/observable` subpath. This declutters the primary import surface, which is now the app-facing API (`State`, `Component`, `Context`, instructions). The protocol is power-user surface for building custom observables; import it explicitly:

  ```ts
  import { watch, touch, event } from '@expressive/mvc/observable';
  ```

  Breaking: these names are no longer exported from `@expressive/mvc`, and `@expressive/react` no longer re-exports `Observer` from its main entry. Update imports to the subpath.

### Patch Changes

- Updated dependencies [[`de44e86`](https://github.com/gabeklein/expressive-mvc/commit/de44e86111c9eec6e5b0813174adfd34b15db158), [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99)]:
  - @expressive/mvc@0.80.0

## 0.80.0

### Minor Changes

- [#185](https://github.com/gabeklein/expressive-mvc/pull/185) [`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0) `set` now defines a reactive computed property when passed a function that takes an argument - the instruction equivalent of a class getter. `set(self => self.first + ' ' + self.last)` re-runs whenever a managed property it reads updates, receiving the instance as both `this` and its first argument. It is enumerable and read-only, matching a prototype getter.

  Dispatch is by arity: a zero-arg function (`set(() => ...)`) keeps its existing behavior as a one-shot lazy factory, while a function declaring a parameter routes into the reactive compute engine. This exposes getter behavior through an instruction, so it can be composed or wrapped, and - because the property is instruction-assigned rather than a concrete getter - a subclass may refine its type with `declare`, which a generic getter on a parent class cannot express.

### Patch Changes

- Updated dependencies [[`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0)]:
  - @expressive/mvc@0.79.0

## 0.79.1

### Patch Changes

- [#170](https://github.com/gabeklein/expressive-mvc/pull/170) [`7874353`](https://github.com/gabeklein/expressive-mvc/commit/78743532bf3012c1a59d60c5e5925c179815f98a) fix: preserve adapter side-effect modules in the published build

  `@expressive/react`'s `sideEffects` field listed only `jsx-runtime.ts`, so the
  bundler treated the other side-effect-only imports in `adapter.ts`
  (`state.get.ts`, `state.use.ts`, `component.ts`) as dead and dropped them from
  the emitted dist.

  The most visible casualty was `component.ts`, which installs the `context`
  property setter (`bootstrap`) on `Component.prototype`. When React instantiates
  an mvc Component as a class and assigns `this.context`, that setter is what
  activates state - resolving `set()` field instructions into reactive getters and
  swapping in the adapter's reactive render wrapper. Missing from dist, the
  assignment was a no-op: state never activated, `set()` fields stayed as raw
  `Symbol(field-…)` instructions, and React called `render` on the bare instance
  (e.g. `this.router.segment is not a function`). `State.get` / `State.use` were
  also silently absent from the published build.

  This only affected consumers of the published packages; the examples alias to
  `src`, where the imports always execute. Adding the three modules to
  `sideEffects` keeps them in the build.

## 0.79.0

### Minor Changes

- [#168](https://github.com/gabeklein/expressive-mvc/pull/168) [`037fbbe`](https://github.com/gabeklein/expressive-mvc/commit/037fbbe141ddfd12ebcaca3fcb55e6b285fe6bed) Rename the host-agnostic subpath `@expressive/react/runtime` to `@expressive/react/adapter`, and fix a circular import that crashed bundled apps.

  **Breaking (subpath rename).** The renderer-agnostic layer is now imported from `@expressive/react/adapter` (was `/runtime`). Update imports accordingly; `@expressive/preact` has been moved over.

  **Circular import fix.** Consuming the built package through a plain bundler (not Vite/src path-mapping) threw at module-eval time - `Cannot read properties of null` from the agnostic chunk - and the app never mounted. The runtime module re-exported `Consumer`/`Provider` from `context` while `context` imported the runtime primitives back, a value-level cycle the chunk-split build tripped on during initialization (live ESM bindings hid it in the monorepo).

  `runtime.ts` is now a pure leaf of host-agnostic primitives that imports nothing internal; the new `adapter.ts` barrel owns the adapter wiring (the `State.get` / `State.use` / component registrations) and re-exports the public surface. The dependency graph is one-way and acyclic.

  The `/adapter` surface is `Runtime`, `use`, `State`, `Consumer`, `Provider`. The internal StrictMode hooks (`useHook` / `useFactory` / `useReady`) are no longer re-exported there; they remain an implementation detail of the React adapter.

## 0.78.0

### Minor Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **Re-architected as a pure adapter.** With `Component` now living in `@expressive/mvc`, `@expressive/react` is a thin host adapter rather than the home of the component model. It completes the core class through three channels - a `Component.on` lifecycle hook, prototype attach (`bootstrap`, `isReactComponent`, error boundary), and type augmentation. The public surface is unchanged: `Component` and the instructions are still re-exported from here.

  **Host-agnostic runtime subpath ([#117](https://github.com/gabeklein/expressive-mvc/issues/117)).** The renderer-agnostic adapter core is published at `@expressive/react/runtime` - the `Runtime` seam, StrictMode-safe hooks (`useHook`/`useFactory`/`useReady`), and standalone `use(subject)`. This is the same layer `@expressive/preact` builds on, bringing the two adapters to parity. The old `@expressive/react/state` subpath is renamed to `/runtime`.

  **Behavior.** `fallback={false}` now opts a `Component` out of its own Suspense boundary (Suspense-transparent) instead of being used as the fallback node ([#123](https://github.com/gabeklein/expressive-mvc/issues/123)). Props omitted on rerender are cleared to `undefined` ([#88](https://github.com/gabeklein/expressive-mvc/issues/88)); optional render props are preserved ([#86](https://github.com/gabeklein/expressive-mvc/issues/86)).

  **Breaking.** Import the agnostic runtime from `@expressive/react/runtime` (was `/state`). The `Observable` re-export is renamed to `Observer` ([#151](https://github.com/gabeklein/expressive-mvc/issues/151)).

- [#158](https://github.com/gabeklein/expressive-mvc/pull/158) [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8) Exclude non-settable members from inferred JSX props.

  `Component.StateProps` now drops get-only accessors and `readonly` fields from the prop surface a component accepts. These members can never be meaningfully assigned from JSX, so offering them as props only invited no-op or type-erroring assignments. Writable fields, get/set accessors, callbacks, and methods are unaffected.

  The exclusion is the one structurally-detectable case (via a `readonly`-probe); TypeScript cannot distinguish a method from a callback field, so a blanket function exclusion is intentionally not attempted. The new behavior is consistent with `set`, which already rejects `readonly` keys.

### Patch Changes

- Updated dependencies [[`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050), [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d), [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8)]:
  - @expressive/mvc@0.78.0
