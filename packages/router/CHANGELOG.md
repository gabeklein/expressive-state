# @expressive/router

## 0.7.1

### Patch Changes

- [#324](https://github.com/gabeklein/expressive-mvc/pull/324) [`ae97d53`](https://github.com/gabeklein/expressive-mvc/commit/ae97d531e7f1988d9d0e6956db4485505f03c398) A `State` stored by an owning writer is now adopted regardless of how it arrives, not only by direct assignment at define time. A child produced by a `set()` factory, or assigned to a property which started empty - including a `Component` prop - is parented, registered in its owner's context, activated, and destroyed with its owner.

  Ownership still follows freshness: an already-active `State` is registered as a guest and outlives the property, matching `map()`. Values a state only reads - a getter, a computed, or a type resolved from context by `get(Type)` - are not adopted; reading a reference does not confer ownership.

  Fixes the `Route.router` fallback in `@expressive/router`, where a `Router` constructed for a route with none in context was never activated.

- Updated dependencies [[`ae97d53`](https://github.com/gabeklein/expressive-mvc/commit/ae97d531e7f1988d9d0e6956db4485505f03c398), [`37ef4e9`](https://github.com/gabeklein/expressive-mvc/commit/37ef4e95ae19285ca902bafdccdbe9bd6304176a), [`0bdb45f`](https://github.com/gabeklein/expressive-mvc/commit/0bdb45f294f77970569747262bae4fd8bbc35071), [`6b34ad5`](https://github.com/gabeklein/expressive-mvc/commit/6b34ad5d967f3aa678cf47820140a6e81fb5f3e2), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`1ff6c32`](https://github.com/gabeklein/expressive-mvc/commit/1ff6c32b0b4dd44a21d32f6231671e15be21a6f4), [`968f596`](https://github.com/gabeklein/expressive-mvc/commit/968f596f217d39b78b2568b4171a96d110b493f9), [`6c9a626`](https://github.com/gabeklein/expressive-mvc/commit/6c9a62612d34b3dc460676cf788723e72c1cd493), [`519c800`](https://github.com/gabeklein/expressive-mvc/commit/519c8003e6a1cefdad4bb025b11d1d1a3717d4e7), [`139e338`](https://github.com/gabeklein/expressive-mvc/commit/139e3388a9375b4159ec520cfeca34c98f10784d)]:
  - @expressive/mvc@0.84.0

## 0.7.0

### Minor Changes

- [#302](https://github.com/gabeklein/expressive-mvc/pull/302) [`3d0032a`](https://github.com/gabeklein/expressive-mvc/commit/3d0032afaec35f22010680d8c788608f5968cd8c) A section `default` now answers wherever the section is declared. Previously the lexical gate behind sibling `as`-arbitration ignored a scope's own `default`, while the same scope's `matched` counted it - so a section holding a 404 lost its slot whenever it competed with another `as`-bearing sibling (an index route, a second layout), rendering nothing at all, and an outer layout dropped its chrome when an inner section's default caught the path. Both verdicts now come from one predicate: a scope claims a path via a descendant match, or via its own `default`, which catches anything under the scope's path.

  **Breaking:** a scope holding a section 404 now owns everything under its path, per the usual first-match declaration order - and because a later sibling declared under it is statically dead, the router **throws** on that shape rather than leaving the route silently unreachable. A flat `<Route to="docs/team/roster">` declared after a `docs` section that owns a `default` was reachable before; it now raises `Route "/docs/team/roster" is unreachable` - move it above the section (or into it) to restore it.

### Patch Changes

- Updated dependencies [[`25071c7`](https://github.com/gabeklein/expressive-mvc/commit/25071c7d4cd6e57db154a4430ec4f6228a8f2c56), [`3407792`](https://github.com/gabeklein/expressive-mvc/commit/3407792584f2fe07e72777041951e3ab7aad5c8d), [`a4d2011`](https://github.com/gabeklein/expressive-mvc/commit/a4d201152319d845c3df29d9b9769dd864ebcc74), [`9f75bf2`](https://github.com/gabeklein/expressive-mvc/commit/9f75bf2d086a176581815c26940d2647349f728c)]:
  - @expressive/mvc@0.83.1

## 0.6.3

### Patch Changes

- Updated dependencies [[`1070ef9`](https://github.com/gabeklein/expressive-mvc/commit/1070ef9246bed552c63196fcb21037bb2108dfd7), [`5ade5bd`](https://github.com/gabeklein/expressive-mvc/commit/5ade5bd5bb9c1e25db182f472fd8749b42c053aa)]:
  - @expressive/mvc@0.83.0

## 0.6.2

### Patch Changes

- [#282](https://github.com/gabeklein/expressive-mvc/pull/282) [`2820e96`](https://github.com/gabeklein/expressive-mvc/commit/2820e964c3a0700e2b092276f0c6ebe236d8c48f) Packaging hygiene: drop the `react` peer dependency and declare `sideEffects: false`.

  The router is host-agnostic - its runtime imports are `@expressive/mvc` entries only, so nothing here requires React itself. The hard peer range (`>=16.8.0 <20.0.0`) produced unmet-peer warnings for non-React hosts and belongs to the adapter, which already declares React as an optional peer. Installing under React is unchanged: the adapter's own peering still applies.

  `sideEffects: false` lets bundlers tree-shake the package like `@expressive/mvc`; no module runs anything at import time. Also aligns publish metadata with sibling packages (`publishConfig.access`) and removes a vestigial npm-based `preversion` script - releases run through changesets CI.

## 0.6.1

### Patch Changes

- [#251](https://github.com/gabeklein/expressive-mvc/pull/251) [`a89bf57`](https://github.com/gabeklein/expressive-mvc/commit/a89bf570e6136b0aaa1783b8f4b181ecb29b392e) Construct `BrowserRouter` safely during server render.

  `BrowserRouter` read `window.location.pathname` in a class-field initializer and bound `window`/`history` in `new()`, both of which run at construction - so activating one during `renderToString` threw `ReferenceError: window is not defined`.

  The field now falls back to `'/'` when there is no `window`, and `new()` skips its browser binding on the server. A `BrowserRouter` activated during server render is inert at `'/'`; provide a `Router` per-request (e.g. via `<Provider>`) to render a request's actual path.

- [#251](https://github.com/gabeklein/expressive-mvc/pull/251) [`a89bf57`](https://github.com/gabeklein/expressive-mvc/commit/a89bf570e6136b0aaa1783b8f4b181ecb29b392e) Make root (global) registration opt-in via `static global`.

  Previously any `State.new()` activated outside a Provider registered itself into the process-global root context, becoming resolvable via `get()` from anywhere. This made an accidental global easy to create — a forgotten `<Provider>` would silently land a per-request instance in the shared root, where it persists for the life of the process and (during server render) is shared across every request.

  **Breaking:** a State now registers to the root context only when it declares `static readonly global = true`. Without it, a context-less instance is still fully functional but private — not resolvable via `get()` from elsewhere, and never shared across server-render requests. A private instance can still _read_ declared globals through the root fallback; it simply isn't one. Scope request state with `<Provider>`, or declare a global for a genuine process-wide singleton (e.g. a router, keyboard, or `localStorage` adapter).

  `global` is `readonly` and typed `State.Global` — a boolean, or a resolver `(self) => boolean` evaluated at activation (after props apply) to decide membership per instance or environment (e.g. `() => typeof window !== 'undefined'`). It is declared per class: a subclass that would be global purely by _inheriting_ a `true` **throws on activation** unless it re-declares (`true` to keep it, `false` to opt out), so a global never propagates silently. A bare-literal `false` additionally locks the subtree at compile time — TypeScript rejects a descendant `= true` — a best-effort vendor lockout that a resolver or wide cast can still override. Using a global class inside a `<Provider>` scopes it to that context and never touches the root, so a process-wide default (e.g. `BrowserRouter`) can still be provided per-request.

  A declared global is intentional and long-lived — process-wide, mutable, and shared across requests, including on the server. Keep request-specific data out of it: scope that with a `<Provider>` instead. A non-global that a consumer expects to inject but that was never provided still throws the usual `Could not find <State> in context`, so a missing Provider surfaces at the point of use.

  `@expressive/router`'s `Router` and `BrowserRouter` declare `static readonly global = () => typeof window !== 'undefined'` — a client-side singleton, but _not_ a shared global during server render, so a per-request `path`/`query` can't bleed across requests. Provide a `Router` per-request (via `<Provider>`) to render a specific path on the server.

- Updated dependencies [[`366ef98`](https://github.com/gabeklein/expressive-mvc/commit/366ef9820c3105de5a6623589a8723e8fe2142a2), [`a89bf57`](https://github.com/gabeklein/expressive-mvc/commit/a89bf570e6136b0aaa1783b8f4b181ecb29b392e)]:
  - @expressive/mvc@0.82.0

## 0.6.0

### Minor Changes

- [#257](https://github.com/gabeklein/expressive-mvc/pull/257) [`9d95ba3`](https://github.com/gabeklein/expressive-mvc/commit/9d95ba33f4ffc82648b38c3f0a617f0ba55eb641) **Breaking:** `Router.query` (and the `Route.query` facade) is now a reactive `map` (`map.Insert<string, string>`) rather than a proxied record. Read a param with `query.get('foo')`, write with `query.set('foo', value)`, and remove with `query.delete('foo')` - each write still navigates by pushing a history entry, exactly as before. Reading a key subscribes to just that param, and URL-driven changes reconcile the same map in place.

  Migration: replace property access (`query.foo`, `query.foo = x`, `delete query.foo`) with the map methods above. The per-key `declare query: { ... }` narrowing is removed - a `map` cannot carry an object-shaped key type; `query` is uniformly keyed by `string`.

### Patch Changes

- [#253](https://github.com/gabeklein/expressive-mvc/pull/253) [`dd4a6d4`](https://github.com/gabeklein/expressive-mvc/commit/dd4a6d40758dd3b61f8d17f25a927e5bfb02a63e) Refresh npm metadata: package descriptions and keywords aligned with the project's canonical description. The `@expressive/mvc` readme now directs React users to `@expressive/react` and states that the core arrives as its dependency, correcting a common mistake where both packages get added to `package.json`. Publishing also refreshes the package pages that search engines and answer engines currently cite from older releases.

- Updated dependencies [[`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9), [`dd4a6d4`](https://github.com/gabeklein/expressive-mvc/commit/dd4a6d40758dd3b61f8d17f25a927e5bfb02a63e), [`f5f2773`](https://github.com/gabeklein/expressive-mvc/commit/f5f2773362209a4d5c18259ed31e7b106034b52c), [`f003b03`](https://github.com/gabeklein/expressive-mvc/commit/f003b035b329ee8e8bbccab579badfb700b3c787), [`f3b7bbd`](https://github.com/gabeklein/expressive-mvc/commit/f3b7bbd89a6128cf74aaeafb17049d5413097335), [`8e34b84`](https://github.com/gabeklein/expressive-mvc/commit/8e34b841177ff85a4aecf6c22c682426ee05ddf8), [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2)]:
  - @expressive/mvc@0.81.0

## 0.5.0

### Minor Changes

- [#200](https://github.com/gabeklein/expressive-mvc/pull/200) [`454836b`](https://github.com/gabeklein/expressive-mvc/commit/454836bae1ed263c154be8896a8d1718e9723d57) Rename the `Route` child-contribution seam from `protected get nested()` to `protected get children()`. The getter reads more naturally as the scope's effective children (its default is `props.children`), and now coexists cleanly with the `children` prop thanks to the read-only-computed assignment fix in `@expressive/mvc`. Subclasses overriding the seam must rename `get nested()` to `get children()` and `super.nested` to `super.children`.

### Patch Changes

- [#192](https://github.com/gabeklein/expressive-mvc/pull/192) [`323adf0`](https://github.com/gabeklein/expressive-mvc/commit/323adf0bd7897c5e902f9eab16c0c4b6e3972727) Fix stale redirect-guard verdict when a guarded route is reused across out-and-in navigation. A route that cedes to a sibling under a persistent parent now clears its cached guard verdict, so re-entry re-runs the guard instead of reusing a stale result or hanging on a settled async promise.

- Updated dependencies [[`de44e86`](https://github.com/gabeklein/expressive-mvc/commit/de44e86111c9eec6e5b0813174adfd34b15db158), [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99)]:
  - @expressive/mvc@0.80.0

## 0.4.0

### Minor Changes

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) A functional `redirect` guard returning `null` now **force-404s**: the route cedes its match for the current path and the scope falls through to its nearest `default`. This lets a page (or its data loader) decline a path it structurally matched - e.g. a fetch returning 401/404 - without revealing whether the resource is forbidden or absent. The decision is path-keyed (it marks only the concrete URL declined, cleared on navigation) and rides reactive `Router` state, so the section's `default` re-arbitrates without an error boundary. `null` is distinct from a falsy verdict (`''`/`undefined`), which still allows normal render. A force-404'd leaf is also excluded from `Route.active`.

- [#186](https://github.com/gabeklein/expressive-mvc/pull/186) [`f89008d`](https://github.com/gabeklein/expressive-mvc/commit/f89008d2abd06744d39c3a840a30372a545ef6a9) `Route.goto` now accepts a params object to swap route params in place: `route.goto({ id: '456' })` rebuilds the route's path from its current match merged with the given overrides (`/document/123` -> `/document/456`). Any param the route declares works, not just the last (`goto({ b: '8' })` on `/a/:b/:c`). A route can only set the params it declares in its own `to`: inherited (ancestor) segments are filled read-only, and a key the route doesn't own throws (so in `<Route to="org/:orgId"><Route to="user/:userId"/></Route>` the inner leaf can swap `userId` but not `orgId`). A declared param the current path can't supply throws the usual unresolved-parameters error. This replaces the `goto("../" + id)` idiom for sibling-param navigation. String `goto` (relative/absolute paths) is unchanged.

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) `Route`'s `redirect` now accepts a function, optionally async, in addition to a static string - an entry guard for auth gates and the like. It is evaluated on entry to the route's scope (the current path falling within its subtree): a truthy string redirects there, a falsy result (`''`/`undefined`) allows normal render, and a returned `Promise` shows the route's `fallback` until it settles. The verdict is cached for navigations within the space and re-evaluated on re-entry. A static-string `redirect` behaves exactly as before; a function guard now participates in sibling matching until it actually redirects, so it can wrap a section (a `Route` with children) and gate the whole subtree.

### Patch Changes

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) A functional `redirect` guard now runs on a route whose own pattern contains a `:param` (e.g. `to="document/:id"`). The in-space check compared the literal, unsubstituted pattern against the URL, so any such route silently skipped its guard; it now gates on `matched`, which resolves captures.

- Updated dependencies [[`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0)]:
  - @expressive/mvc@0.79.0

## 0.3.0

### Minor Changes

- [#177](https://github.com/gabeklein/expressive-mvc/pull/177) [`5777fb6`](https://github.com/gabeklein/expressive-mvc/commit/5777fb62c2744764bc0430ebb410d8b08321bb71) Widen `Route`'s `as` to accept any function or class element type, including a fellow `Route` subclass, instead of only a `(props) => Node` function. The type is mvc's agnostic `Exclude<JSX.ElementType, string>`, so a `Route`/component class type-checks as `as` while intrinsic host tags stay excluded. This enables `<Route as={SomeRouteClass} />` - e.g. a generated wrapper delegating to a user page class - without a cast. When `as` is itself a `Route`, delegation falls out of the existing see-through machinery: the inner Route is the sole arbiter, receives the outer's computed `nested` as its children, and `Route.get` inside its content resolves the inner instance.

## 0.2.0

### Minor Changes

- [#176](https://github.com/gabeklein/expressive-mvc/pull/176) [`6aa0719`](https://github.com/gabeklein/expressive-mvc/commit/6aa0719d25ca260c6ad2fb1b9a02fb248b161dd9) `Route.goto()` now resolves its argument relative to the Route it is called on, and with no argument navigates to that Route itself (its concrete, params-filled path) - enabling "pop from below", where a subroute reaches a named ancestor via context and navigates up to it as currently identified. `goto` always resolves relative to its receiver and an absent argument means `"."` (here), so `''`/`'.'` are no longer dead no-ops. This also fixes `anchor` for nested Routes: it now recovers params from the live path and composes `base` correctly, so relative navigation works from any depth.

- [#175](https://github.com/gabeklein/expressive-mvc/pull/175) [`fc3f416`](https://github.com/gabeklein/expressive-mvc/commit/fc3f416b1f4444b7be7b7f0d4cad89662e8205a7) Add a `protected get nested` extension point to `Route`. It defaults to the children declared in JSX; a subclass overrides the getter to opine on the child routes of its own scope - add, remove, or reorder - composing on `super.nested`. The result flows through every registration-form behavior (`inner`, `active`, `matches`, default gating) and the see-through gate for that scope, so contributed routes participate in matching and render as if declared. Because `nested` is pure analysis (it returns nodes and never triggers a page render), `matched` can consult it without breaking the lazy render gate. A subclass that contributes routes can flip its own leaf<->see-through classification, reflecting its effective children.

### Patch Changes

- [#173](https://github.com/gabeklein/expressive-mvc/pull/173) [`9e4009f`](https://github.com/gabeklein/expressive-mvc/commit/9e4009f85258522fa433f3d3aaf9134aeca78391) Route subclasses are now detected by the lexical JSX walk wherever a plain `Route` is. Previously only `allRoutes` recognized subclasses; the default-detection, see-through-scope, and `as`-slot arbitration walks used a strict `=== Route` identity check and silently skipped subclasses. All four sites now share the subclass-aware `Route.is(...)` test, so a `class Page extends Route` used with JSX props participates in default resolution, scope chrome visibility, and sibling arbitration like any `Route`. (Class-field `to` remains invisible to the lexical walk - unchanged.)

## 0.1.0

### Minor Changes

- [#166](https://github.com/gabeklein/expressive-mvc/pull/166) [`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606) fix: keep overridden `render` valid as JSX when consuming built packages

  When `@expressive/router` was consumed as a built package (outside the monorepo), `<Route>`, `<Link>`, and `<NavLinks>` failed type-checking as JSX (`TS2786`). Their `render` overrides had no explicit return type, so the `.d.ts` emitter baked the host-seam alias's build-time fallback (`unknown`) into the published types, which is not assignable to `ReactNode`.

  Two changes fix this:

  - `@expressive/router`: the overridden `render` methods are annotated `: Component.Node`, so the emitter preserves the deferred alias by reference and it re-resolves to the host node type (e.g. `ReactNode`) in a consumer.
  - `@expressive/mvc`: `Component.Node` now falls back to `any` instead of `unknown`. `any` is the only fallback assignable to every host's node type, so an un-annotated `render` override in any host-agnostic package still emits a JSX-valid return.

### Patch Changes

- Updated dependencies [[`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606)]:
  - @expressive/mvc@0.78.1

## 0.0.1

### Patch Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **First release of `@expressive/router`** - a Component-based declarative router, the "C in MVC." Routes are plain `@expressive/mvc` Components authored against the agnostic JSX pragma, so they render under any host; `@expressive/react` is only a dev/test dependency ([#130](https://github.com/gabeklein/expressive-mvc/issues/130), [#131](https://github.com/gabeklein/expressive-mvc/issues/131), [#150](https://github.com/gabeklein/expressive-mvc/issues/150)).

  **Features.**

  - **Declarative `<Route>` trees** - pages are plain Components; see-through scopes, `*` opaque delegation, and a `default` no-match branch. Sibling routes arbitrate first-match by declaration order, Express/switch-case style ([#137](https://github.com/gabeklein/expressive-mvc/issues/137)).
  - **Matching** - `:param` segments, trailing `*` catch-all, slash normalization, case-insensitive, scored.
  - **`Router` / `BrowserRouter`** - a headless in-memory router (`goto`/`back`/`forward`/`replace`) and a browser binding over `window.location`/`history` with `popstate`, auto-spawned into the root context.
  - **Reactive `query` + `url` ([#138](https://github.com/gabeklein/expressive-mvc/issues/138))** - the query string is a reactive record: reading `query.foo` subscribes, writing it navigates; a derived `url` getter is assignable to navigate.
  - **`Link`** - `to`/`replace`, resolved hrefs, modifier-click bailout, and built-in active/match getters with subclass-replaceable render ([#148](https://github.com/gabeklein/expressive-mvc/issues/148)). Plus `Redirect` (StrictMode-safe, `when`-gated) and `NavLinks`.

- Updated dependencies [[`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050), [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d), [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8)]:
  - @expressive/mvc@0.78.0
