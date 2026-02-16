import { addListener } from './observable';
import { event, State, PARENT, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();
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
  type Multiple<T extends State> = {
    [key: string | number]: State.Type<T> | T;
  };

  type Accept<T extends State = State> = T | State.Type<T> | Multiple<T>;

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
  protected cleanup = new Set<() => void>();

  constructor(inputs?: Context.Accept) {
    if (inputs) this.use(inputs);
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
   * Adds a State to this context.
   */
  protected add<T extends State>(input: T | State.Type<T>, implicit?: boolean) {
    const cleanup = new Set<() => void>();
    let T: State.Extends<T>;
    let I: T;

    if (typeof input == 'function') {
      T = input;
      I = new input() as T;
    } else {
      T = input.constructor as State.Extends<T>;
      I = input;
    }

    keys(T, true).forEach((K) => {
      const expects = this[K] as Context.Expect | undefined;

      if (expects)
        addListener(I, (event) => {
          if (event === true) {
            const cb = expects(I);
            if (cb) cleanup.add(cb);
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

    this.cleanup.add(() => {
      cleanup.forEach((cb) => cb());
      if (I !== input) event(I, null);
    });

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Array) waiting.forEach((cb) => cb(this));

    LOOKUP.set(I, this);

    return I;
  }

  /**
   * Register one or more States to this context.
   *
   * Context will add or remove States as needed to keep with provided input.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   * @param forEach Optional callback to run for each State registered.
   */
  public use<T extends State>(
    inputs: Context.Accept<T>,
    forEach?: Context.Expect<T>
  ) {
    const init = new Map<State, boolean>();

    if (typeof inputs == 'function' || inputs instanceof State)
      inputs = { [0]: inputs };

    for (const [K, V] of Object.entries(inputs)) {
      if (!(State.is(V) || V instanceof State))
        throw new Error(
          `Context may only include instance or class \`extends State\` but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const exists = this.inputs[K];

      if (!exists) {
        init.set(this.add(V), true);
      }
      // Context must force-reset because inputs are no longer safe,
      // however probably should do that on a per-state basis.
      else if (exists !== V) {
        this.pop();
        this.use(inputs);
        this.id = uid();
        return;
      }
    }

    for (const [state, explicit] of init) {
      state.set();

      if (explicit && forEach) forEach(state as T);

      for (const [_key, value] of state)
        if (PARENT.get(value as State) === state) {
          this.add(value as State, true);
          init.set(value as State, false);
        }
    }

    this.inputs = inputs;
  }

  /**
   * Create a child context, optionally registering one or more States to it.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   */
  public push(inputs?: Context.Accept) {
    const next = Object.create(this) as this;

    this.cleanup = new Set([() => next.pop(), ...this.cleanup]);

    next.inputs = {};
    next.cleanup = new Set();

    if (inputs) next.use(inputs);

    return next;
  }

  /**
   * Remove all States from this context.
   *
   * Will also run any cleanup callbacks registered when States were added.
   */
  public pop() {
    for (const key of Object.getOwnPropertySymbols(this)) delete this[key];

    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    this.inputs = {};
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context };
