import { listener } from "./observable";
import { event, State, uid } from "./state";

const LOOKUP = new WeakMap<State, Context>();
let ROOT: Context;

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Expect<T extends State = State> = (
  state: T,
  downstream: boolean,
) => (() => void) | void;

declare namespace Context {
  export { Accept, Expect };
}

class Context {
  static get root(): Context {
    return ROOT ??= new Context();
  }

  /** Get the context for a State. Adapters may override to provide framework context. */
  static get(state?: State): Context {
    return state && LOOKUP.get(state.is) || Context.root;
  }

  public id = uid();
  public parent?: Context;
  public scope = new Set<Context>();
  public consume = new Map<
    State.Extends,
    Set<[Expect, boolean | undefined]> | null
  >();
  public provide = new Map<State.Extends, Set<[State, boolean]> | null>();

  protected inputs: Record<string | number, State | State.Extends> = {};

  private cleanup = new Map<string | number | Function, () => void>();

  constructor(arg?: Context | Accept) {
    if (arg instanceof Context) {
      this.parent = arg;
      arg.scope.add(this);
    } else if (arg) {
      this.set(arg);
    }
  }

  private traverse(accept: (ctx: Context) => boolean | void) {
    const queue = [...this.scope];
    for (const ctx of queue)
      if (accept(ctx) !== false) for (const c of ctx.scope) queue.push(c);
  }

  private register<T extends State>(
    type: State.Extends<T>,
    value: [Expect<T>, boolean | undefined],
    asConsumer: true,
  ): () => void;

  private register<T extends State>(
    type: State.Extends<T>,
    value: [T, boolean],
    asConsumer?: false,
  ): () => void;

  private register(type: State.Extends, value: any, asConsumer?: boolean) {
    const mode = asConsumer ? "consume" : "provide";
    let set = this[mode].get(type) as Set<any>;
    if (!set) this[mode].set(type, (set = new Set()));
    set.add(value);

    for (let ctx = this.parent; ctx; ctx = ctx.parent) {
      if (ctx[mode].has(type)) break;
      ctx[mode].set(type, null);
    }

    return () => set.delete(value);
  }

  /** Find specified type upstream. Throws if not found. */
  public get<T extends State>(Type: State.Extends<T>, required?: true): T;

  /** Find specified type upstream. Returns undefined if not found. */
  public get<T extends State>(
    Type: State.Extends<T>,
    required?: boolean,
  ): T | undefined;

  /** Subscribe to a type becoming available in context. */
  public get<T extends State>(
    Type: State.Extends<T>,
    callback: Expect<T>,
    downstream?: boolean,
  ): () => void;

  /** Lookup excluding a specific instance (used by State.prototype.get for upstream-of-self semantics). */
  public get<T extends State>(
    Type: State.Extends<T>,
    arg: boolean | Expect<T> | undefined,
    downstream: boolean | undefined,
    skip: State,
  ): T | undefined | (() => void);

  public get<T extends State>(
    Type: State.Extends<T>,
    arg?: boolean | Expect<T>,
    downstream?: boolean,
    skip?: State,
  ) {
    let found: T | null | undefined;
    let priority = false;

    for (let ctx: Context | undefined = this; ctx; ctx = ctx.parent) {
      const entries = ctx.provide.get(Type);
      if (!entries) continue;

      for (const [state, explicit] of entries) {
        if (state === skip || found === state) continue;
        if (!found || (explicit && !priority)) {
          found = state as T;
          priority = explicit;
          continue;
        }
        if (!priority) {
          found = null;
          break;
        }
        if (explicit)
          throw new Error(
            `Did find ${Type} in context, but multiple were defined.`,
          );
      }
      if (found !== undefined) break;
    }

    if (typeof arg === "function") {
      if (found && !downstream) arg(found, false);

      if (downstream !== false) {
        this.traverse((ctx) => {
          const has = ctx.provide.get(Type);
          if (has) for (const x of has) if (x[0] !== skip) arg(x[0] as T, true);
          return has !== undefined;
        });
      }

      return this.register(Type, [arg as Expect, downstream], true);
    }

    if (found) return found;
    if (found === null) return null;
    if (arg !== false) throw new Error(`Could not find ${Type} in context.`);
  }

  /**
   * Register one or more States to this context.
   *
   * Context will add or remove States as needed to keep with provided input.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   * @param forEach Optional callback to run for each State registered. Receives
   *   whether this context created the State - and so will destroy it - as
   *   opposed to it having been provided already active. May return a callback
   *   to run before that entry is dropped.
   */
  public set<T extends State>(
    inputs: Accept<T>,
    forEach?: (state: T, owned: boolean) => (() => void) | void,
  ) {
    const init = new Set<() => void>();
    const { cleanup } = this;

    if (typeof inputs == "function" || inputs instanceof State)
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

      // a class is constructed here - and so destroyed here; an instance is
      // adopted as-is and outlives this context
      const owned = State.is(V);

      if (!(owned || V instanceof State)) {
        const as = K == "0" || K == String(V) ? V : `${V} (as '${K}')`;
        throw new Error(
          `Context can only include an instance or class of State but got ${as}.`,
        );
      }

      const state = owned ? new (V as State.Type)() : V.is;
      const remove = this.add(state, true);

      init.add(() => {
        event(state);
        const dispose = forEach?.(state as T, owned);
        cleanup.set(K, () => {
          if (typeof dispose == "function") dispose();
          remove();
          if (owned) event(state, null);
        });
      });
    }

    for (const i of init) i();

    this.inputs = inputs;

    return this;
  }

  add(I: State, explicit = false) {
    const { cleanup, provide } = this;
    const root = this === Context.root;
    const TT: State.Extends[] = [];

    function conflict(T: State.Extends) {
      const entries = provide.get(T);
      if (entries)
        for (const entry of entries)
          if (!entry[1] && entry[0] !== I) {
            const type = I.constructor as State.Extends;
            const g = type.global;

            if (entry[0].constructor === type && (typeof g == 'function' ? g(I) : g))
              throw new Error(
                `Cannot register ${I} as a global - ${entry[0]} already exists in root. Destroy the existing instance first, or provide additional ones via explicit context.`
              );

            return entries.delete(entry);
          }
    }

    for (
      let T = I.constructor as State.Extends;
      T !== State;
      T = Object.getPrototypeOf(T)
    )
      if (explicit || !root || !conflict(T)) TT.push(T);

    const expects = new Map<Expect, () => void>();
    const onDone = new Set<() => void>();

    for (const T of TT) onDone.add(this.register(T, [I, explicit]));

    function queue(ctx: Context, downstream: boolean, same?: boolean) {
      let found = false;
      for (const T of TT) {
        const list = ctx.consume.get(T);
        if (list !== undefined) found = true;
        if (list)
          for (const [cb, filter] of list)
            if (same || filter == null || filter === downstream)
              expects.set(cb, () => {
                const r = cb(I, filter ?? downstream);
                if (r) onDone.add(r);
              });
      }
      return found;
    }

    queue(this, true, true);
    for (let ctx = this.parent; ctx; ctx = ctx.parent) queue(ctx, true);
    this.traverse((ctx) => queue(ctx, false));

    if (!LOOKUP.has(I)) LOOKUP.set(I, this);

    listener(I, () => {
      expects.forEach((f) => f());
      expects.clear();
      return null;
    });

    function flush() {
      onDone.forEach((r) => r());
      onDone.clear();
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
  public push(inputs?: Accept) {
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
    this.scope.forEach((x) => x.pop());
    this.scope.clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    this.consume.clear();
    this.provide.clear();
    if (this.parent) {
      this.parent.scope.delete(this);
    }
  }
}

Object.defineProperty(Context.prototype, "toString", {
  value() {
    return `Context-${this.id}`;
  },
});

export { Context };
