import { listener } from './observable';
import { access, event, State, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();
const KEYS = new Map<State.Extends, symbol>();

/**
 * Get the context for a specified State. If a callback is provided, it will be run when
 * the context becomes available.
 */
function context(on: State, callback: (got: Context) => void): void;

/** Get the context for a specified State. Returns undefined if none are found. */
function context(on: State, required?: true): Context;

function context(on: State, required: boolean): Context | undefined;

function context({ is }: State, arg?: ((got: Context) => void) | boolean) {
  const found = LOOKUP.get(is);

  if (found instanceof Context) {
    if (typeof arg == 'function') arg(found);
    return found;
  }

  if (typeof arg == 'function')
    if (found) found.push(arg);
    else LOOKUP.set(is, [arg]);
  else if (arg !== false) {
    throw new Error(`Could not find context for ${is}.`);
  }
}

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

function children(from: Context) {
  const queue = new Set(from.children);
  for (const q of queue) for (const c of q.children) queue.add(c);
  return queue;
}

function subscribe(
  record: Record<symbol, Set<Function>>,
  K: symbol,
  cb: Context.Expect<any>
) {
  const set = record.hasOwnProperty(K) ? record[K] : (record[K] = new Set());
  set.add(cb);
  return () => {
    set.delete(cb);
    if (!set.size) delete record[K];
  };
}

declare namespace Context {
  type Accept<T extends State = State> =
    | T
    | State.Type<T>
    | Record<string | number, T | State.Type<T>>;

  type Expect<T extends State = State> = (
    state: T,
    existing?: true
  ) => (() => void) | false | void;
}

class Context {
  public id = uid();
  public children = new Set<Context>();

  protected inputs: Record<string | number, State | State.Extends> = {};
  protected cleanup = new Map<string | number, () => void>();

  private registry: Record<symbol, [State, boolean][]> = {};
  private upstream: Record<symbol, Set<Context.Expect>> = {};
  private downstream: Record<symbol, Set<Context.Expect>> = {};

  constructor(arg?: Context | Context.Accept) {
    if (arg instanceof Context) {
      this.registry = Object.create(arg.registry);
      this.upstream = Object.create(arg.upstream);
      arg.children.add(this);
    } else if (arg) {
      this.set(arg);
    }
  }

  /** Find specified type registered to a parent context. Throws if none are found. */
  public get<T extends State>(Type: State.Extends<T>, require?: true): T;

  /** Find specified type registered to a parent context. Returns undefined if none are found. */
  public get<T extends State>(
    Type: State.Extends<T>,
    require: boolean
  ): T | undefined;

  /** Subscribe to a type becoming available upstream. */
  public get<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg2?: boolean | Context.Expect<T>
  ) {
    const K = key(Type);

    let found: T | undefined;
    let priority = false;

    for (const [state, explicit] of this.registry[K] || []) {
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

    if (typeof arg2 == 'function') {
      if (found) arg2(found, true);
      return subscribe(this.downstream, K, arg2);
    }

    if (found) return found;
    if (arg2 !== false) throw new Error(`Could not find ${Type} in context.`);
  }

  /** Get all entries of a type registered downstream. */
  public has<T extends State>(Type: State.Extends<T>): T[];

  /** Subscribe to a type being registered downstream. */
  public has<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public has<T extends State>(Type: State.Extends<T>, cb?: Context.Expect<T>) {
    const K = key(Type);

    const out: T[] = [];

    for (const { registry } of children(this))
      if (registry.hasOwnProperty(K))
        for (const [state] of registry[K]) out.push(state as T);

    if (cb) {
      for (const state of out) cb(state, true);
      return subscribe(this.upstream, K, cb);
    }

    return out;
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

    for (const K of Object.keys({ ...this.inputs, ...inputs })) {
      const V = inputs[K];
      const E = this.inputs[K];

      if (E === V) continue;

      if (E) {
        cleanup.get(K)?.();
        cleanup.delete(K);
      }

      if (!V) continue;

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
    }

    for (const state of init) {
      state.set();
      if (forEach) forEach(state as T);
    }

    this.inputs = inputs;
  }

  add<T extends State>(I: T, implicit?: boolean) {
    const context = this.registry;
    const cleanup = new Map<string | Function, () => void>();

    const observe = (I: State, explicit: boolean, key: string) => {
      for (const K of keys(I)) {
        if (!context.hasOwnProperty(K)) context[K] = [];
        context[K].push([I, explicit]);
      }

      cleanup.set(key, () => {
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
      cleanup.get(k)?.();
      cleanup.delete(k);

      if (v instanceof State)
        if (LOOKUP.get(v) instanceof Context) {
          observe(v, false, k);
        } else {
          cleanup.set(k, this.add(v, true));
          event(v);
        }
    };

    observe(I, !implicit, '');

    const IK = keys(I);
    const expects = [] as Context.Expect<T>[];

    let obj = this.upstream;
    while (obj && obj !== Object.prototype) {
      for (const K of IK) if (obj.hasOwnProperty(K)) expects.push(...obj[K]);
      obj = Object.getPrototypeOf(obj);
    }

    const unwatch = listener(I, (key) => {
      if (typeof key === 'string') adopt(key, access(I, key, false));
      else if (key === true) {
        for (const cb of new Set(expects)) {
          const r = cb(I);
          if (r) cleanup.set(r, r);
        }
        for (const [k, v] of I) {
          if (v instanceof State) adopt(k, v);
        }
      }
    });

    const reset = () => {
      unwatch();
      cleanup.forEach((cb) => cb());
      cleanup.clear();
    };

    const waiting = LOOKUP.get(I);

    if (waiting instanceof Context) return reset;

    if (waiting instanceof Array) waiting.forEach((cb) => cb(this));

    LOOKUP.set(I, this);

    for (const { downstream } of [this, ...children(this)])
      for (const K of IK)
        if (downstream.hasOwnProperty(K))
          for (const cb of downstream[K]) {
            const r = cb(I);
            if (typeof r == 'function') cleanup.set(r, r);
          }

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
    this.inputs = this.upstream = this.registry = this.downstream = {};
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

export { Context, context };
