import { listener } from './observable';
import { event, State } from './state';

/** Context parent of a state. */
const PARENT = new WeakMap<State, State | null>();

/** Context children of a state. */
const CHILDREN = new WeakMap<State, Set<State>>();

/** Registry of provided states, keyed by type. */
const PROVIDE = new WeakMap<State, Map<State.Extends, [State, boolean][]>>();

/** Subscriber callbacks waiting for types to appear. */
const CONSUME = new WeakMap<State, Map<State.Extends, Set<Expect>>>();

/** Previous inputs for apply(). */
const INPUTS = new WeakMap<
  State,
  Record<string | number, State | State.Extends>
>();

/** Cleanup callbacks per state. */
const CLEANUP = new WeakMap<
  State,
  Map<string | number | Function, () => void>
>();

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Expect<T extends State = State> = (
  state: T,
  child: boolean,
  existing: boolean
) => (() => void) | false | void;

type ForEach<T> = (state: T) => (() => void) | void;

function get<K extends object, T>(
  source: WeakMap<K, T>,
  key: K,
  Type: new () => any
): T;
function get<K, T>(source: Map<K, T>, key: K, Type: new () => any): T;
function get(source: any, key: any, Type: new () => any) {
  let value = source.get(key);
  if (!value) source.set(key, (value = new Type()));
  return value;
}

const TYPES = new WeakMap<State.Extends, State.Extends[]>();

function types(state: State) {
  let T = state.constructor as State.Extends;
  const cached = TYPES.get(T);
  if (cached) return cached;

  const out: State.Extends[] = [];
  TYPES.set(T, out);
  while (T !== State) {
    out.push(T);
    T = Object.getPrototypeOf(T);
  }
  return out;
}

/** Walk PARENT upward from state, collecting ancestors (inclusive). */
function above(state: State) {
  const out: State[] = [];
  let current: State | undefined = state;
  do out.push(current);
  while ((current = PARENT.get(current) || undefined));
  return out;
}

/** BFS downward via CHILDREN from state (exclusive). */
function below(from: State) {
  const kids = CHILDREN.get(from);
  if (!kids) return new Set<State>();
  const queue = new Set(kids);
  for (const q of queue) {
    const k = CHILDREN.get(q);
    if (k) for (const c of k) queue.add(c);
  }
  return queue;
}

/** Walk up to nearest ancestor with PROVIDE (inclusive), or self. */
function root(state: State) {
  let current: State | undefined = state;
  while (current) {
    if (PROVIDE.has(current)) return current;
    current = PARENT.get(current) || undefined;
  }
  return state;
}

/** Find specified type upstream. Throws if not found. */
function find<T extends State>(state: State, Type: State.Extends<T>): T;

/** Find specified type upstream. Returns undefined if not found. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  required: false | undefined
): T | undefined;

/** Get all entries of a type registered downstream. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  below: true
): T[];

/** Subscribe to a type becoming available in either direction. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  callback: Expect<T>
): () => void;

function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  arg2?: boolean | Expect<T>,
  existing = typeof arg2 == 'function'
) {
  let parent: T | null | undefined;
  let priority = false;

  if (!arg2 || existing)
    for (const s of above(state)) {
      const registry = PROVIDE.get(s);
      if (!registry) continue;
      const entries = registry.get(Type);
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
    for (const s of below(root(state))) {
      const registry = PROVIDE.get(s);
      if (!registry) continue;
      const entries = registry.get(Type);
      if (entries) for (const [st] of entries) children.push(st as T);
    }

  if (arg2 === true) return children;

  if (typeof arg2 == 'function') {
    if (parent) arg2(parent, false, true);
    for (const child of children) arg2(child, true, true);

    const set = get(get(CONSUME, state, Map), Type, Set);
    set.add(arg2 as Expect);

    return () => {
      set.delete(arg2 as Expect);
    };
  }

  if (parent) return parent;
  if (parent === null) return null;
  if (arg2 !== false) throw new Error(`Could not find ${Type} in context.`);
}

/**
 * Apply a set of inputs to a host state, diffing against previous inputs.
 * Creates instances for class inputs, fires event() for new instances.
 */
function provides<T extends State>(
  from: State,
  inputs: Accept<T>,
  forEach?: ForEach<T>
) {
  const cleanup = get(CLEANUP, from, Map);
  const prev = INPUTS.get(from) || {};
  const init = new Set<() => void>();

  if (typeof inputs == 'function' || inputs instanceof State)
    inputs = { [0]: inputs } as Record<string | number, T | State.Type<T>>;

  for (const K of Object.keys({ ...prev, ...inputs })) {
    const V = (inputs as Record<string, any>)[K];
    const E = prev[K];

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

    const state = (State.is(V) ? new (V as State.Type)() : V) as T;
    const remove = provide(from, state, false);
    let done: (() => void) | void;

    init.add(() => {
      event(state);
      if (forEach) done = forEach(state);
    });

    cleanup.set(K, () => {
      remove();
      if (done) done();
      if (state !== V) event(state, null);
    });
  }

  for (const ready of init) ready();

  INPUTS.set(from, inputs);
}

/**
 * Register a target state within a host's context.
 *
 * @param from - The state that owns the context node.
 * @param subject - The state to register.
 * @param implicit - If true, registers on nearest ancestor with PROVIDE.
 * @returns Cleanup function to remove the registration.
 */
function provide(from: State, subject: State, implicit?: boolean) {
  const registrar = implicit ? root(from) : from;
  const registry = get(PROVIDE, registrar, Map);

  const TT = types(subject);
  const expects = new Map<Expect, () => void>();
  const onDone = new Set<() => void>();

  for (const T of TT) get(registry, T, Array).push([subject, !implicit]);

  /* v8 ignore next 9 -- @preserve */
  onDone.add(() => {
    for (const T of TT) {
      const arr = registry.get(T);
      if (arr) {
        const idx = arr.findIndex((e) => e[0] === subject);
        if (idx >= 0) arr.splice(idx, 1);
        if (!arr.length) registry.delete(T);
      }
    }
  });

  if (!PARENT.get(subject)) PARENT.set(subject, from);

  get(CHILDREN, from, Set).add(subject);

  function collect(state: State, child: boolean) {
    for (const T of TT) {
      const set = CONSUME.get(state)?.get(T);
      if (set)
        for (const cb of set)
          if (!expects.has(cb))
            expects.set(cb, () => {
              const r = cb(subject, child, false);
              if (r) onDone.add(r);
            });
    }
  }

  for (const s of above(registrar)) {
    const isAbove = s !== registrar;
    collect(s, isAbove);
    const provided = PROVIDE.get(s);
    if (provided)
      for (const entries of provided.values())
        for (const [st] of entries) if (st !== subject) collect(st, true);
  }

  for (const s of below(registrar)) {
    collect(s, false);
    const provided = PROVIDE.get(s);
    if (provided)
      for (const entries of provided.values())
        for (const [st] of entries) if (st !== subject) collect(st, false);
  }

  const unwatch = listener(subject, (key) => {
    if (key === true) {
      expects.forEach((f) => f());
      expects.clear();
    }
  });

  onDone.add(unwatch);
  onDone.add(() => CHILDREN.get(from)?.delete(subject));

  const hostCleanup = get(CLEANUP, from, Map);
  const targetCleanup = get(CLEANUP, subject, Map);

  function remove() {
    hostCleanup.delete(remove);
    targetCleanup.delete(remove);
    onDone.forEach((r) => r());
    onDone.clear();
  }

  hostCleanup.set(remove, remove);
  targetCleanup.set(remove, remove);

  return remove;
}

/**
 * Detach a state from context, recursively cleaning up children.
 */
function detach(state: State) {
  INPUTS.delete(state);

  const kids = CHILDREN.get(state);
  if (kids) {
    for (const child of kids) detach(child);
    kids.clear();
  }

  const cleanup = CLEANUP.get(state);
  if (cleanup) {
    cleanup.forEach((cb) => cb());
    cleanup.clear();
  }

  const p = PARENT.get(state);
  if (p) {
    const pk = CHILDREN.get(p);
    if (pk) pk.delete(state);
  }

  PROVIDE.delete(state);
  CONSUME.delete(state);
}

/** Get context parent of a state. */
function parent(state: State): State | undefined;

/** Get context parent only if it directly owns the state. */
function parent(state: State, direct: true): State | undefined;

function parent(state: State) {
  return PARENT.get(state) || undefined;
}

/**
 * Link two states as parent-child in the context tree.
 * Does NOT register the child in PROVIDE — use include() for that.
 */
function link(p: State, child: State) {
  if (!PARENT.get(child)) PARENT.set(child, p);
  get(CHILDREN, p, Set).add(child);
}

export {
  find,
  provide,
  provides,
  detach,
  parent,
  link,
  PARENT,
  CHILDREN,
  PROVIDE,
  CONSUME,
  CLEANUP
};
export type { Accept, Expect, ForEach };
