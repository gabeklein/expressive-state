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

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Expect<T extends State = State> = (
  state: T,
  existing: boolean
) => (() => void) | false | void;

declare namespace Context {
  export { Accept, Expect };
}

class Context {
  static root = new Context();

  public id = uid();
  public parent?: Context;
  public scope = new Set<Context>();
  public consume = new Map<State.Extends, Set<[Expect, boolean]> | null>();
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

  private register(type: State.Extends, value: any, asConsumer?: boolean) {
    const map = asConsumer ? this.consume : this.provide;
    let set = map.get(type) as Set<any>;
    if (!set) map.set(type, (set = new Set()));
    set.add(value);

    let ctx = this.parent;
    while (ctx) {
      const pmap = asConsumer ? ctx.consume : ctx.provide;
      if (pmap.has(type)) break;
      pmap.set(type, null);
      ctx = ctx.parent;
    }

    return () => set.delete(value);
  }

  private traverse(accept: (ctx: Context) => boolean | void) {
    const queue = [...this.scope];
    for (const ctx of queue)
      if (accept(ctx) !== false) for (const c of ctx.scope) queue.push(c);
  }

  /** Find specified type upstream. Throws if not found. */
  public get<T extends State>(Type: State.Extends<T>, required?: true): T;

  /** Find specified type upstream. Returns undefined if not found. */
  public get<T extends State>(
    Type: State.Extends<T>,
    required?: boolean
  ): T | undefined;

  /** Subscribe to a type becoming available upstream. */
  public get<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg?: boolean | Context.Expect<T>
  ) {
    let found: T | null | undefined;
    let priority = false;

    for (let ctx: Context | undefined = this; ctx; ctx = ctx.parent) {
      const entries = ctx.provide.get(Type);
      if (!entries) continue;

      for (const [state, explicit] of entries) {
        if (found === state) continue;
        if (!found || explicit > priority) {
          found = state as T;
          priority = explicit;
          continue;
        }
        if (!priority && !explicit) {
          found = null;
          break;
        }
        if (explicit)
          throw new Error(
            `Did find ${Type} in context, but multiple were defined.`
          );
      }
      break;
    }

    if (typeof arg === 'function') {
      if (found) arg(found, true);
      return this.register(Type, [arg as Context.Expect, false], true);
    }

    if (found) return found;
    if (found === null) return null;
    if (arg !== false) throw new Error(`Could not find ${Type} in context.`);
  }

  /** Find single downstream State. Throws if not found. */
  public one<T extends State>(Type: State.Extends<T>, required?: true): T;

  /** Find single downstream State. Returns undefined if not found. */
  public one<T extends State>(
    Type: State.Extends<T>,
    required: boolean
  ): T | undefined;

  /** Subscribe to a single downstream State. */
  public one<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public one<T extends State>(
    Type: State.Extends<T>,
    arg?: boolean | Context.Expect<T>
  ) {
    if (typeof arg === 'function') {
      const [first] = this.all(Type);
      if (first) arg(first, true);
      return this.register(Type, [arg, true], true);
    }

    const [first] = this.all(Type);
    if (first) return first;
    if (arg !== false) throw new Error(`Could not find ${Type} in context.`);
  }

  /** Get all downstream States of a type. */
  public all<T extends State>(Type: State.Extends<T>): T[];

  /** Subscribe to downstream States of a type. */
  public all<T extends State>(
    Type: State.Extends<T>,
    callback: Context.Expect<T>
  ): () => void;

  public all<T extends State>(
    Type: State.Extends<T>,
    callback?: Context.Expect<T>
  ): T[] | (() => void) {
    const results: T[] = [];
    this.traverse((ctx) => {
      const entries = ctx.provide.get(Type) || [];
      for (const [state] of entries) results.push(state as T);
      return ctx.provide.has(Type);
    });

    if (!callback) return results;
    for (const state of results) callback(state, true);
    return this.register(Type, [callback, true], true);
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
    const { cleanup } = this;

    const TT = types(I);
    const expects = new Map<Context.Expect, () => void>();
    const onDone = new Set<() => void>();

    function queue(ctx: Context, downstream: boolean) {
      let found = false;
      for (const T of TT) {
        const list = ctx.consume.get(T);
        if (list !== undefined) found = true;
        for (const [cb, filter] of list || [])
          if (filter === downstream)
            expects.set(cb, () => {
              const r = cb(I, false);
              if (r) onDone.add(r);
            });
      }
      return found;
    }

    for (const T of TT) onDone.add(this.register(T, [I, !implicit]));

    queue(this, false);
    for (let ctx = this.parent; ctx; ctx = ctx.parent) queue(ctx, true);
    this.traverse((ctx) => queue(ctx, false));

    context(I, this);

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
    this.scope.forEach((x) => x.pop());
    this.scope.clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    if (this.parent) {
      this.parent.scope.delete(this);
    }
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context, context };
