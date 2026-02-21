import { listener } from './observable';
import { event, State, PARENT, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();
const OWNED = new WeakSet<State>();
const KEYS = new Map<symbol | State.Extends, symbol>();

function key(T: State.Extends | symbol, upstream?: boolean): symbol {
  let K = KEYS.get(T);

  if (!K) {
    K = Symbol(typeof T == 'symbol' ? 'get ' + T.description : String(T));
    KEYS.set(T, K);
  }

  return upstream ? key(K) : K;
}

function keys(from: State.Extends, upstream?: boolean) {
  const keys = new Set<symbol>();

  do {
    keys.add(key(from, upstream));
    from = Object.getPrototypeOf(from);
  } while (from !== State);

  return keys;
}

declare namespace Context {
  type Accept<T extends State = State> =
    | T
    | State.Type<T>
    | Record<string | number, T | State.Type<T>>;

  type Expect<T extends State = State> = (state: T) => (() => void) | void;
}

interface Context {
  [key: symbol]: State | Context.Expect | null | undefined;
}

class Context {
  /**
   * Get the context for a specified State. If a callback is provided, it will be run when
   * the context becomes available.
   */
  static get<T extends State>(
    on: State,
    callback: (got: Context) => void
  ): void;

  /**
   * Get the context for a specified State. Returns undefined if none are found.
   */
  static get<T extends State>(on: State): Context | undefined;

  static get({ is }: State, callback?: (got: Context) => void) {
    const context = LOOKUP.get(is);

    if (context instanceof Context) {
      if (callback) callback(context);
      return context;
    }

    if (callback)
      if (context) context.push(callback);
      else LOOKUP.set(is, [callback]);
  }

  public id = uid();

  protected inputs = {} as Record<string | number, State | State.Extends>;
  protected cleanup = new Map<State | Context, (() => void)[]>();

  constructor(inputs?: Context.Accept) {
    if (inputs) this.set(inputs);
  }

  /** Find specified type registered to a parent context. Throws if none are found. */
  public get<T extends State>(Type: State.Extends<T>, require: true): T;

  /** Find specified type registered to a parent context. Returns undefined if none are found. */
  public get<T extends State>(
    Type: State.Extends<T>,
    require?: boolean
  ): T | undefined;

  /** Run callback when a specified type is registered in context downstream. */
  public get<T extends State>(
    Type: State.Extends<T>,
    callback: (state: T) => void
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg2?: boolean | ((state: T) => void)
  ) {
    if (typeof arg2 == 'function') {
      const k = key(Type, true);
      Object.defineProperty(this, k, {
        value: arg2,
        configurable: true
      });
      return () => {
        delete this[k];
      };
    }

    const result = this[key(Type)];

    if (result === null)
      throw new Error(
        `Did find ${Type} in context, but multiple were defined.`
      );

    if (result) return result as T;

    if (arg2) throw new Error(`Could not find ${Type} in context.`);
  }

  /**
   * Register one or more States to this context.
   *
   * Context will add or remove States as needed to keep with provided input.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   * @param forEach Optional callback to run for each State registered.
   */
  public set<T extends State>(
    inputs: Context.Accept<T>,
    forEach?: Context.Expect<T>
  ) {
    const init = new Map<State, boolean>();

    if (typeof inputs == 'function' || inputs instanceof State)
      inputs = { [0]: inputs };

    Object.keys({ ...this.inputs, ...inputs }).forEach((K) => {
      const I = inputs[K];
      const E = this.inputs[K];

      if (E === I) return;
      else if (E) {
        this.id = uid(); //TODO: remove this when able to remount context state independent of React tree.
        this.delete(E, true);
      }

      if (I instanceof State || State.is(I)) {
        init.set(this.add(I), true);
      } else if (I)
        throw new Error(
          `Context can only include an instance or class of State but got ${
            K == '0' || K == String(I) ? I : `${I} (as '${K}')`
          }.`
        );
    });

    init.forEach((explicit, state) => {
      state.set();

      if (explicit && forEach) forEach(state as T);

      for (const [_key, value] of state)
        if (PARENT.get(value as State) === state) {
          this.add(value as State, true);
          init.set(value as State, false);
        }
    });

    this.inputs = inputs;
  }

  /**
   * Adds a State to this context.
   */
  protected add<T extends State>(input: T | State.Type<T>, implicit?: boolean) {
    const cleanup = [] as (() => void)[];
    let T: State.Extends<T>;
    let I: T;

    if (typeof input == 'function') {
      T = input;
      I = new input() as T;
      cleanup.push(() => event(I, null));
    } else {
      T = input.constructor as State.Extends<T>;
      I = input;
    }

    keys(T, true).forEach((K) => {
      const expects = this[K] as Context.Expect | undefined;

      if (expects)
        listener(I, (event) => {
          if (event === true) {
            const cb = expects(I);
            if (cb) cleanup.unshift(cb);
          }

          return null;
        });
    });

    keys(T).forEach((K) => {
      const value = this.hasOwnProperty(K) ? null : I;

      if (value || (this[K] !== I && !implicit))
        Object.defineProperty(this, K, {
          configurable: true,
          value
        });
    });

    this.cleanup.set(I, cleanup);

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Array) {
      waiting.forEach((cb) => cb(this));
    }

    LOOKUP.set(I, this);

    return I;
  }

  public delete(state: State | State.Extends, keep?: boolean) {
    let K = new Set<symbol>();

    if (state instanceof State) {
      K = keys(state.constructor as State.Extends);
    } else {
      const [k] = (K = keys(state));
      state = this[k] as State;
      if (OWNED.has(state)) state.set(null);
    }

    const callbacks = this.cleanup.get(state);

    if (callbacks) {
      new Set(callbacks).forEach((cb) => cb());
      this.cleanup.delete(state);
    }

    LOOKUP.delete(state);

    for (const k of K) if (this[k] === state) delete this[k];

    if (!keep && !Object.getOwnPropertySymbols(this).length) this.pop();
  }

  /**
   * Create a child context, optionally registering one or more States to it.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   */
  public push(inputs?: Context.Accept) {
    const next = Object.create(this) as this;

    this.cleanup.set(next, []);

    next.inputs = {};
    next.cleanup = new Map();

    if (inputs) next.set(inputs);

    return next;
  }

  /**
   * Remove all States from this context.
   *
   * Will also run any cleanup callbacks registered when States were added.
   */
  public pop() {
    for (const key of Object.getOwnPropertySymbols(this)) delete this[key];

    Array.from(this.cleanup)
      .reverse()
      .forEach(([entry, callbacks]) => {
        if (entry instanceof Context) entry.pop();
        else callbacks?.forEach((cb) => cb());
      });

    this.inputs = {};
    this.cleanup = new Map();
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context };
