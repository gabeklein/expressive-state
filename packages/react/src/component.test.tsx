import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, expect, it, describe } from 'vitest';
import { renderToString } from 'react-dom/server';
import React, { Suspense } from 'react';

import { mockError, mockPromise, flushMicrotasks } from '../test.setup';
import { Component, Consumer, pending, set } from '.';

it('will create and provide instance', () => {
  class Control extends Component {
    foo = 'bar';
  }

  render(
    <Control>
      <Consumer for={Control}>{(c) => c.foo}</Consumer>
    </Control>
  );

  expect(screen).toHaveText('bar');
});

it('will not enumerate react internals on instance', () => {
  class Control extends Component {
    foo = 'bar';
    baz = 123;
  }

  let instance!: Control;
  render(<Control is={(c) => (instance = c)} />);

  expect(Object.keys(instance).sort()).toEqual(['baz', 'foo']);
});

it('will create instance only once', () => {
  class Control extends Component {
    protected new() {
      didConstruct(this);
    }
  }

  const didConstruct = vi.fn();
  const { rerender } = render(<Control />);

  expect(didConstruct).toBeCalled();

  rerender(<Control />);

  expect(didConstruct).toBeCalledTimes(1);
});

it('will call is method on creation', () => {
  class Control extends Component {}

  const didCreate = vi.fn();

  const screen = render(<Control is={didCreate} />);

  expect(didCreate).toBeCalled();

  screen.rerender(<Control is={didCreate} />);
  expect(didCreate).toBeCalledTimes(1);

  act(screen.unmount);
});

it('will transition Component dispatch', async () => {
  const gate = mockPromise<void>();

  class Control extends Component {
    value = 'a';

    render() {
      if (this.value === 'b') throw gate;
      return <span>{this.value}</span>;
    }
  }

  let instance!: Control;
  let setLocal!: React.Dispatch<React.SetStateAction<string>>;

  function View() {
    const [local, update] = React.useState('a');
    setLocal = update;

    return <>{local}<Control is={(current) => void (instance = current)} /></>;
  }

  const view = render(
    <Suspense fallback={<i>loading</i>}>
      <View />
    </Suspense>
  );

  await act(async () => {
    pending(() => {
      setLocal('b');
      instance.value = 'b';
    });
    await Promise.resolve();
  });

  // Local state updates urgently - pending() scopes to mvc-driven updates - while
  // the Component holds its own content rather than suspending to fallback.
  expect(view.container.querySelector('i')).toBeNull();
  expect(view.container.textContent).toBe('ba');

  instance.value = 'c';
  gate.resolve();
  await act(async () => {});

  expect(view.container.textContent).toBe('bc');
});

it('will not commit mixed revisions across repeated placement', async () => {
  let scheduled = false;

  class Control extends Component {
    revision = 1;

    render() {
      const { revision } = this;
      const started = performance.now();

      while (performance.now() - started < 1) {}

      if (!scheduled) {
        scheduled = true;
        setTimeout(() => {
          this.revision = 2;
        });
      }

      return <span>{revision}</span>;
    }
  }

  const instance = Control.new();
  const commits: number[][] = [];
  let reveal!: () => void;

  function Placements() {
    const root = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
      commits.push(
        [...root.current!.querySelectorAll('span')].map((node) =>
          Number(node.textContent)
        )
      );
    });

    return (
      <div ref={root}>
        {Array.from({ length: 40 }, (_, index) => (
          <div key={index}>{instance}</div>
        ))}
      </div>
    );
  }

  function App() {
    const [shown, setShown] = React.useState(false);
    reveal = () => React.startTransition(() => setShown(true));
    return shown && <Placements />;
  }

  const view = render(<App />);
  reveal();

  await waitFor(() => {
    expect(view.container.querySelectorAll('span')).toHaveLength(40);
  });

  expect(new Set(commits[0]).size).toBe(1);
});

describe('ref prop', () => {
  it('will populate ref object with instance', () => {
    class Control extends Component {
      foo = 'bar';
    }

    const ref = React.createRef<Control>();
    const screen = render(<Control ref={ref} />);

    expect(ref.current).toBeInstanceOf(Control);
    expect(ref.current!.foo).toBe('bar');

    act(screen.unmount);
    expect(ref.current).toBe(null);
  });

  it('will invoke callback ref with instance', () => {
    class Control extends Component {}

    const cb = vi.fn();
    const screen = render(<Control ref={cb} />);

    expect(cb).toBeCalled();
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Control);

    act(screen.unmount);
    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[1][0]).toBe(null);
  });
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = vi.fn();

    class Test extends Component {
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

describe('mount method', () => {
  it('will call once on commit', () => {
    const didMount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
      }
    }

    const element = render(<Test />);

    expect(didMount).toBeCalledTimes(1);

    element.rerender(<Test />);

    expect(didMount).toBeCalledTimes(1);
  });

  it('will run returned callback on unmount', () => {
    const didUnmount = vi.fn();

    class Test extends Component {
      mount() {
        return didUnmount;
      }
    }

    const element = render(<Test />);

    expect(didUnmount).not.toBeCalled();

    element.unmount();

    expect(didUnmount).toBeCalledTimes(1);
  });

  it('will not repeat under strict mode', () => {
    const didMount = vi.fn();
    const didUnmount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
        return didUnmount;
      }
    }

    const element = render(<Test />, { reactStrictMode: true });

    expect(didMount).toBeCalledTimes(1);

    element.unmount();

    expect(didUnmount).toBeCalledTimes(1);
  });

  it('will not call during server render', () => {
    const didMount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
      }

      render() {
        return <span>hello</span>;
      }
    }

    expect(renderToString(<Test />)).toContain('<span>hello</span>');
    expect(didMount).not.toBeCalled();
  });
});

describe('use method', () => {
  it('will throw if called as a hook', () => {
    class Test extends Component {}

    expect(() => (Test as any).use()).toThrow(
      'Test is a Component - render as an element instead of calling use().'
    );
  });
});

describe('element props', () => {
  class Foo extends Component {
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

  it('will only offer settable members as JSX props', () => {
    class Bar extends Component {
      value = 0;
      onClick = () => {};
      readonly id = 1;
      get computed() { return this.value * 2 }
    }

    render(<Bar value={1} onClick={() => {}} />);

    // @ts-expect-error - get-only accessor is not a settable prop
    (() => <Bar computed={4} />);

    // @ts-expect-error - readonly field is not a settable prop
    (() => <Bar id={2} />);
  });

  it('will trigger set instruction', () => {
    class Foo extends Component {
      value = set('foobar', didSet);
    }

    const didSet = vi.fn();

    render(<Foo value="barfoo" />);

    expect(didSet).toBeCalled();
  });

  it('will override method', async () => {
    class Test extends Component {
      callback() {
        return 'foo';
      }

      render() {
        return <span>{this.callback()}</span>;
      }
    }

    const element = render(<Test callback={() => 'bar'} />);
    expect(screen).toHaveText('bar');

    element.rerender(<Test callback={() => 'baz'} />);
    expect(screen).toHaveText('baz');
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
    class Control extends Component {
      foo = 'bar';
    }

    const screen = render(
      <Control foo="sd">
        <span>Hello</span>
        <span>World</span>
      </Control>
    );

    expect(screen).toHaveText('Hello');
    expect(screen).toHaveText('World');
  });

  it('will notify parent', async () => {
    class Control extends Component {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = vi.fn();
    const screen = render(<Control>Hello</Control>);

    expect(screen).toHaveText('Hello');
    expect(didUpdate).toBeCalled();
  });

  it('will accept arbitrary children with render', () => {
    const symbol = Symbol('foo');

    class Control extends Component {
      render(props = {} as { children: symbol }) {
        expect(props.children).toBe(symbol);
        return 'Hello';
      }
    }

    const screen = render(<Control>{symbol}</Control>);

    expect(screen).toHaveText('Hello');
  });
});

describe('props property', () => {
  it('will update on rerender', () => {
    class Control extends Component {
      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);
    expect(screen).toHaveText('foo');

    rerender(<Control value="bar" />);
    expect(screen).toHaveText('bar');
  });

  it('will be observable', async () => {
    const didUpdate = vi.fn();

    class Control extends Component {
      protected new() {
        this.get(({ props }, keys) => {
          didUpdate(props);
        });
      }

      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);

    expect(didUpdate).toBeCalledWith({ value: 'foo' });

    await act(async () => {
      rerender(<Control value="bar" />);
    });

    expect(didUpdate).toBeCalledWith({ value: 'bar' });
    expect(didUpdate).toBeCalledTimes(2);
  });

  it('will not cause redundant render', async () => {
    const didRender = vi.fn();
    let control: Control;

    class Control extends Component {
      new() {
        control = this;
      }

      render(props = {} as { value: string }) {
        didRender();
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);

    expect(didRender).toBeCalled();

    rerender(<Control value="bar" />);

    await expect(control!).toHaveUpdated();

    expect(didRender).toBeCalledTimes(2);
  });
});

describe('render method', () => {
  it('will be element output', () => {
    class Control extends Component {
      foo = 'bar';

      render(props = {} as { bar: string }) {
        return (
          <>
            <span>{props.bar}</span>
            <span>{this.foo}</span>
          </>
        );
      }
    }

    const screen = render(<Control bar="foo" />);

    expect(screen).toHaveText('foo');
    expect(screen).toHaveText('bar');
  });

  it('will accept function component', async () => {
    function FunctionComponent(
      this: ClassComponent,
      props = {} as { name: string }
    ) {
      return (
        <div>
          {this.salutation} {props.name}
        </div>
      );
    }

    class ClassComponent extends Component {
      salutation = 'Hello';
      render = FunctionComponent;
    }

    const screen = render(<ClassComponent name="World" />);

    expect(screen).toHaveText('Hello World');

    screen.rerender(<ClassComponent salutation="Bonjour" name="React" />);

    expect(screen).toHaveText('Bonjour React');
  });

  it('will ignore children not handled', () => {
    class Control extends Component {
      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const screen = render(
      // render declares props but no children, so children should be rejected
      // @ts-expect-error
      <Control value="Goodbye">Hello</Control>
    );

    expect(screen).toHaveText('Goodbye');
    expect(screen).not.toHaveText('Hello');
  });

  it('will accept all-optional render props', () => {
    type ControlProps = {
      base?: string;
      children?: React.ReactNode;
    };

    class Control extends Component {
      render(props: ControlProps = {}) {
        return <>{props.base || props.children}</>;
      }
    }

    const screen = render(<Control base="home" />);

    expect(screen).toHaveText('home');
  });

  it('will handle children if managed by this', () => {
    class Control extends Component {
      children = set<React.ReactNode>();

      render(props = {} as { value: string }) {
        return (
          <>
            <span>{props.value}</span>
            {this.children}
          </>
        );
      }
    }

    const screen = render(<Control value="Hello">World</Control>);

    expect(screen).toHaveText('Hello');
    expect(screen).toHaveText('World');
  });

  it('will refresh on update', async () => {
    class Control extends Component {
      value = 'bar';

      render() {
        return <span>{this.value}</span>;
      }
    }

    let control: Control;
    const screen = render(<Control is={(x) => (control = x)} />);

    expect(screen).toHaveText('bar');

    await act(async () => {
      control.value = 'foo';
      await control.set();
    });

    expect(screen).toHaveText('foo');
  });
});

describe('suspense', () => {
  it('will render fallback property', async () => {
    class Foo extends Component {
      fallback = (<span>Loading...</span>);
      value = set<string>();
    }

    let foo!: Foo;
    const Consumer = () => (foo = Foo.get()).value;

    const element = render(
      <Foo>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading...');

    await act(async () => (foo.value = 'Hello World'));

    expect(element).toHaveText('Hello World');
  });

  it('will fallback when own render suspends', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
      render() {
        return this.value;
      }
    }

    let foo!: Foo;

    const element = render(<Foo is={(x) => (foo = x)} />);

    expect(element).toHaveText('Loading!');

    await act(async () => {
      foo.value = 'Hello World';
    });

    expect(element).toHaveText('Hello World');
  });

  it('will use fallback property first', async () => {
    class Foo extends Component {
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

    expect(element).toHaveText('Loading!');

    element.rerender(
      <Foo fallback={<span>Loading...</span>}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
    });

    expect(element).toHaveText('Hello World');
  });

  it('fallback === false opts out of the boundary, bubbling to an ancestor', async () => {
    const ready = mockPromise<void>();
    let done = false;
    ready.then(() => { done = true; });
    const Slow = () => {
      if (!done) throw ready;
      return <span>Hello World</span>;
    };

    class Transparent extends Component {
      fallback = false as const; // Suspense-transparent: no own boundary
    }

    const element = render(
      <React.Suspense fallback={<span>OUTER</span>}>
        <Transparent>
          <Slow />
        </Transparent>
      </React.Suspense>
    );

    // own boundary opted out -> child suspension bubbles to the ancestor
    expect(element).toHaveText('OUTER');

    await act(async () => { ready.resolve(); });

    expect(element).toHaveText('Hello World');
  });

  it('default boundary catches its own subtree (control for opt-out)', () => {
    const Slow = () => { throw new Promise<void>(() => {}); }; // never resolves

    class Own extends Component {
      fallback = (<span>INNER</span>);
    }

    const element = render(
      <React.Suspense fallback={<span>OUTER</span>}>
        <Own>
          <Slow />
        </Own>
      </React.Suspense>
    );

    // own boundary catches - never reaches OUTER
    expect(element).toHaveText('INNER');
  });

  it('will update with new fallback', async () => {
    class Foo extends Component {
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

    expect(element).toHaveText('Loading!');

    await act(async () => {
      foo.fallback = <span>Loading...</span>;
      await flushMicrotasks();
    });

    expect(element).toHaveText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
      await flushMicrotasks();
    });

    expect(element).toHaveText('Hello World');
  });
});

describe('unmount', () => {
  for (const reactStrictMode of [false, true])
    it('will dispose instance' + (reactStrictMode ? ' (strict)' : ''), () => {
      const didDispose = vi.fn();

      class Control extends Component {
        protected new() {
          return didDispose;
        }
      }

      const element = render(<Control />, { reactStrictMode });

      expect(didDispose).not.toBeCalled();

      element.unmount();

      expect(didDispose).toBeCalled();
    });
});

describe('state props on rerender', () => {
  it('will update instance value', () => {
    class Control extends Component {
      value = 'initial';

      render() {
        return <span>{this.value}</span>;
      }
    }

    const element = render(<Control value="first" />);

    expect(screen).toHaveText('first');

    element.rerender(<Control value="second" />);

    expect(screen).toHaveText('second');
  });

  it('will clear omitted instance value', () => {
    class Control extends Component {
      value?: string = 'initial';

      render() {
        return <span>{this.value || 'empty'}</span>;
      }
    }

    const element = render(<Control value="first" />);

    expect(screen).toHaveText('first');

    element.rerender(<Control />);

    expect(screen).toHaveText('empty');
  });

  it('will ignore update after instance destroyed', async () => {
    class Control extends Component {
      value = 'foo';

      render() {
        return <span>{this.value}</span>;
      }
    }

    let instance!: Control;
    const view = render(<Control value="bar" is={(c) => (instance = c)} />);

    expect(screen).toHaveText('bar');

    await act(async () => instance.set(null));

    view.rerender(<Control value="baz" />);

    expect(screen).toHaveText('bar');
  });

});

describe('default render', () => {
  it('will pass children through', () => {
    class Control extends Component {}

    render(
      <Control>
        <span>Hello World</span>
      </Control>
    );

    expect(screen).toHaveText('Hello World');
  });

  it('will provide instance created', () => {
    class Parent extends Component {
      value = 'foobar';
    }
    const Child = () => Parent.get().value;

    const element = render(
      <Parent>
        <Child />
      </Parent>
    );

    expect(element).toHaveText('foobar');
  });
});

describe('render chain', () => {
  it('will compose subclass render as children of super', () => {
    class Outer extends Component {
      render(props = {} as { children?: React.ReactNode }) {
        return (
          <main>
            <h1>Wrapper</h1>
            {props.children}
          </main>
        );
      }
    }

    class Inner extends Outer {
      render() {
        return <span>Content</span>;
      }
    }

    const element = render(<Inner />);

    // Inner authors content via render; Outer orchestration still wraps it,
    // without Inner calling super.render().
    const heading = element.getByText('Wrapper');
    const content = element.getByText('Content');

    expect(heading.tagName).toBe('H1');
    expect(content.closest('main')).toBe(heading.closest('main'));
  });

  it('will compose three levels inner to outer', () => {
    class A extends Component {
      render(props = {} as { children?: React.ReactNode }) {
        return <div data-a>{props.children}</div>;
      }
    }

    class B extends A {
      render(props = {} as { children?: React.ReactNode }) {
        return <section data-b>{props.children}</section>;
      }
    }

    class C extends B {
      render() {
        return <span data-c>Leaf</span>;
      }
    }

    const { container } = render(<C />);

    // A (outermost) > B > C (innermost content).
    const a = container.querySelector('[data-a]')!;
    const b = a.querySelector('[data-b]')!;
    const c = b.querySelector('[data-c]')!;

    expect(c.textContent).toBe('Leaf');
  });

  it('will stay reactive across composed levels', async () => {
    class Frame extends Component {
      title = 'Base';

      render(props = {} as { children?: React.ReactNode }) {
        return (
          <article>
            <h2>{this.title}</h2>
            {props.children}
          </article>
        );
      }
    }

    class Page extends Frame {
      body = 'Hello';

      render() {
        return <p>{this.body}</p>;
      }
    }

    let instance!: Page;
    render(<Page is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Base');
    expect(screen).toHaveText('Hello');

    // Both the super's and the subclass's reactive reads drive updates.
    await act(async () => {
      instance.title = 'Updated';
      instance.body = 'World';
    });

    expect(screen).toHaveText('Updated');
    expect(screen).toHaveText('World');
  });

  it('will drop derived content if wrapper omits children', () => {
    // Documented footgun: an intermediate render is a wrapper - if it does not
    // place props.children, the derived (subclass) content vanishes.
    class Shell extends Component {
      render() {
        return <div>Shell only</div>;
      }
    }

    class Lost extends Shell {
      render() {
        return <span>Never seen</span>;
      }
    }

    const element = render(<Lost />);

    expect(element).toHaveText('Shell only');
    expect(element).not.toHaveText('Never seen');
  });

  it('will preserve identity for single-level override', () => {
    // The universal case: a single override composes with Component's
    // pass-through default, so output is exactly the subclass render.
    class Solo extends Component {
      render() {
        return <span>Just me</span>;
      }
    }

    const { container } = render(<Solo />);

    expect(container.innerHTML).toBe('<span>Just me</span>');
  });
});

describe('subcomponents', () => {
  const error = mockError();

  it('will render last values after owner destroyed', async () => {
    class Control extends Component {
      value = 'foo';

      Inner() {
        return <span>{this.value}</span>;
      }

      render() {
        return <this.Inner />;
      }
    }

    let instance!: Control;
    const view = render(<Control is={(c) => (instance = c)} />);

    expect(screen).toHaveText('foo');

    await act(async () => instance.set(null));

    view.rerender(<Control />);

    expect(screen).toHaveText('foo');
    expect(error).not.toBeCalled();
  });

  it('will render from owner not yet activated', () => {
    class Control extends Component {
      value = 'foo';

      Sidebar() {
        return <span>{this.value}</span>;
      }
    }

    const control = new Control({});

    render(<control.Sidebar />);

    expect(screen).toHaveText('foo');
  });

  it('will wrap PascalCase method as reactive component', async () => {
    class Dashboard extends Component {
      label = 'Hello';

      Sidebar() {
        return <span>{this.label}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    expect(screen).toHaveText('Updated');
  });

  it('will be accessible via context get', () => {
    class Dashboard extends Component {
      Sidebar() {
        return <span>Sidebar Content</span>;
      }

      render() {
        return this.props.children;
      }
    }

    const Child = () => {
      const { Sidebar } = Dashboard.get();
      return <Sidebar />;
    };

    render(
      <Dashboard>
        <Child />
      </Dashboard>
    );

    expect(screen).toHaveText('Sidebar Content');
  });

  it('will work with assigned function', async () => {
    class Dashboard extends Component {
      Sidebar(): React.ReactNode {
        return null;
      }

      // for coverage
      Ignore = 3;

      render() {
        return <this.Sidebar />;
      }
    }

    class MyDashboard extends Dashboard {
      content = 'value';
      Sidebar = Sidebar;

      new() {
        dashboard = this;
      }
    }

    function Sidebar(this: MyDashboard) {
      return <span>Sidebar {this.content}</span>;
    }

    let dashboard!: MyDashboard;

    render(<MyDashboard />);

    expect(screen).toHaveText('Sidebar value');

    await act(async () => {
      dashboard.content = 'updated';
    });

    expect(screen).toHaveText('Sidebar updated');
  });

  it('will work with function assigned in constructor', async () => {
    class Dashboard extends Component {
      Sidebar(): React.ReactNode {
        return null;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    function Sidebar(this: Defined) {
      return <span>Sidebar {this.content}</span>;
    }

    class Defined extends Dashboard {
      content = 'value';
      Sidebar = Sidebar;
    }

    class Assigned extends Dashboard {
      content = 'value';

      constructor(props: {}) {
        super(props);
        this.Sidebar = Sidebar as any;
      }
    }

    for (const Type of [Defined, Assigned]) {
      let instance!: Defined;

      const { unmount } = render(
        <Type is={(x) => (instance = x as Defined)} />
      );

      expect(screen).toHaveText('Sidebar value');

      await act(async () => {
        instance.content = 'updated';
      });

      expect(screen).toHaveText('Sidebar updated');
      unmount();
    }
  });

  it('will work with function assigned after activation', async () => {
    class Dashboard extends Component {
      content = 'value';

      Sidebar(): React.ReactNode {
        return null;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;

    render(
      <Dashboard
        is={(x) => {
          instance = x;
          x.Sidebar = function (this: Dashboard) {
            return <span>Sidebar {this.content}</span>;
          };
        }}
      />
    );

    expect(screen).toHaveText('Sidebar value');

    await act(async () => {
      instance.content = 'updated';
    });

    expect(screen).toHaveText('Sidebar updated');
  });

  it('will allow override via setter', async () => {
    class Dashboard extends Component {
      value = 'Original';

      Sidebar() {
        return <span>{this.value}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Original');

    await act(async () => {
      instance.Sidebar = function (this: Dashboard) {
        return <span>Replaced: {this.value}</span>;
      } as any;
      instance.value = 'yes';
    });

    expect(screen).toHaveText('Replaced: yes');
  });

  it('will inherit from parent class', () => {
    class Base extends Component {
      Header() {
        return <span>Header</span>;
      }
    }

    class Page extends Base {
      render() {
        return <this.Header />;
      }
    }

    render(<Page />);

    expect(screen).toHaveText('Header');
  });

  it('will compose elements from subclass', () => {
    class Base extends Component {
      Before(): React.ReactNode {
        return null;
      }

      After(): React.ReactNode {
        return null;
      }

      render() {
        return (
          <>
            <this.Before />
            <span>Main</span>
            <this.After />
          </>
        );
      }
    }

    class Page extends Base {
      Before() {
        return <span>Header</span>;
      }

      After() {
        return <span>Footer</span>;
      }
    }

    const element = render(<Page />);

    expect(element).toHaveText('Header');
    expect(element).toHaveText('Main');
    expect(element).toHaveText('Footer');
  });

  it('will accept props', () => {
    class Dashboard extends Component {
      Sidebar(props: { label: string }) {
        return <span>{props.label}</span>;
      }

      render() {
        return <this.Sidebar label="Dynamic Label" />;
      }
    }

    render(<Dashboard />);

    expect(screen).toHaveText('Dynamic Label');
  });

  it('will work in strict mode', async () => {
    class Dashboard extends Component {
      label = 'Hello';

      Sidebar() {
        return <span>{this.label}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    const element = render(
      <React.StrictMode>
        <Dashboard is={(x) => (instance = x)} />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(screen).toHaveText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    expect(screen).toHaveText('Updated');

    element.unmount();
  });

  it('will render usages independently', async () => {
    const renders = { a: 0, b: 0 };

    class Dashboard extends Component {
      label = 'Hello';

      Sidebar(props: { id: 'a' | 'b' }) {
        renders[props.id]++;
        return (
          <span>
            {props.id}: {this.label}
          </span>
        );
      }

      render() {
        return (
          <>
            <this.Sidebar id="a" />
            <this.Sidebar id="b" />
          </>
        );
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('a: Hello');
    expect(screen).toHaveText('b: Hello');

    await act(async () => {
      instance.label = 'World';
    });

    expect(screen).toHaveText('a: World');
    expect(screen).toHaveText('b: World');
    expect(renders.a).toBeGreaterThan(1);
    expect(renders.b).toBeGreaterThan(1);
  });

  it('will refresh independently based on subscriptions', async () => {
    const renders = { a: 0, b: 0 };

    class Dashboard extends Component {
      x = 'x';
      y = 'y';

      Display(props: { which: 'a' | 'b' }) {
        renders[props.which]++;
        return <span>{props.which === 'a' ? this.x : this.y}</span>;
      }

      render() {
        return (
          <>
            <this.Display which="a" />
            <this.Display which="b" />
          </>
        );
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('x');
    expect(screen).toHaveText('y');

    const before = { ...renders };

    await act(async () => {
      instance.x = 'x2';
    });

    expect(screen).toHaveText('x2');
    expect(screen).toHaveText('y');

    // only the "a" instance should have re-rendered
    expect(renders.a).toBe(before.a + 1);
    expect(renders.b).toBe(before.b);
  });
});

describe('strict mode', () => {
  it('will not create two instances', async () => {
    const didCreate = vi.fn();
    const didDestroy = vi.fn();

    class Control extends Component {
      foo = 'bar';

      new() {
        didCreate();
        return didDestroy;
      }
    }

    const element = render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();

    element.unmount();

    expect(didDestroy).toBeCalledTimes(1);
  });

  it('will refresh via property update', async () => {
    const didRender = vi.fn();
    let instance!: Control;

    class Control extends Component {
      foo = 'bar';

      new() {
        instance = this;
      }

      render() {
        didRender(this.foo);
        return <span>{this.foo}</span>;
      }
    }

    const element = render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(screen).toHaveText('bar');

    await act(async () => {
      instance.foo = 'baz';
    });

    expect(screen).toHaveText('baz');
    expect(didRender).toBeCalledWith('baz');

    await act(async () => {
      instance.foo = 'qux';
    });

    expect(screen).toHaveText('qux');
    expect(didRender).toBeCalledWith('qux');

    element.unmount();
  });

  it('will refresh via props update', async () => {
    const didRender = vi.fn();

    class Control extends Component {
      foo = 'bar';

      render() {
        didRender(this.foo);
        return <span>{this.foo}</span>;
      }
    }

    const { rerender } = render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(screen).toHaveText('bar');
    didRender.mockClear();

    rerender(
      <React.StrictMode>
        <Control foo="baz" />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(screen).toHaveText('baz');
    expect(didRender).toBeCalledWith('baz');
  });

  it('will survive define-semantics field clobber', async () => {
    const didAttemptConstruct = vi.fn();

    class Control extends Component {
      foo = 'foo';

      constructor(props: any, ...rest: any[]) {
        didAttemptConstruct();
        super(props, ...rest);
      }
    }

    let instance!: Control;
    const element = render(
      <React.StrictMode>
        <Control is={(is) => (instance = is)} />
      </React.StrictMode>
    );

    expect(didAttemptConstruct).toBeCalledTimes(2);

    const effect = vi.fn();
    instance.get(($) => {
      effect($.foo);
    });

    expect(effect).toBeCalledWith('foo');
    instance.foo = 'bar';

    await instance.set();

    expect(effect).toBeCalledWith('bar');

    element.unmount();
  });

  it('will construct twice then init once', async () => {
    const order: string[] = [];

    class Control extends Component {
      constructor(props: any, ...rest: any[]) {
        super(props, ...rest);
        order.push('construct');
      }
    }

    Control.on(() => {
      order.push('init');
    });

    const element = render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(order).toEqual(['construct', 'construct', 'init']);

    element.unmount();
  });
});
