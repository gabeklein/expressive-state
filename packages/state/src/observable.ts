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
  key: Event,
  source: T
) => (() => void) | null | void;

type Effect<T extends Observable> = (
  proxy: T
) => ((update: boolean | null) => void) | Promise<void> | null | void;

type Event = number | string | null | boolean | symbol;

type PromiseLite<T = void> = { then: (callback: () => T) => T };

declare namespace Observable {
  export type Callback = () => void | PromiseLite;
}

interface Observable {
  [Observable](callback: Observable.Callback, required?: boolean): this | void;
}

const Observable = Symbol('observe');

/** Placeholder event determines if state is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<
  Observable,
  Map<Notify, Set<Event> | undefined>
>();

/** Events pending for a given object. */
const PENDING = new WeakMap<Observable, Set<Event>>();

/** Update register. */
const PENDING_KEYS = new WeakMap<Observable, Set<string | number | symbol>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

function addListener<T extends Observable>(
  subject: T,
  callback: Notify<T>,
  select?: Event | Set<Event>
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

function emit(state: Observable, key: Event): void {
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

function event(
  subject: Observable,
  key?: string | number | symbol | null,
  silent?: boolean
) {
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
  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke() {
    let ignore: boolean = true;

    function onUpdate(): void | PromiseLite<void> {
      if (ignore || reset === null) return;

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
        target[Observable](onUpdate, argument === true) as T
      );
      const flush = exit ? exit() : () => {};

      ignore = false;
      reset = output === null ? null : invoke;
      unset = (key) => {
        if (typeof output == 'function') output(key);

        flush();
      };
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

export { addListener, watch, event, Notify, PENDING_KEYS, Observable };
