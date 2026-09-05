# Router

Runnable source: the [`router`](https://expressive.dev/examples/router/overview) section - [`overview`](https://expressive.dev/examples/router/overview), [`params`](https://expressive.dev/examples/router/params), [`query`](https://expressive.dev/examples/router/query), [`guards`](https://expressive.dev/examples/router/guards), [`transitions`](https://expressive.dev/examples/router/transitions), [`nav`](https://expressive.dev/examples/router/nav). Complete programs, served as HTML.

`@expressive/router` is a host-agnostic, class-based router built on Expressive MVC. Routes are declared as nested JSX, matching is lexical (computed from the JSX tree, not a separate config), and navigation state lives on a reactive `Router` State that any component can read or drive.

Published on npm alongside the core packages:

```bash
npm install @expressive/router @expressive/react react
```

```tsx
import { Route, Link, NavLinks, Redirect, Router, BrowserRouter } from '@expressive/router';
```

## Mental model

- **`Router`** - the navigation State: current `path`, reactive `query` map, derived `url`, and an in-memory history stack. Headless; touches no browser globals, so it runs and tests anywhere. It is also the memory-router substrate.
- **`BrowserRouter`** - binds the core to `window.location`/`history`, syncing `path`/`query` on navigation (`goto`, `popstate`, external `pushState`/`replaceState`).
- **`Route`** - a `Component` that matches part of the URL and renders a page. Routes nest to mirror the URL hierarchy. Each `Route` is a scoped facade over the active `Router` (`path`, `match`, `query`, `goto`, `resolve`).
- **`Link` / `NavLinks` / `Redirect`** - navigation UI built on `Route`.

A `<Route>` with no ancestor `Router` in context spins up a headless `Router`. For a browser app, provide a `BrowserRouter` so navigation reflects the address bar.

## Declaring routes

Routes are nested JSX. `to` is the pattern segment; `as` is the page (or layout) component. Children compose against the parent's path.

```tsx
<Route as={RootLayout}>
  <Route as={HomePage} />                {/* index: matches the parent path */}
  <Route to="blog" as={BlogLayout}>
    <Route as={BlogIndex} />             {/* /blog */}
    <Route to=":slug" as={BlogPost} />   {/* /blog/:slug */}
  </Route>
  <Route default as={NotFound} />        {/* matches when no sibling did */}
</Route>
```

| Prop       | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `to`       | URL pattern segment. `:name` captures a param. A trailing `*` is a catch-all matching the remaining path segments (captured as `*`) - needed on a **leaf** that should match deep paths; **redundant on a scope with child Routes**, whose children already extend the match. Omit for an index route. |
| `as`       | Component rendered when matched. As a layout, it receives matched children via `children`. |
| `default`  | Matches when nothing else in this scope did. Scoped to its parent (root-level = app 404, nested = section 404). |
| `redirect` | Entry guard. A static string redirects there when matched; a function gates the route (see [Entry guards](#entry-guards)). |
| `label`    | Display name for NavLinks/breadcrumbs/titles (ignored by matching).                      |
| `meta`     | Free-form metadata (icons, ordering, badges) - ignored by matching.                      |

A parent-less `<Route>` with no `to` is its own root: always matched, capturing everything below.

### Flat leaf vs. nested scope

A multi-segment `to` (`to="users/:id"`) is a **flat leaf** - it does *not* synthesize an intermediate `users` scope. Nesting is the explicit (and only) way to open one:

```tsx
<Route to="users/:id" as={Detail} />            {/* flat leaf */}

<Route to="users" as={Layout}>                   {/* nested scope */}
  <Route to=":id" as={Detail} />
  <Route default as={NotFound} />
</Route>
```

Both resolve `/users/42` identically - same match, same captures, same relative navigation (both anchor on the resolved `/users/42`). Nesting changes nothing for plain navigation; it buys a **scope**. Only the nested form can:

- host a **section `default`** (a `/users/<bad-id>` 404 that stays in the section, rather than falling through to the app-level default);
- wrap children in **shared chrome** (the layout `as`) that persists across param changes;
- interpose a **section `Route`** in context (so `get(Route)` sees both the section and the leaf) and group the section in `NavLinks`.

A `default` always needs an authored parent scope - a root `default` is the app 404 only because the root `<Route>` is its scope. So **use the flat leaf for a standalone endpoint; nest the moment you need a section 404, shared chrome, sibling routes under the prefix, or nav grouping** - which is most resource pages, and is required for the force-404 pattern below.

## Entry guards

`redirect` accepts a **function** as well as a static string - an entry guard run when the route is matched (it can wrap a section by living on a `Route` with children). The verdict drives one of three outcomes:

| Returns | Outcome |
| --- | --- |
| a truthy `string` | redirect there (replaces history) |
| `''` / `undefined` / `false` | allow normal render |
| `null` | **force-404**: cede the path so the scope falls through to its nearest `default` |

The guard may be **async** (return a `Promise`); while it pends, the route's `fallback` shows on cold load, and in-app navigation holds the current screen (see [Deferred presentation](#deferred-presentation)). The verdict is cached for navigation within the matched space and re-evaluated on re-entry.

```tsx
<Route to="document/:id"
  fallback={<Spinner />}
  redirect={async () => {
    const res = await fetch(`/api/doc/${id}`);
    if (res.status === 401) return null;        // force-404 (don't reveal forbidden vs deleted)
    if (res.status === 302) return '/login';    // redirect
    // ...allow
  }}
  as={Document} />
<Route default as={DocumentNotFound} />          // the section 404 a null verdict cedes to
```

Force-404 is path-keyed: it marks only the concrete URL that was declined, so navigating elsewhere clears it. `null` is the deliberate "definitively not here" signal - distinct from a falsy `&&` short-circuit, which allows. The 404 surface is the scope's authored `default` sibling, so a *section*-level not-found requires a parent scope with children (a flat leaf forfeits to the nearest authored default).

## Code-split pages

`as` takes a lazy component - `React.lazy`, or anything that suspends while its module loads. A `Route` is its own suspense boundary: on cold load `fallback` shows while the chunk loads, then the page resolves in place - the Route instance, its `match`, and any ancestor layout survive. On in-app navigation the previous screen holds instead (see [Deferred presentation](#deferred-presentation)).

```tsx
const Document = lazy(() => import('./Document'));

<Route to="document/:id" fallback={<Spinner />} as={Document} />
```

A lazy *layout* suspends its whole scope - child routes register only after its module resolves. Navigating away mid-load abandons the page; it never mounts. A failed chunk is an error, not a suspension - handle it with `catch` on a `Route` subclass, or it propagates to the nearest ancestor boundary.

## Deferred presentation

Every navigation (`goto`, `Link`, `back`/`forward`, popstate) commits through `Router.transition`, a protected seam whose default marks the commit non-urgent via the host scheduler (React `startTransition`). In-app navigation to a page that isn't ready - a loading chunk, a pending entry guard - holds the current screen until the next resolves, instead of flashing `fallback`. Cold load (initial mount, no prior screen) still shows `fallback`. The URL updates immediately either way; only presentation defers.

Override `transition(commit)` on a subclass to stage the swap differently - `commit` applies the navigation state and must run:

```ts
class MyRouter extends BrowserRouter {
  static global = true;   // subclasses re-declare global explicitly

  protected transition(commit: () => void) {
    // bracket the swap (e.g. View Transitions), then defer as usual
    super.transition(commit);
  }
}
```

Hosts without a scheduler (no `HostRuntime.transition`) apply navigation at normal priority - same timing as before the seam.

## Reading match state inside a page

A page reads the nearest `Route` from context (e.g. via `Consumer` or `get(Route)`) and uses its reactive getters:

```tsx
const BlogPost = () => (
  <Consumer for={Route}>{route => <article>post: {route.match!.slug}</article>}</Consumer>
);
```

| Member            | Type                              | Meaning                                                                 |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `route.match`     | `Record<string,string> \| undefined` | Captured params from the current match (`undefined` when unmatched). Stable identity across reads when captures are unchanged. |
| `route.matched`   | `boolean`                         | Whether this route is active. Read this in render (not `match`) so same-pattern navigations reconcile in place instead of remounting. |
| `route.path`      | `string`                          | This route's own absolute path (base + segment).                        |
| `route.query`     | `map.Insert<string,string>`       | Live query map from the active Router (global, not route-scoped - see below). |
| `route.anchor`    | `string`                          | Directory-style anchor for relative navigation.                         |
| `route.goto(to)`  | -                                 | Navigate. A string resolves relative to this route; a params object swaps route params in place (see below). |
| `route.resolve(to)` | `string`                        | Resolve a (possibly relative) url to an absolute pathname.              |

Same-pattern navigation (`/blog/a` -> `/blog/b`) keeps the page instance mounted: `matched` is unchanged, so the component reconciles and re-reads `match`, rather than unmounting/remounting.

To swap a param without composing a relative path, pass `goto` an object: it rebuilds this route's path from the current match merged with the overrides. Any param the route **declares in its own `to`** can change - position doesn't matter.

```tsx
// on /document/123, route pattern "document/:id"
route.goto({ id: '456' });        // -> /document/456

// on /a/1/2, route pattern "a/:b/:c"
route.goto({ c: '9' });           // -> /a/1/9   (keeps :b)
route.goto({ b: '8' });           // -> /a/8/2   (keeps :c)
```

**A route can only set the params it declares.** Inherited (ancestor) segments are filled from the current path, read-only; a key the route does not own throws. This is where flat-vs-nested matters again: a flat `org/:orgId/user/:userId` leaf owns *both*, but in `<Route to="org/:orgId"><Route to="user/:userId"/></Route>` the inner leaf owns only `userId` - changing `orgId` is the parent scope's call. To cross levels, navigate to the owning route or pass an absolute path string. A declared param the current path can't supply and the object doesn't provide throws an unresolved-parameters error.

Param changes do not remount: like `query`, `match` updates reactively and the page reconciles in place. A param combination that matches the pattern but is invalid in data (`/org/9/user/2` where that pairing doesn't exist) navigates fine; detecting it is the page's job - see force-404 under [Entry guards](#entry-guards).

## Navigation state on `Router`

`Router` (and `BrowserRouter`) expose the canonical location as three reactive surfaces:

| Member            | Type                                | Notes                                                                |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `path`            | `string`                            | Pathname only.                                                       |
| `query`           | `map.Insert<string,string>`         | Canonical query state - a reactive map (see below).                  |
| `url`             | `string`                            | Full URL (path + `?query`), canonically serialized. Assigning navigates. |
| `goto(to, replace?)` | -                                | Navigate to an absolute path; `replace` overwrites the current entry instead of pushing. |
| `back()` / `forward()` | -                              | Move the history cursor.                                             |

```tsx
router.goto('/posts?page=2');   // push
router.goto('/posts', true);    // replace
router.url = '/posts?page=2';   // same as goto (push); use goto(to, true) to replace
router.back();
```

## The `query` map

`query` is the canonical query state as a reactive `map` - not a string. Read a param to track it; **write** a param (or delete it) to navigate.

```tsx
router.query.get('page');       // read - subscribes to just this param
router.query.set('page', '2');  // write - pushes a new history entry, like goto
router.query.delete('sort');    // delete - also navigates
```

Writing or deleting a param pushes a new history entry, exactly as if it arrived via `goto`. URL-driven changes (navigation, popstate) reconcile the same map, so consumers reading `query.get('foo')` re-render only when that param changes.

Notes:
- Keys and values are `string` - URL params carry no other type. Reading an absent key is `undefined`.
- Single-valued: repeated keys (`?a=1&a=2`) collapse to the last value.
- `query` is **global** to the Router. On a `Route` it is the same map for every route, unlike `match` which is that route's own captures. (Query strings are not path-scoped.)
- `url` is always canonically serialized (space as `+`, last-value-per-key), so navigation never pushes a spurious duplicate entry due to encoding differences.

## Links and navigation UI

### `Link`

Renders an `<a>` that navigates on click (intercepting only plain left-clicks, so modifier/middle clicks fall through to the browser). `href` is the resolved absolute path.

```tsx
<Link to="blog">Blog</Link>
<Link to="/posts?page=2" replace>Page 2</Link>
```

| Prop      | Meaning                                                  |
| --------- | -------------------------------------------------------- |
| `to`      | Target, resolved relative to the enclosing `Route`.      |
| `replace` | Replace the current history entry instead of pushing.    |
| ...rest   | Forwarded to the underlying `<a>`.                       |

`Link` also exposes its match state as reactive getters, so active-link styling needs no separate component:

| Getter   | Type                        | Meaning                                                            |
| -------- | --------------------------- | ------------------------------------------------------------------ |
| `href`   | `string`                    | Resolved absolute path for the `<a>`.                              |
| `match`  | `boolean \| undefined`      | `true` exact match, `false` prefix match, `undefined` no match.    |
| `active` | `boolean`                   | Whether the current path matches the target at all (`match !== undefined`). |

Both `match`/`active` are **lazy**: a `Link` whose render reads neither stays inert across navigation (no re-render on route changes). Reading either subscribes that instance to navigation.

#### Active links by subclassing

There is no `NavLink` - extend `Link` and read `active`/`match` to express activeness however the host wants (a `className` on web, a `style` on native). A subclass that authors its own `render` **fully replaces** the base anchor rather than nesting inside it (see render composition in the Component skill): the base detects subclass-authored content and defers. `route` and `go` are `protected` so the subclass can wire its own anchor.

> **Gotcha - annotate overridden `render` in agnostic packages.** When a host-agnostic package (router, or any package built against `@expressive/mvc` with no adapter in scope) ships its own `.d.ts`, give every overridden `render` an explicit `: Component.Node` return type:
> ```tsx
> render(props = {} as { children?: Component.Node }): Component.Node { ... }
> ```
> `Component.Node` is a deferred alias over the host seam - it resolves to the host's node type (e.g. `ReactNode`) only once an adapter augments `Host`. With no annotation, the `.d.ts` emitter resolves the alias at *build* time (no adapter present) and bakes the literal fallback into the published types; it never re-resolves in a consumer, so `<NavLink>` fails JSX validity. The explicit annotation makes the emitter preserve the alias *by reference* so it re-resolves per consumer. This never surfaces inside the monorepo, where path mapping reads source and re-infers - only against the built package.

```tsx
class NavLink extends Link {
  render() {
    return (
      <a href={this.href} onClick={this.go}
         className={this.active ? 'active' : undefined}
         aria-current={this.active ? 'page' : undefined}>
        {this.props.children}
      </a>
    );
  }
}
```

### `NavLinks`

Renders a navigation tree from the route hierarchy. Subclass and override `Item`, `List`, and `Group` to control rendering - `Group` is transparent by default (flattens), override it to turn tree structure into nav sections with headings.

```tsx
class SideNav extends NavLinks {
  List = (p) => <ul className="side">{p.children}</ul>;
  Group = (p) => <section><h3>{p.route.label}</h3>{p.children}</section>;
}
```

### `Redirect`

Navigates to `to` when mounted, gated on `when` (default `true`). Pushes by default; pass `replace` to overwrite. Renders nothing. (The `Route` `redirect` prop is a always-replace shorthand for this.)

```tsx
<Redirect to="/login" when={!user} />
<Redirect to="/home" replace />
```

## Extending Route: contributing child routes

A `Route` subclass can opine on its own scope's children before matching and
registration by overriding the `protected get children()` seam. It defaults to the
children declared in JSX; override it to return the effective set - add, remove,
or reorder - composing on `super.children`. Both matching and render read the
result, so contributed routes participate in this scope's control flow
(matching, `inner` registration, default-resolution, `matches`, and render)
exactly as if declared in JSX.

```tsx
class Page extends Route {
  Default = NotFound;

  protected get children(): Component.Node {
    return <>{super.children}<Route default as={this.Default} /></>;
  }
}
```

`<Page to="docs/*">…</Page>` now resolves to `Default` whenever no child of the
scope matches - a section fallback the caller never had to write. `Default` is
the subclass's own surface; `Route` exposes only the `children` seam.

The same seam is how you build a **component that generates routes from data** -
map a source to `Route` elements in `children`, and use the subclass like any
other route:

```tsx
class Examples extends Route {
  modules = set<Modules>();

  protected get children(): Component.Node {
    return <>
      {organize(this.modules).map((group) => (
        <Route key={group.slug} to={group.slug} label={group.label}>
          {group.items.map((item) => (
            <Route key={item.slug} to={item.slug} as={item.page} />
          ))}
        </Route>
      ))}
      {super.children}
    </>;
  }
}

<BrowserRouter><Examples modules={modules} as={Shell} /></BrowserRouter>
```

The generated routes match, register, and render exactly as if written in JSX.
`super.children` splices in whatever the caller passed (e.g. a `<Route default>`),
so the component stays composable. Caller-passed children are otherwise dropped
unless you compose `super.children` - the seam fully owns the scope.

Scope and caveats:
- **Own scope only.** Contributed routes are first-class *within this Route*.
  They are invisible to walks that inspect this Route as a bare JSX element from
  the outside - sibling `as`-slot arbitration and a parent scope recursing into
  this element's lexical children - which have no instance to read `children` from.
  Same blind spot as class-field `to` (see below).
- **Classification follows effective children.** Contributing a default to a
  `to`-leaf turns it into a see-through scope (matched by prefix rather than
  exact pattern). Intended - the leaf/scope distinction reflects what the scope
  effectively contains.
- Contribute via `children`, not `render()`: it is pure analysis (returns nodes,
  never runs a page render), so matching can consult it without the circularity
  and lazy-gate problems of deciding matches from render output.

## Lexical matching - the limits

Matching is computed statically from the JSX tree in the same render. It does **not** see:
- class-field `to` on `Route` subclasses (only the JSX `to` prop), or
- routes declared inside a child component's own render (the `*`-delegation case).

A see-through scope counts as matched when a descendant matches, or when it owns a `default` - which claims anything under the scope's path, so the section 404 answers there instead of the app one. Without a default the scope is never a greedy prefix. That verdict is the same one sibling `as`-routes arbitrate over, so a scope holding a section 404 owns everything under its path - a later sibling declared under it can never match, and the router **throws** on that shape rather than leaving the route silently unreachable. Declare such a route above the section, or inside it. Put routes where they are lexically visible to the matcher.
