import { watch, Observable } from './observable';
import { set } from './instruction/set';
import { use } from './instruction/use';
import { mockError, vi, describe, it, expect, mockPromise } from '../vitest';
import { State } from './state';

describe('effect', () => {
  it('will cleanup safely while suspended', async () => {
    let shouldSuspend = true;
    const pending = mockPromise();

    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const done = watch(test, () => {
      if (shouldSuspend) {
        shouldSuspend = false;
        throw pending;
      }

      return null;
    });

    expect(done).not.toThrow();

    pending.resolve();
    await pending;
  });

  it('will run after properties', () => {
    const mock = vi.fn();

    class Test extends State {
      property = use((_key, _state, state) => {
        this.get(() => mock(state));
      });

      foo = 1;
      bar = 2;
    }

    Test.new();

    expect(mock).toBeCalledWith({ foo: 1, bar: 2 });
  });

  it('will enforce values if required', () => {
    class Test extends State {
      property?: string = undefined;
    }

    const test = Test.new('ID');
    const attempt = () => {
      watch(
        test,
        ($) => {
          expect<string>($.property);
        },
        true
      );
    };

    expect(attempt).toThrow(`ID.property is required in this context.`);
  });

  it('will still get events after silent ones', async () => {
    class Test extends State {
      value1 = 1;
      value2 = 2;
    }

    const test = Test.new();
    const didGetValue = vi.fn();

    test.get(($) => {
      didGetValue($.value1, $.value2);
    });

    expect(didGetValue).toBeCalledWith(1, 2);

    test.set({ value1: 10 }, true);
    test.set({ value2: 20 });

    await expect(test).toHaveUpdated();

    expect(didGetValue).toBeCalledWith(10, 20);
    expect(didGetValue).toBeCalledTimes(2);
  });

  it('will cleanup nested effects', async () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    const test = Test.new();
    const didInvoke = vi.fn();

    const done = watch(test, ({ foo }) => {
      watch(test, ({ bar }) => {
        didInvoke({ foo, bar });
      });
    });

    expect(didInvoke).toBeCalledTimes(1);
    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 2 });

    await test.set({ bar: 3 });

    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 3 });

    await test.set({ foo: 2, bar: 4 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 4 });
    expect(didInvoke).not.toBeCalledWith({ foo: 1, bar: 4 });

    await test.set({ bar: 2 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 2 });

    done();

    await test.set({ bar: 1 });

    expect(didInvoke).not.toBeCalledWith({ foo: 2, bar: 1 });
    expect(didInvoke).toBeCalledTimes(4);
  });

  it('will ignore circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const didUpdate = vi.fn();
    const test = Test.new();

    watch(test, ({ foo, bar }) => {
      didUpdate(foo, bar);
      test.bar = foo;
    });

    expect(didUpdate).toBeCalledTimes(1);
    expect(didUpdate).toBeCalledWith(1, undefined);

    // is syncronously 1 after effect did run.
    expect(test.bar).toBe(1);

    // flush events to check if effect updates.
    await expect(test).toHaveUpdated('bar');
    expect(didUpdate).not.toBeCalledWith(1, 1);

    test.foo = 2;
    await expect(test).toHaveUpdated('foo');
    expect(didUpdate).toBeCalledWith(2, 1);

    expect(didUpdate).toBeCalledTimes(2);
    expect(test.bar).toBe(2);

    test.foo = 3;
    await expect(test).toHaveUpdated('foo');

    expect(didUpdate).toBeCalledTimes(3);
    expect(test.bar).toBe(3);
  });

  it('will ignore circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const didUpdate = vi.fn();
    const test = Test.new();

    watch(test, ({ foo, bar }) => {
      didUpdate(foo, bar);
      test.bar = foo;
    });

    expect(didUpdate).toBeCalledTimes(1);
    expect(didUpdate).toBeCalledWith(1, undefined);

    // is syncronously 1 after effect did run.
    expect(test.bar).toBe(1);

    // flush events to check if effect updates.
    await expect(test).toHaveUpdated('bar');
    expect(didUpdate).not.toBeCalledWith(1, 1);

    test.foo = 2;
    await expect(test).toHaveUpdated('foo');
    expect(didUpdate).toBeCalledWith(2, 1);

    expect(didUpdate).toBeCalledTimes(2);
    expect(test.bar).toBe(2);

    test.foo = 3;
    await expect(test).toHaveUpdated('foo');

    expect(didUpdate).toBeCalledTimes(3);
    expect(test.bar).toBe(3);
  });

  it('will override circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const test = Test.new();

    watch(test, ({ foo, bar = 0 }) => {
      test.bar = foo + bar;
    });

    expect(test.bar).toBe(1);

    test.bar = 2;
    expect(test.bar).toBe(2);

    await expect(test).toHaveUpdated('bar');
    expect(test.bar).toBe(3);
  });
});

describe('suspense', () => {
  it('will seem to throw error outside react', () => {
    class Test extends State {
      value = set<never>();
    }

    const instance = Test.new('ID');
    let didThrow: Error | undefined;

    try {
      void instance.value;
    } catch (err: any) {
      didThrow = err;
    }

    expect(String(didThrow)).toMatchInlineSnapshot(
      `"Error: ID.value is not yet available."`
    );
  });

  it('will reject if state destroyed before resolved', async () => {
    class Test extends State {
      value = set<never>();
    }

    const instance = Test.new('ID');
    let didThrow: Promise<any> | undefined;

    try {
      void instance.value;
    } catch (err: any) {
      didThrow = err;
    }

    instance.set(null);

    await expect(didThrow).rejects.toThrow(`ID is destroyed.`);
  });
});

describe('errors', () => {
  const error = mockError();

  it('will throw sync error to the console', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();

    test.set(() => {
      throw new Error('sync error');
    });

    const attempt = () => (test.value = 2);

    expect(attempt).toThrow(`sync error`);
  });

  it('will log async error to the console', async () => {
    class Test extends State {
      value = 1;
    }

    const expected = new Error('async error');
    const test = Test.new();

    test.get(($) => {
      if ($.value == 2) throw expected;
    });

    test.value = 2;

    await expect(test).toHaveUpdated();

    expect(error).toBeCalledWith(expected);
  });
});

describe('observable', () => {
  it.each(['', ' (returning)'])('will update effect%s', async (returns) => {
    class MyObservable implements Observable {
      value = 'foo';
      watch?: Observable.Callback = undefined;

      [Observable](onUpdate: Observable.Callback) {
        this.watch = onUpdate;
        if (returns) return this;
      }

      async update(value: string) {
        this.value = value;
        if (this.watch) return this.watch();
      }
    }

    class Test extends State {
      observable = new MyObservable();
    }

    const mock = vi.fn();
    const test = Test.new();

    test.get(($) => {
      mock($.observable.value);
    });

    expect(mock).toBeCalledWith('foo');

    await test.observable.update('bar');

    expect(mock).toBeCalledWith('bar');
    expect(mock).toBeCalledTimes(2);
  });
});
