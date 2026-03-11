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
  this: T,
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

/** Lifecycle status for any observable: false = pending, true = ready, null = terminated. */
const READY = new WeakMap<Observable, true | null>();

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

/**
 * Check if an object is observable and return its status.
 * - `true` if ready
 * - `false` if pending
 * - `null` if expired
 * - `undefined` if not observable.
 */
function observable(state: object): boolean | null | undefined {
  if (Observable in state) {
    const status = READY.get(state as Observable);
    return status === undefined ? false : status;
  }
}

function observe<T extends Observable>(
  object: T,
  callback: Observable.Callback,
  required?: boolean
): T {
  const watching = new Set<unknown>();
  const proxy = Object.create(object);

  listener(object, (key) => {
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

function listener<T extends Observable>(
  subject: T,
  callback: Notify<T>,
  select?: Signal | Set<Signal>
) {
  let listeners = LISTENERS.get(subject)!;

  if (!listeners) LISTENERS.set(subject, (listeners = new Map()));

  if (select !== undefined && !(select instanceof Set))
    select = new Set([select]);

  if (READY.has(subject) && !select) {
    callback.call(subject, true, subject);
  }

  listeners.set(callback, select);

  return () => listeners.delete(callback);
}

const EMPTY = Object.assign<never[], PromiseLike<never[]>>([], {
  then: Promise.prototype.then.bind(Promise.resolve([]))
});

function pending<K extends Event>(state: Observable): K[] & PromiseLike<K[]> {
  const current = PENDING_KEYS.get(state) as Set<K> | undefined;

  if (!current) return EMPTY;

  const listeners = LISTENERS.get(state)!;
  const promise = new Promise<K[]>((res) => {
    const callback: Notify = (key) => {
      listeners.delete(callback);
      return () => res([...current]);
    };

    listeners.set(callback, undefined);
  });

  return Object.assign([...current], {
    then: promise.then.bind(promise)
  });
}

function emit(state: Observable, key: Signal): void {
  const isReady = READY.has(state);

  if (key === true && isReady) return;

  let pending = PENDING.get(state);

  if (pending) {
    pending.add(key);
    return;
  }

  PENDING.set(state, (pending = new Set(isReady ? [key] : [true, key])));

  if (key === true || key === null) READY.set(state, key);

  const listeners = LISTENERS.get(state)!;

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

function event(state: Observable, key?: Event | null, silent?: boolean) {
  if (key === null) return emit(state, key);

  if (!key) return emit(state, true);

  let pending = PENDING_KEYS.get(state);

  if (!pending) {
    PENDING_KEYS.set(state, (pending = new Set()));

    if (!silent)
      enqueue(() => {
        emit(state, false);
        PENDING_KEYS.delete(state);
      });
  }

  pending.add(key);

  if (!silent) emit(state, key);
}

function enqueue(eventHandler: () => void) {
  if (!DISPATCH.size)
    queueMicrotask(() => {
      DISPATCH.forEach((event) => {
        try {
          event();
        } catch (err) {
          console.error(err);
        }
      });
      DISPATCH.clear();
    });

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
  let cause: readonly Event[] = [];
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
    }

    try {
      const exit = argument === false ? undefined : scope();
      const proxy = target[Observable](onUpdate, argument === true) as T;
      const output = callback.call(proxy, proxy, cause);
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

  listener(target, (key) => {
    if (key === true) invoke();
    else if (!reset) return reset;

    if (key === null && unset) unset(null);
  });

  return cleanup;
}

let EffectContext: Set<() => void> | undefined;

function scope() {
  const last = EffectContext;
  const context = (EffectContext = new Set());

  return () => {
    EffectContext = last;
    return () => context.forEach((fn) => fn());
  };
}

export {
  listener,
  emit,
  event,
  Observable,
  observe,
  observing,
  pending,
  observable,
  watch,
  scope
};
