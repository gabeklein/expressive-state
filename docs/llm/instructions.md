# Expressive State — Instructions

Instructions are special initializers for State class fields. They wire up behavior declaratively — refs, child state, context lookups, computed values, and validation.

```typescript
import State, { ref, use, get, set } from '@expressive/state';
```

---

## ref — Mutable References

Holds a mutable value (like React's `useRef`). Updates to the ref do NOT trigger state events.

### Basic Ref

```typescript
class MyState extends State {
  element = ref<HTMLDivElement>();
}

const state = MyState.new();
state.element.current;            // HTMLDivElement | null
state.element.current = div;      // set via .current
state.element(div);               // or call as function
```

### Ref with Callback

Called whenever the value changes:

```typescript
class MyState extends State {
  node = ref<HTMLElement>((el) => {
    console.log("element attached:", el);
  });
}
```

### Ref Proxy

Creates a proxy that gives ref objects for every property on a state:

```typescript
class Form extends State {
  name = "";
  email = "";

  refs = ref(this);
}

const form = Form.new();
form.refs.name;   // ref.Object<string>
form.refs.email;  // ref.Object<string>
```

---

## use — Child State

Creates a child state instance owned by the parent. The child is automatically destroyed when the parent is.

### Basic Child

```typescript
class Parent extends State {
  child = use(ChildState);
}
```

The child is created eagerly and shares the parent's context.

### Optional Child

```typescript
class Parent extends State {
  child = use(ChildState, false); // T | undefined
}
```

### With Ready Callback

```typescript
class Parent extends State {
  child = use(ChildState, (instance) => {
    console.log("child ready:", instance);
  });
}
```

### Custom Instruction

`use()` also accepts an `Instruction` function for advanced use:

```typescript
class MyState extends State {
  custom = use((state, key) => {
    // state = parent instance, key = property name
    return computedValue;
  });
}
```

---

## get — Context Lookup

Fetches another state instance from the ambient context hierarchy.

### Upstream Lookup

```typescript
class Child extends State {
  parent = get(ParentState);
}
```

When `Child` is created inside `ParentState`'s context (via `use()`, `Provider`, or `State.as()`), the `parent` field resolves to the `ParentState` instance.

If no instance is found, the state suspends (waits). Pass `false` to make it optional:

```typescript
class Child extends State {
  maybeParent = get(ParentState, false); // T | undefined
}
```

### With Callback

```typescript
class Child extends State {
  parent = get(ParentState, (parent, self) => {
    console.log("parent found:", parent);
    // return cleanup function
    return () => console.log("detached");
  });
}
```

### Downstream Collection

Collect all instances of a type registered below in the context tree:

```typescript
class Parent extends State {
  children = get(ChildState, true); // readonly ChildState[]
}
```

The array updates automatically as children are created/destroyed.

### Downstream with Callback

```typescript
class Parent extends State {
  children = get(ChildState, true, (child, self) => {
    console.log("child registered:", child);
    return () => console.log("child removed");
  });
}
```

---

## set — Computed Values, Factories & Validation

The most versatile instruction. Handles computed properties, async data, and assignment validation.

### Required Placeholder

Suspends until a value is assigned:

```typescript
class MyState extends State {
  data = set<string>(); // suspends until set
}
```

### Factory (Lazy Initialization)

```typescript
class MyState extends State {
  config = set(() => loadConfig());
}
```

### Async Factory

```typescript
class MyState extends State {
  data = set(async () => {
    const res = await fetch("/api/data");
    return res.json();
  });
}
```

The state suspends until the promise resolves. In React, this integrates with Suspense.

### Default Value with Validation

```typescript
class MyState extends State {
  name = set("default", (next, prev) => {
    if (next.length < 3) return false; // reject update
    console.log(`changed: ${prev} -> ${next}`);
  });
}
```

Return `false` to reject. Return a function for cleanup:

```typescript
class MyState extends State {
  query = set("", (value) => {
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer); // cleanup on next update
  });
}
```

### Computed (Reactive to Another State)

```typescript
class MyState extends State {
  items = [1, 2, 3];
  multiplier = 2;

  total = set(this, ($) =>
    $.items.reduce((a, b) => a + b, 0) * $.multiplier
  );
}
```

`total` re-computes whenever `items` or `multiplier` changes. The `$` parameter is a tracking proxy.

### Computed (Reactive to Self)

```typescript
class MyState extends State {
  value = 10;
  doubled = set(true, (self) => self.value * 2);
}
```

Pass `true` as the first argument to react to `this`.

---

## Summary

| Instruction | Purpose | Triggers Updates? |
|------------|---------|-------------------|
| `ref()` | Mutable reference holder | No |
| `use()` | Create owned child state | Yes (child events) |
| `get()` | Context lookup (up or down) | Yes (when found/lost) |
| `set()` | Computed, factory, validation | Yes |
