import { scope } from '../observable';
import { Context } from '../context';
import { State, PARENT, update } from '../state';
import { use } from './use';

type Type<T extends State> = State.Extends<T> & typeof State;

declare namespace get {
  type Callback<T = any> = (
    state: T,
    subject: State
  ) => void | boolean | (() => void);
}

/**
 * Fetches upstream State from context with optional lifecycle callback.
 * Callback runs on mount and can return cleanup function for unmount.
 *
 * @param Type - Type of State to fetch.
 * @param callback - Optional lifecycle callback, receives (state, subject). Can return cleanup function.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  callback?: get.Callback<T>
): T;

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class.
 * @param required - If false, property may be undefined. Otherwise will throw suspense.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  required: false
): T | undefined;

/**
 * Collects downstream States, this will accumulate all instances of specified type for which this is an ancestor.
 * Returns a frozen array that updates as States are added or removed.
 * Callback runs on each State registration and can return cleanup or false to prevent registration.
 *
 * @param Type - Type of State to collect.
 * @param downstream - Must be true to enable downstream mode.
 * @param callback - Optional lifecycle callback, receives (state, subject). May return false to prevent registration.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  downstream: true,
  callback?: get.Callback<T>
): readonly T[];

function get<R, T extends State>(
  Type: Type<T>,
  arg1?: Function | boolean,
  arg2?: Function
) {
  const isDownstream = arg1 === true;
  const isOptional = arg1 === false;

  return use<T[] | T>((key, subject) => {
    // Downstream collection mode
    if (isDownstream) {
      const callback =
        typeof arg2 === 'function' ? (arg2 as get.Callback<T>) : undefined;

      const applied = new Set<State>();
      const reset = () => {
        update(subject, key, Object.freeze(Array.from(applied)));
      };

      Context.get(subject, (context) => {
        context.get(Type, (state) => {
          let remove: (() => void) | undefined;
          let flush: (() => void) | undefined;

          if (applied.has(state)) return;

          if (callback) {
            const exit = scope();

            try {
              const done = callback(state, subject);

              if (done === false) return false;
              if (typeof done == 'function') remove = done;
            } finally {
              flush = exit();
            }
          }

          applied.add(state);
          reset();

          const done = () => {
            if (flush) flush();
            ignore();

            applied.delete(state);
            reset();

            if (typeof remove == 'function') remove();

            remove = undefined;
          };

          const ignore = state.set(done, null);

          return done;
        });
      });

      return {
        value: [],
        enumerable: false
      };
    }

    // Upstream mode
    const hasParent = PARENT.get(subject) as T;

    function assign(value: T) {
      // If callback provided, run it as lifecycle hook
      if (typeof arg1 === 'function') {
        const callback = arg1 as get.Callback<T>;
        const result = callback(value, subject);

        // Register cleanup if returned
        if (typeof result === 'function') {
          subject.set(result, null);
        }
      }

      update(subject, key, value);
    }

    // Check parent
    if (hasParent && hasParent instanceof Type) {
      assign(hasParent);
      return {};
    }

    // Check context
    Context.get(subject, (context) => {
      const self = context.get(Type);

      if (self && self !== subject) assign(self);
      else if (!isOptional)
        throw new Error(
          `Required ${Type} not found in context for ${subject}.`
        );
    });

    return {
      get: !isOptional,
      enumerable: false
    };
  });
}

export { get };
