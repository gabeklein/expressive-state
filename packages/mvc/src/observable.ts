import { enqueue } from './dispatch';

declare namespace Observer {
  /**
   * Update callback function.
   *
   * @param key -
   *   - `string` - property which has updated.
   *   - `false` - a normal update has completed.
   *   - `true` - initial event; instance is ready.
   *   - `null` - terminal event; instance is expired.
   */
  type Notify = (key: Signal) => (() => void) | null | void;

  type EffectCleanup = (update: boolean | null) => void;

  type Effect<T extends object> = (
    this: T,
    proxy: T,
    changed: readonly Event[]
  ) => EffectCleanup | Promise<void> | null | void;

  type Event = number | string | symbol;

  type Signal = Event | true | false | null;

  type Callback = () => void | null;
}

interface Observer {
  /** Becomes `true` once the subject has emitted its initial event. */
  ready?: true;
  listeners: Map<Observer.Notify, Set<Observer.Signal> | undefined>;
  /** Recursion guard for an in-progress emit pass. */
  pending: Set<Observer.Signal>;
  /** Accumulator drained by the next microtask. */
  events: Set<Observer.Event>;
}

interface Observing {
  callback: Observer.Callback;
  watching: Set<Observer.Signal>;
  required?: boolean;
}

const Observer: unique symbol = Symbol('Observer');
const Observing: unique symbol = Symbol('Observing');

interface Observable { [Observer]?: Observer | null }
interface Observed { [Observing]?: Observing }

/**
 * Fetch the dispatch bundle attached to an object.
 * - returns the bundle if active
 * - returns `null` if the subject has been terminated
 * - returns `undefined` if the subject was never observable
 *
 * With `create: true`, attaches a fresh bundle iff the slot is undefined.
 * A terminated (null) slot is not resurrected.
 */
function observer(state: object, create: true): Observer;
function observer(state: object, create?: boolean): Observer | undefined | null;
function observer(state: object, create?: boolean) {
  const o = (state as Observable)[Observer];

  if (!o && create) {
    if (o === null)
      throw new Error(
        `${state} was destroyed - cannot be rendered, watched or updated.`
      );

    const value: Observer = {
      listeners: new Map(),
      pending: new Set(),
      events: new Set()
    };
    Object.defineProperty(state, Observer, { value, writable: true });
    return value;
  }

  return o;
}

function observe<T extends object>(
  object: T,
  callback: Observer.Callback,
  required?: boolean
): T {
  const watching = new Set<Observer.Signal>();

  const release = listener(object, (key) => {
    if (watching.has(key)) return callback();
  });

  if (EffectContext)
    EffectContext.add((update) => {
      if (update !== true) release();
    });

  const proxy = Object.create(object) as T;

  if ('is' in object)
    Object.defineProperty(proxy, 'is', {
      value: (object as { is?: unknown }).is,
      writable: true
    });

  return Object.defineProperty(proxy, Observing, {
    value: { callback, watching, required } as Observing
  });
}

function touch(from: object, key: any): void;
function touch<T>(from: object, key: any, value?: T): T;
function touch(from: object, key: any, value?: any) {
  const active = (from as Observed)[Observing];

  if (active) {
    if (value === undefined && arguments.length === 3 && active.required)
      throw new Error(
        `${Object.getPrototypeOf(from)}.${String(key)} is required in this context.`
      );

    active.watching.add(key);

    if (value instanceof Object && observer(value))
      return observe(value, active.callback, active.required);
  }

  return value;
}

function listener<T extends object>(
  subject: T,
  callback: Observer.Notify,
  select?: Observer.Signal | Set<Observer.Signal>
) {
  const o = observer(subject, true);

  if (select !== undefined && !(select instanceof Set))
    select = new Set([select]);

  if (o.ready && !select) callback(true);

  o.listeners.set(callback, select);

  return () => o.listeners.delete(callback);
}

const EMPTY = Object.assign([], {
  then: Promise.prototype.then.bind(Promise.resolve([]))
} as PromiseLike<never[]>);

function pending<K extends Observer.Event>(
  state: object
): K[] & PromiseLike<K[]> {
  const o = observer(state);
  if (!o?.events.size) return EMPTY;

  const current = o.events as Set<K>;
  const promise = new Promise<K[]>((res) => {
    const callback: Observer.Notify = () => {
      o.listeners.delete(callback);
      return () => res([...current]);
    };
    o.listeners.set(callback, undefined);
  });

  return Object.assign([...current], {
    then: promise.then.bind(promise)
  });
}

function event(state: object, key?: Observer.Event | null, silent?: boolean) {
  const o = observer(state, key === undefined);

  if (!o) return;

  if (key === null) {
    if (!Object.getOwnPropertyDescriptor(state, Observer)) return;

    (state as Observable)[Observer] = null;
    return emit(o, key);
  }

  if (key === undefined) return emit(o, true);

  if (!o.events.size && !silent)
    enqueue(() => {
      emit(o, false);
      o.events = new Set();
    });

  o.events.add(key);

  if (!silent) emit(o, key);
}

function emit(o: Observer, key: Observer.Signal): void {
  const { listeners, pending, ready } = o;

  if (key === ready) return;

  if (pending.size) {
    pending.add(key);
    return;
  }

  if (!ready && key !== null) pending.add(true);

  pending.add(key);

  for (const k of pending)
    for (const [callback, filter] of listeners)
      if (!filter || filter.has(k)) {
        const after = callback(k);
        if (after === null) listeners.delete(callback);
        else if (after) enqueue(after);
      }

  if (key === null) listeners.clear();
  else if (key === true) o.ready = true;

  pending.clear();
}

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and whenever values are stale.
 *
 * @param target - Instance of State to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function watch<T extends object>(
  target: T,
  callback: Observer.Effect<Required<T>>,
  requireValues: true,
  transition?: (work: () => void) => void
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observer.Effect<T>,
  recursive?: boolean,
  transition?: (work: () => void) => void
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observer.Effect<T>,
  argument?: boolean,
  transition?: (work: () => void) => void
) {
  const o = observer(target, true);
  let events: readonly Observer.Event[] = [];
  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;
  let previous: T | undefined;
  let queued = false;

  function invoke() {
    if (observer(target) === null) return;

    queued = false;
    let ignore: boolean = true;

    function onUpdate() {
      events = [...o.events];

      if (reset === null) return null;
      if (ignore) {
        if (queued) enqueue(invoke, transition);
        return;
      }

      ignore = true;
      queued = true;

      unset!(true);
      unset = undefined;

      enqueue(invoke, transition);
    }

    function run(release?: (update?: boolean | null) => void) {
      const proxy = observe(target, onUpdate, argument === true);
      const output = callback.call(proxy, proxy, events);

      if (observer(target) === null) {
        if (typeof output == 'function') output(null);
        if (release) release(null);
        return;
      }

      if (previous && argument === false) {
        const { watching } = (proxy as Observed)[Observing]!;
        if (!watching.size)
          (previous as Observed)[Observing]!.watching.forEach((k) => watching.add(k));
      }
      
      previous = proxy;
      ignore = false;
      reset = output === null ? null : invoke;
      unset = (key) => {
        if (typeof output == 'function') output(key);
        if (release) release(key);
      };

      events = [];
    }

    try {
      if (argument !== false) capture(run);
      else run();
    } catch (err) {
      if (err instanceof Promise) {
        reset = undefined;
        err.then(invoke);
      } else {
        throw err;
      }
    }
  }

  const unlisten = listener(target, (key) => {
    if (key === true) invoke();
    else if (!reset) return reset;

    if (key === null && unset) unset(null);
  });

  function cleanup() {
    if (unset) unset(false);

    reset = null;
    unlisten();
  }

  if (EffectContext && argument !== false) EffectContext.add(cleanup);

  return cleanup;
}

let EffectContext: Set<(update?: boolean | null) => void> | undefined;

function capture(scope: (release: (update?: boolean | null) => void) => void) {
  const parent = EffectContext;
  const context = (EffectContext = new Set());

  try {
    scope((update) => context.forEach((fn) => fn(update)));
  } finally {
    EffectContext = parent;
  }
}

export {
  listener,
  event,
  Observer,
  touch,
  pending,
  observer,
  watch,
  capture
};
