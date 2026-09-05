import { State, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import { Runtime, useFactory, useSettle, useSetup } from './runtime';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  namespace State {
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
}

State.get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  const Type = this;
  const [tick, next] = Runtime.useState(0);
  const claim = useSettle(tick);
  const local = Context.get();
  const render = useFactory(() => {
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let value: any;
    let force!: () => void;

    function update() {
      pending = false;
      next((x) => x + 1);
    }

    function observed() {
      if (mounted) {
        claim();
        update();
      }
      else pending = true;
    }

    function refresh<T>(action?: Promise<T> | (() => Promise<T>)): any {
      if (typeof action == 'function') action = action();
      update();
      if (action instanceof Promise) return action.finally(update);
    }

    function release() {
      unsubscribe();
      unwatch?.();
      unwatch = undefined;
    }

    function attach(next: T) {
      if (local.get(Type, false) !== next) return;

      unwatch?.();

      if (observer(next) === null) {
        value = typeof argument === 'function'
          ? argument.call(next, next, refresh)
          : next;
        unwatch = () => {};
        return release;
      }

      let first = true;

      unwatch = watch(
        next,
        (current) => {
          if (typeof argument === 'function') {
            const next = argument.call(current, current, refresh);
            if (next === value) return;
            value = next;
          } else {
            value = current;
          }

          if (!first) observed();
          first = false;

          return (update) => {
            if (update === true) force();
          };
        },
        argument === true,
        Runtime.transition
      );

      if (mounted) {
        pending = true;
        queueMicrotask(() => pending && update());
      }

      return release;
    }

    const unsubscribe = local.get(Type, attach);

    if (!unwatch) {
      unsubscribe();
      if (argument === false) return () => undefined;
      throw new Error(`Could not find ${Type} in context.`);
    }

    if (value === null) {
      release();
      return () => null;
    }

    if (value instanceof Promise) {
      let error: Error | undefined;

      release();

      value
        .then(
          (x) => (value = x),
          (e) => (error = e)
        )
        .finally(update);

      value = null;

      return () => {
        if (error) throw error;
        return value === undefined ? null : value;
      };
    }

    return () => {
      pending = false;
      useSetup((_self, reset) => {
        force = reset;

        return () => {
          mounted = true;
          if (pending) update();
          return release;
        };
      });
      return value === undefined ? null : value;
    };
  });

  return render();
};
