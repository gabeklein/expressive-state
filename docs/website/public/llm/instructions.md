# Expressive State — Instructions

Instructions are special initializers for State class fields. They wire up behavior declaratively — refs, child state, context lookups, computed values, and validation.

```ts
import State, { apply, ref, get, set } from '@expressive/state';
```

---

## ref — Mutable References

Holds a mutable value (like React's `useRef`). Does NOT trigger state events.

```ts
class MyState extends State {
  element = ref<HTMLDivElement>();
}

state.element.current; // HTMLDivElement | null
state.element.current = div; // set via .current
state.element(div); // or call as function
```

### Ref with Callback

Called whenever value changes:

```ts
class MyState extends State {
  node = ref<HTMLElement>((el) => {
    console.log('element attached:', el);
  });
}
```

### Ref Proxy

Gives ref objects for every property on a state:

```ts
class Form extends State {
  name = '';
  email = '';
  refs = ref(this);
}

form.refs.name; // ref.Object<string>
form.refs.email; // ref.Object<string>
```

---

## apply — Custom Instruction

Low-level primitive for defining custom property behavior during initialization.

```ts
class MyState extends State {
  custom = apply((key, subject, state) => {
    // key = property name, subject = instance, state = store
    return { value: computedValue };
  });
}
```

### Child State (No Instruction Needed)

Nest states by direct assignment. Children are auto-parented and destroyed with parent.

```ts
class Parent extends State {
  child = new ChildState();
}
```

---

## get — Context Lookup

Fetches another state from ambient context hierarchy.

```ts
class Child extends State {
  parent = get(ParentState); // suspends if not found
  maybe = get(ParentState, false); // optional (T | undefined)
}
```

### With Callback

```ts
class Child extends State {
  parent = get(ParentState, (parent, self) => {
    console.log('found:', parent);
    return () => console.log('detached'); // cleanup
  });
}
```

### Downstream Collection

Collect all instances of a type below in context tree:

```ts
class Parent extends State {
  children = get(ChildState, true); // readonly ChildState[]
}
```

Array updates automatically as children are created/destroyed.

### Downstream with Callback

```ts
class Parent extends State {
  children = get(ChildState, true, (child, self) => {
    console.log('registered:', child);
    return () => console.log('removed');
  });
}
```

---

## set — Computed Values, Factories & Validation

The most versatile instruction. All `set()` properties differ from plain assignment (`= value`) in their enumerable and writable behavior.

### Property Descriptor Policy

| Form | Enumerable | Writable | Description |
| --- | --- | --- | --- |
| `= "foo"` | yes | yes | Plain data property |
| `= set("foo")` | no | yes | Managed value, excluded from snapshots/ref |
| `= set("foo", cb)` | no | yes | Managed value with setter callback |
| `= set(() => "foo")` | no | no | Factory-initialized, read-only |
| `= set(() => "foo", cb)` | no | yes | Factory with setter callback |
| `= set((self) => ...)` | yes | no | Reactive computed, included in snapshots/ref |

- **Enumerable** determines if the property appears in `Object.keys()`, `get()` snapshots, and `ref(this)`.
- **Writable** determines if the property can be assigned to. Read-only properties throw on assignment.
- Only reactive computed properties are enumerable because they are derived data. All other `set()` forms are non-enumerable.
- A property is only writable if a setter callback is provided, or if initialized with a non-function value.

### Placeholder (Suspense)

```ts
class MyState extends State {
  data = set<string>(); // required, suspends until assigned
}
```

### Factory

```ts
class MyState extends State {
  config = set(() => loadConfig()); // lazy, read-only
  api = set(async () => fetch('/api').then(r => r.json())); // async, suspends
}
```

Factory properties are read-only. To make writable, provide a callback:

```ts
class MyState extends State {
  config = set(() => loadDefaults(), (next, prev) => {
    console.log('config changed');
  });
}
```

### Default Value with Validation

```ts
class MyState extends State {
  name = set('default', (next, prev) => {
    if (next.length < 3) throw false; // reject update
  });

  query = set('', (value) => {
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer); // cleanup on next update
  });
}
```

> Callbacks may throw `false` to reject an update. Returning a function provides cleanup called on next update.

### Reactive Computed

```ts
class MyState extends State {
  value = 10;
  doubled = set((from: this) => from.value * 2);
}
```

`doubled` re-computes when `value` changes. The `self` parameter is a tracking proxy - only properties accessed through it are subscribed to. Reactive computed properties are enumerable (considered data) and read-only.

---

## Summary

| Instruction | Purpose                       | Triggers Updates?     |
| ----------- | ----------------------------- | --------------------- |
| `ref()`     | Mutable reference holder      | No                    |
| `apply()`   | Custom instruction            | Yes                   |
| `get()`     | Context lookup (up or down)   | Yes (when found/lost) |
| `set()`     | Computed, factory, validation | Yes                   |
