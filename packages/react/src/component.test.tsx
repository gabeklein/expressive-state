import { State, set } from '.';
import { vi, expect, it, describe, act, render, screen } from '../vitest';

it('will render bare State without runtime', () => {
  class Test extends State {
    value = 'Hello';

    render() {
      return <span>{this.value}</span>;
    }
  }

  // @ts-expect-error - Not a valid component unless using @expressive/react/runtime
  render(<Test />);
  screen.getByText('Hello');
});

describe('State.as()', () => {
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

  it('will expect props based off callback signature', () => {
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

  it('will pass untracked props to render', async () => {
    let test: Test;

    class Test extends State {
      foo = 'foo';

      protected new() {
        test = this;
      }
    }
    const Component = Test.as((props: { value: string }, self) => (
      <span>{self.foo + props.value}</span>
    ));

    render(<Component value="bar" />);
    screen.getByText('foobar');

    await act(async () => test.set({ foo: 'baz' }));
    screen.getByText('bazbar');
  });

  it('will merge props into state', async () => {
    const didUpdateFoo = vi.fn();
    class Test extends State {
      foo = 'foo';

      protected new() {
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

  it('will retain local updates over initial props', async () => {
    let test: Test;
    const didSetFoo = vi.fn();

    class Test extends State {
      foo = 'foo';

      protected new() {
        test = this;
        this.set(didSetFoo);
      }
    }

    const renderSpy = vi.fn((_, { foo }) => {
      return <span>{foo}</span>;
    });

    const Component = Test.as(renderSpy);

    render(<Component foo="bar" />);

    screen.getByText('bar');

    await act(async () => {
      test.foo = 'baz';
      await test.set();
      expect(test.foo).toBe('baz');
    });

    screen.getByText('baz');

    expect(didSetFoo).toBeCalledTimes(1);
    expect(renderSpy).toBeCalledTimes(2);
  });

  it('will render fallback with external render', async () => {
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
});
