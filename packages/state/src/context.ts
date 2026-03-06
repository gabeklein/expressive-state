import { listener } from './observable';
import { access, event, State, uid } from './state';

const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();
const REGISTRY = new WeakMap<Context, Map<State.Extends, [State, boolean][]>>();
const CHILDREN = new WeakMap<Context, Set<Context>>();
const PARENT = new WeakMap<Context, Context>();
const LISTENERS = new WeakMap<
  Context,
  Map<State.Extends, Map<Expect, boolean>>
>();

function parent(ctx: Context) {
  return PARENT.get(ctx);
}

function children(ctx: Context) {
  let set = CHILDREN.get(ctx);
  if (!set) CHILDREN.set(ctx, (set = new Set()));
  return set;
}

function registry(ctx: Context) {
  let map = REGISTRY.get(ctx);
  if (!map) REGISTRY.set(ctx, (map = new Map()));
  return map;
}

function subscribers(ctx: Context) {
  let map = LISTENERS.get(ctx);
  if (!map) LISTENERS.set(ctx, (map = new Map()));
  return map;
}

/** Get the context for a specified State. Returns undefined if none are found. */
function context(on: State, required?: true): Context;

function context(on: State, required: boolean): Context | undefined;

/** Subscribe to when a State gets a Context. */
function context(on: State, callback: (got: Context) => void): void;

/** Assign a State to a Context. Returns cleanup function, or undefined if already assigned. */
function context(on: State, ctx: Context): (() => void) | undefined;

function context(
  { is }: State,
  arg?: ((got: Context) => void) | Context | boolean
): any {
  const found = LOOKUP.get(is);

  if (arg instanceof Context) {
    if (found instanceof Context) return;
    if (found instanceof Array) found.forEach((cb) => cb(arg));
    LOOKUP.set(is, arg);
    return () => LOOKUP.delete(is);
  }

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
  while ((from = parent(from)!));
  return out;
}

function below(from: Context, include?: boolean) {
  const queue = new Set(include ? [from] : children(from));
  for (const q of queue) for (const c of children(q)) queue.add(c);
  return queue;
}

function subscribe(
  ctx: Context,
  T: State.Extends,
  cb: Expect<any>,
  up: boolean
) {
  const subs = subscribers(ctx);
  let map = subs.get(T);
  if (!map) subs.set(T, (map = new Map()));
  map.set(cb, up);
  return () => map.delete(cb);
}

function notify(self: Context, IT: State.Extends[], up: boolean) {
  const callbacks = new Set<Expect>();
  for (const ctx of up ? above(self) : below(self, true))
    for (const T of IT) {
      const map = subscribers(ctx).get(T);
      if (map) for (const [cb, isUp] of map) if (isUp === up) callbacks.add(cb);
    }
  return callbacks;
}

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Expect<T extends State = State> = (
  state: T,
  existing?: true
) => (() => void) | false | void;

type Input = State | State.Type | (State | State.Type)[];

function register(context: Context, state: State, explicit: boolean) {
  const reg = registry(context);

  for (const T of types(state)) {
    let arr = reg.get(T);
    if (!arr) reg.set(T, (arr = []));
    arr.push([state, explicit]);
  }

  /* v8 ignore next 9 -- @preserve */
  return () => {
    for (const T of types(state)) {
      const arr = reg.get(T);
      if (arr) {
        const idx = arr.findIndex((e) => e[0] === state);
        if (idx >= 0) arr.splice(idx, 1);
        if (!arr.length) reg.delete(T);
      }
    }
  };
}

function resolve<T extends State>(
  from: Context,
  Type: State.Extends<T>
): T | null | undefined {
  let found: T | undefined;
  let priority = false;

  for (const ctx of above(from)) {
    const entries = registry(ctx).get(Type);
    if (!entries) continue;
    for (const [state, explicit] of entries) {
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
    break;
  }

  return found;
}

function lookup<T extends State>(
  from: Context,
  Type: State.Extends<T>,
  arg2?: boolean | Expect<T>
) {
  const found = resolve(from, Type);

  if (typeof arg2 == 'function') {
    if (found) arg2(found, true);
    return subscribe(from, Type, arg2, false);
  }

  if (found) return found;
  if (found === null) return null;
  if (arg2 !== false) throw new Error(`Could not find ${Type} in context.`);
}

function collect<T extends State>(
  from: Context,
  Type: State.Extends<T>,
  cb?: Expect<T>
) {
  const out: T[] = [];

  for (const ctx of below(from)) {
    const entries = registry(ctx).get(Type);
    if (entries) for (const [state] of entries) out.push(state as T);
  }

  if (cb) {
    for (const state of out) cb(state, true);
    return subscribe(from, Type, cb, true);
  }

  return out;
}

function add(
  self: Context,
  input: Input,
  implicit?: boolean,
  init: (I: State) => void = event
): () => void {
  if (Array.isArray(input)) {
    const clean = input.map((i) => add(self, i, implicit, init));
    return () => void clean.forEach((c) => c());
  }

  const cleanup = new Map<string | Function, () => void>();

  const I = input instanceof State ? input : new (input as State.Type)();

  const adopt = (k: string, v: unknown) => {
    cleanup.get(k)?.();
    cleanup.delete(k);

    if (v instanceof State)
      if (LOOKUP.get(v) instanceof Context) {
        cleanup.set(k, register(self, v, false));
      } else {
        cleanup.set(k, add(self, v, true));
        event(v);
      }
  };

  cleanup.set('', register(self, I, !implicit));

  const IT = types(I);
  const expects = notify(self, IT, true);

  const unwatch = listener(I, (key) => {
    if (typeof key === 'string') adopt(key, access(I, key, false));
    else if (key === true) {
      for (const cb of expects) {
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

  const release = context(I, self);

  for (const cb of notify(self, IT, false)) {
    const r = cb(I);
    if (typeof r == 'function') cleanup.set(r, r);
  }

  init(I);

  const remove = () => {
    self.cleanup.delete(remove);
    reset();
    if (I !== input) event(I, null);
    if (release) release();
  };

  self.cleanup.set(remove, remove);

  return remove;
}

class Context {
  public id = uid();

  protected inputs: Record<string | number, State | State.Extends> = {};

  cleanup = new Map<string | number | Function, () => void>();

  constructor(arg?: Context | Accept) {
    if (arg instanceof Context) {
      PARENT.set(this, arg);
      children(arg).add(this);
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
    callback: Expect<T>
  ): () => void;

  public get<T extends State>(
    Type: State.Extends<T>,
    arg2?: boolean | Expect<T>
  ) {
    return lookup(this, Type, arg2);
  }

  /** Get all entries of a type registered downstream. */
  public has<T extends State>(Type: State.Extends<T>): T[];

  /** Subscribe to a type being registered downstream. */
  public has<T extends State>(
    Type: State.Extends<T>,
    callback: Expect<T>
  ): () => boolean;

  public has<T extends State>(Type: State.Extends<T>, cb?: Expect<T>) {
    return collect(this, Type, cb);
  }

  /**
   * Register one or more States to this context.
   *
   * Context will add or remove States as needed to keep with provided input.
   *
   * @param inputs State, State class, or map of States / State classes to register.
   * @param forEach Optional callback to run for each State registered.
   */
  public set<T extends State>(inputs: Accept<T>, forEach?: Expect<T>) {
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

      cleanup.set(
        K,
        add(this, V, false, (I) => init.push(I))
      );
    }

    for (const state of init) {
      state.set();
      if (forEach) forEach(state as T);
    }

    this.inputs = inputs;

    return this;
  }

  add(input: Input, implicit?: boolean, init?: (I: State) => void) {
    return add(this, input, implicit, init);
  }

  public push(inputs?: Accept) {
    const next = new Context(this);
    if (inputs) next.set(inputs);
    return next;
  }

  public pop() {
    this.inputs = {};
    children(this).forEach((x) => x.pop());
    children(this).clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    const p = parent(this);
    if (p) children(p).delete(this);
  }
}

Object.defineProperty(Context.prototype, 'toString', {
  value() {
    return `Context-${this.id}`;
  }
});

export { Context, context };
