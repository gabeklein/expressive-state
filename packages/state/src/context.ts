import { listener } from './observable';
import { access, event, State, uid } from './state';

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

function keys(state: State) {
  let T = state.constructor as State.Extends;
  const types = [] as symbol[];

  while (T !== State) {
    types.push(key(T));
    T = Object.getPrototypeOf(T);
  }

  return types;
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
  protected cleanup = new Map<string | number, () => void>();
  protected children = new Set<Context>();

  upstream: Record<symbol, Context.Expect[]> = {};
  downstream: Record<symbol, [State, boolean][]> = {};

  constructor(arg?: Context | Context.Accept) {
    if (arg instanceof Context) {
      this.upstream = Object.create(arg.upstream);
      this.downstream = Object.create(arg.downstream);
      arg.children.add(this);
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
    const context = this.upstream;

    if (typeof arg2 == 'function') {
      const cb = arg2 as Context.Expect;
      const arr = context.hasOwnProperty(K) ? context[K] : (context[K] = []);
      arr.push(cb);
      return () => {
        arr.splice(arr.indexOf(cb), 1);
        if (!arr.length) delete context[K];
      };
    }

    let found: T | undefined;
    let priority = false;

    for (const [state, explicit] of this.downstream[K] || []) {
      if (found === state) continue;
      if (!found || (!priority && explicit)) {
        found = state as T;
        priority = explicit;
        continue;
      }
      if (!priority) return null;
      if (explicit)
        throw new Error(
          `Did find ${Type} in context, but multiple were defined.`
        );
    }

    if (found) return found;
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
    const { cleanup } = this;
    const init: State[] = [];

    if (typeof inputs == 'function' || inputs instanceof State)
      inputs = { [0]: inputs };

    Object.keys({ ...this.inputs, ...inputs }).forEach((K) => {
      const V = inputs[K];
      const E = this.inputs[K];

      if (E === V) return;

      if (E) {
        this.id = uid(); //TODO: remove this when able to remount context state independent of React tree.
        cleanup.get(K)?.();
        cleanup.delete(K);
      }

      if (!V) return;

      if (!(State.is(V) || V instanceof State))
        throw new Error(
          `Context can only include an instance or class of State but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const I = V instanceof State ? V : new (V as State.Type<T>)();

      const clear = this.add(I);
      cleanup.set(K, () => {
        clear();
        if (I !== V) event(I, null);
      });
      init.push(I);
    });

    for (const state of init) {
      state.set();
      if (forEach) forEach(state as T);
    }

    this.inputs = inputs;
  }

  add<T extends State>(I: T, implicit?: boolean) {
    const expects = [] as Context.Expect<T>[];
    const adopted = new Map<string, () => void>();
    const cleanup = new Set<() => void>();

    const observe = (I: State, explicit: boolean, key = '') => {
      const context = this.downstream;

      for (const K of keys(I)) {
        if (!context.hasOwnProperty(K)) context[K] = [];
        context[K].push([I, explicit]);
      }

      adopted.set(key, () => {
        for (const K of keys(I)) {
          const arr = context[K];
          if (arr) {
            const idx = arr.findIndex((e) => e[0] === I);
            if (idx >= 0) arr.splice(idx, 1);
            if (!arr.length) delete context[K];
          }
        }
      });
    };

    const adopt = (k: string, v: unknown) => {
      adopted.get(k)?.();
      adopted.delete(k);

      if (v instanceof State)
        if (LOOKUP.get(v) instanceof Context) {
          observe(v, false, k);
        } else {
          adopted.set(k, this.add(v, true));
          event(v);
        }
    };

    const reset = () => {
      cleanup.forEach((cb) => cb());
      adopted.forEach((cb) => cb());
      adopted.clear();
    };

    observe(I, !implicit);

    keys(I).forEach((K) => {
      const E = this.upstream[K];
      if (E) expects.push(...E);
    });

    cleanup.add(
      listener(I, (ev) => {
        if (typeof ev === 'string') adopt(ev, access(I, ev, false));
        else if (ev === true) {
          for (const cb of new Set(expects)) {
            const r = cb(I);
            if (r) cleanup.add(r);
          }
          for (const [k, v] of I) {
            if (v instanceof State) adopt(k, v);
          }
        }
      })
    );

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Context) return reset;

    if (waiting instanceof Array) waiting.forEach((cb) => cb(this));

    LOOKUP.set(I, this);

    return () => {
      reset();
      LOOKUP.delete(I);
    };
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
   * Remove all States from this context.
   *
   * Will also run any cleanup callbacks registered when States were added.
   */
  public pop() {
    this.inputs = this.upstream = this.downstream = {};
    this.children.forEach((x) => x.pop());
    this.children.clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context };
