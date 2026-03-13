import { scope } from '../observable';
import { Context } from '../context';
import { State, PARENT, update } from '../state';
import { apply } from './apply';

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
 * @param required - If false, property may be undefined. Otherwise will throw.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  required: false
): T | undefined;

/**
 * Collects downstream States, accumulating all instances of specified type
 * for which this is an ancestor. Returns an array that updates as States
 * are added or removed. Callback runs on each registration and can return
 * cleanup or false to prevent registration.
 *
 * @param Type - Type of State to collect.
 * @param downstream - Must be true to enable downstream mode.
 * @param callback - Optional lifecycle callback, receives (state, subject). May return false to prevent registration.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  downstream: true,
  callback?: get.Callback<T>
): T[];

/**
 * Fetches a single downstream State of specified type.
 * Updates when a matching child appears or is removed.
 * Throws if not found.
 *
 * @param Type - Type of State to fetch.
 * @param downstream - Must be true to enable downstream mode.
 * @param required - Throw if no match found.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  downstream: true,
  single: true
): T;

/**
 * Fetches a single downstream State of specified type.
 * Updates when a matching child appears or is removed.
 * Returns undefined if not found.
 *
 * @param Type - Type of State to fetch.
 * @param downstream - Must be true to enable downstream mode.
 * @param required - If false, returns undefined if no match found.
 */
function get<T extends State>(
  Type: State.Extends<T>,
  downstream: true,
  required: false
): T | undefined;

function get<T extends State>(
  Type: Type<T>,
  arg1?: get.Callback<T> | boolean,
  arg2?: get.Callback<T> | boolean
) {
  if (arg1 === true)
    return typeof arg2 === 'boolean'
      ? getOneDownstream(Type, arg2)
      : getDownstream(Type, arg2);

  return apply<T>((key, subject) => {
    const hasParent = PARENT.get(subject) as T;
    const callback =
      typeof arg1 === 'function' ? (arg1 as get.Callback<T>) : undefined;

    function assign(value: T) {
      if (callback) {
        const result = callback(value, subject);
        if (typeof result === 'function') subject.set(result, null);
      }
      update(subject, key, value);
    }

    if (hasParent && hasParent instanceof Type) {
      assign(hasParent);
      return {};
    }

    const ctx = Context.get(subject);
    let found = false;

    ctx.get(Type, (state) => {
      if (state !== subject) {
        found = true;
        assign(state);
      }
    });

    if (!found && arg1 !== false)
      throw new Error(`Required ${Type} not found in context for ${subject}.`);

    return {
      get: arg1 !== false,
      enumerable: false
    };
  });
}

function getOneDownstream<T extends State>(Type: Type<T>, required: boolean) {
  return apply<T | undefined>((key, subject) => {
    Context.get(subject).all(Type, (state) => {
      update(subject, key, state);
      const ignore = state.set(() => {
        ignore();
        update(subject, key, undefined);
      }, null);
      return ignore;
    });

    return {
      get: required,
      value: undefined,
      enumerable: false
    };
  });
}

function getDownstream<T extends State>(
  Type: Type<T>,
  callback: get.Callback<T> | undefined
) {
  return apply<T[]>((key, subject) => {
    const applied = new Set<State>();

    Context.get(subject).all(Type, (state) => {
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
      update(subject, key, [...applied]);

      function done() {
        if (flush) flush();
        ignore();

        applied.delete(state);
        update(subject, key, [...applied]);

        if (typeof remove == 'function') remove();
      }

      const ignore = state.set(done, null);

      return done;
    });

    return {
      value: [],
      enumerable: false
    };
  });
}

export { get };
