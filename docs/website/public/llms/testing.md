# Testing — Expressive State

Framework: **Vitest** with `jsdom` environment. Coverage target: 100%.

## Setup

```ts
// packages/state tests import from local vitest re-export
import { vi, describe, it, expect, mockPromise, mockWarn, mockError } from '../../vitest';

// packages/react tests also get @testing-library/react
import { render, renderHook, act, waitFor, screen } from '../../vitest';
// (packages/react/vitest.ts re-exports both vitest and @testing-library/react)
```

## Custom Matchers

Defined in `vitest.setup.ts`, available globally:

```ts
// Assert state has pending updates (async)
await expect(state).toUpdate(timeout?);

// Assert state did update, optionally with specific keys
await expect(state).toHaveUpdated();
await expect(state).toHaveUpdated('foo', 'bar');

// Negated
await expect(state).not.toHaveUpdated();
```

## Test Utilities

### mockPromise

Controllable promise for async testing:

```ts
const promise = mockPromise<string>();

// Later, resolve or reject manually:
promise.resolve('hello');
promise.reject('oh no');
await promise; // resolves to 'hello'
```

### mockWarn / mockError

Spy on console, auto-clear between tests:

```ts
const warn = mockWarn();
// ... do something that warns
expect(warn).toBeCalledWith('expected message');
```

## Testing State Classes

### Basic instantiation and updates

```ts
class Subject extends State {
  value = 1;
}

const state = Subject.new();
expect(state.value).toBe(1);

state.value = 2;
const update = await state.set();
expect(update).toEqual(['value']);
```

### Testing effects

```ts
const mock = vi.fn();
state.get((current) => {
  mock(current.value);
});

state.value = 42;
await expect(state).toHaveUpdated('value');
expect(mock).toBeCalledWith(42);
```

### Testing lifecycle

```ts
const didCreate = vi.fn();

class Test extends State {
  protected new() {
    didCreate();
    return () => { /* cleanup */ };
  }
}

const t = Test.new();
expect(didCreate).toBeCalledTimes(1);
t.set(null); // destroy
```

### Testing destruction

```ts
const destroyed = vi.fn();
state.get(null, destroyed);

state.set(null);
expect(destroyed).toBeCalled();
```

## Testing React Integration

### renderHook for State.use()

```ts
const hook = renderHook(() => Test.use());
expect(hook.result.current).toBeInstanceOf(Test);

// Test reactive updates
hook.result.current.value = 'bar';
await waitFor(() => {
  expect(willRender).toBeCalledTimes(2);
});
```

### renderWith helper

Common pattern for tests needing Provider + Suspense:

```ts
function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper(props) {
      return (
        <Provider for={Type}>
          <Suspense fallback={null}>{props.children}</Suspense>
        </Provider>
      );
    }
  });
}

// Usage
const hook = renderWith(Test, () => Test.get((x) => x.foo));
```

### Testing components via State.as()

```ts
class Test extends State {
  something = 'World';
}

const TestComponent = Test.as((_, self) => (
  <span>Hello {self.something}</span>
));

const element = render(<TestComponent />);
element.getByText('Hello World');

// Update and verify
await act(async () => {
  test.foo = 'baz';
  await test.set();
});
screen.getByText('baz');
```

### Testing props merge

```ts
const { rerender } = render(<Component foo="bar" />);
screen.getByText('bar');

rerender(<Component foo="baz" />);
screen.getByText('baz');
```

### Testing Provider/Consumer

```ts
render(
  <Provider for={Foo}>
    <Consumer for={Foo}>
      {(i) => {
        expect(i).toBeInstanceOf(Foo);
      }}
    </Consumer>
  </Provider>
);
```

### Testing Suspense

```ts
class Foo extends State {
  value = set<string>();
}

const foo = Foo.new();

render(
  <Provider for={foo} fallback={<span>Loading...</span>}>
    <Consumer />
  </Provider>
);

screen.getByText('Loading...');

await act(async () => {
  foo.value = 'Hello World';
});

screen.getByText('Hello World');
```

## Naming Convention

- Positive: `it('will create instance')`
- Negative: `it('will not trigger update')`
- Error: `it('will throw if not found')`

## Running Tests

```bash
pnpm test           # run all tests
pnpm test:coverage  # with coverage report
```
