import { Context } from './context';
import {
  listener,
  watch,
  event,
  Observable,
  observing,
  observe,
  pending,
  emit
} from './observable';

const define = Object.defineProperty;

/** Register for all active states via string identifiers (usually unique). */
const ID = new WeakMap<State, string>();

/** Internal state assigned to states. */
const STATE = new WeakMap<State, Record<string | number | symbol, unknown>>();

/** External listeners for any given State. */
const NOTIFY = new WeakMap<State.Extends, Set<Observable.Notify>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<State, State | null>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child states. */
let EXPORT: Map<any, any> | undefined;

declare namespace State {
  /** Any type of State, using own class constructor as its identifier. */
  type Extends<T extends State = State> = (abstract new (...args: any[]) => T) &
    typeof State;

  /** A State constructor which may be instanciated. */
  type Type<T extends State = State> = (new (...args: State.Args<T>) => T) &
    Omit<typeof State, never>;

  /** State constructor arguments */
  type Args<T extends State = any> = (
    | Args<T>
    | Init<T>
    | Assign<T>
    | string
    | void
  )[];

  /**
   * State constructor callback - is called when State finishes intializing.
   * Returned function will run when state is destroyed.
   */
  type Init<T extends State = State> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Assign<T> | void;

  /** Object overlay to override values and methods on a state. */
  type Assign<T> = Record<string, unknown> & {
    [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
      ? (this: T, ...args: A) => R
      : T[K];
  };

  /** Subset of `keyof T` which are not methods or defined by base State U. **/
  type Field<T> = Exclude<keyof T, keyof State>;

  /** Any valid key for state, including but not limited to Field<T>. */
  type Event<T = State> = Field<T> | number | symbol | (string & {});

  /** Any event signal dispatched to listeners, including lifecycle meta events. */
  type Signal<T = State> = Event<T> | true | false | null;

  /** Export/Import compatible value for a given property in a State. */
  type Export<R> = R extends { get(): infer T } ? T : R;

  /**
   * Values from current state of given state.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.Object.
   */
  type Values<T> = { [P in Field<T>]: Export<T[P]> };

  /** Object comperable to data found in T. */
  type Partial<T> = { [P in Field<T>]?: Export<T[P]> };

  /** Value for a property managed by a state. */
  type Value<T extends State, K extends State.Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type OnEvent<T extends State> = (
    this: T,
    key: Signal<T>,
    source: T
  ) => void | (() => void) | null;

  type OnUpdate<T extends State, K extends State.Event<T>> = (
    this: T,
    key: K,
    thisArg: K
  ) => void;

  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  };

  /**
   * A callback function which is subscribed to parent and updates when accessed properties change.
   *
   * @param current - Current state of this state. This is a proxy which detects properties which
   * where accessed, and thus depended upon to stay current.
   *
   * @param update - Set of properties which have changed, and events fired, since last update.
   *
   * @returns A callback function which will be called when this effect is stale.
   */
  type Effect<T> = (
    this: T,
    current: T,
    update: readonly State.Event<T>[] | undefined
  ) => EffectCallback | Promise<void> | null | void;

  /**
   * A callback function returned by effect. Will be called when effect is stale.
   *
   * @param update - `true` if update is pending, `false` effect has been cancelled, `null` if state is destroyed.
   */
  type EffectCallback = (update: boolean | null) => void;

  type Pending<T extends State> = readonly Event<T>[] &
    PromiseLike<readonly Event<T>[]>;
}

interface State {
  /**
   * Loopback to instance of this state. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

abstract class State implements Observable {
  constructor(...args: State.Args) {
    prepare(this);
    define(this, 'is', { value: this });
    init(this, ...args, (x: this) => x.new && x.new());
  }

  [Observable](callback: Observable.Callback, required?: boolean) {
    return observe(this, callback, required);
  }

  /**
   * Optional lifecycle hook called during State initialization.
   * Can return a cleanup function to run when state is destroyed.
   */
  protected new?(): void | (() => void);

  /**
   * Pull current values from state. Flattens all states and exotic values recursively.
   *
   * @returns Object with all values from this state.
   **/
  get(): State.Values<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   *
   * @param effect Function to run, and again whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent state is destroyed.
   * @returns Function to cancel listener.
   */
  get(effect: State.Effect<this>): () => void;

  /**
   * Get value of a property.
   *
   * @param key - Property to get value of.
   * @param required - If true, will throw an error if property is not available.
   * @returns Value of property.
   */
  get<T extends State.Event<this>>(
    key: T,
    required?: boolean
  ): State.Value<this, T>;

  /**
   * Run a function when a property is updated.
   *
   * @param key - Property to watch for updates.
   * @param callback - Function to call when property is updated.
   * @returns Function to cancel listener.
   */
  get<T extends State.Event<this>>(
    key: T,
    callback: State.OnUpdate<this, T>
  ): () => void;

  /**
   * Check if state is expired.
   *
   * @param status - `null` to check if state is expired.
   * @returns `true` if state is expired, `false` otherwise.
   */
  get(status: null): boolean;

  /**
   * Callback when state is to be destroyed.
   *
   * @param callback - Function to call when state is destroyed.
   * @returns Function to cancel listener.
   */
  get(status: null, callback: () => void): () => void;

  get(
    arg1?: State.Effect<this> | string | null,
    arg2?: boolean | State.OnUpdate<this, any>
  ) {
    const self = this.is;

    if (arg1 === undefined) return values(self);
    if (typeof arg1 == 'function') return effect(self, arg1);
    if (typeof arg2 == 'function') return listener(self, arg2, arg1);
    if (arg1 === null) return Object.isFrozen(STATE.get(self));
    return access(self, arg1, arg2);
  }

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values, `undefined` if there no update is pending.
   **/
  set(): State.Pending<this>;

  /**
   * Update mulitple properties at once. Merges argument with current state.
   * Properties which are not managed by this state will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If an update does occur, listeners will not be refreshed automatically.
   * @returns Promise resolving an array of keys updated, `undefined` (immediately) if a noop.
   */
  set(assign?: State.Assign<this>, silent?: boolean): State.Pending<this>;

  /**
   * Push an update. This will not change the value of associated property.
   *
   * Useful where a property value internally has changed, but the object is the same.
   * For example: An array has pushed a new value, or a nested property is updated.
   *
   * You can also use this to dispatch arbitrary events.
   * Symbols are recommended as non-property events, however you can use any string.
   * If doing so, be sure to avoid collisions with property names! An easy way to do this is
   * to prefix an event with "!" and/or use dash-case. e.g. `set("!event")` or `set("my-event")`.
   *
   * @param key - Property or event to dispatch.
   * @returns Promise resolves an array of keys updated.
   */
  set(key: State.Event<this>): State.Pending<this>;

  /**
   * Set a value for a property. This will update the value and notify listeners.
   *
   * **Use with caution!** Key nor value are checked for validity.
   *
   * This is meant for assigning values programmatically,
   * where simple assignment is not practicable.
   *
   * For example: `(this as any)[myProperty] = value;`
   *
   * @param key - Property to set value for.
   * @param value - Value to set for property.
   * @param init - If true, state will begin to manage the property if it is not already.
   * @returns Promise resolves an array of keys updated.
   */
  set(
    key: State.Event<this>,
    value: unknown,
    init?: boolean
  ): State.Pending<this>;

  /**
   * Call a function when update occurs.
   *
   * Given function is called for every assignment (which changes value) or explicit `set`.
   *
   * To run logic on final value only, callback may return a function. Using the same
   * function for one or more events will ensure it is called only when events are settled.
   *
   * @param callback - Function to call when update occurs.
   * @returns Function to remove listener. Will return `true` if removed, `false` if inactive already.
   *
   */
  set(callback: State.OnEvent<this>): () => boolean;

  /**
   * Call a function when a property is updated.
   * Unlike `get`, this calls synchronously and will fire as many times as the property is updated.
   *
   * @param callback - Function to call when property is updated.
   * @param event - Property to watch for updates.
   */
  set(
    callback: State.OnEvent<this>,
    event: State.Event<this> | null
  ): () => boolean;

  /**
   * Declare an end to updates. This event is final and will freeze state.
   * This event can be watched for as well, to run cleanup logic and internally will remove all listeners.
   *
   * @param status - `null` to end updates.
   */
  set(status: null): void;

  set(
    arg1?: State.OnEvent<this> | State.Assign<this> | State.Event<this> | null,
    arg2?: unknown,
    arg3?: boolean
  ) {
    const self = this.is;

    if (typeof arg1 == 'function')
      return listener(self, (key) => {
        if (arg2 === key || (arg2 === undefined && typeof key == 'string'))
          return arg1.call(self, key, self);
      });

    if (arg1 && typeof arg1 == 'object') {
      assign(self, arg1, arg2 === true);
    } else if (!arg2) {
      event(self, arg1);
    } else if (arg3) {
      manage(self, arg1 as string | number, arg2);
    } else {
      update(self, arg1 as string | number, arg2);
    }

    return pending(self) as State.Pending<this>;
  }

  /**
   * Iterate over managed properties in this instance of State.
   * Yeilds the key and current value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Create and activate a new instance of this state.
   *
   * **Important** - Unlike `new this(...)` - this method also activates state.
   *
   * @param args - arguments sent to constructor
   */
  static new<T extends State>(this: State.Type<T>, ...args: State.Args<T>): T {
    const instance = new this(...args);
    event(instance);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends State.Extends>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  /**
   * Register a callback to run when any instance of this State is updated.
   */
  static on<T extends State>(
    this: State.Extends<T>,
    listener: State.OnEvent<T>
  ) {
    let notify = NOTIFY.get(this);

    if (!notify) NOTIFY.set(this, (notify = new Set()));

    notify.add(listener);

    return () => notify.delete(listener);
  }
}

define(State.prototype, 'toString', {
  value() {
    return ID.get(this.is);
  }
});

define(State, 'toString', {
  value() {
    return this.name;
  }
});

function assign(state: State, data: State.Assign<State>, silent?: boolean) {
  emit(state, true);

  const methods = METHODS.get(state.constructor)!;

  for (const key in data) {
    const bind = methods.get(key);

    if (bind) bind.call(state, data[key]);
    else if (key in state && key !== 'is') {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;
      const set = desc && (desc.set as (value: any, silent?: boolean) => void);

      if (set) {
        set.call(state, data[key], silent);
      } else {
        (state as any)[key] = data[key];
      }
    }
  }
}

/** Apply instructions and inherited event listeners. Ensure class metadata is ready. */
function prepare(state: State) {
  let T = state.constructor as State.Extends;

  if (T === State) throw new Error('Cannot create base State.');

  const chain = [] as State.Extends[];
  let keys = new Map<string, (value: any) => void>();

  ID.set(state, `${T}-${uid()}`);

  while (T.name) {
    for (const cb of NOTIFY.get(T) || []) {
      listener(state, cb);
    }

    if (T === State) break;
    else chain.unshift(T);

    T = Object.getPrototypeOf(T);
  }

  for (const type of chain) {
    if (METHODS.has(type)) {
      keys = METHODS.get(type)!;
      continue;
    }

    METHODS.set(type, (keys = new Map(keys)));

    for (const [key, { value }] of Object.entries(
      Object.getOwnPropertyDescriptors(type.prototype)
    )) {
      if (!value || key == 'constructor') continue;

      function bind(this: State, original?: Function) {
        const { is } = this;

        if (is.hasOwnProperty(key) && !original) return value as Function;

        const fn = original || value;
        const bound = fn.bind(is);

        METHOD.set(bound, fn);
        define(is, key, { value: bound, writable: true });

        return bound;
      }

      keys.set(key, bind);
      define(type.prototype, key, { get: bind, set: bind });
    }
  }
}

/**
 * Apply state arguemnts, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(state: State, ...args: State.Args) {
  const store = {} as Record<string | number | symbol, unknown>;

  STATE.set(state, store);

  args = args.flat().filter((arg) => {
    if (typeof arg == 'string') ID.set(state, arg);
    else return true;
  });

  listener(state, () => {
    if (!PARENT.has(state)) PARENT.set(state, null);

    for (const key in state) {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;

      if ('value' in desc) manage(state, key, desc.value, true);
    }

    for (const arg of args) {
      const use =
        typeof arg == 'function'
          ? arg.call(state, state)
          : (arg as State.Assign<State>);

      if (use instanceof Promise)
        use.catch((err) => {
          console.error(`Async error in constructor for ${state}:`);
          console.error(err);
        });
      else if (Array.isArray(use)) args.push(...use);
      else if (typeof use == 'function') listener(state, use, null);
      else if (typeof use == 'object') assign(state, use, true);
    }

    listener(
      state,
      () => {
        for (const [_, value] of state)
          if (value instanceof State && PARENT.get(value) === state)
            value.set(null);

        Object.freeze(store);
      },
      null
    );

    return null;
  });
}

function manage(
  state: State,
  key: string | number,
  value: any,
  silent?: boolean
) {
  const store = STATE.get(state)!;

  function get(this: State) {
    return observing(this, key, store[key]);
  }

  function set(value: unknown, silent?: boolean) {
    update(state, key, value, silent);
    if (value instanceof State && !PARENT.has(value)) {
      PARENT.set(value, state);
      Context.for(state)?.add(value, true);
      event(value);
    }
  }

  define(state, key, { set, get });
  set(value, silent);
}

function effect<T extends State>(state: T, fn: State.Effect<T>) {
  const effect: State.Effect<T> = METHOD.get(fn) || fn;

  return watch(state, (proxy, changed) => {
    const cb = effect.call(proxy, proxy, changed || []);

    if (typeof cb == 'function' || cb === null) return cb;
  });
}

function values<T extends State>(state: T): State.Values<T> {
  const values = {} as any;
  let isNotRecursive;

  if (!EXPORT) {
    isNotRecursive = true;
    EXPORT = new Map([[state, values]]);
  }

  for (let [key, value] of state) {
    if (EXPORT.has(value)) value = EXPORT.get(value);
    else if (
      value &&
      typeof value == 'object' &&
      'get' in value &&
      typeof value.get === 'function'
    )
      EXPORT.set(value, (value = value.get()));

    values[key] = value;
  }

  if (isNotRecursive) EXPORT = undefined;

  return Object.freeze(values);
}

function access(state: State, property: string, required?: boolean) {
  const store = STATE.get(state)!;

  if (property in store || required === false) {
    const value = store[property];

    if (value !== undefined || !required) return value;
  }

  if (METHODS.get(state.constructor)!.has(property))
    return METHOD.get((state as any)[property]);

  const error = new Error(`${state}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    listener(state, (key) => {
      if (key === property) {
        resolve(store[key]);
        return null;
      }

      if (key === null) {
        reject(new Error(`${state} is destroyed.`));
      }
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: 'Suspense',
    message: error.message,
    stack: error.stack
  });
}

function update<T>(
  state: State,
  key: string | number | symbol,
  value: T,
  arg?: boolean | State.Setter<T>
) {
  const store = STATE.get(state)!;

  if (Object.isFrozen(store))
    throw new Error(
      `Tried to update ${state}.${String(key)} but state is destroyed.`
    );

  const previous = store[key] as T;

  if (typeof arg == 'function') {
    const out = arg.call(state, value, previous);

    if (out === false) return false;

    if (typeof out == 'function') value = out();
  }

  if (value === previous && key in store) return;

  store[key] = value;

  if (arg !== true) event(state, key);

  return true;
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid() {
  return (0.278 + Math.random() * 0.722)
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function unbind<T extends Function>(fn: T): T;
function unbind<T extends Function>(fn?: T): T | undefined;
function unbind(fn?: Function) {
  return METHOD.get(fn) || fn;
}

export { event, unbind, State, PARENT, STATE, uid, access, update };
