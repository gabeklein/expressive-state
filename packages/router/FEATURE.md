# Feature: Suspense-aware navigation + screen transitions

> Working doc. When shipped, fold the durable parts into PLAN.md and delete this
> file (same lifecycle as the matching REFACTOR.md).
>
> **🚩 FLAG** = a decision needing confirmation.

## 1. What it's for

Two related capabilities about *when* and *how* a navigation presents:

- **Deferred presentation** - wait for a navigated page to be ready before
  swapping, so you never flash a blank or a loading state on in-app navigation.
  Keep the current screen up until the next is ready.
- **Screen transitions** - first-class but **unopinionated** support for
  animating between screens (cross-fade, shared-element, slide). The router only
  brackets the navigation; the app owns the visuals.

Both opt-in, both opinion-free at the base.

## 2. Model: one overridable seam on the Router

Consistent with how `NavLinks` (Item/Group) and Route's proposed `Layout`
members work - behavior lives as members on the class; the base ships thin
boilerplate; a subclass customizes. `goto` brackets every navigation:

```ts
import { transition as scheduleTransition } from '@expressive/mvc';

goto(to, replace?) {
  this.transition(() => /* mutate path */);
}

// BrowserRouter default: deferred presentation, no animation.
protected transition(commit: () => void) {
  scheduleTransition(commit);
}
```

A user `class MyRouter extends BrowserRouter` (or `extends Router` for another
host) overrides `transition` and/or render members to decide *how* a navigation
plays out. **One seam, two layers:** base = deferred presentation; subclass =
deferral + animation.

## 3. Requirements (what it leans on)

- **Component auto-Suspense (already exists).** Every `@expressive/react`
  Component wraps itself in `<Suspense fallback={this.fallback}>`
  ([component.ts:84](../react/src/component.ts#L84)) and reuses `fallback` as the
  error placeholder ([:169](../react/src/component.ts#L169)). So a page (`as`) is
  its own Component with its own loading fallback - **page-level loading already
  works**; Route does not implement it.
- **Expressive `transition`.** Model writes run synchronously while their queued
  subscriber callbacks retain non-urgent priority through MVC's microtask
  dispatch. The active host interprets that priority; React registers
  `startTransition`.
- **React** `startTransition` (deferral) + `useTransition` (the `pending` flag).

## 4. Deferred presentation (built-in default)

No-flash-on-navigate is universal and opinion-free, so it is the seam's default.

**The crux (solved):** React only assigns transition priority to state setters
called inside `startTransition`, while Expressive normally delivers subscriber
callbacks in a later microtask. MVC's `transition()` records that designation
with each queued watcher and replays the watcher through the host bracket when
dispatch flushes. `goto` can therefore mutate `path` normally: batching,
computed invalidation, and final-state squashing remain intact while Route's
React setter receives transition priority and holds the prior screen until the
suspending page resolves.

**`pending`.** React's pending state comes from the `useTransition` *hook*, which
lives in a component, not a method. Expose `router.pending` via a hook-resident
render member on the Router feeding the field (mirror to `aria-busy`, a progress
bar, dimming the outgoing screen). Pairs with `Link.onClick`'s `pending`.

## 5. Screen transitions (subclass override)

Unopinionated; the clean primitive is the **View Transitions API**. A subclass
overrides `transition` to bracket the swap and the **consumer owns all the CSS**
(`view-transition-name`, `::view-transition-*`):

```ts
transition(commit) {
  document.startViewTransition(() => {
    scheduleTransition(commit);
  });
}
```

For richer per-screen control, overridable render members on the Router (a
`Frame`/outlet member) can host enter/leave.

- **Why not JS/FLIP first:** exit animations need the *outgoing* screen to
  persist through the transition, which React doesn't do natively (it unmounts).
  View Transitions sidesteps this via a DOM snapshot. A keep-mounted/presence
  mechanism for JS-driven exit is opinionated and deferred.
- **Opt-in granularity:** per-navigation or per-route flag vs global; respect
  `prefers-reduced-motion`.

## 6. The `fallback` conflict (RESOLVED - option A)

`Component.fallback` natively means the Suspense/error placeholder. `Route
extends Component` had overridden `fallback = false` to mean the **404
else-branch** - so Route's inherited Suspense/error placeholder was permanently
`false`, and the name was unavailable for a route-level loading placeholder.

**Resolution (option A, done):** the no-match branch is now the **`default`**
prop (`<Route default as={NotFound} />`). `fallback` reverts to Component's
Suspense/error meaning, so route-level loading + per-route error UI come for
free, uniform with all Components. `default` reads as prose at the call site and
mirrors `switch`'s `default` - the branch taken when nothing else matched. It
stays an instance field (not a render-local prop) because sibling/parent
matching computeds read it off live Route instances. Renamed in lockstep:
`hasDefault`/`defaultCatches` helpers, `RouteProps.default`, and all call sites.

Rejected alternatives:
- **B** - keep `fallback`=404; add a distinct `loading` member that places its
  own boundary. More code; works *around* the inherited boundary.
- **C** - do nothing at Route. Deferred indefinitely; A was cheap enough to do.

## 7. Plan (in order)

1. **`transition(commit)` seam (DONE)** on Router; every navigation commit
   (goto/back/forward, and BrowserRouter's popstate/pushState sync) routes
   through it; default = deferred presentation via mvc `transition()`.
2. **MVC transition dispatch** (the core, done): normal path updates carry
   non-urgent priority through batched subscriber dispatch. Router
   computeds (`matched`/`match`) and Route presentation verified against
   that contract in tests.
3. **`pending`** flag via a hook-resident `useTransition` member on Router.
4. **Verify (tests DONE)** against page-level loading: a suspending page (lazy
   chunk or pending guard) holds the old screen on in-app nav, shows its own
   `fallback` on cold load - covered in route.test.tsx. Example dogfood still
   open.
5. **fallback realignment (DONE)** - §6 option A: no-match branch is now the
   `default` prop; `fallback` reverts to Component's Suspense/error meaning.

## 8. Concerns / open
- Suspense **boundary placement** for any route-level case: per-route vs a shared
  boundary at the matched-content site.
- `pending` requires a render-resident member (hook), not a plain method.
- View Transitions + React commit timing (the snapshot must capture the *new*
  screen after React commits) - validate when building §5.
