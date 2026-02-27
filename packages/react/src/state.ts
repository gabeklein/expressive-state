import { State, Context, watch } from '@expressive/state';

export const Pragma = {} as {
  useState<S>(initial: () => S): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  createElement(type: any, props?: any, ...children: any[]): any;
};

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

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

declare module '@expressive/state' {
  interface UseState extends State {
    /**
     * Optional hook called when State.use() is invoked within a React component.
     *
     * This is called *every render* of the component, and will intercept
     * arguments which would otherwise be passed into the State constructor.
     *
     * @param props Arguments passed to State.use().
     */
    use?(...props: any[]): Promise<void> | void;
  }

  namespace State {
    /**
     * Create and manage instance of this State within React component.
     *
     * @param args Arguments to pass to constructor or `use` method (if defined).
     * @returns Managed instance of this State.
     */
    function use<T extends UseState>(
      this: State.Type<T>,
      ...args: UseArgs<T>
    ): T;

    /** Fetch instance of this class from context. */
    function get<T extends State>(this: State.Extends<T>): T;

    /** Fetch instance of this class optionally. */
    function get<T extends State>(
      this: State.Extends<T>,
      required: false
    ): T | undefined;

    /** Fetch instance of this class from context. */
    function get<T extends State>(
      this: State.Extends<T>,
      requireValues: true
    ): Required<T>;

    function get<T extends State, R>(
      this: State.Extends<T>,
      factory: GetFactory<T, Promise<R> | R>
    ): NoVoid<R>;

    function get<T extends State>(
      this: State.Extends<T>,
      factory: GetEffect<T>
    ): null;
  }

  namespace State {
    export type { UseArgs, GetFactory, GetEffect, ForceRefresh };
  }
}

State.use = function <T extends State>(
  this: State.Type<T>,
  ...args: UseArgs<T>
) {
  const outer = Context.use();
  const state = Pragma.useState(() => {
    let ready: boolean | undefined;
    let active: T;

    const add = (arg: unknown) =>
      typeof arg == 'object' && instance.set(arg as State.Assign<T>);

    let use = (...args: State.Args<T>) => {
      return Promise.all(args.flat().map(add));
    };

    const instance = new this((x) => {
      if (x instanceof State && 'use' in x && typeof x.use == 'function') {
        use = x.use.bind(x);
        use(...args);
      } else {
        return args;
      }
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
};

State.get = function <T extends State, R>(
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
};

export { State };
