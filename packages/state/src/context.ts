import { listener } from './observable';
import { event, State, uid } from './state';

const LOOKUP = new WeakMap<State, Context>();

/** Get the context for a specified State. Falls back to Context.root. */
function context(on: State, assign?: Context): Context;

/**
 * Assign a context to a State. Ignored if already assigned.
 *
 * @returns The context assigned to the State, either existing or new.
 */
function context(on: State, set: Context): Context;

function context({ is }: State, set?: Context) {
  const found = LOOKUP.get(is);
  if (found) return found;
  const ctx = set || Context.root;
  LOOKUP.set(is, ctx);
  return ctx;
}

const TYPES = new WeakMap<State.Extends, State.Extends[]>();

function types(state: State) {
  let T = state.constructor as State.Extends;
  let types = TYPES.get(T);
  if (!types) {
    TYPES.set(T, (types = []));
    while (T !== State) {
      types.push(T);
      T = Object.getPrototypeOf(T);
    }
  }

  return types;
}

function above(from: Context) {
  const out: Context[] = [];
  while ((from = from.parent!)) out.push(from);
  return out;
}

function below(from: Context, predicate: (ctx: Context) => boolean) {
  const queue = [...from.children];
  for (const q of queue)
    for (const c of q.children) if (predicate(c)) queue.push(c);
  return queue;
}

function touch(from: Context, T: State.Extends, provides?: boolean) {
  let ctx = from.parent;
  while (ctx) {
    const map = provides ? ctx.provide : ctx.consume;
    if (map.has(T)) break;
    map.set(T, null);
    ctx = ctx.parent;
  }
}

declare namespace Context {
  type Accept<T extends State = State> =
    | T
    | State.Type<T>
    | Record<string | number, T | State.Type<T>>;

  type Expect<T extends State = State> = (
    state: T,
    child: boolean,
    existing: boolean
  ) => (() => void) | false | void;
}

class Context {
  static root = new Context();

  public id = uid();
  public parent?: Context;
  public children = new Set<Context>();
  public consume = new Map<State.Extends, Set<Context.Expect> | null>();
  public provide = new Map<State.Extends, Set<[State, boolean]> | null>();

  protected inputs: Record<string | number, State | State.Extends> = {};

  private cleanup = new Map<string | number | Function, () => void>();

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
    callback: Context.Expect<T>,
    existing?: boolean
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg2?: boolean | Context.Expect<T>,
    existing = typeof arg2 == 'function'
  ) {
    let parent: T | null | undefined;
    let priority = false;

    if (!arg2 || existing)
      for (const ctx of [this, ...above(this)]) {
        const entries = ctx.provide.get(Type);
        if (entries) {
          for (const [state, explicit] of entries) {
            if (parent === state) continue;
            if (!parent || explicit > priority) {
              parent = state as T;
              priority = explicit;
              continue;
            }
            if (!priority && !explicit) {
              parent = null;
              break;
            }
            if (explicit)
              throw new Error(
                `Did find ${Type} in context, but multiple were defined.`
              );
          }
          break;
        }
      }

    const children: T[] = [];

    if (arg2 === true || existing)
      for (const ctx of below(this, (c) => c.provide.has(Type))) {
        const entries = ctx.provide.get(Type);
        for (const [state] of entries || []) children.push(state as T);
      }

    if (arg2 === true) return children;

    if (arg2) {
      if (parent) arg2(parent, false, true);
      for (const child of children) arg2(child, true, true);
      let set = this.consume.get(Type) as Set<any>;
      if (!set) this.consume.set(Type, (set = new Set()));
      set.add(arg2);
      touch(this, Type);
      return () => set.delete(arg2);
    }

    if (parent) return parent;
    if (parent === null) return null;
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
      if (forEach) forEach(state as T, false, false);
    }

    this.inputs = inputs;

    return this;
  }

  add(I: State, implicit?: boolean) {
    const { provide, cleanup } = this;

    const TT = types(I);
    const expects = new Map<Context.Expect, boolean | (() => void)>();
    const removes = new Set<() => void>();

    for (const T of TT) {
      const tup = [I, !implicit] as [State, boolean];
      let reg = provide.get(T);
      if (!reg) provide.set(T, (reg = new Set()));
      reg.add(tup);
      removes.add(() => reg.delete(tup));
      touch(this, T, true);
    }

    for (const [isAbove, items] of <[boolean, Iterable<Context>][]>[
      [false, [this]],
      [true, above(this)],
      [false, below(this, (c) => TT.some((T) => c.consume.has(T)))]
    ])
      for (const ctx of items)
        for (const T of TT) {
          const list = ctx.consume.get(T) || [];
          for (const cb of list) expects.set(cb, isAbove);
        }

    context(I, this);

    listener(I, () => {
      for (const [cb, isChild] of expects)
        expects.set(cb, cb(I, !!isChild, false) || false);

      return null;
    });

    function flush() {
      removes.forEach((r) => r());
      removes.clear();
      expects.forEach((r) => typeof r == 'function' && r());
      expects.clear();
    }

    function remove() {
      cleanup.delete(remove);
      flush();
    }

    cleanup.set(remove, remove);

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
