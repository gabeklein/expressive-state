import { listener } from './observable';
import { access, event, State, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();

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

function types(state: State) {
  let T = state.constructor as State.Extends;
  const out: State.Extends[] = [];
  while (T !== State) {
    out.push(T);
    T = Object.getPrototypeOf(T);
  }
  return out;
}

function above(from: Context) {
  const out: Context[] = [];
  do out.push(from);
  while ((from = from.parent!));
  return out;
}

function below(from: Context) {
  const queue = new Set(from.children);
  for (const q of queue) for (const c of q.children) queue.add(c);
  return queue;
}

function subscribe(
  record: Map<State.Extends, Set<Function>>,
  T: State.Extends,
  cb: Context.Expect<any>
) {
  let set = record.get(T);
  if (!set) record.set(T, (set = new Set()));
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

function assign(state: State, context: Context) {
  const waiting = LOOKUP.get(state);
  if (waiting instanceof Context) return;
  if (waiting instanceof Array) waiting.forEach((cb) => cb(context));
  LOOKUP.set(state, context);
  return () => LOOKUP.delete(state);
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
  public parent?: Context;
  public children = new Set<Context>();

  protected inputs: Record<string | number, State | State.Extends> = {};

  private cleanup = new Map<string | number | Function, () => void>();
  private registry = new Map<State.Extends, [State, boolean][]>();
  private upstream = new Map<State.Extends, Set<Context.Expect>>();
  private downstream = new Map<State.Extends, Set<Context.Expect>>();

  constructor(arg?: Context | Context.Accept) {
    if (arg instanceof Context) {
      this.parent = arg;
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
    let found: T | undefined;
    let priority = false;

    for (const ctx of above(this)) {
      const entries = ctx.registry.get(Type);
      if (entries) {
        for (const [state, explicit] of entries) {
          if (found === state) continue;
          if (!found || explicit > priority) {
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
        break;
      }
    }

    if (typeof arg2 == 'function') {
      if (found) arg2(found, true);
      return subscribe(this.downstream, Type, arg2);
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
    const out: T[] = [];

    for (const ctx of below(this)) {
      const entries = ctx.registry.get(Type);
      if (entries) for (const [state] of entries) out.push(state as T);
    }

    if (cb) {
      for (const state of out) cb(state, true);
      return subscribe(this.upstream, Type, cb);
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

      const state = State.is(V) ? new (V as State.Type)() : V;
      const remove = this.add(state, false, (I) => init.push(I));

      cleanup.set(
        K,
        state === V
          ? remove
          : () => {
              remove();
              event(state, null);
            }
      );
    }

    for (const state of init) {
      state.set();
      if (forEach) forEach(state as T);
    }

    this.inputs = inputs;

    return this;
  }

  add(I: State, implicit?: boolean, init: (I: State) => void = event) {
    const { registry } = this;
    const cleanup = new Map<string | Function, () => void>();

    const observe = (I: State, explicit: boolean, key?: string) => {
      const TT = types(I);

      for (const T of TT) {
        let arr = registry.get(T);
        if (!arr) registry.set(T, (arr = []));
        arr.push([I, explicit]);
      }

      /* v8 ignore next 9 -- @preserve */
      cleanup.set(key || '', () => {
        for (const T of TT) {
          const arr = registry.get(T);
          if (arr) {
            const idx = arr.findIndex((e) => e[0] === I);
            if (idx >= 0) arr.splice(idx, 1);
            if (!arr.length) registry.delete(T);
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

    observe(I, !implicit);

    const IT = types(I);
    const expects = [] as Context.Expect[];

    for (const ctx of above(this))
      for (const T of IT) {
        const set = ctx.upstream.get(T);
        if (set) expects.push(...set);
      }

    for (const ctx of [this, ...below(this)])
      for (const T of IT) {
        const set = ctx.downstream.get(T);
        if (set) expects.push(...set);
      }

    const unwatch = listener(I, (key) => {
      if (typeof key === 'string') {
        adopt(key, access(I, key, false));
      } else if (key === true) {
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

    const release = assign(I, this);

    init(I);

    const remove = () => {
      this.cleanup.delete(remove);
      reset();
      if (release) release();
    };

    this.cleanup.set(remove, remove);

    return remove;
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
    this.inputs = {};
    this.children.forEach((x) => x.pop());
    this.children.clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    if (this.parent) this.parent.children.delete(this);
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context, context };
