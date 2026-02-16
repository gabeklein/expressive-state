import { act, render, renderHook, waitFor } from '@testing-library/preact';

import { get, State, Provider, set } from '.';
import { expect, describe, it, vi } from '../vitest';

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
        return <Provider for={Type}>{props.children}</Provider>;
      }
    });
  }

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

    await act(async () => {
      await test.set({ foo: 'bar' });
    });

    expect(hook.result.current).toBe('bar');
    expect(didRender).toBeCalledTimes(2);
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
  });
});
