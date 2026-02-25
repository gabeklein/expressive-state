/** @jsxImportSource . */

import { vi, expect, it, describe, act, render, screen } from '../vitest';

import React, { Children, Component, isValidElement } from 'react';
import State, { Consumer, get, set } from '.';

it('will create and provide instance', () => {
  class Control extends State {
    foo = 'bar';
  }

  render(
    <Control>
      <Consumer for={Control}>{(c) => c.foo}</Consumer>
    </Control>
  );

  screen.getByText('bar');
});

it('will create instance only once', () => {
  class Control extends State {
    constructor(...args: State.Args) {
      super(args);
      didConstruct(this);
    }
  }

  const didConstruct = vi.fn();
  const { rerender } = render(<Control />);

  expect(didConstruct).toBeCalledTimes(1);

  rerender(<Control />);

  expect(didConstruct).toBeCalledTimes(1);
});

it('will call is method on creation', () => {
  class Control extends State {}

  const didCreate = vi.fn();

  const screen = render(<Control is={didCreate} />);

  expect(didCreate).toBeCalledTimes(1);

  screen.rerender(<Control is={didCreate} />);
  expect(didCreate).toBeCalledTimes(1);

  act(screen.unmount);
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = vi.fn();

    class Test extends State {
      protected new() {
        didCreate();
      }
    }

    const element = render(<Test />);

    expect(didCreate).toBeCalled();

    element.rerender(<Test />);

    expect(didCreate).toBeCalledTimes(1);
  });
});

describe('element props', () => {
  class Foo extends State {
    /** Hover over this prop to see description. */
    value?: string = undefined;
  }

  it('will accept managed values', () => {
    render(
      <Foo value="baz">
        <Consumer for={Foo}>
          {(c) => {
            expect(c.value).toBe('baz');
          }}
        </Consumer>
      </Foo>
    );
  });

  it('will assign values to instance', () => {
    render(
      <Foo value="foobar">
        <Consumer for={Foo}>
          {(i) => {
            expect(i.value).toBe('foobar');
          }}
        </Consumer>
      </Foo>
    );
  });

  it('will trigger set instruction', () => {
    class Foo extends State {
      value = set('foobar', didSet);
    }

    const didSet = vi.fn();

    render(<Foo value="barfoo" />);

    expect(didSet).toBeCalled();
  });

  it('will override method', async () => {
    class Test extends State {
      callback() {
        return 'foo';
      }

      render() {
        return <span>{this.callback()}</span>;
      }
    }

    const element = render(<Test callback={() => 'bar'} />);
    screen.getByText('bar');

    element.rerender(<Test callback={() => 'baz'} />);
    screen.getByText('baz');
  });

  it('will not assign foreign values', () => {
    render(
      // @ts-expect-error
      <Foo nonValue="foobar">
        <Consumer for={Foo}>
          {(i) => {
            // @ts-expect-error
            expect(i.nonValue).toBeUndefined();
          }}
        </Consumer>
      </Foo>
    );
  });
});

describe('element children', () => {
  it('will handle multiple elements', () => {
    class Control extends State {
      foo = 'bar';
    }

    const screen = render(
      <Control foo="sd">
        <span>Hello</span>
        <span>World</span>
      </Control>
    );

    screen.getByText('Hello');
    screen.getByText('World');
  });

  it('will notify parent', async () => {
    class Control extends State {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = vi.fn();
    const screen = render(<Control>Hello</Control>);

    screen.getByText('Hello');
    expect(didUpdate).toBeCalled();
  });

  it('will accept arbitrary children with render', () => {
    const symbol = Symbol('foo');

    class Control extends State {
      props!: { children: symbol };

      render() {
        expect(this.props.children).toBe(symbol);
        return 'Hello';
      }
    }

    const screen = render(<Control>{symbol}</Control>);

    screen.getByText('Hello');
  });
});

describe('props property', () => {
  it('will update on rerender', () => {
    class Control extends State {
      props!: { value: string };

      render() {
        return <>{this.props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);
    screen.getByText('foo');

    rerender(<Control value="bar" />);
    screen.getByText('bar');
  });

  it('will be accessible on instance', () => {
    class Control extends State {
      props!: { value: string };
    }

    let ctrl!: Control;
    render(<Control value="hello" is={(x) => (ctrl = x)} />);
    expect(ctrl.props.value).toBe('hello');
  });
});

describe('render method', () => {
  it('will be element output', () => {
    class Control extends State {
      foo = 'bar';

      props!: { bar: string };

      render() {
        return (
          <>
            <span>{this.props.bar}</span>
            <span>{this.foo}</span>
          </>
        );
      }
    }

    const screen = render(<Control bar="foo" />);

    screen.getByText('foo');
    screen.getByText('bar');
  });

  it('will accept function component', async () => {
    function FunctionComponent(this: ClassComponent) {
      return (
        <div>
          {this.salutation} {this.props.name}
        </div>
      );
    }

    class ClassComponent extends State {
      salutation = 'Hello';
      props!: { name: string };
      render = FunctionComponent;
    }

    const screen = render(<ClassComponent name="World" />);

    screen.getByText('Hello World');

    screen.rerender(<ClassComponent salutation="Bonjour" name="React" />);

    screen.getByText('Bonjour React');
  });

  it('will ignore children not handled', () => {
    class Control extends State {
      props!: { value: string };

      render() {
        return <>{this.props.value}</>;
      }
    }

    const screen = render(
      // while by default children are passed through,
      // we shouldn't accept props not defined in render
      // @ts-expect-error
      <Control value="Goodbye">Hello</Control>
    );

    screen.getByText('Goodbye');
    expect(screen.queryByText('Hello')).toBe(null);
  });

  it('will handle children if managed by this', () => {
    class Control extends State {
      props!: { value: string };
      children = set<React.ReactNode>();

      render() {
        return (
          <>
            <span>{this.props.value}</span>
            {this.children}
          </>
        );
      }
    }

    const screen = render(<Control value="Hello">World</Control>);

    screen.getByText('Hello');
    screen.getByText('World');
  });

  it('will refresh on update', async () => {
    class Control extends State {
      value = 'bar';

      render() {
        return <span>{this.value}</span>;
      }
    }

    let control: Control;
    const screen = render(<Control is={(x) => (control = x)} />);

    screen.getByText('bar');

    await act(async () => {
      control.value = 'foo';
      await control.set();
    });

    screen.getByText('foo');
  });
});

describe('State.FC', () => {
  it('will have correct types', () => {
    class Control extends State {
      foo = 'bar';
      bar = 'baz';
    }

    interface CorrectProps {
      baz: string;
      foo?: string | undefined;
      bar?: string | undefined;
      is?: (instance: Control) => void;
    }

    const Component = (props: { baz: string }) => {
      expect<CorrectProps>(props);
      return <div>{props.baz}</div>;
    };

    expect<React.FC<CorrectProps>>(Component);
  });
});

describe('suspense', () => {
  it('will render fallback prop', async () => {
    class Foo extends State {
      value = set<string>();
    }

    let foo!: Foo;
    const Consumer = () => (foo = Foo.get()).value;

    const element = render(
      <Foo fallback={<span>Loading...</span>}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading...');

    await act(async () => (foo.value = 'Hello World'));

    element.getByText('Hello World');
  });

  it('will fallback when own render suspends', async () => {
    class Foo extends State {
      value = set<string>();
      fallback = (<span>Loading!</span>);
      render() {
        return this.value;
      }
    }

    let foo!: Foo;

    const element = render(<Foo is={(x) => (foo = x)} />);

    element.getByText('Loading!');

    await act(async () => {
      foo.value = 'Hello World';
    });

    element.getByText('Hello World');
  });

  it('will use fallback property first', async () => {
    class Foo extends State {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => Foo.get().value;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading!');

    element.rerender(
      <Foo fallback={<span>Loading...</span>}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
    });

    element.getByText('Hello World');
  });

  it('will update with new fallback', async () => {
    class Foo extends State {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => Foo.get().value;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading!');

    await act(async () => {
      foo.fallback = <span>Loading...</span>;
      await new Promise((r) => setTimeout(r, 0));
    });

    element.getByText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
      await new Promise((r) => setTimeout(r, 0));
    });

    element.getByText('Hello World');
  });
});

describe('types', () => {
  it('will not compromise existing Component props', () => {
    const FunctionComponent = (props: {
      /** this is foo */
      foo: string;
    }) => {
      return <div>Hello {props.foo}</div>;
    };

    class ClassComponent extends Component {
      readonly props!: {
        /** this is bar */
        bar: string;
      };

      render() {
        return <div>Hello {this.props.bar}</div>;
      }
    }

    const screen = render(<FunctionComponent foo="bar" />);

    screen.getByText('Hello bar');

    screen.rerender(<ClassComponent bar="baz" />);

    screen.getByText('Hello baz');
  });
});

describe.skip('implicit context', () => {
  it('will provide automatically', async () => {
    class Parent extends State {
      value = 'foobar';
    }
    class Child extends State {
      parent = get(Parent);
    }

    let parent: Parent;
    const Outer = (props: React.PropsWithChildren) => {
      parent = Parent.use().is;
      return props.children;
    };

    const Inner = () => {
      return Child.use().parent.value;
    };

    render(
      <Outer>
        <Inner />
      </Outer>
    );

    screen.getByText('foobar');

    await act(async () => parent.set({ value: 'barfoo' }));

    screen.getByText('barfoo');
  });

  it('will recycle context', () => {
    class Foo extends State {}
    class Bar extends State {}
    class Baz extends State {
      foo = get(Foo);
      bar = get(Bar);

      constructor(...args: State.Args) {
        super(args);
        baz = this;
      }
    }

    let baz!: Baz;
    const Outer = (props: React.PropsWithChildren) => {
      Foo.use();
      Bar.use();

      return props.children;
    };

    render(
      <Outer>
        <Baz />
      </Outer>
    );

    expect(baz.foo).toBeInstanceOf(Foo);
    expect(baz.bar).toBeInstanceOf(Bar);
  });
});

describe.skip('implicit return', () => {
  it('will return element', () => {
    const Test = (props: { name?: string }) => {
      <div>Hello {props.name || 'World'}</div>;
    };

    const element = render(<Test />);
    screen.getByText('Hello World');

    element.rerender(<Test name="Foo" />);
    screen.getByText('Hello Foo');
  });

  it('will select last element', () => {
    const Test = (props: { hi?: boolean }) => {
      if (props.hi)
        <div>
          <span>Hello</span>
          <span>World</span>
        </div>;
      else <div>Goodbye World</div>;
    };

    const element = render(<Test />);
    screen.getByText('Goodbye World');

    element.rerender(<Test hi />);
    screen.getByText('Hello');
    screen.getByText('World');
  });

  it('will always select returned', () => {
    const Test = (props: { hi?: boolean }) => {
      const hi = <span>Hello World</span>;
      const bye = <div>Goodbye World</div>;

      return props.hi ? hi : bye;
    };

    render(<Test hi />);
    screen.getByText('Hello World');
  });

  it('will ignore non-arrow functions', () => {
    const Container = (props: { children: React.ReactNode }) => {
      const [child1, child2, child3] = Children.toArray(props.children);

      // Runtime wraps arrow functions in an HOC so should be different.
      expect(isValidElement(child1) && child1.type !== ArrowFunction).toBe(
        true
      );

      // function expressions and declarations are not wrapped.
      expect(isValidElement(child2) && child2.type === FunctionExpression).toBe(
        true
      );
      expect(
        isValidElement(child3) && child3.type === FunctionDeclaration
      ).toBe(true);

      return null;
    };

    const ArrowFunction = () => null;
    const FunctionExpression = function () {
      return null;
    };
    function FunctionDeclaration() {
      return null;
    }

    render(
      <Container>
        <ArrowFunction />
        <FunctionExpression />
        <FunctionDeclaration />
      </Container>
    );
  });
});
