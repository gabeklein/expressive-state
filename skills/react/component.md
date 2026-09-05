# Expressive MVC - Component

Runnable source: the [`component`](https://expressive.dev/examples/component/props) section walks the whole surface - [`props`](https://expressive.dev/examples/component/props), [`subcomponents`](https://expressive.dev/examples/component/subcomponents), [`lifecycle`](https://expressive.dev/examples/component/lifecycle), [`injection`](https://expressive.dev/examples/component/injection), [`headless`](https://expressive.dev/examples/component/headless), [`suspense`](https://expressive.dev/examples/component/suspense), [`boundary`](https://expressive.dev/examples/component/boundary), [`custom`](https://expressive.dev/examples/component/custom) - plus [`extension`](https://expressive.dev/examples/composition/extension) for render composition. Complete programs, served as HTML.

`Component` extends `State` to create **smart, reusable React components** - persistent class instances that own their rendering, lifecycle, and behavior.

## When to use Component vs State vs function components

- **Function components** present data or define local implementation scopes. They may read contextual state with `.get()`; they do not own a persistent Expressive instance.
- **State** is display-agnostic - pure data and logic, no render method. Use with `State.use()` in function components to separate concerns.
- **Component** is for **custom components/primitives** that own their display logic. They're _meant_ to render. Use when you need a reusable, extensible unit combining behavior + UI: form controls, media players, data grids, modals. A layout shell earns Component only with owned state; a stateless shell is an FC mounting its children. The exception is the **app/route entrypoint**: it is a Component even when `render()` is pure composition, because owning the construction graph is the state - replica and region fields provide implicitly, and the instance ships the last-resort `catch` and `fallback` an FC root would hand-roll as a Provider + ErrorBoundary + Suspense stack in `main`.

The assumption behind these rules: **the class tree is the app; rendering is a projection of it.** `App.new()` stands the UX up headless - every feature's status reads off the instance (`inbox.archive.open`, a pool's members, an import's progress) with no DOM in the loop. Structure ownership so that stays true: regions as fields rather than Providers, `has()` subtrees contributing to macro-state whether or not they are placed, render-less Components. Tests, devtools, and agents consume this surface as much as views do.

Rule of thumb: use `Component` when state is intrinsic to display logic. Usually that means defining `render()`. Intrinsic to *this* display concern, not to the surface - a second intrinsic concern (a resize handle beside send) is a second class, composed as a mounted wrapper, not more fields on the first.

A Component does not have to define `render()`: without one, it passes children through while placement, `mount()`, implicit provide, `catch`, and `fallback` all still run. The default is omit `render()` unless the class paints - never write `render() { return this.props.children; }`. Headless examples, not a closed set: route controllers inserted throughout an app, progressive `Boundary` wrappers, the app root's last-resort boundary, and mount-only ancestors - a stick-to-bottom scroller, a focus trap, a resize listener that must sit above what it measures. A mount-only ancestor stays a Component when the instance owns fields or a reaction; having no JSX does not demote it to an FC-plus-`useEffect`.

This and the pass-through demotion are one rule, not two. A ref plus a DOM-sync reaction never earns the *paint's* instance - but that same behavior, separated into its own name, earns its own:

```tsx
// Wrong: paint and scroll policy fused on one class
class Transcript extends Component {
  session = get(Session);
  box = ref<HTMLDivElement>();

  mount() { /* scroll box to bottom as messages arrive */ }
  render() { /* paint messages from session */ }
}

// Right: paint is an FC; the policy is its own name
function Transcript() {
  const { messages } = Session.get();
  return <div className="transcript">{messages}</div>;
}

class Stick extends Component {
  on = true;

  mount() { /* pin scroll to bottom while on */ }
}

<Stick>
  <Transcript />
</Stick>
```

The fused class demotes because scroll-sync was incidental to its paint. `Stick` earns the instance because the behavior is now a feature: unplug is deleting one wrap, and `stick.on` reads off the tree.

Use `State` for headless models/controllers, even if they are only meaningful in context. A `Component` carries React instance properties (`props`, `state`, `context`, `setState`, `forceUpdate`), so using it where `State` would suffice makes `.get()` noisier.

Prefer an FC when state is reducible or zero and neither boundary nor suspense is wanted. A class whose only members are `inbox = get(Inbox)` and `render()` is a pass-through - an FC snapshotting `Inbox.get()` is the same subscription without an instance. Component earns the class when the instance owns fields, a pool, or its boundary; lifecycle earns it only when it manages owned state - a ref plus a reaction mirroring context to the DOM is still an FC (effect over its `.get()` snapshot). Inverse for a leaf widget still on `useState`/`useEffect` whose inputs are its identity: `<Thumbnail src={…} size={…} />` writes class fields; reactions to them live in `mount()` or `set` callbacks.

For one-shot feature builds and hook refactors, avoid creating `FooState` plus `FooView` by reflex. A local router, tab panel, menu, editor surface, media player, or custom form control is often clearer as `class Foo extends Component` because the state is intrinsic to the rendered unit. An app or route entrypoint stays a Component thru region extraction - the regions become its fields; only chrome owning nothing demotes to an FC.

## Basic Usage

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

<Counter />;
```

Properties accessed via `this` in `render()` are reactive - changes trigger re-renders automatically.

An activated instance can also be rendered directly. This is useful when another
object or collection owns the Component's lifecycle:

```tsx
const first = Item.new({ label: 'First' });
const second = Item.new({ label: 'Second' });
const items = [first, second];

<>{first}</>
<>{items}</>
```

The React adapter exposes each instance as an element using its `key`, which
defaults lazily to the State uid returned by `String(instance)`. Override the
readonly `key` property when an instance needs an application-defined identity.
Mounting subscribes and provides context as usual; unmounting only detaches the
rendered instance. Its external owner remains responsible for destruction with
`instance.set(null)`.

One instance may appear beneath separate parents. Repeating it within the same
sibling collection repeats the same key and intentionally produces the host's
duplicate-key warning.

Direct rendering eliminates wrapper components whose only job is to manage subscriptions.

When a render reads more than a value or two, destructure everything it reads from `this` at the top - the same dependency-snapshot rule as `.get()` / `State.use()` (see [react.md](react.md)). Rendering shares its subscription plumbing with the hooks, so scattered deep reads carry the same conditional-subscription risk:

```tsx
render() {
  const { count, step, increment } = this;

  return <button onClick={increment}>{count} (+{step})</button>;
}
```

An injected parent (`inbox = get(Inbox)`) is part of that snapshot - reach it and its nested values thru `this`:

```tsx
render() {
  const {
    selected,
    info: { sender, subject },
    inbox: {
      searching,
    },
  } = this;
  ...
}
```

Calling `Inbox.get()` inside `render()` when the class already holds the field opens a second hook subscription to the same instance. Static `Type.get()` belongs in freestanding FCs, which have no `this`.

## Inheritance and Custom Primitives

The primary power of Component: build reusable base classes, extend to specialize.

```tsx
abstract class Toggle extends Component {
  active = false;

  toggle() {
    this.active = !this.active;
  }

  // Subclasses override to customize each state
  Active(): ReactNode {
    return null;
  }
  Inactive(): ReactNode {
    return null;
  }

  render() {
    return (
      <div onClick={this.toggle}>
        {this.active ? <this.Active /> : <this.Inactive />}
      </div>
    );
  }
}

// Team members extend without reimplementing toggle logic
class DarkModeSwitch extends Toggle {
  Active() {
    return <span>Dark</span>;
  }
  Inactive() {
    return <span>Light</span>;
  }
}

class Accordion extends Toggle {
  title = 'Details';

  Inactive() {
    return <h3>{this.title}</h3>;
  }
  Active() {
    return (
      <>
        <h3>{this.title}</h3>
        <div>{this.props.children}</div>
      </>
    );
  }
}
```

Key pattern: base class owns behavior + structure, subclass fills in rendering. Subclasses work immediately as `<DarkModeSwitch />` or `<Accordion title="FAQ">...</Accordion>`.

## Render Composition

When a subclass overrides `render()`, it **composes** with the base instead of replacing it. Each `render()` up the prototype chain wraps the one below it, base-outermost, with the inner output passed down as `props.children`. No `super.render()` call.

```tsx
class Frame extends Component {
  render(props = {} as { children?: ReactNode }) {
    return (
      <section className="frame">
        <header>Frame</header>
        {props.children}
      </section>
    );
  }
}

class Page extends Frame {
  body = 'Hello';

  render() {
    return <p>{this.body}</p>;
  }
}

// <Page /> renders:
// <section class="frame"><header>Frame</header><p>Hello</p></section>
```

`Frame` is the outer layer (higher on the chain); `Page` content slots in where `Frame` reads `props.children`. Levels nest the same way - each subclass becomes its parent's `children`. Every layer binds to the same live instance, so all read the same reactive `this`.

This is how a base primitive owns shared chrome/suspense/context once while subclasses author only the content.

Extend only when the subclass *is a kind of* the base (`Nav` is a `Link`). An add-on - resize, collapse, drag - wraps as a mounted Component (`<Resize>{children}</Resize>`) instead: extending parks the add-on's fields on the subclass's every snapshot, and taking it off means rewriting the class rather than dropping the wrap.

Composition here is deliberate and confined: `render` is sealed at bootstrap as the **single** composition seam - every other member (methods, getters, subcomponents, lifecycle hooks) overrides with standard replace semantics. The rationale: a reactive base's render is chrome *plus subscriptions and boundaries* that must run for the subclass to work, and override-with-`super.render()` makes every subclass responsible for remembering the call - one forgotten `super` silently drops the base's boundaries. Composing inverts the default so the base owns its chrome exactly once (see [design.md](../design.md)).

**Footgun:** the inner content arrives as `props.children`. A wrapper render that never reads `props.children` silently drops everything below it - and because the `children` getter is lazy, the dropped layer never even runs. A base meant to wrap subclasses must declare a `props` parameter and render `props.children`.

### Letting a subclass replace the base (opt-out of wrapping)

Wrapping is the default, but a base can choose to *defer* to a subclass's render instead of wrapping it - useful for a leaf primitive (an `<a>`, an `<input>`) that is fully usable on its own yet should be entirely overridable. The decision belongs to the base, not the subclass: the base detects that a subclass supplied content and returns it as-is.

The signal is identity. Composition synthesizes a fresh `children` getter, so when a subclass authored its own render, the `children` the base receives is *not* the same value as the original `this.props.children`:

```tsx
class Link extends Component {
  to = '';

  render({ children, ...rest } = {} as Link.Props) {
    // A subclass authored its own render; it arrives as our `children`
    // (base render is outer). Defer to it instead of wrapping in an anchor.
    if (children !== this.props.children) return children;

    return <a {...rest} href={this.to}>{children}</a>;
  }
}

// <Link to="/x">hi</Link>      -> <a href="/x">hi</a>   (base renders)
// class Nav extends Link { render() { return <a className="nav" .../> } }
// <Nav to="/x">hi</Nav>        -> <a class="nav" .../>   (base defers)
```

Plain `<Link>` and render-less subclasses (`class Foo extends Link {}`, no composition layer) keep the base anchor, since their `children` *is* `this.props.children`. Only a subclass that authored a render replaces it.

This is the sensible inverse of forcing an override: a subclass can't unilaterally refuse to be wrapped (that would turn legitimate wrapping into a runtime error and require it to know its ancestor's behavior). Keeping the choice in the base preserves "works standalone *and* overridable."

**Caution with React hooks in a render layer.** Reactivity comes from `this`, so you rarely need hooks here - but they aren't forbidden. The sharp edge: the whole composed chain runs in a single host render, so all layers' hooks stack into one component. Fine if they obey the rules of hooks for the chain as a whole, but a hook in a layer below a wrapper that *conditionally* renders `props.children` runs only sometimes (mounts/unmounts across renders) and breaks the rules of hooks. When a layer needs its own isolated hooks/subscription/boundary, make it a PascalCase subcomponent (`<this.Panel />`) - those each get their own component; render layers are folded into one.

## Persistent Instance

Component instances survive across renders. `this` is stable - you can store references, pass `this` to external objects, hold imperative state (Sets, Maps, DOM refs) without losing it.

```tsx
class ChatRoom extends Component {
  messages: Message[] = [];
  url = '';

  new() {
    const socket = new WebSocket(this.url);
    socket.onmessage = (e) => {
      this.messages = [...this.messages, JSON.parse(e.data)];
    };
    return () => socket.close();
  }

  render() {
    return (
      <ul>
        {this.messages.map((m) => (
          <li key={m.id}>{m.text}</li>
        ))}
      </ul>
    );
  }
}
```

External code can hold a reference via `is` prop (construction-time, fires once): `<ChatRoom is={c => controller = c} />`.

Standard React `ref` also works - Component is a real class component, so `ref` receives the instance after mount and clears to `null` on unmount: `<ChatRoom ref={chatRef} />`. Use `is` when you need the instance during construction; use `ref` for post-mount imperative access following React conventions.

## Props

State fields become optional JSX props. Applied to instance every render.

```tsx
class Greeting extends Component {
  name = 'World';
  render() {
    return <h1>Hello, {this.name}!</h1>;
  }
}

<Greeting name="React" />;
```

### Render Props

Extra props (beyond state fields) via parameter on `render()`:

```tsx
class Card extends Component {
  title = '';

  render(props = {} as { className: string }) {
    return <div className={props.className}>{this.title}</div>;
  }
}

<Card title="Hello" className="card" />;
```

Non-optional render props become required JSX attributes.
All props (state + render + special) available on `this.props`.

### Special Props

- `is` - callback receiving instance on creation: `<Counter is={c => ref = c} />`
- `ref` - standard React ref (object or callback), attached after mount, cleared on unmount
- `fallback` - ReactNode for suspense/error UI, overrides instance property; `false` opts out of the component's own boundary so suspension bubbles to an ancestor

## Children and Context

Component instances auto-provide to React context. Without explicit `render()`, children simply pass through provider:

```tsx
class App extends Component {
  user = 'Alice';
}

function Profile() {
  const app = App.get();
  return <p>{app.user}</p>;
}

<App>
  <Profile />
</App>;
```

## Suspense

`fallback` displays while render or children are suspended:

```tsx
class DataView extends Component {
  data = set<string>(); // undefined until set - suspends render

  fallback = (<span>Loading...</span>);

  render() {
    return <span>{this.data}</span>;
  }
}
```

`fallback={false}` declines the component's own boundary so suspension bubbles to an ancestor - valid only when the pending value is owned **above** the boundary that catches it. A boundary rebuilds the subtree it retries, so state owned below is reconstructed on every retry and requests again: a silent infinite retry loop.

## Transitions

`pending()` marks work non-urgent, so React keeps current content on screen while a replacement gets ready instead of falling back to `fallback`. Writes inside are ordinary - the designation rides with the subscriber updates they queue, for state this component does not own included.

```tsx
import { Component, pending } from '@expressive/react';

class Shell extends Component {
  busy = false;

  go(to: string) {
    this.busy = true;
    pending(() => {
      data.page = to;
    }).then(() => {
      this.busy = false;
    });
  }
}
```

The returned promise settles once every reader has **absorbed** the work - after a suspended replacement commits, not when the write lands. Writes inside run immediately; only notification defers. A reader which cannot report - unmounted, hidden, or one with no scheduler - absorbs on replay. Every reader is waited on, not the first.

**Where the flag is read matters.** The flag is written urgently, so its readers re-render while the work is still in flight - but they read deferred state at the value already written. A component reading both jumps ahead of the held screen; one which *rebuilds* the deferred content suspends, replacing the screen the deferral existed to keep. Read the flag from a sibling of that content, or from a wrapper receiving it as `children` - both leave its element untouched, so it holds.

```tsx
const Status = () => <b>{Shell.get().busy ? 'loading' : 'idle'}</b>;

const Lock = ({ children }) => (
  <fieldset disabled={Shell.get().busy}>{children}</fieldset>
);

class Shell extends Component {
  render() {
    return <><Status /><Lock><Screen /></Lock></>;
  }
}
```

`Lock` re-renders urgently and disables the outgoing screen; `<Screen />` is the same element it already rendered, so it holds.

Reading `busy` in `Shell` itself would rebuild `<Screen />` on the same urgent pass, which is the one arrangement that does not work.

## Error Boundaries

Override `catch()` to handle child render errors:

```tsx
class SafeView extends Component {
  async catch(error: Error) {
    this.fallback = <span>Something went wrong</span>;
    // Fallback shown while pending. On resolve, render retries.
    await reportError(error);
  }

  render() {
    return <RiskyComponent />;
  }
}
```

- `this.fallback` in `catch()` shows error UI, reverted after recovery.
- Rejected `catch()` propagates to parent boundary.
- Sync `catch()` triggers immediate retry.
- Repeated throw after recovery propagates out.

## Subcomponents

PascalCase methods become reactive React components scoped to `this`:

```tsx
class Dashboard extends Component {
  items = ['a', 'b', 'c'];
  title = 'My Dashboard';

  Sidebar() {
    return (
      <ul>
        {this.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    );
  }

  Header() {
    return <h1>{this.title}</h1>;
  }

  render() {
    return (
      <div>
        <this.Header />
        <this.Sidebar />
      </div>
    );
  }
}
```

- Each usage subscribes to parent, re-renders on change.
- Accept props like any component.
- Accessible from context: `Dashboard.get()` then `<dashboard.Sidebar />`.
- **Overridable by subclasses** for plug-and-play composition.

Subcomponents are **extension points**, not a general decomposition tool. The decision test: **would a subclass reasonably replace or wrap this renderer?** If yes - a `Toggle.Active`, a grid's `Row`, chrome a theme variant swaps out - a subcomponent carries that intent. If no, the section is an implementation scope: keep it a freestanding function component that calls `Dashboard.get()`. Contextual FCs keep dependencies local without inheriting the override machinery, and decomposing a busy `render()` into them costs nothing:

```tsx
function SidebarItems() {
  const { items } = Dashboard.get();

  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
```

Inside a subcomponent body, destructure what it reads from `this` at the top, same as `render()`.

## Lifecycle

- `new()` - once after init, synchronously. Return cleanup function for teardown.
- `render(props)` - every render.
- `mount()` - once when `<MyComponent />` commits. Return cleanup for unmount.
  Not called for an instance placed as `{instance}`, which the placing component
  does not own (see [react.md](react.md)).
- `catch(error)` - error boundary.
- Destruction on unmount or `this.set(null)`.

`MyComponent.use()` is not available - a Component is rendered, not used. Render
it with `<MyComponent />` or `{instance}`; for a bare instance use `MyComponent.new()`.

```tsx
class Timer extends Component {
  elapsed = 0;

  new() {
    const id = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(id);
  }

  render() {
    return <span>{this.elapsed}s</span>;
  }
}
```

`new()` runs during server render, so anything touching `window`, timers or
subscriptions belongs in `mount()` instead - it only runs on the client.

```tsx
class Viewport extends Component {
  width = 0;

  mount() {
    const measure = () => (this.width = window.innerWidth);

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }

  render() {
    return <span>{this.width}px</span>;
  }
}
```

## ref() for DOM Access

`ref()` returns a ref callback that triggers imperative setup. Return a cleanup function.

```tsx
class VideoPlayer extends Component {
  element = ref<HTMLVideoElement>((el) => {
    el.play();
    return () => el.pause();
  });

  render() {
    return <video ref={this.element} src={this.src} />;
  }

  src = '';
}
```

## Strict Mode

Handles React strict mode correctly - one instance despite double-mount.
