# @expressive/mvc

## 0.84.0

### Minor Changes

- [#334](https://github.com/gabeklein/expressive-mvc/pull/334) [`1ff6c32`](https://github.com/gabeklein/expressive-mvc/commit/1ff6c32b0b4dd44a21d32f6231671e15be21a6f4) Pools can shape or decline what `add` produces.

  `has(Player, 'id')` names a field to receive `add`'s argument, covering the common transposition without a function. A lone instance is still admitted rather than constructed.

  A factory returning `undefined` or `null` now adds nothing and `add` yields it back - so a factory may look a member up, filter one out, or build it. Member type excludes nullish, so only `add` widens.

- [#330](https://github.com/gabeklein/expressive-mvc/pull/330) [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9) A `State` constructed with plain `new` must activate before the end of the tick - by `State.new()`, adoption by an owner, or placement with `new Context(state)`. One that does not now warns, naming the instance and the three remedies. `set(null)` releases an instance you decide against, exempting it.

  This makes an existing tacit rule enforceable. A bare `new` that nothing adopts produced an inert instance whose instructions never ran and whose properties were never managed, with no signal at all - the same deadline, wired in as a probe, is what found the `set()` factory adoption bug fixed in [#324](https://github.com/gabeklein/expressive-mvc/issues/324).

  Two defects surfaced by the invariant are fixed alongside it:

  Destroying a `State` that never activated threw instead of releasing it. Terminal dispatch synthesized the activation signal for a never-ready instance, running its init against an already-terminated observer.

  ```ts
  const state = new MyState();
  state.set(null); // threw: "was destroyed - cannot be rendered, watched or updated"
  ```

  A host constructs a `Component` per render attempt, and the constructor resolves duplicates by props object - returning the first instance and abandoning the second. That twin never activated and was never released, so it outlived the render attempt which created it. Under React StrictMode this happened on every mount.

  Deferring activation past the tick is no longer supported. `new Context(state)` still claims a home before activation locks it to root, but the placement must happen in the same tick as construction.

- [#319](https://github.com/gabeklein/expressive-mvc/pull/319) [`6c9a626`](https://github.com/gabeklein/expressive-mvc/commit/6c9a62612d34b3dc460676cf788723e72c1cd493) `has(Type)` pools now admit a ready-made member. `add(value)` with a lone instance of the pool's class (or a subclass) holds that value instead of forwarding it to the constructor, so one field both spawns and injects - a second pool over members of a first (`selected = has(Item)`) and fetch hydration (`items.add(new Item(data))`) no longer need an identity factory. Ownership is unchanged and still follows freshness: a fresh instance is adopted and destroyed with the pool, an already-activated one is a guest. Only a single argument is treated this way, so multi-argument constructors are unaffected, and factory pools never admit - their arguments are their own.

### Patch Changes

- [#324](https://github.com/gabeklein/expressive-mvc/pull/324) [`ae97d53`](https://github.com/gabeklein/expressive-mvc/commit/ae97d531e7f1988d9d0e6956db4485505f03c398) A `State` stored by an owning writer is now adopted regardless of how it arrives, not only by direct assignment at define time. A child produced by a `set()` factory, or assigned to a property which started empty - including a `Component` prop - is parented, registered in its owner's context, activated, and destroyed with its owner.

  Ownership still follows freshness: an already-active `State` is registered as a guest and outlives the property, matching `map()`. Values a state only reads - a getter, a computed, or a type resolved from context by `get(Type)` - are not adopted; reading a reference does not confer ownership.

  Fixes the `Route.router` fallback in `@expressive/router`, where a `Router` constructed for a route with none in context was never activated.

- [#325](https://github.com/gabeklein/expressive-mvc/pull/325) [`37ef4e9`](https://github.com/gabeklein/expressive-mvc/commit/37ef4e95ae19285ca902bafdccdbe9bd6304176a) Fix `State.on()` handlers being silently skipped when an anonymous class sits in the prototype chain.

  Bootstrap walked the chain until it hit a class with a falsy `name`, which terminated correctly only because `Object.getPrototypeOf(State)` is `Function.prototype`. Any intermediate class with an empty `name` ended the walk early and every ancestor above it was dropped - their per-class `type` hooks, per-instance `before`/`after` setup, and the teardowns those return never ran, with no error.

  The ordinary mixin idiom produces exactly that: a class expression which is returned or passed rather than assigned gets no inferred name.

  ```ts
  const Timestamped = (Base) =>
    class extends Base {
      stamp = Date.now();
    };

  class Doc extends Timestamped(State) {} // handlers on State were lost
  ```

  The walk now ends on `State` itself rather than on a name check.

- [#321](https://github.com/gabeklein/expressive-mvc/pull/321) [`0bdb45f`](https://github.com/gabeklein/expressive-mvc/commit/0bdb45f294f77970569747262bae4fd8bbc35071) Instruction tokens are now held weakly, so an instruction that never lands on an activated instance (shadowed by a subclass initializer, or constructed without activation) no longer retains its factory for the process lifetime.

- [#306](https://github.com/gabeklein/expressive-mvc/pull/306) [`6b34ad5`](https://github.com/gabeklein/expressive-mvc/commit/6b34ad5d967f3aa678cf47820140a6e81fb5f3e2) Fix two error paths that reported internals instead of the mistake.

  An enumerable property declared on a State subclass's prototype crashed
  activation with `undefined is not an object (evaluating 'property.value')`.
  `for-in` enumerates such a key but `getOwnPropertyDescriptor` returns nothing for
  it, and the `def` and `observe` sweeps assumed a descriptor. Keys with no own
  descriptor are now skipped - prototype members are unmanaged by design, the same
  as methods.

  Using a destroyed state threw `Object is not observable (terminated).`, naming an
  internal slot rather than the error. It now names the state and what cannot be
  done with it: `Foo-a1b2c3 was destroyed - cannot be rendered, watched or
updated.`

- [#330](https://github.com/gabeklein/expressive-mvc/pull/330) [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9) An instruction token which cannot be applied now throws at activation instead of persisting as a value. A token minted outside a construction - hoisted to a module binding, or shared between classes - is consumed by whichever instance activates first, and every later instance silently kept the raw `Symbol('field-<uid>')` in place of its value.

  ```ts
  const shared = set(() => 42);
  class Thing extends State {
    value = shared;
  }

  Thing.new().value; // 42
  Thing.new().value; // Symbol(field-WZJHFS) - now throws
  ```

  A single-instance app shipped this and worked; the failure appeared only once a second instance was constructed.

- [#330](https://github.com/gabeklein/expressive-mvc/pull/330) [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9) Instructions work again on React Native. The token registry is now a plain `Map` cleared at the end of each tick, so no `WeakMap` is ever keyed by a symbol - Hermes does not implement ES2023 symbol keys for `WeakMap`, and keying on one made every instruction throw. This supersedes the `WeakMap` introduced to stop unconsumed tokens retaining their factories; a per-tick registry bounds that retention instead.

  Creating an instruction outside a construction now throws:

  ```ts
  const shared = set(() => 42); // Error - no State under construction
  ```

  An instruction is per-instance, so a token minted ahead of one had no possible claimant - it was consumed by whichever instance activated first, leaving every later instance with the raw symbol. This is sound only because a State must now activate in the tick it was constructed.

- [#312](https://github.com/gabeklein/expressive-mvc/pull/312) [`519c800`](https://github.com/gabeklein/expressive-mvc/commit/519c8003e6a1cefdad4bb025b11d1d1a3717d4e7) Tracking proxies now carry `is` as an own writable property.

  Value is unchanged - `is` still resolves to the subject instance - but the
  property no longer comes from the non-writable one on the instance. Test runners
  that diff a proxy (the value handed to effects and renders) against a State
  crashed while building the diff: vitest clones both sides through the prototype
  chain and assigns onto the clone, which threw `Cannot assign to read only
property 'is'` and replaced the real assertion failure with a TypeError.

- [#335](https://github.com/gabeklein/expressive-mvc/pull/335) [`139e338`](https://github.com/gabeklein/expressive-mvc/commit/139e3388a9375b4159ec520cfeca34c98f10784d) Resolve upstream `get()` between siblings regardless of field order. A child's `get(Type)` no longer throws when the matching sibling is declared after it on the same parent, and `get(Type, false)` and the callback form backfill when the sibling arrives. States added to a context now notify upstream consumers registered in that same context.

## 0.83.1

### Patch Changes

- [#301](https://github.com/gabeklein/expressive-mvc/pull/301) [`25071c7`](https://github.com/gabeklein/expressive-mvc/commit/25071c7d4cd6e57db154a4430ec4f6228a8f2c56) Run effect cleanup when an effect terminates its own subject.

  An effect which called `set(null)` on its own subject synchronously - during its first run or any re-run - left the cleanup it returned dangling. The terminal event completed inside `set(null)`, before the effect had returned, so its cleanup registered after listeners were already cleared and never fired. Resources held there, such as timers or sockets, would leak.

  Cleanup returned by a run which terminated its subject now fires immediately with `null`, matching the normal destruction path.

- [#298](https://github.com/gabeklein/expressive-mvc/pull/298) [`3407792`](https://github.com/gabeklein/expressive-mvc/commit/3407792584f2fe07e72777041951e3ab7aad5c8d) Scope effects created during activation to the state that creates them.

  A State activated inside another state's effect registered its own activation-time
  effects into the enclosing effect scope. The enclosing effect's next run tore them
  down permanently, leaving the inner state inert - it would render once and then stop
  responding to updates. Activation now captures its own scope, so those effects belong
  to the state being activated and survive unrelated reruns.

  As part of the same scoping, an effect a state registers on a _different_ state during
  activation is now released when that state is destroyed, rather than outliving it.

- [#295](https://github.com/gabeklein/expressive-mvc/pull/295) [`a4d2011`](https://github.com/gabeklein/expressive-mvc/commit/a4d201152319d845c3df29d9b9769dd864ebcc74) Store the underlying instance when a State is assigned from a subscriber.

  Reading a child State through a subscriber proxy - a render body, an effect, or any handler which closed over one - yields a tracking proxy for that child, not the child itself. Assigning it back to a managed field stored the proxy. Since the proxy is a fresh object each read, adoption treated it as an unparented State and claimed ownership of it, and clearing the field then fired the terminal event against the proxy. That event resolves the child's real observer through the prototype chain, so every listener on the live child was dropped while the child itself stayed active and unaware.

  The visible symptom was a computed getter that stopped recomputing. Its subscription is established once and never re-established, so it never recovered - it returned a frozen value while plain fields, whose subscriptions are rebuilt on each render, kept tracking. Under React this surfaced on the third `{instance}` placement of a child field toggled from an event handler.

  Managed fields now hold the instance, so identity, update de-duplication and adoption all reference the same object.

- [#303](https://github.com/gabeklein/expressive-mvc/pull/303) [`9f75bf2`](https://github.com/gabeklein/expressive-mvc/commit/9f75bf2d086a176581815c26940d2647349f728c) `event(state, null)` (exported via `@expressive/mvc/observable`) now honors a terminal event only when the target owns its observer. Previously a derived object - `Object.create(subject)` or a subscriber proxy - resolved the subject's observer through the prototype chain and cleared the real subject's listeners, leaving it silently deaf while the null write landed on the throwaway object. Such calls are now inert; legitimate destruction (`State.set(null)`, owner teardown) is unaffected, as every valid terminal call already arrives holding the slot owner.

## 0.83.0

### Minor Changes

- [#290](https://github.com/gabeklein/expressive-mvc/pull/290) [`1070ef9`](https://github.com/gabeklein/expressive-mvc/commit/1070ef9246bed552c63196fcb21037bb2108dfd7) A second global instance of the same type now throws on activation instead of silently evicting both from root. A duplicate `static global` singleton is nearly always a bug (double `.new()`, leaked test instance), and mutual eviction deferred the failure to a distant "Could not find X in context". Destroy the existing instance first (`set(null)`), or register additional instances explicitly via context. Sibling-subtype collisions at a shared ancestor keep the per-ancestor eviction semantics.

- [#284](https://github.com/gabeklein/expressive-mvc/pull/284) [`5ade5bd`](https://github.com/gabeklein/expressive-mvc/commit/5ade5bd5bb9c1e25db182f472fd8749b42c053aa) Host registry moves to `@expressive/mvc/runtime`, and gains a transition seam.

  **Breaking:** the host registry now lives at the new subpath `@expressive/mvc/runtime` - `host()`, `HostRuntime`, the `Host` augmentation manifest, `Fragment`, the introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`), and element creation. `@expressive/mvc/jsx-runtime` is constrained to exactly the transform contract - `jsx`, `jsxs`, `Fragment`, and the `JSX` namespace, which is all `jsxImportSource` resolves there. Imports of anything else from `jsx-runtime` must retarget to `@expressive/mvc/runtime`; likewise adapters extending `Host` must augment `declare module '@expressive/mvc/runtime'` (augmentation cannot follow re-exports regardless). No published pairing breaks - 0.x caret ranges pin every shipped adapter and router to mvc 0.82 - and in-repo consumers are updated in this release.

  **Transition seam:** `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/runtime` exports the implementation. The same `transition(work)` is promoted through the public `@expressive/mvc` and `@expressive/react` barrels, but deliberately not through `jsx-runtime`. The helper runs `work` inline through the host bracket while marking observable writes as non-urgent; affected subscriber callbacks later replay the bracket when the normal microtask dispatch flushes. Immediate host updates and deferred MVC publication therefore share non-urgent priority without promising one atomic transition. Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler), work and subscriber dispatch retain their normal timing.

  `@expressive/react` registers React's `startTransition` as the scheduler. `State.get()`, `State.use()`, Component, and direct collection subscribers therefore receive React Transition priority without moving model mutation or core event dispatch into React. Urgent invalidation upgrades only subscriber work that is already pending for the same watcher; unrelated urgent work does not cancel deferred presentation.

  This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter.

## 0.82.0

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

## 0.81.0

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

- [#254](https://github.com/gabeklein/expressive-mvc/pull/254) [`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9) Fix a crash when a bare-constructed instance (`new X()`, not `X.new()`) activates after a foreign non-configurable own property has been installed on it - for example a React element internal like `_owner`, added by the render facade when a not-yet-activated `Component` is dropped into JSX and activated in place. Activation's field sweep now converts only _configurable_ value properties into reactive ones, leaving anything non-configurable untouched instead of throwing on `defineProperty`.

- [#253](https://github.com/gabeklein/expressive-mvc/pull/253) [`dd4a6d4`](https://github.com/gabeklein/expressive-mvc/commit/dd4a6d40758dd3b61f8d17f25a927e5bfb02a63e) Refresh npm metadata: package descriptions and keywords aligned with the project's canonical description. The `@expressive/mvc` readme now directs React users to `@expressive/react` and states that the core arrives as its dependency, correcting a common mistake where both packages get added to `package.json`. Publishing also refreshes the package pages that search engines and answer engines currently cite from older releases.

- [#250](https://github.com/gabeklein/expressive-mvc/pull/250) [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2) Fix instances rendered through a subscriber proxy (such as from their owner's own render) losing element identity on every re-render, causing React to remount their placement and context teardown to destroy the live instance. The element facade now installs on the real instance so all proxies share one identity, and context teardown only destroys instances the context itself constructed.

## 0.80.1

### Patch Changes

- [#212](https://github.com/gabeklein/expressive-mvc/pull/212) [`b37b918`](https://github.com/gabeklein/expressive-mvc/commit/b37b918800f569029c297e9e5b6d458fdb723fea) Fix a dropped refresh when an observer is re-notified within the same dispatch tick. The batched event queue coalesced handlers by identity and drained with `Set.forEach`, so a handler re-enqueued after it had already run in the current tick was silently skipped. This stranded a `.get()` subscription that observed both a field and a computed derived from that field (the field's change and the computed's recompute land in one tick): the component refreshed once, then froze. The queue now removes each handler before invoking it, so a same-tick re-enqueue runs again.

## 0.80.0

### Minor Changes

- [#196](https://github.com/gabeklein/expressive-mvc/pull/196) [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99) Move the low-level observable protocol (`observer`, `touch`, `event`, `listener`, `watch`, `Observer`) off the main entry to a dedicated `@expressive/mvc/observable` subpath. This declutters the primary import surface, which is now the app-facing API (`State`, `Component`, `Context`, instructions). The protocol is power-user surface for building custom observables; import it explicitly:

  ```ts
  import { watch, touch, event } from '@expressive/mvc/observable';
  ```

  Breaking: these names are no longer exported from `@expressive/mvc`, and `@expressive/react` no longer re-exports `Observer` from its main entry. Update imports to the subpath.

### Patch Changes

- [#199](https://github.com/gabeklein/expressive-mvc/pull/199) [`de44e86`](https://github.com/gabeklein/expressive-mvc/commit/de44e86111c9eec6e5b0813174adfd34b15db158) Fix prop assignment throwing when a prop shares the name of a read-only (getter-derived) computed. Such a key previously hit the computed's throwing setter and dropped the value; it is now skipped during assignment, leaving the computed to derive it.

## 0.79.1

### Patch Changes

- [#188](https://github.com/gabeklein/expressive-mvc/pull/188) [`077f9e5`](https://github.com/gabeklein/expressive-mvc/commit/077f9e59bacb99e64036244501090fa8e44c82bb) Fix stack overflow in `get()` snapshots when the model graph has a cycle not passing through root state.

## 0.79.0

### Minor Changes

- [#185](https://github.com/gabeklein/expressive-mvc/pull/185) [`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0) `set` now defines a reactive computed property when passed a function that takes an argument - the instruction equivalent of a class getter. `set(self => self.first + ' ' + self.last)` re-runs whenever a managed property it reads updates, receiving the instance as both `this` and its first argument. It is enumerable and read-only, matching a prototype getter.

  Dispatch is by arity: a zero-arg function (`set(() => ...)`) keeps its existing behavior as a one-shot lazy factory, while a function declaring a parameter routes into the reactive compute engine. This exposes getter behavior through an instruction, so it can be composed or wrapped, and - because the property is instruction-assigned rather than a concrete getter - a subclass may refine its type with `declare`, which a generic getter on a parent class cannot express.

## 0.78.1

### Patch Changes

- [#166](https://github.com/gabeklein/expressive-mvc/pull/166) [`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606) fix: keep overridden `render` valid as JSX when consuming built packages

  When `@expressive/router` was consumed as a built package (outside the monorepo), `<Route>`, `<Link>`, and `<NavLinks>` failed type-checking as JSX (`TS2786`). Their `render` overrides had no explicit return type, so the `.d.ts` emitter baked the host-seam alias's build-time fallback (`unknown`) into the published types, which is not assignable to `ReactNode`.

  Two changes fix this:

  - `@expressive/router`: the overridden `render` methods are annotated `: Component.Node`, so the emitter preserves the deferred alias by reference and it re-resolves to the host node type (e.g. `ReactNode`) in a consumer.
  - `@expressive/mvc`: `Component.Node` now falls back to `any` instead of `unknown`. `any` is the only fallback assignable to every host's node type, so an un-annotated `render` override in any host-agnostic package still emits a JSX-valid return.

## 0.78.0

### Minor Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **Milestone release.** `@expressive/mvc` now ships the renderer-agnostic `Component`, completing the "MVC" the package is named for. This is the first publish since `0.73.1` and folds in a large body of architectural work.

  **`Component` in core ([#100](https://github.com/gabeklein/expressive-mvc/issues/100), [#111](https://github.com/gabeklein/expressive-mvc/issues/111)).** The reactive `Component` - previously living in `@expressive/react` - is now a layer on `State` in the core package. A renderer is no longer assumed: `@expressive/react` becomes a thin adapter that completes the class through documented seams. Subclasses may override `render` and have it **compose up the prototype chain** with no `super.render()` call - each ancestor wraps the subclass output as `children`, base-outermost, lazily and reactively ([#111](https://github.com/gabeklein/expressive-mvc/issues/111), breaking).

  **Host-agnostic JSX runtime ([#127](https://github.com/gabeklein/expressive-mvc/issues/127)).** `@expressive/mvc` is now a standalone JSX pragma (`jsxImportSource: "@expressive/mvc"`). The new `@expressive/mvc/jsx-runtime` entry forwards `jsx`/`jsxs`/`jsxDEV`/`Fragment` to a host table registered by an adapter (one host per build). Element-introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`) let agnostic libraries walk JSX without a renderer.

  **Reactive collections ([#78](https://github.com/gabeklein/expressive-mvc/issues/78)).** New `hot()` helper - a shallow reactive proxy for arrays/objects with keyed read-subscription and native mutating methods.

  **Robustness.** Reads of a destroyed instance now settle to last-known values instead of throwing, while writes and subscriptions stay loud ([#121](https://github.com/gabeklein/expressive-mvc/issues/121)); instances discarded before a React commit are now destroyed ([#122](https://github.com/gabeklein/expressive-mvc/issues/122)).

  **Breaking / surface changes.**

  - Package renamed back to `@expressive/mvc` from the interim `@expressive/state` ([#104](https://github.com/gabeklein/expressive-mvc/issues/104)).
  - `Observable` export renamed to `Observer` ([#151](https://github.com/gabeklein/expressive-mvc/issues/151)).
  - Removed the redundant `get(key, callback)` overload; use `set()` for event listening ([#102](https://github.com/gabeklein/expressive-mvc/issues/102)).
  - ESM-only; CJS output dropped ([#79](https://github.com/gabeklein/expressive-mvc/issues/79)).

- [#143](https://github.com/gabeklein/expressive-mvc/pull/143) [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d) `State.on` now accepts a handler object in addition to the existing init callback, hooking distinct points of the class/instance lifecycle by cadence:

  - `type` - per-class, runs once when the class is first bootstrapped, before its members are classified; receives the class so a handler may inspect or reshape the prototype first. A base-class handler runs for each subclass.
  - `before` - per-instance, runs in the `prepare` phase before `observe`/`new()` (equivalent to a bare function).
  - `after` - per-instance, runs at the `new()` slot after own values are observed; may return a cleanup.

  The bare function overload is unchanged.

  Additionally, bootstrap no longer reactively binds a non-configurable own member. This lets an adapter claim a member by sealing it in a `type` handler (e.g. keeping a Component's `render` unbound for the render chain) and mirrors the existing getter behaviour, which only binds configurable getters.

- [#158](https://github.com/gabeklein/expressive-mvc/pull/158) [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8) Exclude non-settable members from inferred JSX props.

  `Component.StateProps` now drops get-only accessors and `readonly` fields from the prop surface a component accepts. These members can never be meaningfully assigned from JSX, so offering them as props only invited no-op or type-erroring assignments. Writable fields, get/set accessors, callbacks, and methods are unaffected.

  The exclusion is the one structurally-detectable case (via a `readonly`-probe); TypeScript cannot distinguish a method from a callback field, so a blanket function exclusion is intentionally not attempted. The new behavior is consistent with `set`, which already rejects `readonly` keys.
