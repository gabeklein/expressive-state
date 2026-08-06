import { listener, capture } from '../observable';
import { access, compute, event, State, update } from '../state';
import { def } from './def';

declare namespace set {
  type Callback<T, S = any> = (
    this: S,
    next: T,
    previous: T
  ) => ((next: T) => void) | Promise<any> | void | boolean;

  type Factory<T, S = any> = (this: S, property: string) => Promise<T> | T;
}

/**
 * Set a property as a placeholder, initially `undefined` but required.
 *
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (aka: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 *
 * Non-enumerable; writable only if `onUpdate` callback is provided.
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
 * Non-enumerable and read-only.
 *
 * @param factory - Zero-arg async callback to produce property value.
 * @param required - Pass `true` to run factory immediately and require value.
 */
function set<T>(factory: () => T | Promise<T>, required?: true): T;

/**
 * Set property with a lazy factory, no suspense.
 *
 * Non-enumerable and read-only.
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
 * Non-enumerable but writable via the callback.
 *
 * @param factory - Callback to produce initial value.
 * @param onUpdate - Callback run when property is updated.
 */
function set<T>(factory: () => T | Promise<T>, onUpdate: set.Callback<T>): T;

/**
 * Define a reactive computed property - the instruction equivalent of a getter.
 *
 * Unlike a zero-arg factory (which runs once and caches), the compute function
 * re-runs whenever any managed property it reads is updated. It receives the
 * instance as both `this` and its first argument, so arrow functions work.
 *
 * Enumerable and read-only, matching a prototype getter. Because it assigns
 * through an instruction rather than a concrete getter, subclasses may refine
 * the property's type with `declare`.
 *
 * @param compute - Function of arity >= 1; receives the instance to derive from.
 */
function set<T, S = any>(compute: (this: S, self: S) => T): T;

/**
 * Set a property with a non-function, non-Promise value.
 *
 * Non-enumerable but writable. Unlike plain assignment (`= value`), this
 * property is excluded from snapshots and `ref(this)`.
 *
 * @param value - Starting value for property.
 * @param onUpdate - Optional callback run when property is set.
 */
// TODO: if onUpdate is not defined, should this have behavior unique to simple assignment?
// I'm thinking default behavior should be to assign value directly to property, without triggering any additional updates.
// All this requires is a default callback which throws true, silent updates are already implemented.
function set<T>(
  value: T extends Promise<any> ? never : T,
  onUpdate?: set.Callback<T>
): T;

function set<T = any>(value?: unknown, argument?: unknown): any {
  return def<T>((key, subject) => {
    if (value instanceof Promise)
      throw new TypeError(
        `Direct promises are not supported in set(${subject}.${key}). Use set(() => promise) instead.`
      );

    if (typeof value == 'function' && value.length > 0) {
      compute.call(subject, value as () => unknown, key);
      return;
    }

    const config: State.Apply = {
      enumerable: false,
      set: false
    };

    let computed = false;

    // One-shot factory
    if (typeof value == 'function') {
      const factory = value.bind(subject, key)
      computed = true;

      function init() {
        let output: unknown;

        try {
          output = attempt(factory);
        } catch (err) {
          console.warn(
            `Generating initial value for ${subject}.${key} failed.`
          );
          throw err;
        }

        config.get = argument !== false;

        function assign(next: any, silent?: boolean) {
          if (typeof argument == 'function') subject[key] = next;
          else update(subject, key, next, silent, true);
        }

        if (output instanceof Promise)
          output.then(assign, (error) => {
            event(subject, key);
            config.get = () => {
              throw error;
            };
          });
        else assign(output, true);

        if (argument) return null;

        if (output instanceof Promise && argument !== false)
          return access(subject, key, true);

        return subject[key];
      }

      if (argument) {
        listener(subject, () => {
          init();
          return null;
        });
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
    } else if (!computed)
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
