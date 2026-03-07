import { listener } from './observable';
import { event, State, uid } from './state';

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
    assign(is, Context.root);
    return Context.root;
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

function subscribe(ctx: Context, T: State.Extends, cb: Context.Expect<any>) {
  const map = ctx.listeners;
  let set = map.get(T);
  if (!set) map.set(T, (set = new Set()));
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
    child: boolean,
    existing?: true
  ) => (() => void) | false | void;
}

class Context {
  static root = new Context();

  public id = uid();
  public parent?: Context;
  public children = new Set<Context>();
  public listeners = new Map<State.Extends, Set<Context.Expect>>();

  protected inputs: Record<string | number, State | State.Extends> = {};

  private cleanup = new Map<string | number | Function, () => void>();
  private registry = new Map<State.Extends, [State, boolean][]>();

  constructor(arg?: Context | Context.Accept) {
    if (arg instanceof Context) {
      this.parent = arg;
      arg.children.add(this);
    } else if (arg) {
      this.set(arg);
    }
  }

  /** Find specified type upstream. Throws if not found. */
  public get<T extends State>(Type: State.Extends<T>): T;

  /** Find specified type upstream. Returns undefined if not found. */
  public get<T extends State>(
    Type: State.Extends<T>,
    required: false | undefined
  ): T | undefined;

  /** Get all entries of a type registered downstream. */
  public get<T extends State>(Type: State.Extends<T>, below: true): T[];

  /** Subscribe to a type becoming available in either direction. */
  public get<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg2?: boolean | Context.Expect<T>
  ) {
    if (typeof arg2 == 'function') {
      for (const ctx of above(this)) {
        const entries = ctx.registry.get(Type);
        if (entries) {
          let found: T | undefined;
          let priority = false;

          for (const [state, explicit] of entries) {
            if (found === state) continue;
            if (!found || explicit > priority) {
              found = state as T;
              priority = explicit;
              continue;
            }
            if (!priority && !explicit) {
              found = undefined;
              break;
            }
            if (explicit)
              throw new Error(
                `Did find ${Type} in context, but multiple were defined.`
              );
          }

          if (found) arg2(found, false, true);
          break;
        }
      }

      for (const ctx of below(this)) {
        const entries = ctx.registry.get(Type);
        if (entries)
          for (const [state] of entries) arg2(state as T, true, true);
      }

      return subscribe(this, Type, arg2);
    }

    if (arg2 === true) {
      const out: T[] = [];
      for (const ctx of below(this)) {
        const entries = ctx.registry.get(Type);
        if (entries) for (const [state] of entries) out.push(state as T);
      }
      return out;
    }

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

    if (found) return found;
    if (arg2 !== false) throw new Error(`Could not find ${Type} in context.`);
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
    const init = new Set<State>();

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
      const remove = this.add(state, false);

      init.add(state);
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
      event(state);
      if (forEach) forEach(state as T, false);
    }

    this.inputs = inputs;

    return this;
  }

  add(I: State, implicit?: boolean) {
    const { registry } = this;
    const cleanup = new Map<string | Function, () => void>();

    const TT = types(I);

    for (const T of TT) {
      let arr = registry.get(T);
      if (!arr) registry.set(T, (arr = []));
      arr.push([I, !implicit]);
    }

    /* v8 ignore next 9 -- @preserve */
    cleanup.set('', () => {
      for (const T of TT) {
        const arr = registry.get(T);
        if (arr) {
          const idx = arr.findIndex((e) => e[0] === I);
          if (idx >= 0) arr.splice(idx, 1);
          if (!arr.length) registry.delete(T);
        }
      }
    });

    const IT = types(I);
    const expects = [] as [Context.Expect, boolean][];
    const seen = new Set<Context.Expect>();

    for (const ctx of above(this))
      for (const T of IT) {
        const set = ctx.listeners.get(T);
        if (set)
          for (const cb of set)
            if (!seen.has(cb)) {
              seen.add(cb);
              expects.push([cb, ctx !== this]);
            }
      }

    for (const ctx of below(this))
      for (const T of IT) {
        const set = ctx.listeners.get(T);
        if (set)
          for (const cb of set)
            if (!seen.has(cb)) {
              seen.add(cb);
              expects.push([cb, false]);
            }
      }

    const unwatch = listener(I, (key) => {
      if (key === true)
        for (const [cb, child] of expects) {
          const r = cb(I, child);
          if (r) cleanup.set(r, r);
        }
    });

    const reset = () => {
      unwatch();
      cleanup.forEach((cb) => cb());
      cleanup.clear();
    };

    const release = assign(I, this);

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
