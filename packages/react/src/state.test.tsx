import { renderHook, waitFor } from '@testing-library/react';
import { Suspense } from 'react';

import { get, State, Provider, set } from '.';
import {
  vi,
  expect,
  it,
  describe,
  act,
  render,
  screen,
  afterEach,
  afterAll
} from '../vitest';

describe('State.use', () => {
  class Test extends State {
    value = 'foo';
  }

  describe('hook', () => {
    it('will create instance given a class', () => {
      const hook = renderHook(() => Test.use());

      expect(hook.result.current).toBeInstanceOf(Test);
    });

    it('will subscribe to instance of controller', async () => {
      const willRender = vi.fn();
      const { result } = renderHook(() => {
        willRender();
        return Test.use();
      });

      expect(result.current.value).toBe('foo');
      expect(willRender).toBeCalledTimes(1);

      result.current.value = 'bar';

      await waitFor(() => {
        expect(willRender).toBeCalledTimes(2);
      });

      expect(result.current.value).toBe('bar');
    });

    it('will assign `is` as a circular reference', async () => {
      const { result } = renderHook(() => Test.use());

      expect(result.current.value).toBe('foo');

      await act(async () => {
        result.current.is.value = 'bar';
      });

      expect(result.current.value).toBe('bar');
    });

    it('will run callback', () => {
      const callback = vi.fn();

      renderHook(() => Test.use(callback));

      expect(callback).toBeCalledWith(expect.any(Test));
    });

    it('will destroy instance of given class', async () => {
      const didDestroy = vi.fn();

      class Test extends State {
        constructor() {
          super();
          this.get(null, didDestroy);
        }
      }

      const Component = () => void Test.use();

      const rendered = render(<Component />);

      rendered.unmount();

      expect(didDestroy).toBeCalled();
    });

    it('will ignore updates after unmount', async () => {
      const hook = renderHook(() => {
        const test = Test.use();
        void test.value;
        return test.is;
      });

      await act(async () => {
        hook.result.current.value = 'bar';
      });

      hook.unmount();

      expect(() => {
        hook.result.current.value = 'baz';
      }).toThrow();
    });

    it('will bind methods to instance', async () => {
      class Test extends State {
        current = 0;

        action() {
          this.current++;
        }
      }

      const hook = renderHook(() => {
        const { action, current } = Test.use();

        action();

        return current;
      });

      expect(hook.result.current).toBe(0);

      hook.rerender();

      expect(hook.result.current).toBe(1);

      hook.unmount();
    });
  });

  describe('new method', () => {
    it('will call if exists', () => {
      const didCreate = vi.fn();

      class Test extends State {
        protected new() {
          didCreate();
        }
      }

      const element = renderHook(() => Test.use());

      expect(didCreate).toBeCalled();

      element.rerender();

      expect(didCreate).toBeCalledTimes(1);
    });
  });

  describe('use method', () => {
    it('will call every render if present', () => {
      const didUse = vi.fn();

      class Test extends State {
        use() {
          didUse();
        }
      }

      const element = renderHook(() => Test.use());

      expect(didUse).toBeCalledTimes(1);

      element.rerender();

      expect(didUse).toBeCalledTimes(2);
    });

    it('will receive arguments', () => {
      const didUse = vi.fn();

      class Test extends State {
        use(foo: string, bar: number) {
          didUse(foo, bar);
        }
      }

      renderHook(() => Test.use('hello', 123));

      expect(didUse).toBeCalledWith('hello', 123);
    });

    it('will divert arguments from constructor', () => {
      const didUse = vi.fn();

      class Test extends State {
        value = 0;
      }

      class Test2 extends Test {
        use(props: { value: number }) {
          didUse(props);
          expect(this.value).not.toBe(props.value);
        }
      }

      const test = renderHook(() => Test.use({ value: 42 }));
      const test2 = renderHook(() => Test2.use({ value: 42 }));

      expect(test.result.current.value).toBe(42);
      expect(test2.result.current.value).not.toBe(42);
      expect(didUse).toBeCalledWith({ value: 42 });
    });

    it('will enforce signature', () => {
      class Test extends State {
        use(foo: string, bar: number) {}
      }

      void function test() {
        // @ts-expect-error
        Test.use();
      };
    });
  });

  describe('callback argument', () => {
    class Test extends State {
      foo?: string = undefined;
      bar?: string = undefined;
    }

    it('will run callback once', async () => {
      const callback = vi.fn();
      const hook = renderHook(() => Test.use(callback));

      expect(callback).toBeCalledTimes(1);

      hook.rerender(() => Test.use(callback));

      expect(callback).toBeCalledTimes(1);
    });

    it('will run argument before effects', () => {
      const effect = vi.fn();
      const argument = vi.fn(() => {
        expect(effect).not.toBeCalled();
      });

      class Test extends State {
        constructor(...args: State.Args) {
          super(args);
          this.get(effect);
        }
      }

      renderHook(() => {
        Test.use(argument);
      });

      expect(argument).toBeCalled();
      expect(effect).toBeCalled();
    });
  });

  describe('props argument', () => {
    class Test extends State {
      foo?: string = undefined;
      bar?: string = undefined;
    }

    it('will apply props to state', async () => {
      const mockExternal = {
        foo: 'foo',
        bar: 'bar'
      };

      const didRender = vi.fn();

      const hook = renderHook(() => {
        didRender();
        return Test.use(mockExternal);
      });

      expect(hook.result.current).toMatchObject(mockExternal);
    });

    it('will apply callback only once', async () => {
      const hook = renderHook(() => {
        return Test.use(() => ({ foo: 'foo', bar: 'bar' }));
      });

      expect(hook.result.current).toMatchObject({ foo: 'foo', bar: 'bar' });

      await expect(hook.result.current).not.toHaveUpdated();

      hook.rerender(() => {
        return Test.use({ foo: 'bar', bar: 'foo' });
      });

      await expect(hook.result.current).not.toHaveUpdated();

      await act(async () => {
        hook.result.current.foo = 'bar';
      });

      expect(hook.result.current.foo).toBe('bar');
    });

    it('will apply object every render', async () => {
      const hook = renderHook(
        ({ foo }) => {
          return Test.use({ foo, bar: 'bar' });
        },
        { initialProps: { foo: 'foo' } }
      );

      expect(hook.result.current).toMatchObject({ foo: 'foo', bar: 'bar' });

      hook.rerender({ foo: 'bar' });

      expect(hook.result.current.foo).toBe('bar');
    });

    it('will apply props over (untracked) arrow functions', () => {
      class Test extends State {
        foobar = () => 'Hello world!';
      }

      const mockExternal = {
        foobar: () => 'Goodbye cruel world!'
      };

      const hook = renderHook(() => {
        return Test.use(mockExternal);
      });

      const { foobar } = hook.result.current;

      expect(foobar).toBe(mockExternal.foobar);
    });

    it('will not apply props over methods', () => {
      class Test extends State {
        foobar() {
          return 'Hello world!';
        }
      }

      const mockProps = {
        foobar: () => 'Goodbye cruel world!'
      };

      const { result } = renderHook(() => {
        return Test.use(mockProps);
      });

      expect(result.current).not.toBe(mockProps.foobar);
    });

    it('will not trigger updates it caused', async () => {
      const didRender = vi.fn();
      const hook = renderHook(
        (props) => {
          didRender();
          return Test.use(props);
        },
        { initialProps: { foo: 'foo' } }
      );

      hook.rerender({ foo: 'bar' });

      expect(didRender).toBeCalledTimes(2);
    });

    it('will trigger set instruction', () => {
      const mock = vi.fn();

      class Test extends State {
        foo = set('foo', mock);
      }

      const { result } = renderHook(() => {
        return Test.use({ foo: 'bar' });
      });

      expect(result.current.foo).toBe('bar');
      expect(mock).toBeCalledWith('bar', 'foo');
    });
  });

  describe('context', () => {
    it('will attach before model init', () => {
      class Ambient extends State {
        foo = 'foo';
      }

      class Test extends State {
        ambient = get(Ambient);

        constructor() {
          super(() => {
            expect(this.ambient).toBeInstanceOf(Ambient);
          });
        }
      }

      const Element = () => {
        const test = Test.use();
        expect(test.ambient.foo).toBe('foo');
        return null;
      };

      render(
        <Provider for={Ambient}>
          <Element />
        </Provider>
      );
    });
  });
});

describe('State.get', () => {
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

  interface MockPromise<T> extends Promise<T> {
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
  }

  function mockPromise<T = void>() {
    const methods = {} as MockPromise<T>;
    const promise = new Promise((res, rej) => {
      methods.resolve = res;
      methods.reject = rej;
    }) as MockPromise<T>;

    return Object.assign(promise, methods);
  }

  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    // expect(error).not.toBeCalled();
    error.mockReset();
  });

  afterAll(() => error.mockClear());

  it('will fetch model', () => {
    class Test extends State {}

    const test = Test.new();
    const hook = renderWith(test, () => Test.get());

    expect(hook.result.current.is).toBe(test);
  });

  it('will refresh for values accessed', async () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');

    await act(async () => test.set({ foo: 'bar' }));

    expect(hook.result.current).toBe('bar');
    expect(didRender).toBeCalledTimes(2);
  });

  it('will not update on death event', async () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');
    test.set(null);

    expect(didRender).toBeCalledTimes(1);
  });

  it('will throw if not found', () => {
    class Test extends State {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(() => Test.get()).toThrow('Could not find Test in context.');
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will not throw if optional', () => {
    class Test extends State {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(Test.get(false)).toBeUndefined();
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will throw if expected value undefined', () => {
    class Test extends State {
      constructor() {
        super('ID');
      }
      value?: number = undefined;
    }

    renderWith(Test, () => {
      expect(() => {
        void Test.get(true).value;
      }).toThrow('ID.value is required in this context.');
    });
  });

  describe('computed', () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    it.todo('will suspend if factory does');

    it('will select and subscribe to subvalue', async () => {
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get((x) => x.foo);
      });

      expect(hook.result.current).toBe(1);

      await act(async () => test.set({ foo: 2 }));

      expect(hook.result.current).toBe(2);
    });

    it('will throw if instance not found', () => {
      class Test extends State {
        value = 1;
      }

      const useTest = vi.fn(() => {
        expect(() => Test.get((x) => x)).toThrow(
          `Could not find ${Test} in context.`
        );
      });

      renderHook(useTest);
      expect(useTest).toHaveReturned();
    });

    it('will compute output', async () => {
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get((x) => x.foo + x.bar);
      });

      expect(hook.result.current).toBe(3);

      await act(async () => test.set({ foo: 2 }));

      expect(hook.result.current).toBe(4);
    });

    it('will ignore updates with same result', async () => {
      const test = Test.new();
      const compute = vi.fn();
      const didRender = vi.fn();

      const hook = renderWith(test, () => {
        didRender();
        return Test.get((x) => {
          compute();
          void x.foo;
          return x.bar;
        });
      });

      expect(hook.result.current).toBe(2);
      expect(compute).toBeCalled();

      test.foo = 2;
      await expect(test).toHaveUpdated();

      // did attempt a second compute
      expect(compute).toBeCalledTimes(2);

      // compute did not trigger a new render
      expect(didRender).toBeCalledTimes(1);
      expect(hook.result.current).toBe(2);
    });

    it('will return null', () => {
      class Test extends State {}

      const test = Test.new();
      const rendered = renderWith(test, () => Test.get(() => null));

      expect(rendered.result.current).toBe(null);
    });

    it('will convert undefined to null', () => {
      const hook = renderWith(Test, () => {
        return Test.get(() => {});
      });

      expect(hook.result.current).toBe(null);
    });

    it('will disable updates if null returned', async () => {
      const factory = vi.fn(($: Test) => {
        void $.foo;
        return null;
      });

      const didRender = vi.fn(() => {
        return Test.get(factory);
      });

      const test = Test.new();
      const hook = renderWith(test, didRender);

      expect(didRender).toBeCalledTimes(1);
      expect(hook.result.current).toBe(null);

      test.foo = 2;

      await expect(test).toHaveUpdated();

      expect(factory).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(1);
    });

    it('will run initial callback syncronously', async () => {
      class Parent extends State {
        values = [] as string[];
      }

      type ChildProps = {
        value: string;
      };

      const Child = (props: ChildProps) =>
        Parent.get(($) => {
          didPushToValues();
          $.values = [...$.values, props.value];
          return null;
        });

      const parent = Parent.new();
      const didUpdateValues = vi.fn();
      const didPushToValues = vi.fn();

      parent.get((state) => {
        didUpdateValues(state.values.length);
      });

      render(
        <Provider for={parent}>
          <Child value="foo" />
          <Child value="bar" />
          <Child value="baz" />
        </Provider>
      );

      expect(didPushToValues).toBeCalledTimes(3);

      await expect(parent).toHaveUpdated();

      // Expect updates to have bunched up before new frame.
      expect(didUpdateValues).toBeCalledTimes(2);
      expect(didUpdateValues).toBeCalledWith(3);
    });
  });

  describe('force update', () => {
    class Test extends State {
      foo = 'bar';
    }

    it('will force a refresh', async () => {
      const didRender = vi.fn();
      const didEvaluate = vi.fn();
      let forceUpdate!: () => void;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          didEvaluate();
          forceUpdate = update;
        });
      });

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(1);

      await act(async () => {
        forceUpdate();
      });

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh without reevaluating', async () => {
      const didEvaluate = vi.fn();
      const didRender = vi.fn();
      let forceUpdate!: () => void;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          didEvaluate();
          forceUpdate = update;
          // return null to stop subscription.
          return null;
        });
      });

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(1);

      act(forceUpdate);

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh again after promise', async () => {
      const promise = mockPromise();
      const didRender = vi.fn();

      let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

      const { result } = renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect<null>(result.current).toBe(null);
      expect(didRender).toBeCalledTimes(1);

      await act(async () => {
        forceUpdate(promise);
      });

      expect(didRender).toBeCalledTimes(2);

      await act(async () => {
        promise.resolve();
      });

      expect(didRender).toBeCalledTimes(3);
    });

    it('will invoke async function', async () => {
      const promise = mockPromise();
      const didRender = vi.fn();

      let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(didRender).toBeCalledTimes(1);

      await act(async () => {
        forceUpdate(() => promise);
      });

      expect(didRender).toBeCalledTimes(2);

      await act(async () => {
        promise.resolve();
      });

      expect(didRender).toBeCalledTimes(3);
    });
  });

  describe('async', () => {
    class Test extends State {
      foo = 'bar';
    }

    it('will convert void to null', async () => {
      const promise = mockPromise<void>();

      const hook = renderWith(Test, () => {
        return Test.get(async () => promise);
      });

      await act(async () => promise.resolve(undefined));

      expect(hook.result.current).toBe(null);
    });

    it('will not subscribe to values', async () => {
      const promise = mockPromise<string>();

      const test = Test.new();
      const didRender = vi.fn();
      const hook = renderWith(test, () => {
        didRender();
        return Test.get(async ($) => {
          void $.foo;
          return promise;
        });
      });

      expect(didRender).toBeCalledTimes(1);
      expect(hook.result.current).toBe(null);

      await act(async () => {
        promise.resolve('foobar');
      });

      expect(didRender).toBeCalledTimes(2);
      expect(hook.result.current).toBe('foobar');

      test.foo = 'foo';
      await expect(test).toHaveUpdated();

      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh and throw if async rejects', async () => {
      class Test extends State {}

      const promise = mockPromise();
      const hook = renderWith(Test, () => {
        try {
          Test.get(async () => {
            await promise;
            throw 'oh no';
          });
        } catch (err: any) {
          return err;
        }
      });

      expect(hook.result.current).toBeUndefined();

      await act(async () => {
        promise.resolve();
      });

      expect(hook.result.current).toBe('oh no');
    });
  });

  describe('get instruction', () => {
    class Foo extends State {
      bar = get(Bar);
    }

    class Bar extends State {
      value = 'bar';
    }

    it('will attach peer from context', async () => {
      const bar = Bar.new();
      const hook = renderWith(bar, () => Foo.use().is.bar);

      expect(hook.result.current).toBe(bar);
    });

    it('will subscribe peer from context', async () => {
      const bar = Bar.new();
      const didRender = vi.fn();
      const hook = renderWith(bar, () => {
        didRender();
        return Foo.use().bar.value;
      });

      expect(hook.result.current).toBe('bar');

      await act(async () => {
        bar.value = 'foo';
        await bar.set();
      });

      expect(hook.result.current).toBe('foo');
      expect(didRender).toBeCalledTimes(2);
    });

    it('will return undefined if instance not found', () => {
      class Foo extends State {
        bar = get(Bar, false);
      }

      const hook = renderHook(() => Foo.use().bar);

      expect(hook.result.current).toBeUndefined();
    });

    it('will throw if instance not found', () => {
      class Foo extends State {
        bar = get(Bar);

        constructor() {
          super('ID');
        }
      }

      const tryToRender = () => renderHook(() => Foo.use());

      expect(tryToRender).toThrow(`Required Bar not found in context for ID.`);
    });

    it('will prefer parent over context', () => {
      class Parent extends State {
        child = new Child();
        value = 'foo';
      }

      class Child extends State {
        parent = get(Parent);
      }

      const { result } = renderWith(Parent, () => Parent.use().is);

      expect(result.current.child.parent).toBe(result.current);
    });
  });

  describe('set instruction', () => {
    describe('factory', () => {
      it('will suspend if function is async', async () => {
        const promise = mockPromise<string>();

        class Test extends State {
          value = set(() => promise, true);
        }

        const hook = renderWith(Test, () => {
          return Test.get().value;
        });

        expect(hook.result.current).toBe(null);

        await act(async () => {
          promise.resolve('hello');
        });

        expect(hook.result.current).toBe('hello');
      });

      it('will refresh and throw if async rejects', async () => {
        const promise = mockPromise();

        class Test extends State {
          value = set(() => promise, true);
        }

        const hook = renderWith(Test, () => {
          try {
            void Test.get().value;
          } catch (err: any) {
            if (err instanceof Promise) throw err;
            else return err;
          }
        });

        expect(hook.result.current).toBe(null);

        await act(async () => {
          promise.reject('oh no');
        });

        expect(hook.result.current).toBe('oh no');
      });
    });

    describe('placeholder', () => {
      it('will suspend if value not yet assigned', async () => {
        class Test extends State {
          foobar = set<string>();
        }

        const test = Test.new();
        const hook = renderWith(test, () => {
          return Test.get().foobar;
        });

        expect(hook.result.current).toBe(null);

        // expect refresh caused by update
        await act(async () => {
          test.foobar = 'foo!';
        });

        expect(hook.result.current).toBe('foo!');
      });

      it('will not suspend if already defined', async () => {
        class Test extends State {
          foobar = set<string>();
        }

        const test = Test.new();

        test.foobar = 'foo!';

        const hook = renderWith(test, () => {
          return Test.get().foobar;
        });
        expect(hook.result.current).toBe('foo!');
      });
    });
  });
});

describe('State.as', () => {
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
      constructor() {
        super();
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
});
