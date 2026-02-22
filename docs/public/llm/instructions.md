# Expressive State — Instructions

Instructions are special initializers for State class fields. They wire up behavior declaratively — refs, child state, context lookups, computed values, and validation.

```ts
import State, { ref, get, set } from '@expressive/state';
```

---

## ref — Mutable References

Holds a mutable value (like React's `useRef`). Does NOT trigger state events.

```ts
class MyState extends State {
  element = ref<HTMLDivElement>();
}

state.element.current;    // HTMLDivElement | null
state.element.current = div; // set via .current
state.element(div);       // or call as function
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

form.refs.name;  // ref.Object<string>
form.refs.email; // ref.Object<string>
```

---

## use — Custom Instruction

Low-level primitive for defining custom property behavior during initialization.

```ts
class MyState extends State {
  custom = use((key, subject, state) => {
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
  parent = get(ParentState);          // suspends if not found
  maybe  = get(ParentState, false);   // optional (T | undefined)
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
  children = get(ChildState, true);  // readonly ChildState[]
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

The most versatile instruction.

```ts
class MyState extends State {
  data   = set<string>();                      // required placeholder (suspends until set)
  config = set(() => loadConfig());            // factory (lazy init)
  api    = set(async () => fetch('/api').then(r => r.json())); // async (suspends, integrates with Suspense)
}
```

### Default Value with Validation

```ts
class MyState extends State {
  name = set('default', (next, prev) => {
    if (next.length < 3) return false; // reject update
  });

  query = set('', (value) => {
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer); // cleanup on next update
  });
}
```

### Computed (Reactive to Another State)

```ts
class MyState extends State {
  items = [1, 2, 3];
  multiplier = 2;
  total = set(this, ($) => $.items.reduce((a, b) => a + b, 0) * $.multiplier);
}
```

`total` re-computes when `items` or `multiplier` changes. `$` is a tracking proxy.

### Computed (Reactive to Self)

```ts
class MyState extends State {
  value = 10;
  doubled = set(true, (self) => self.value * 2);
}
```

Pass `true` as first argument to react to `this`.

---

## Summary

| Instruction | Purpose | Triggers Updates? |
|-------------|---------|-------------------|
| `ref()` | Mutable reference holder | No |
| `use()` | Custom property instruction | Yes |
| `get()` | Context lookup (up or down) | Yes (when found/lost) |
| `set()` | Computed, factory, validation | Yes |
