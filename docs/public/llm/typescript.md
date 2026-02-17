# TypeScript — Expressive State

Type system overview for contributors and consumers.

## Key Type Aliases

Defined in `packages/state/src/state.ts` namespace `State`:

| Type | Purpose |
|------|---------|
| `State.Extends<T>` | Abstract or concrete constructor of T — use for parameters accepting a class |
| `State.Type<T>` | Concrete (instantiable) constructor — use when `new` is required |
| `State.Field<T>` | Keys of T excluding inherited State members |
| `State.Event<T>` | Valid event keys: `Field<T> \| number \| symbol \| (string & {})` |
| `State.Args<T>` | Constructor argument union: `(Args \| Init \| Assign \| string \| void)[]` |
| `State.Assign<T>` | Object form of constructor arg — maps properties preserving function `this` |
| `State.Values<T>` | All fields with ref objects unwrapped via `Export<R>` |
| `State.Export<R>` | If R has `.get()`, extracts return type; otherwise R |
| `State.Value<T, K>` | Single property value lookup with Export unwrapping |

## Generics Pattern

### Extends vs Type

```ts
// Accepts abstract classes too (for parameters, lookups)
function lookup<T extends State>(Type: State.Extends<T>): T | undefined;

// Requires concrete class (for instantiation)
function create<T extends State>(Type: State.Type<T>): T;
```

### Field excludes base members

```ts
class MyState extends State {
  foo = 1;       // included in Field<MyState>
  bar = 'hello'; // included
  // get(), set(), is, etc. — excluded
}
```

## Instruction Typing

### set() overloads

```ts
value = set<string>();                           // placeholder, suspends until assigned
value = set('default');                           // initial value, type inferred
value = set(() => compute(), false);              // optional async factory
value = set('initial', (next, prev) => { ... }); // with update callback
value = set(this, (state) => state.x + state.y); // computed from self
value = set(otherState, (s) => s.value);          // computed from other state
value = set(true, this.method);                   // reactive method reference
```

### get() overloads

```ts
peer = get(PeerType);                // required upstream lookup
peer = get(PeerType, false);         // optional (T | undefined)
items = get(ItemType, true);         // downstream collection (readonly T[])
peer = get(PeerType, callback);      // with lifecycle callback
```

### ref() overloads

```ts
el = ref<HTMLElement>();                    // basic ref, ref.Object<T>
el = ref<HTMLElement>((el) => { ... });     // with mount callback
proxy = ref(this);                          // ref proxy for all properties
proxy = ref(otherState, (key) => custom);   // custom property mapper
```

### use()

```ts
child = use(ChildType);                    // child state instance
child = use(ChildType, (child) => { ... }); // with init callback
```

## Instruction return types

Instructions return symbols at definition time. The actual typed value is only available after initialization:

```ts
class Test extends State {
  value = set<string>(); // TypeScript sees string, runtime sees Symbol until init
}
```

## React Adapter Types

### Props inference

```ts
type Props<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};
```

Props are derived from State fields, all optional.

### State.as() — component factory

```ts
// With render function — infers props + state fields
const Comp = MyState.as((props, self) => <div>{self.value}</div>);

// With default props
const Comp = MyState.as({ value: 'default' });
```

Type checking prevents conflicting prop types:

```ts
// PropsConflicting<P, V> detects type mismatches between external props and state props.
// PropsValid<P, T> resolves to `never` if conflicts exist, causing a type error.
```

### State.use() argument inference

```ts
// If State defines use() method, its params become the hook args:
class Custom extends State {
  use(name: string, count: number) { ... }
}

Custom.use('hello', 42); // typed correctly

// Otherwise falls back to State.Args<T>
```

### State.get() factory types

```ts
// Factory receives proxy + refresh function
State.get((current, refresh) => {
  return current.foo + current.bar; // return type inferred
});

// NoVoid<T> converts undefined/void to null for React
State.get((current) => {
  if (!current.ready) return; // becomes null, not undefined
});
```

## Common Type Patterns

### string & {} trick

```ts
type Event<T> = Field<T> | number | symbol | (string & {});
```

Allows any string while preserving autocompletion for known keys.

### Tuple conditional for type guards

```ts
type PropsValid<P, T> = [PropsConflicting<P, Props<T>>] extends [never]
  ? unknown
  : never;
```

Wrapping in tuple prevents distribution over union.

### Recursive Args type

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | string | void)[];
```

Allows nested arrays in constructor arguments — they're flattened at runtime.

## tsconfig

- `strict: true` — full type checking
- `moduleResolution: "bundler"` — supports package.json exports
- `target: "es2020"` — WeakMap, Symbol, class features
- Path aliases: `@expressive/*` → `../*/src` for cross-package dev
