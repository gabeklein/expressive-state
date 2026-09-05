import { Context } from './context';
import { set } from './field/set';
import { State, unbind } from './state';

import { transition } from './runtime';
import type { Host } from './runtime';

const PENDING = new WeakMap<object, Component>();

/** Per-class composed content render. */
const CHAIN = new WeakMap<Function, Function>();

type IfEquals<X, Y, A, B> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : B;

/** Keys of T which are settable (excludes get-only accessors and `readonly`). */
type Acceptable<T> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P, never
  >;
}[keyof T];

declare namespace Component {
  /**
   * Host element type produced by `Component.render`. Delegates to the
   * {@link Host} manifest on the jsx-runtime entry; falls back to `any`
   * until an adapter augments it with `node`. `any` (not `unknown`) so an
   * un-annotated `render` override in a host-agnostic package still emits a
   * JSX-valid return - `any` is assignable to every host's node type, where
   * `unknown` is assignable to none.
   */
  type Node = Host extends { node: infer T } ? T : any;

  interface BaseProps<T extends Component> {
    /**
     * Callback for newly created instance. Only called once.
     *
     * Runs after props apply but **before** the `new()` lifecycle hook - so it
     * may configure state that `new()` then observes. To react to a fully
     * initialized instance instead, use `watch` or an effect.
     */
    is?: (instance: T) => void;

    /**
     * Fallback to show when suspended or in error recovery.
     * Pass `false` to opt out of the component's own suspense boundary,
     * letting suspension bubble to an ancestor.
     */
    fallback?: Component.Node;
  }

  type StateProps<T extends State> = {
    [K in Exclude<keyof T, keyof Component> & Acceptable<T>]?: T[K];
  };

  type RenderProps<T> = [T] extends [(props: infer P) => any]
    ? [keyof NonNullable<P>] extends [never]
    ? { children?: Component.Node }
    : NonNullable<P>
    : { children?: Component.Node };

  type Props<T extends Component> =
    & StateProps<T>
    & BaseProps<T>
    & RenderProps<T['render']>;
}

class Component extends State {
  /**
   * Run `work` as non-urgent, so React can keep current content on screen while
   * a replacement gets ready rather than falling back. Writes inside are
   * ordinary - the designation rides with the subscriber updates they queue,
   * for state this component does not own included.
   *
   * Resolves once that work is presented, so a caller can hold a flag across
   * the wait. Read such a flag *above* the deferred content: one component
   * carries one update at one priority, so reading it beside the deferred value
   * takes the flag's urgent priority for both and the fallback wins.
   */
  act(work: () => void): Promise<void> {
    return transition(work, this.is);
  }

  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  declare readonly props: Component.Props<this>;

  /** Stable identity used when this instance is rendered in a collection. */
  declare readonly key: string;

  /**
   * Content to display while this component or its children are suspended.
   * Will cover suspense by pending properties in `this.render` as well.
   * Can be set as a class property or overridden via the `fallback` JSX prop.
   *
   * Defaults to null - nothing will be rendered.
   * Set `false` to opt out of having a boundary at all - suspension then
   * bubbles to the nearest ancestor boundary.
   */
  fallback: Component.Node = set(null);

  constructor(props?: any, ...rest: any[]) {
    if (props == null) props = {};

    const seen = {} as Record<string, undefined>;
    const copy = PENDING.get(props);

    if (typeof props == 'object') merge(props);

    function merge(props: {}) {
      for (const k in props) seen[k] = undefined;
      return { ...seen, ...props };
    }

    super(copy ? [] : [
      props,
      rest.filter((x) => !(x instanceof Context)),
      () => {
        props.is?.(this);
        Object.defineProperty(this, 'props', { enumerable: false });
        PENDING.delete(props);
      }
    ]);

    if (copy) {
      this.set(null);
      return copy;
    }

    PENDING.set(props, this);

    this.props = props;
    this.set('props', () => {
      this.set(merge(this.props));
    });

    Object.defineProperty(this, 'render', {
      writable: true,
      configurable: true,
      value: render(this)
    });
  }

  /**
   * Output for this component. Override to define custom JSX.
   *
   * Properties accessed via `this` are reactive and trigger a render when they
   * change, in addition to props. Accepts an optional parameter to receive extra
   * props from JSX, beyond those merged to state properties; declare its shape
   * via `props = {} as { ... }`. Without a parameter (the default below),
   * children pass through.
   *
   * The constructor installs a composed `render` per instance; the bootstrap
   * `type` pass seals this and any override non-configurable, keeping it the
   * content-render seam the chain reads.
   */
  render(props?: {}): Component.Node {
    const { children } = (props || this.props) as { children?: Component.Node };
    return children || null;
  }

  /**
   * Called when a child component throws during render.
   * While this is pending, `fallback` is displayed.
   * When resolved, the error boundary resets and `render` is called again.
   *
   * Override to handle errors - set `this.fallback` for error-specific UI,
   * await async recovery, or await user interaction before retrying. If you
   * assign a fallback within catch, it will be reverted after resolved.
   */
  catch?(error: Error): Promise<void> | void;
}

/**
 * Default `key` accessor. The get/set pair keeps it off observed state.
 */
Object.defineProperty(Component.prototype, 'key', {
  configurable: true,
  get() {
    return String(this);
  },
  set(value) {
    Object.defineProperty(this, 'key', { value });
  }
});

/**
 * Seal each class's own `render` non-configurable at bootstrap so member
 * classification leaves it unbound - it stays the content-render seam the chain
 * reads (and which adapters like preact detect as the class-component marker).
 */
Component.on({
  before(self) {
    const key = Object.getOwnPropertyDescriptor(self, 'key');

    if (key?.configurable)
      Object.defineProperty(self, 'key', {
        enumerable: false,
        writable: false
      });
  },
  type(type) {
    const desc = Object.getOwnPropertyDescriptor(type.prototype, 'render');

    if (desc && typeof desc.value == 'function')
      Object.defineProperty(type.prototype, 'render', {
        ...desc,
        configurable: false
      });
  }
});

/**
 * Build (or fetch the cached) composed content render for an instance's class.
 * Walks the prototype chain for content renders strictly below Component - the
 * default render on Component.prototype is excluded and serves as the fallback
 * when a class authors none.
 */
function render(target: Component) {
  const cached = CHAIN.get(target.constructor);

  if (cached) return cached;

  let render: Function | undefined;
  let proto = target;

  while ((proto = Object.getPrototypeOf(proto)) !== Component.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'render');

    if (desc) {
      const layer = unbind(desc.get || desc.value);
      render = render ? compose(layer, render) : layer;
    }
  }

  if (!render)
    render = Component.prototype.render;

  CHAIN.set(target.constructor, render);

  return render;
}

/** Wrap an outer render so it receives `inner` as a lazy `children` getter. */
function compose(outer: Function, inner: Function): Function {
  return function (this: Component, props?: {}) {
    const self = this;
    return outer.call(self, {
      ...props,
      get children() {
        return inner.call(self, props);
      }
    });
  };
}

export { Component };
