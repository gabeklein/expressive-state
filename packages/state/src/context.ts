import { listener } from './observable';
import { event, State, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();
const KEYS = new Map<State.Extends, symbol>();

function key(T: State.Extends) {
  let K = KEYS.get(T);

  if (!K) {
    K = Symbol(String(T));
    KEYS.set(T, K);
  }

  return K;
}

function keys(from: State.Extends) {
  const keys = new Set<symbol>();

  do {
    keys.add(key(from));
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

class Context {
  /**
   * Get the context for a specified State. If a callback is provided, it will be run when
   * the context becomes available.
   */
  static for<T extends State>(
    on: State,
    callback: (got: Context) => void
  ): void;

  /**
   * Get the context for a specified State. Returns undefined if none are found.
   */
  static for<T extends State>(on: State, required?: true): Context;

  static for<T extends State>(
    on: State,
    required: boolean
  ): Context | undefined;

  static for({ is }: State, arg?: ((got: Context) => void) | boolean) {
    const context = LOOKUP.get(is);

    if (context instanceof Context) {
      if (typeof arg == 'function') arg(context);
      return context;
    }

    if (typeof arg == 'function')
      if (context) context.push(arg);
      else LOOKUP.set(is, [arg]);
    else if (arg !== false)
      throw new Error(`Could not find context for ${is}.`);
  }

  public id = uid();

  protected inputs: Record<string | number, State | State.Extends> = {};
  protected cleanup: (() => void)[] = [];

  upstream: Record<symbol, Context.Expect> = {};
  downstream: Record<symbol, State | null> = {};

  constructor(arg?: Context | Context.Accept) {
    if (arg instanceof Context) {
      this.upstream = Object.create(arg.upstream);
      this.downstream = Object.create(arg.downstream);
      arg.cleanup.unshift(() => this.pop());
    } else if (arg) {
      this.set(arg);
    }
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
    const K = key(Type);

    if (typeof arg2 == 'function') {
      this.upstream[K] = arg2 as Context.Expect;
      return () => {
        delete this.upstream[K];
      };
    }

    const result = this.downstream[K];

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

    for (const [K, V] of Object.entries(inputs)) {
      if (!(State.is(V) || V instanceof State))
        throw new Error(
          `Context can only include an instance or class of State but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const exists = this.inputs[K];

      if (!exists) {
        const I = V instanceof State ? V : new (V as State.Type<T>)();
        init.set(this.add(I), true);
        if (I !== V) this.cleanup.push(() => event(I, null));
      }
      // Context must force-reset because inputs are no longer safe,
      // however probably should do that on a per-state basis.
      else if (exists !== V) {
        this.pop();
        this.set(inputs);
        this.id = uid();
      }
    }

    for (const [state, explicit] of init) {
      state.set();
      if (explicit && forEach) forEach(state as T);
    }

    this.inputs = inputs;
  }

  /**
   * Create a child context, optionally registering one or more States to it.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   */
  public push(inputs?: Context.Accept) {
    const next = new Context(this);
    if (inputs) next.set(inputs);
    return next;
  }

  /**
   * Adds a State to this context.
   */
  add<T extends State>(I: T, implicit?: boolean) {
    const { upstream, downstream, cleanup } = this;

    const done = new Set<() => void>();
    const T = I.constructor as State.Extends<T>;

    keys(T).forEach((K) => {
      const expects = upstream[K];

      if (expects)
        listener(I, (event) => {
          if (event === true) {
            const cb = expects(I);
            if (cb) done.add(cb);
          }

          return null;
        });
    });

    keys(T).forEach((K) => {
      const value = downstream.hasOwnProperty(K) ? null : I;

      if (value || (downstream[K] !== I && !implicit)) downstream[K] = value;
    });

    cleanup.push(() => done.forEach((cb) => cb()));

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Array) {
      waiting.forEach((cb) => cb(this));
    }

    LOOKUP.set(I, this);

    return I;
  }

  /**
   * Remove all States from this context.
   *
   * Will also run any cleanup callbacks registered when States were added.
   */
  public pop() {
    this.inputs = this.upstream = this.downstream = {};
    this.cleanup.forEach((cb) => cb());
    this.cleanup = [];
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context };
