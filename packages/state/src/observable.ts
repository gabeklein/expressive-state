/**
 * Update callback function.
 *
 * @param key -
 *   - `string` - property which has updated.
 *   - `false` - a normal update has completed.
 *   - `true` - initial event; instance is ready.
 *   - `null` - terminal event; instance is expired.
 * @param source - Instance of State for which update has occured.
 */
type Notify<T extends Observable = any> = (
  this: T,
  key: Signal,
  source: T
) => (() => void) | null | void;

type EffectCleanup = (update: boolean | null) => void;

type Effect<T extends Observable> = (
  proxy: T,
  changed: readonly Event[]
) => EffectCleanup | Promise<void> | null | void;

type Event = number | string | symbol;

type Signal = Event | true | false | null;

type PromiseLite<T = void> = { then: (callback: () => T) => T };

type Observer<T = any> = (key: string | number, value: T) => T;

type Callback = () => void | PromiseLite;

declare namespace Observable {
  export { Callback, Effect, Event, Notify, Observer, Signal };
}

interface Observable {
  [Observable](callback: Observable.Callback, required?: boolean): this | void;
}

const Observable = Symbol('Observable');

/** Placeholder event determines if state is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<
  Observable,
  Map<Notify, Set<Signal> | undefined>
>();

/** Events pending for a given object. */
const PENDING = new WeakMap<Observable, Set<Signal>>();

/** Update register. */
const PENDING_KEYS = new WeakMap<Observable, Set<string | number | symbol>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

const OBSERVER = new WeakMap<object, Observer>();

function observe<T extends Observable>(
  object: T,
  callback: Observable.Callback,
  required?: boolean
): T {
  const watching = new Set<unknown>();
  const proxy = Object.create(object);

  addListener(object, (key) => {
    if (watching.has(key)) callback();
  });

  OBSERVER.set(proxy, (key, value) => {
    if (value === undefined && required)
      throw new Error(`${object}.${key} is required in this context.`);

    watching.add(key);

    if (value instanceof Object && Observable in value)
      return value[Observable](callback, required) || value;

    return value;
  });

  return proxy as T;
}

function observing(from: Observable, key: string | number, value?: any) {
  const observe = OBSERVER.get(from);
  return observe ? observe(key, value) : value;
}

function addListener<T extends Observable>(
  subject: T,
  callback: Notify<T>,
  select?: Signal | Set<Signal>
) {
  let listeners = LISTENERS.get(subject)!;

  if (!listeners)
    LISTENERS.set(subject, (listeners = new Map([[onReady, undefined]])));

  if (select !== undefined && !(select instanceof Set))
    select = new Set([select]);

  if (!listeners.has(onReady) && !select) {
    callback.call(subject, true, subject);
  }

  listeners.set(callback, select);

  return () => listeners.delete(callback);
}

function pending<K extends Event>(subject: Observable) {
  const current = PENDING_KEYS.get(subject) as Set<K> | undefined;
  const resolver: PromiseLike<K[]> = {
    then: (onFulfilled) =>
      new Promise<K[]>((res) => {
        if (current) {
          const remove = addListener(subject, (key) => {
            if (key !== true) {
              remove();
              return () => {
                const result = [...current];
                return res(result);
              };
            }
          });
        } else res([]);
      }).then(onFulfilled)
  };

  return Object.assign(Array.from(current || []), resolver);
}

function emit(state: Observable, key: Signal): void {
  const listeners = LISTENERS.get(state)!;
  const notReady = listeners.has(onReady);

  if (key === true && !notReady) return;

  let pending = PENDING.get(state);

  if (pending) {
    pending.add(key);
    return;
  }

  PENDING.set(state, (pending = new Set(notReady ? [true, key] : [key])));

  for (const key of pending)
    for (const [callback, filter] of listeners)
      if (!filter || filter.has(key)) {
        const after = callback.call(state, key, state);

        if (after) {
          enqueue(after);
        } else if (after === null) {
          listeners.delete(callback);
        }
      }

  if (key === null) listeners.clear();

  PENDING.delete(state);
}

function event(subject: Observable, key?: Event | null, silent?: boolean) {
  if (key === null) return emit(subject, key);

  if (!key) return emit(subject, true);

  let pending = PENDING_KEYS.get(subject);

  if (!pending) {
    PENDING_KEYS.set(subject, (pending = new Set()));

    if (!silent)
      enqueue(() => {
        emit(subject, false);
        PENDING_KEYS.delete(subject);
      });
  }

  pending.add(key);

  if (!silent) emit(subject, key);
}

function enqueue(eventHandler: () => void) {
  if (!DISPATCH.size)
    setTimeout(() => {
      DISPATCH.forEach((event) => {
        try {
          event();
        } catch (err) {
          console.error(err);
        }
      });
      DISPATCH.clear();
    }, 0);

  DISPATCH.add(eventHandler);
}

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and whenever values are stale.
 *
 * @param target - Instance of State to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function watch<T extends Observable>(
  target: T,
  callback: Effect<Required<T>>,
  requireValues: true
): () => void;

function watch<T extends Observable>(
  target: T,
  callback: Effect<T>,
  recursive?: boolean
): () => void;

function watch<T extends Observable>(
  target: T,
  callback: Effect<T>,
  argument?: boolean
) {
  let cause: readonly Event[];
  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke() {
    let ignore: boolean = true;

    function onUpdate(): void | PromiseLite<void> {
      cause = [...(PENDING_KEYS.get(target) || [])];

      if (reset === null || ignore) return;

      ignore = true;

      if (reset && unset) {
        unset(true);
        unset = undefined;
      }

      enqueue(invoke);
      return { then: enqueue };
    }

    try {
      const exit = argument === false ? undefined : scope();
      const output = callback(
        target[Observable](onUpdate, argument === true) as T,
        cause
      );
      const flush = exit ? exit() : () => {};

      ignore = false;
      reset = output === null ? null : invoke;
      unset = (key) => {
        if (typeof output == 'function') output(key);

        flush();
      };

      cause = [];
    } catch (err) {
      if (err instanceof Promise) {
        reset = undefined;
        err.then(invoke);
      } else {
        throw err;
      }
    }
  }

  function cleanup() {
    if (unset) unset(false);

    reset = null;
  }

  if (EffectContext && argument !== false) EffectContext.add(cleanup);

  addListener(target, (key) => {
    if (key === true) invoke();
    else if (!reset) return reset;

    if (key === null && unset) unset(null);
  });

  return cleanup;
}

let EffectContext: Set<() => void> | undefined;

export function scope() {
  const last = EffectContext;
  const context = (EffectContext = new Set());

  return () => {
    EffectContext = last;
    return () => context.forEach((fn) => fn());
  };
}

export { addListener, event, Observable, observe, observing, pending, watch };
