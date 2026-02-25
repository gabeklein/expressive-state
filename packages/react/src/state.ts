import { State, Context, watch, event } from '@expressive/state';
import { ReactNode } from 'react';
import { provide, Layers } from './context';

export const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => () => void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

const OUTER = new WeakMap<object, Context>();
const PROPS = new WeakMap<object, ComponentProps<any>>();

type ForceRefresh = {
  /** Request a refresh for current component. */
  (): void;

  /**
   * Request a refresh and again after promise either resolves or rejects.
   *
   * @param waitFor Promise to wait for.
   * @returns Promise which resolves, after refresh, to same value as `waitFor`.
   */
  <T = void>(waitFor: Promise<T>): Promise<T>;

  /**
   * Request refresh before and after async function.
   * A refresh will occur both before and after the given function.
   *
   * **Note:** Any actions performed before first `await` will occur prior to refresh.
   *
   * @param invoke Async function to invoke.
   * @returns Promise which resolves returned value after refresh.
   */
  <T = void>(invoke: () => Promise<T>): Promise<T>;
};

type GetFactory<T extends State, R> = (
  this: T,
  current: T,
  refresh: ForceRefresh
) => R;

type GetEffect<T extends State> = (
  this: T,
  current: T,
  refresh: ForceRefresh
) => null;

type UseArgs<T extends State> = T extends {
  use(...props: infer P): any;
}
  ? P
  : State.Args<T>;

type Props<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type Render<T extends State, P extends object> = ((
  props: P & Props<T>,
  self: T
) => ReactNode) &
  PropsValid<P, T>;

type Overlap<P extends object, V extends object> = Extract<keyof P, keyof V>;

type PropsConflicting<P extends object, V extends object> = {
  [K in Overlap<P, V>]: [P[K]] extends [V[K]] ? never : K;
}[Overlap<P, V>];

type PropsValid<P extends object, T extends State> = [
  PropsConflicting<P, Props<T>>
] extends [never]
  ? unknown
  : never;

type ComponentProps<T extends State> = Readonly<
  Props<T> & {
    /**
     * Callback for newly created instance. Only called once.
     * @returns Callback to run when instance is destroyed.
     */
    is?: (instance: T) => void;

    /**
     * A fallback react tree to show when suspended.
     * If not provided, `fallback` property of the State will be used.
     */
    fallback?: React.ReactNode;

    /**
     * Children to render within component. Will be passed as `children` prop.
     */
    children?: React.ReactNode;
  }
>;

interface Component<P = {}> extends ReactState {
  readonly props: ComponentProps<this> & P;
  context: Context;
  state: State.Values<this>;
  fallback?: ReactNode;

  render(): ReactNode;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  setState: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  forceUpdate: (callback?: () => void) => void;
}

type ComponentType<T, P = {}> = State.Type<T & Component<P>>;

declare namespace ReactState {
  export import Extends = State.Extends;
  export import Type = State.Type;
  export import Args = State.Args;
  export import Init = State.Init;
  export import Assign = State.Assign;
  export import Field = State.Field;
  export import Event = State.Event;
  export import Export = State.Export;
  export import Value = State.Value;
  export import Setter = State.Setter;
  export import OnEvent = State.OnEvent;
  export import OnUpdate = State.OnUpdate;
  export import Values = State.Values;
  export import Partial = State.Partial;
  export import Ref = State.Ref;
  export import Effect = State.Effect;
  export import EffectCallback = State.EffectCallback;

  export { GetFactory, GetEffect, UseArgs, Props, Component };
}

abstract class ReactState extends State {
  /**
   * Optional hook is called when State.use() is invoked within a React component.
   *
   * This is called *every render* of the component, and will intercept
   * arguments which would otherwise be merged into the State.
   *
   * @param props Arguments passed to State.use().
   */
  protected use?(...props: any[]): Promise<void> | void;

  /**
   * Create and manage instance of this State within React component.
   *
   * @param args Arguments to pass to constructor or `use` method (if defined).
   * @returns Managed instance of this State.
   */
  static use<T extends ReactState>(
    this: State.Type<T>,
    ...args: UseArgs<T>
  ): T {
    const outer = Context.use();
    const state = Pragma.useState(() => {
      let ready: boolean | undefined;
      let active: T;

      let use = (...args: State.Args<T>): Promise<unknown> | void =>
        Promise.all(
          args
            .flat()
            .map(
              (arg) =>
                typeof arg == 'object' && instance.set(arg as State.Assign<T>)
            )
        );

      // Create instance - pass args to constructor if no use method
      const instance = new this((x) => {
        if (x instanceof ReactState && x.use) {
          use = x.use?.bind(x);
          use(...args);
        } else return args;
      });

      const context = outer.push(instance);

      watch(instance, (current) => {
        active = current;

        if (ready) state[1]((x) => x.bind(null));
      });

      function didMount() {
        ready = true;
        return () => {
          context.pop();
          instance.set(null);
        };
      }

      return (...args: State.Args<T>) => {
        Pragma.useEffect(didMount, []);

        if (ready) {
          ready = false;

          Promise.resolve(use(...args)).finally(() => (ready = true));
        }

        return active;
      };
    });

    return state[0](...args);
  }

  /** Fetch instance of this class from context. */
  static get<T extends State>(this: State.Extends<T>): T;

  /** Fetch instance of this class optionally. */
  static get<T extends State>(
    this: State.Extends<T>,
    required: false
  ): T | undefined;

  /** Fetch instance of this class from context. */
  static get<T extends State>(
    this: State.Extends<T>,
    requireValues: true
  ): Required<T>;

  static get<T extends State, R>(
    this: State.Extends<T>,
    factory: GetFactory<T, Promise<R> | R>
  ): NoVoid<R>;

  // TODO: eagerly match this so any nulls are caught - would prevent updates.
  static get<T extends State>(
    this: State.Extends<T>,
    factory: GetEffect<T>
  ): null;

  static get<T extends State, R>(
    this: State.Extends<T>,
    argument?: boolean | GetFactory<T, unknown>
  ) {
    const outer = Context.use();
    const state = Pragma.useState(() => {
      const instance = outer.get(this);

      if (!instance)
        if (argument === false) return () => undefined;
        else throw new Error(`Could not find ${this} in context.`);

      let ready: boolean | undefined;
      let value: any;

      function render() {
        state[1]((x) => x.bind(null));
      }

      function refresh<T>(action?: Promise<T> | (() => Promise<T>)): any {
        if (typeof action == 'function') action = action();

        render();

        if (action) return action.finally(render);
      }

      const unwatch = watch(
        instance,
        (current) => {
          if (typeof argument === 'function') {
            const next = argument.call(current, current, refresh);

            if (next === value) return;

            value = next;
          } else value = current;

          if (ready) render();
        },
        argument === true
      );

      if (value instanceof Promise) {
        let error: Error | undefined;

        unwatch();

        value
          .then(
            (x) => (value = x),
            (e) => (error = e)
          )
          .finally(render);

        value = null;

        return () => {
          if (error) throw error;

          return value === undefined ? null : value;
        };
      }

      if (value === null) {
        unwatch();
        return () => null;
      }

      function onMount() {
        ready = true;
        return unwatch;
      }

      return () => {
        Pragma.useEffect(onMount, []);
        return value === undefined ? null : value;
      };
    });

    return state[0]() as R;
  }

  static as<T extends State, P extends object = {}>(
    this: State.Type<T>,
    render: Render<T, P>
  ): ComponentType<T, P>;

  static as<T extends State, P extends object = {}>(
    this: ComponentType<T, P>,
    withProps: Props<T>
  ): ComponentType<T, P>;

  static as<T extends State>(
    this: State.Type<T>,
    withProps: Props<T>
  ): ComponentType<T, {}>;

  static as<T extends State, P>(
    this: State.Type<T>,
    argument: ((props: P, self: T) => ReactNode) | Props<T>
  ) {
    const Type = this as unknown as State.Type<State>;
    const render = typeof argument === 'function' ? argument : undefined;

    class ReactType extends Type {
      static contextType = Layers;

      get props(): ComponentProps<this> {
        return PROPS.get(this)!;
      }

      private set props(props: ComponentProps<this>) {
        PROPS.set(this, props);
        this.set(props as {});
      }

      get context() {
        return Context.get(this)!;
      }

      private set context(context: Context) {
        if (OUTER.get(this) === context) return;

        OUTER.set(this, context);
        context.push(this);
      }

      get state() {
        return this.get();
      }

      private set state(_state: State.Values<this>) {}

      render!: () => ReactNode;
      fallback?: ReactNode = undefined;

      constructor(nextProps: any, ...rest: any[]) {
        const { is } = nextProps;
        const defaults = typeof argument === 'object' ? argument : {};

        if (rest[0] instanceof Context) rest.shift();

        super(nextProps, defaults, is, rest);
        PROPS.set(this, nextProps);

        if (render) {
          const Self = Render.bind(this, render as any);
          this.render = () => Pragma.createElement(Self);
        } else if (!this.render) {
          this.render = () =>
            provide(
              this.context,
              this.props.children || null,
              this.props.fallback,
              String(this)
            );
        }
      }

      /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
      setState!: (state: any, callback?: () => void) => void;

      /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
      forceUpdate!: (callback?: () => void) => void;
    }

    Object.defineProperty(ReactType, 'name', { value: 'React' + this.name });
    Object.defineProperty(ReactType.prototype, 'isReactComponent', {
      get: () => true
    });

    return ReactType;
  }
}

function Render<T extends Component, P extends State.Assign<T>>(
  this: T,
  render: (props: P, self: T) => ReactNode
) {
  const state = Pragma.useState(() => {
    event(this);

    const { context } = this;

    let ready: boolean | undefined;
    let active: T;

    watch(this, (current) => {
      active = current as T;

      if (ready) state[1]((x) => x.bind(null));
    });

    const didMount = () => {
      ready = true;
      return () => {
        context.pop();
        this.set(null);
      };
    };

    const View = () => render.call(active, this.props as any, active);

    return () => {
      ready = false;

      Pragma.useEffect(didMount, []);
      setTimeout(() => (ready = true), 0);

      return provide(
        context,
        Pragma.createElement(View),
        this.props.fallback,
        String(this)
      );
    };
  });

  return state[0]();
}

export { ReactState };
