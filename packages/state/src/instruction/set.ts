import { listener, capture, watch } from '../observable';
import { access, event, unbind, State, update } from '../state';
import { Apply, apply } from './apply';

const STALE = new WeakSet<() => void>();

declare namespace set {
  type Callback<T, S = any> = (
    this: S,
    next: T,
    previous: T
  ) => ((next: T) => void) | Promise<any> | void | boolean;

  type Reactive<T, S = any> = (self: S, property: string) => T;

  type Factory<T, S = any> = (this: S, property: string) => Promise<T> | T;
}

/**
 * Set a property as a placeholder, initially `undefined` but required.
 *
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (aka: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 *
 * @param value - Starting value (undefined for suspense placeholder).
 * @param onUpdate - Callback run when property is set.
 */
function set<T>(value?: undefined, onUpdate?: set.Callback<T>): T;

/**
 * Set property with an async factory function.
 * If required is not defined, factory runs lazily on first access.
 * If async, or returns a promise, suspense is thrown upon access until resolved.
 *
 * @param factory - Zero-arg async callback to produce property value.
 * @param required - Pass `true` to run factory immediately and require value.
 */
function set<T>(factory: () => T | Promise<T>, required?: true): T;

/**
 * Set property with a lazy factory, no suspense.
 *
 * @param factory - Zero-arg callback to produce property value.
 * @param required - Pass `false` to allow undefined while pending.
 */
function set<T>(
  factory: () => T | Promise<T>,
  required: boolean
): T | undefined;

/**
 * Set property with a factory and update callback.
 *
 * @param factory - Callback to produce initial value.
 * @param onUpdate - Callback run when property is updated.
 */
function set<T>(factory: () => T | Promise<T>, onUpdate: set.Callback<T>): T;

/**
 * Set a reactive computed property.
 *
 * Factory receives a watched proxy `self` and re-runs when accessed properties change.
 *
 * @param factory - Callback receiving self proxy, returns computed value.
 */
// TODO: add optional onUpdate callback for reactive computed (observation-only)
function set<T, S extends State>(
  factory: (self: S, key: string) => T | Promise<T>
): T;

/**
 * Set a property with a non-function value.
 *
 * @param value - Starting value for property.
 * @param onUpdate - Optional callback run when property is set.
 */
function set<T>(value: T | Promise<T>, onUpdate?: set.Callback<T>): T;

function set<T = any>(value?: unknown, argument?: unknown): any {
  return apply<T>((key, subject, state) => {
    // Reactive compute: function with declared args
    if (typeof value === 'function' && value.length >= 1) {
      const getter = unbind(value) as set.Reactive<T, any>;

      let reset: (() => void) | undefined;
      let isAsync: boolean;
      let proxy: any;

      function connect(source: State) {
        reset = watch(
          source,
          (current) => {
            proxy = current;

            if (!(key in state) || STALE.delete(compute)) compute(!reset);

            return (didUpdate) => {
              if (didUpdate) {
                STALE.add(compute);
                event(subject, key, true);
              }
            };
          },
          false
        );
      }

      function compute(initial?: boolean) {
        let next: T | undefined;

        try {
          next = getter.call(subject, proxy, key);
        } catch (err) {
          console.warn(
            `An exception was thrown while ${
              initial ? 'initializing' : 'refreshing'
            } ${subject}.${key}.`
          );

          if (initial) throw err;

          console.error(err);
        }

        update(subject, key, next, !isAsync);
      }

      return {
        get() {
          if (!proxy) {
            connect(subject);
            isAsync = true;
          }

          if (STALE.delete(compute)) compute();

          return access(subject, key, !proxy) as T;
        }
      };
    }

    const config: Apply.Config = {};

    // One-shot factory or Promise
    if (typeof value == 'function' || value instanceof Promise) {
      function init() {
        if (typeof value == 'function')
          try {
            value = attempt(value.bind(subject, key));
          } catch (err) {
            console.warn(
              `Generating initial value for ${subject}.${key} failed.`
            );
            throw err;
          }

        config.get = argument !== false;

        if (value instanceof Promise)
          value.then(
            (value: any) => (subject[key] = value),
            (error) => {
              event(subject, key);
              config.get = () => {
                throw error;
              };
            }
          );
        else subject[key] = value;

        if (argument) return null;

        if (value instanceof Promise && argument !== false)
          return access(subject, key, true);

        return subject[key];
      }

      if (argument) {
        listener(subject, init, true);
      } else {
        config.get = init;
      }
    } else if (value !== undefined) {
      config.value = value;
    }

    if (typeof argument == 'function') {
      let unset: ((next: T) => void) | undefined;

      config.set = function (this: any, value: any, previous: any) {
        capture((release) => {
          const returns = argument.call(this, value, previous);

          if (unset) unset(value);

          unset = (next: T) => {
            if (typeof returns == 'function') returns(next);
            release();
          };
        });
      };
    } else
      config.set = () => {
        config.get = undefined;
        config.set = undefined;
      };

    return config;
  });
}

function attempt(fn: () => any): any {
  function retry(err: unknown) {
    if (err instanceof Promise) return err.then(compute);
    else throw err;
  }

  function compute(): any {
    try {
      const output = fn();

      return output instanceof Promise ? output.catch(retry) : output;
    } catch (err) {
      return retry(err);
    }
  }

  return compute();
}

export { set };
