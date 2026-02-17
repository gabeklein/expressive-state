# Expressive State — Patterns

Copy-paste recipes for common scenarios. All examples use `@expressive/react`.

## Counter

```ts
import State from '@expressive/react';

class Counter extends State {
  count = 0;
  increment() { this.count++; }
  decrement() { this.count--; }
}

const CounterView = Counter.as((_, self) => (
  <div>
    <button onClick={self.decrement}>-</button>
    <span>{self.count}</span>
    <button onClick={self.increment}>+</button>
  </div>
));
```

## Form with Validation

```ts
import State, { set } from '@expressive/react';

class LoginForm extends State {
  email = set("", (value) => {
    if (!value.includes("@")) return false;
  });

  password = set("", (value) => {
    if (value.length < 8) return false;
  });

  get valid() {
    return !!this.email && !!this.password;
  }

  submit() {
    if (this.valid)
      postLogin(this.email, this.password);
  }
}

const Login = LoginForm.as((_, self) => (
  <form onSubmit={(e) => { e.preventDefault(); self.submit(); }}>
    <input value={self.email} onChange={e => self.email = e.target.value} />
    <input type="password" value={self.password}
           onChange={e => self.password = e.target.value} />
    <button disabled={!self.valid}>Log In</button>
  </form>
));
```

## Async Data Fetching

```ts
import State, { set } from '@expressive/react';

class UserProfile extends State {
  data = set(async () => {
    const res = await fetch("/api/user");
    return res.json();
  });
}

const Profile = UserProfile.as((_, self) => (
  <div>
    <h1>{self.data.name}</h1>
    <p>{self.data.email}</p>
  </div>
));

// Suspense fallback via prop
<Profile fallback={<p>Loading...</p>} />
```

## Nested / Child State

```ts
import State, { use } from '@expressive/react';

class TodoItem extends State {
  text = "";
  done = false;
  toggle() { this.done = !this.done; }
}

class TodoList extends State {
  items: TodoItem[] = [];

  add(text: string) {
    const item = use.call(this, TodoItem);
    item.text = text;
    this.items = [...this.items, item];
  }
}

const Todos = TodoList.as((_, self) => (
  <ul>
    {self.items.map((item) => (
      <li key={item.text} onClick={item.toggle}
          style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
        {item.text}
      </li>
    ))}
    <button onClick={() => self.add("New item")}>Add</button>
  </ul>
));
```

## Context Sharing

```ts
import State, { get, Provider } from '@expressive/react';

class Theme extends State {
  color = "blue";
  toggle() {
    this.color = this.color === "blue" ? "red" : "blue";
  }
}

class ThemedWidget extends State {
  theme = get(Theme);
}

const Widget = ThemedWidget.as((_, self) => (
  <div style={{ color: self.theme.color }}>
    Themed content
    <button onClick={self.theme.toggle}>Toggle</button>
  </div>
));

function App() {
  return (
    <Provider for={Theme}>
      <Widget />
    </Provider>
  );
}
```

## Computed Values

```ts
import State, { set } from '@expressive/react';

class Cart extends State {
  items: { name: string; price: number; qty: number }[] = [];

  total = set(this, ($) =>
    $.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  );

  count = set(this, ($) => $.items.reduce((sum, i) => sum + i.qty, 0));

  add(name: string, price: number) {
    this.items = [...this.items, { name, price, qty: 1 }];
  }
}
```

## Debounced Search

```ts
import State, { set } from '@expressive/react';

class Search extends State {
  query = '';
  results: string[] = [];

  // Debounce with set callback cleanup
  debouncedQuery = set('', (value) => {
    const timer = setTimeout(() => {
      this.performSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  });

  async performSearch(q: string) {
    const res = await fetch(`/api/search?q=${q}`);
    this.results = await res.json();
  }
}
```

## Downstream Collection (Parent Tracks Children)

```ts
import State, { get, Provider } from '@expressive/react';

class TabGroup extends State {
  tabs = get(Tab, true); // collects all Tab instances below
  active = 0;
}

class Tab extends State {
  label = "";
  group = get(TabGroup);
}

const TabBar = TabGroup.as((_, self) => (
  <div>
    {self.tabs.map((tab, i) => (
      <button key={tab.label}
              onClick={() => self.active = i}
              style={{ fontWeight: self.active === i ? 'bold' : 'normal' }}>
        {tab.label}
      </button>
    ))}
  </div>
));
```

## Effects & Cleanup

```ts
import State from '@expressive/react';

class Timer extends State {
  elapsed = 0;

  protected new() {
    const id = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(id);
  }
}
```

## Using State.get() with Computed Hook

```ts
function OrderSummary() {
  const summary = Cart.get(($) => ({
    total: $.total,
    count: $.count,
    empty: $.items.length === 0,
  }));

  if (summary.empty) return <p>Cart is empty</p>;

  return (
    <div>
      <p>{summary.count} items</p>
      <p>Total: ${summary.total}</p>
    </div>
  );
}
```
