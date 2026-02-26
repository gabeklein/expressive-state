import { State, set } from '.';
import { vi, expect, it, describe, act, render, screen } from '../vitest';

it('will prefix generated component class name with React', () => {
  class Test extends State {}

  const Component = Test.as(() => null);

  expect(Component.name).toBe('ReactTest');
});

it('will create extensible component', () => {
  class Test extends State {
    something = 'World';
  }

  const TestComponent = Test.as((_, self) => (
    <span>Hello {self.something}</span>
  ));

  class Test2 extends TestComponent {
    something = 'Tester';
  }

  const element = render(<Test2 />);

  element.getByText('Hello Tester');
});

it('will create passthrough component with defaults', () => {
  class Test extends State {
    name = 'World';
  }

  const Component = Test.as({ name: 'Tester' });
  const Consumer = () => {
    const { name } = Test.get();

    return <div>Hello {name}</div>;
  };

  const element = render(
    <Component>
      <Consumer />
    </Component>
  );

  element.getByText('Hello Tester');
});

it('will create null component with no render', () => {
  class Test extends State {
    something = 'World';
  }

  const Component = Test.as({});

  const element = render(<Component />);

  expect(element.container.innerHTML).toBe('');
});

it('will expect props based of callback signature', () => {
  class Test extends State {
    something = 'World';
  }

  interface InvalidProps {
    value: string;
    something?: number; // -> this shouldn't be allowed
  }

  if (0) {
    // @ts-expect-error - overlap with state prop must be compatible
    Test.as((props: InvalidProps, self) => (
      <span>{props.value + self.something}</span>
    ));
  }

  const Component = Test.as((props: { value: string }, self) => (
    <span>{props.value + self.something}</span>
  ));

  if (0) {
    // @ts-expect-error - value prop is required
    <Component />;
  }

  const element = render(<Component value="Hello " />);

  element.getByText('Hello World');
});

it('will create component with default values', () => {
  class Test extends State {
    foo = 'bar';
  }

  const Renderable = Test.as((_, i) => <span>{i.foo}</span>);
  const WithDefault = Renderable.as({ foo: 'baz' });

  const element = render(<WithDefault />);

  element.getByText('baz');
});

it('will update component as values change', async () => {
  class Test extends State {
    foo = 'bar';
    protected new() {
      test = this;
    }
  }
  let test: Test;
  const Component = Test.as((_, self) => {
    return <span>{self.foo}</span>;
  });

  render(<Component />);
  screen.getByText('bar');

  await act(async () => {
    test.foo = 'baz';
    await test.set();
  });

  screen.getByText('baz');
});

it('will merge props into state', async () => {
  const didUpdateFoo = vi.fn();
  class Test extends State {
    foo = 'foo';
    constructor(...args: State.Args) {
      super(...args);
      this.set(didUpdateFoo);
    }
  }
  const Component = Test.as((_, self) => <span>{self.foo}</span>);
  const { rerender } = render(<Component foo="bar" />);

  screen.getByText('bar');
  expect(didUpdateFoo).not.toBeCalled();

  rerender(<Component foo="baz" />);

  screen.getByText('baz');
  expect(didUpdateFoo).toBeCalledTimes(1);
  expect(didUpdateFoo).toBeCalledWith(
    'foo',
    expect.objectContaining({ foo: 'baz' })
  );
});

it('will pass initial props before effects run', async () => {
  class Test extends State {
    foo = 'foo';

    constructor(...args: State.Args) {
      super(...args, (self) => {
        expect(self.foo).toBe('bar');
      });
    }
  }

  const Component = Test.as((_, self) => <span>{self.foo}</span>);

  render(<Component foo="bar" />);

  screen.getByText('bar');
});

it('will call is method on creation', () => {
  class Control extends State {}

  const Test = Control.as(() => null);

  const didCreate = vi.fn();

  const screen = render(<Test is={didCreate} />);

  expect(didCreate).toBeCalledTimes(1);

  screen.rerender(<Test is={didCreate} />);
  expect(didCreate).toBeCalledTimes(1);

  act(screen.unmount);
});

it('will pass untracked props to render', async () => {
  class Test extends State {
    foo = 'foo';

    constructor(...args: State.Args) {
      super(args);
      test = this;
    }
  }

  let test: Test;
  const Component = Test.as((props: { value: string }, self) => (
    <span>{self.foo + props.value}</span>
  ));

  render(<Component value="bar" />);
  screen.getByText('foobar');

  await act(async () => test.set({ foo: 'baz' }));
  screen.getByText('bazbar');
});

it('will retain local updates over initial props', async () => {
  class Test extends State {
    foo = 'foo';

    constructor(...args: State.Args) {
      super(args);
      test = this;
      this.set(didSetFoo);
    }
  }

  let test: Test;
  const didSetFoo = vi.fn();
  const renderSpy = vi.fn((_, { foo }) => {
    return <span>{foo}</span>;
  });

  const Component = Test.as(renderSpy);

  render(<Component foo="bar" />);

  screen.getByText('bar');

  await act(async () => {
    // explicitly update foo; calls for new render
    test.foo = 'baz';
    await test.set();
    expect(test.foo).toBe('baz');
  });

  screen.getByText('baz');

  expect(didSetFoo).toBeCalledTimes(1);
  expect(renderSpy).toBeCalledTimes(2);
});

it('will override method', async () => {
  class Test extends State {
    callback() {
      return 'foo';
    }
  }

  const Component = Test.as((_, self) => {
    return <span>{self.callback()}</span>;
  });

  const element = render(<Component callback={() => 'bar'} />);
  screen.getByText('bar');

  element.rerender(<Component callback={() => 'baz'} />);
  screen.getByText('baz');
});

it('will trigger set instruction', () => {
  class Foo extends State {
    value = set('foobar', didSet);
  }

  const Component = Foo.as(() => null);
  const didSet = vi.fn();

  render(<Component value="barfoo" />);

  expect(didSet).toBeCalled();
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = vi.fn();

    class Test extends State {
      value = 0;

      protected new() {
        didCreate();
      }
    }

    const Component = Test.as(() => null);

    render(<Component />);

    expect(didCreate).toBeCalled();
  });
});

describe('suspense', () => {
  it('will render fallback prop', async () => {
    class Foo extends State {
      value = set<string>();
    }

    let foo!: Foo;
    const Provider = Foo.as(() => <Consumer />);

    const Consumer = () => (foo = Foo.get()).value;

    const element = render(<Provider fallback={<span>Loading...</span>} />);

    element.getByText('Loading...');

    await act(async () => (foo.value = 'Hello World'));

    element.getByText('Hello World');
  });

  it('will use fallback property first', async () => {
    class Foo extends State {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Provider = Foo.as(() => <Consumer />);

    const Consumer = () => (foo = Foo.get()).value;

    const element = render(<Provider />);

    element.queryByText('Loading!');

    element.rerender(<Provider fallback={<span>Loading...</span>} />);

    element.getByText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
    });

    element.getByText('Hello World');
  });
});
