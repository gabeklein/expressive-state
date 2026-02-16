import {
  vi,
  describe,
  it,
  expect,
  mockWarn,
  mockPromise,
  mockError
} from '../../vitest';
import { State } from '../state';
import { set } from './set';

const warn = mockWarn();

it('will be enumerable', () => {
  class Test extends State {
    value = set('foo');
  }

  const test = Test.new();

  expect(Object.keys(test)).toContain('value');
});

describe('placeholder', () => {
  class Test extends State {
    foobar = set<string>();
  }

  it('will suspend if value is accessed before assign', async () => {
    const instance = Test.new();
    const promise = mockPromise<string>();
    const mockEffect = vi.fn((state: Test) => {
      promise.resolve(state.foobar);
    });

    instance.get(mockEffect);

    expect(mockEffect).toBeCalledTimes(1);

    instance.foobar = 'foo!';

    const result = await promise;

    expect(mockEffect).toBeCalledTimes(2);
    expect(result).toBe('foo!');
  });

  it('will resolve suspense after latest value', async () => {
    const test = Test.new();
    const foobar = vi.fn();
    const effect = vi.fn((state: Test) => {
      foobar(state.foobar);
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
    expect(foobar).not.toBeCalled();

    test.foobar = 'foo';
    test.foobar = 'bar';

    await expect(test).toHaveUpdated('foobar');

    expect(effect).toBeCalledTimes(2);
    expect(foobar).not.toBeCalledWith('foo');
    expect(foobar).toBeCalledWith('bar');
  });

  it('will not suspend if value is defined', async () => {
    const instance = Test.new();

    instance.foobar = 'bar!';

    const mockEffect = vi.fn((state: Test) => {
      expect(state.foobar).toBe('bar!');
    });

    instance.get(mockEffect);
    expect(mockEffect).toBeCalledTimes(1);
  });
});

describe('callback', () => {
  it('will invoke callback on property assign', async () => {
    class Subject extends State {
      test = set<number>(1, (value) => {
        didAssign(value + 1);
      });
    }

    const state = Subject.new();
    const didAssign = vi.fn();
    const didUpdate = vi.fn();

    expect(didAssign).not.toBeCalled();

    state.set(didUpdate, 'test');
    state.test = 2;

    expect(didUpdate).toBeCalledTimes(1);
    expect(didAssign).toBeCalledWith(3);
  });

  // TODO: this is not implemented yet
  it.skip('will invoke callback on set assignment', async () => {
    const didAssign = vi.fn();

    class Subject extends State {
      test = set<number>(1, didAssign);
    }

    const state = Subject.new();

    state.set({ test: 2 });

    expect(didAssign).toBeCalledWith(1);
  });

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends State {
      test = set<number>(1, () => {
        return () => {
          callback(true);
        };
      });
    }

    const callback = vi.fn();
    const state = Subject.new();

    state.test = 2;

    await expect(state).toHaveUpdated();
    expect(callback).not.toBeCalled();
    state.test = 3;

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith(true);
  });

  it('will assign a default value', async () => {
    class Subject extends State {
      test = set('foo', (value) => {
        callback(value);
      });
    }

    const callback = vi.fn();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
  });

  it('will ignore effect promise', () => {
    class Subject extends State {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.new();

    expect(() => (state.property = 'bar')).not.toThrow();
  });

  it('will not suspend own property access', () => {
    class Subject extends State {
      property = set<string>(undefined, (_, previous) => {
        propertyWas = previous;
      });
    }

    const state = Subject.new();
    let propertyWas: string | undefined;

    state.property = 'bar';
    expect(propertyWas).toBe(undefined);

    state.property = 'foo';
    expect(propertyWas).toBe('bar');
  });

  it('will reset nested effects', async () => {
    class Subject extends State {
      name = 'World';

      hello = set('Hello', async (value) => {
        this.get(({ name }) => {
          effect(`${value} ${name}!`);
        });
      });
    }

    const effect = vi.fn();
    const state = Subject.new();

    state.hello = 'Hola';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Hola World!');

    state.hello = 'Bonjour';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour World!');

    state.name = 'Earth';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour Earth!');
    expect(effect).not.toBeCalledWith('Hola Earth!');
  });
});

describe('intercept', () => {
  it('will prevent update if callback returns false', async () => {
    class Subject extends State {
      test = set('foo', (value) => {
        callback(value);
        return false;
      });
    }

    const callback = vi.fn();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).not.toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
    expect(state.test).toBe('foo');
  });

  it('will not call prior cleanup if supressed', async () => {
    const cleanup = vi.fn();
    const setter = vi.fn((value: number) => {
      return value === 3 ? false : cleanup;
    });

    class Test extends State {
      value = set(1, setter);
    }

    const subject = Test.new();

    subject.value = 2;

    expect(setter).toBeCalledWith(2, 1);
    await expect(subject).toHaveUpdated();
    expect(subject.value).toBe(2);

    // this update will be supressed by setter
    subject.value = 3;

    expect(setter).toBeCalledWith(3, 2);
    await expect(subject).not.toHaveUpdated();
    expect(cleanup).not.toBeCalled();

    subject.value = 4;

    expect(setter).toBeCalledWith(4, 2);
    expect(cleanup).toBeCalledTimes(1);
    expect(cleanup).toBeCalledWith(4);
  });
});

describe('factory', () => {
  it('will accept a direct Promise initializer', async () => {
    const pending = mockPromise<string>();

    class Test extends State {
      value = set(pending);
    }

    const test = Test.new();

    try {
      void test.value;
    } catch (_err) {}

    pending.resolve('foo');
    await pending;

    expect(test.value).toBe('foo');
  });

  it('will ignore setter if assigned', () => {
    const getValue = vi.fn(() => 'foo');

    class Test extends State {
      value = set(getValue);
    }

    const test = Test.new();

    test.value = 'bar';

    expect(test).toHaveUpdated();
    expect(test.value).toBe('bar');
    expect(getValue).not.toBeCalled();
  });

  it('will compute when accessed', () => {
    const factory = vi.fn(() => 'Hello World');

    class Test extends State {
      value = set(factory);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();

    void test.value;

    expect(factory).toBeCalled();
  });

  it('will compute lazily', () => {
    const factory = vi.fn(() => 'Hello World');

    class Test extends State {
      value = set(factory, false);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();
    expect(test.value).toBe('Hello World');
    expect(factory).toBeCalledTimes(1);
  });

  it('will bind factory function to self', async () => {
    class Test extends State {
      // methods lose implicit this
      value = set(this.method);

      async method() {
        expect(this).toBe(instance);
      }
    }

    const instance = Test.new();
  });

  it('will warn and rethrow error from factory', () => {
    class Test extends State {
      memoized = set(this.failToGetSomething, true);

      failToGetSomething() {
        throw new Error('Foobar');
      }
    }

    const attempt = () => Test.new('ID');

    expect(attempt).toThrow('Foobar');
    expect(warn).toBeCalledWith(
      `Generating initial value for ID.memoized failed.`
    );
  });
});

describe('suspense', () => {
  it('will throw suspense-promise resembling an error', () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise, true);
    }

    const instance = Test.new('ID');

    expect(() => instance.value).toThrow(`ID.value is not yet available.`);
    promise.resolve();
  });

  it('will suspend on another pending set', async () => {
    const didEvaluate = vi.fn(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends State {
      value = set<string>();
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalledTimes(1);

    await test.set({ value: 'hello' });

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will suspend other set factories', async () => {
    const promise = mockPromise<string>();
    const didEvaluate = vi.fn(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends State {
      value = set(() => promise);
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalledTimes(1);

    promise.resolve('hello');
    await expect(test).toUpdate();

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will resolve when factory does', async () => {
    class Test extends State {
      value = set(async () => 'foobar', true);
    }

    const test = Test.new();

    expect(() => test.value).toThrow(expect.any(Promise));

    await expect(test).toUpdate(0);

    expect(test.value).toBe('foobar');
  });

  it('will not suspend where already resolved', async () => {
    class Test extends State {
      greet = set(async () => 'Hello', true);
      name = set(async () => 'World', true);

      value = set(() => this.greet + ' ' + this.name);
    }

    const test = Test.new();

    try {
      void test.value;
    } catch (error) {
      if (error instanceof Promise) await error;
      else throw error;
    }

    expect(() => test.value).not.toThrow();
  });

  it('will suspend if required while still pending', () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise, true);
    }

    const instance = Test.new();

    expect(() => instance.value).toThrow(expect.any(Promise));
    promise.resolve();
  });

  it('will be undefined if not required', async () => {
    const promise = mockPromise<string>();
    const mock = vi.fn();

    class Test extends State {
      value = set(() => promise, false);
    }

    const test = Test.new();

    test.get(($) => mock($.value));
    expect(mock).toBeCalledWith(undefined);

    promise.resolve('foobar');
    await expect(test).toUpdate(0);

    expect(mock).toBeCalledWith('foobar');
  });

  it('will suspend another factory', async () => {
    const salute = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = vi.fn(function (this: Test) {
      return this.greet + ' ' + this.name;
    });

    class Test extends State {
      greet = set(() => salute, true);
      name = set(() => name, true);

      value = set(didEvaluate, true);
    }

    const test = Test.new();

    test.get(($) => void $.value);

    salute.resolve('Hello');
    await expect(test).toUpdate(0);

    name.resolve('World');
    await expect(test).toUpdate(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will suspend another factory (async)', async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = vi.fn(async function (this: Test) {
      return this.greet + ' ' + this.name;
    });

    class Test extends State {
      greet = set(() => greet, true);
      name = set(() => name, true);
      value = set(didEvaluate, true);
    }

    const test = Test.new();

    test.get(($) => void $.value);

    greet.resolve('Hello');
    await expect(test).toUpdate(0);

    name.resolve('World');
    await expect(test).toUpdate(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will nest suspense', async () => {
    const promise = mockPromise<string>();
    const didUpdate = mockPromise<string>();

    class Child extends State {
      value = set(() => promise, true);
    }

    class Test extends State {
      child = new Child();

      childValue = set(() => {
        return this.child.value + ' world!';
      }, true);
    }

    const test = Test.new();
    const effect = vi.fn((state: Test) => {
      didUpdate.resolve(state.childValue);
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
    expect(effect).not.toHaveReturned();

    promise.resolve('hello');

    await expect(didUpdate).resolves.toBe('hello world!');
    expect(effect).toBeCalledTimes(2);
  });

  it('will return undefined on nested suspense', async () => {
    const promise = mockPromise<string>();

    class Test extends State {
      asyncValue = set(() => promise, true);

      value = set(() => `Hello ${this.asyncValue}`, false);
    }

    const test = Test.new();

    expect(test.value).toBeUndefined();

    promise.resolve('World');
    await expect(test).toUpdate();

    expect(test.value).toBe('Hello World');
  });

  it('will squash repeating suspense', async () => {
    let pending = mockPromise();
    let suspend = true;

    const compute = vi.fn(() => {
      if (suspend) throw pending;

      return `OK I'm unblocked.`;
    });

    class Test extends State {
      message = set(compute, true);
    }

    const test = Test.new();
    const didEvaluate = mockPromise<string>();

    const effect = vi.fn((state: Test) => {
      didEvaluate.resolve(state.message);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(effect).not.toHaveReturned();
    expect(compute).toBeCalledTimes(1);

    pending.resolve();
    pending = mockPromise();

    // TODO: why does this not work when `.set(0)` is used?
    await test.set();

    // expect eval to run again because promise resolved.
    expect(compute).toBeCalledTimes(2);

    suspend = false;
    pending.resolve();
    await didEvaluate;

    expect(test.message).toBe("OK I'm unblocked.");
    expect(compute).toBeCalledTimes(3);
    expect(effect).toBeCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  });

  it('will squash multiple dependancies', async () => {
    const promise = mockPromise<number>();
    const promise2 = mockPromise<number>();

    class Test extends State {
      a = set(() => promise, true);
      b = set(() => promise2, true);

      sum = set(this.getSum);

      getSum() {
        const { a, b } = this;

        return `Answer is ${a + b}.`;
      }
    }

    const test = Test.new();

    const effect = vi.fn((state: Test) => void state.sum);

    test.get(effect);

    expect(effect).toBeCalled();

    promise.resolve(10);
    await expect(test).toUpdate();

    expect(effect).toBeCalledTimes(1);

    promise2.resolve(20);
    await expect(test).toUpdate();

    expect(test.sum).toBe('Answer is 30.');
    expect(effect).toBeCalledTimes(2);
  });

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise, true);
    }

    const instance = Test.new();
    let didThrow: Promise<unknown> | undefined;

    instance.get((state) => {
      try {
        void state.value;
      } catch (err: any) {
        didThrow = err;

        if (err instanceof Promise) throw err;
      }
    });

    expect(didThrow).toBeInstanceOf(Promise);

    promise.reject('oh no');
    await new Promise((res) => setTimeout(res, 10));

    expect(didThrow).toBe('oh no');
  });
});

describe('factory with callback overload', () => {
  it('calls callback after factory resolves', async () => {
    const callback = vi.fn();
    class Test extends State {
      value = set(() => 'computed', callback);
    }
    const test = Test.new();
    expect(test.value).toBe('computed');
    expect(callback).toBeCalledWith('computed', undefined);
  });

  it('calls callback after async factory resolves', async () => {
    const callback = vi.fn();
    class Test extends State {
      value = set(async () => {
        await new Promise((res) => setTimeout(res, 10));
        return 'asyncValue';
      }, callback);
    }
    const test = Test.new();
    // Should throw a promise first (suspense)
    let threw: Promise<unknown> | undefined;
    try {
      void test.value;
    } catch (e) {
      threw = e as Promise<unknown>;
    }
    expect(threw).toBeInstanceOf(Promise);
    // Wait for promise to resolve
    await threw;
    expect(test.value).toBe('asyncValue');
    expect(callback).toBeCalledWith('asyncValue', undefined);
  });

  it('will callback if set before factory run', () => {
    const callback = vi.fn();
    class Test extends State {
      value = set(async () => 'something', callback);
    }
    const test = Test.new();

    test.value = 'setBefore';
    expect(test.value).toBe('setBefore');
    expect(callback).toBeCalledWith('setBefore', undefined);

    test.value = 'setAfter';
    expect(test.value).toBe('setAfter');
    expect(callback).toBeCalledWith('setAfter', 'setBefore');
  });
});

it('supports Promise objects as factory return', async () => {
  const resolve = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve('foobar');
    }, 0);
  });

  class Test extends State {
    value = set(() => resolve);
  }

  const test = Test.new();
  let threw: Promise<string> | undefined;

  try {
    expect<string>(test.value);
  } catch (e) {
    threw = e as Promise<string>;
  }

  await expect(threw).resolves.toBe('foobar');
  expect(test.value).toBe('foobar');
});

describe('compute mode', () => {
  it('will cleanup source subscription when source is destroyed', async () => {
    class Source extends State {
      value = 1;
    }

    class Subject extends State {
      source = new Source();

      computed = set(this.source, (source) => source.value);
    }

    const subject = Subject.new();

    expect(subject.computed).toBe(1);

    expect(() => subject.source.set(null)).not.toThrow();
    expect(subject.computed).toBe(1);
  });

  it('will reevaluate when inputs change', async () => {
    class Subject extends State {
      seconds = 0;

      minutes = set(this, (state) => {
        return Math.floor(state.seconds / 60);
      });
    }

    const subject = Subject.new();

    subject.seconds = 30;

    await expect(subject).toHaveUpdated();

    expect(subject.seconds).toEqual(30);
    expect(subject.minutes).toEqual(0);

    subject.seconds = 60;

    await expect(subject).toHaveUpdated();

    expect(subject.seconds).toEqual(60);
    expect(subject.minutes).toEqual(1);
  });

  it('will trigger when nested inputs change', async () => {
    class Subject extends State {
      child = new Child();
      nested = set(this, (state) => {
        return state.child.value;
      });
    }

    class Child extends State {
      value = 'foo';
    }

    const subject = Subject.new();

    expect(subject.nested).toBe('foo');

    subject.child.value = 'bar';

    await expect(subject).toHaveUpdated();
    expect(subject.nested).toBe('bar');

    subject.child = new Child();

    await expect(subject).toHaveUpdated();
    expect(subject.child.value).toBe('foo');
    expect(subject.nested).toBe('foo');
  });

  it('will compute early if value is accessed', async () => {
    class Test extends State {
      number = 0;
      plusOne = set(this, (state) => {
        const value = state.number + 1;
        didCompute(value);
        return value;
      });
    }

    const didCompute = vi.fn();
    const test = Test.new();

    expect(test.plusOne).toBe(1);

    test.number++;

    // not accessed; compute will wait for frame
    expect(didCompute).not.toBeCalledWith(2);

    // does compute eventually
    await expect(test).toHaveUpdated();
    expect(didCompute).toBeCalledWith(2);
    expect(test.plusOne).toBe(2);

    test.number++;

    // sanity check
    expect(didCompute).not.toBeCalledWith(3);

    // accessing value now will force compute
    expect(test.plusOne).toBe(3);
    expect(didCompute).toBeCalledWith(3);

    // update should still occur
    await expect(test).toHaveUpdated();
  });

  it('will be squashed with regular updates', async () => {
    const exec = vi.fn();
    const emit = vi.fn();

    class Inner extends State {
      value = 1;
    }

    class Test extends State {
      a = 1;
      b = 1;

      c = set(this, (state) => {
        exec();
        return state.a + state.b + state.x.value;
      });

      // sanity check; multi-source updates do work
      x = new Inner();
    }

    const test = Test.new();

    expect(test.c).toBe(3);
    expect(exec).toBeCalledTimes(1);

    test.set(emit);

    test.a++;
    expect(emit).toBeCalledTimes(1);
    expect(emit).toBeCalledWith('a', test);

    test.b++;

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(3);
    expect(emit).toBeCalledWith('b', test);
    expect(emit).toBeCalledWith('c', test);

    test.x.value++;

    await expect(test).toHaveUpdated();

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(3);
    expect(emit).toBeCalledWith('c', test);
  });

  it('will be evaluated in order', async () => {
    let didCompute: string[] = [];

    class Ordered extends State {
      X = 1;

      A = set(this, (state) => {
        const value = state.X;
        didCompute.push('A');
        return value;
      });

      B = set(this, (state) => {
        const value = state.A + 1;
        didCompute.push('B');
        return value;
      });

      C = set(this, (state) => {
        const value = state.X + state.B + 1;
        didCompute.push('C');
        return value;
      });

      D = set(this, (state) => {
        const value = state.A + state.C + 1;
        didCompute.push('D');
        return value;
      });
    }

    const test = Ordered.new();

    // initialize D, should cascade to dependancies
    expect(test.D).toBe(6);

    // should evaluate in order, by use
    expect(didCompute).toMatchObject(['A', 'B', 'C', 'D']);

    // empty computed
    didCompute = [];

    // change value of X, will trigger A & C;
    test.X = 2;

    await expect(test).toHaveUpdated();

    // should evaluate by prioritiy
    expect(didCompute).toMatchObject(['A', 'B', 'C', 'D']);
  });

  describe('failures', () => {
    const error = mockError();
    const warn = mockWarn();

    class Subject extends State {
      never = set(this, () => {
        throw new Error();
      });
    }

    it('will warn if throws', () => {
      const state = Subject.new();
      const attempt = () => state.never;

      expect(attempt).toThrow();
      expect(warn).toBeCalledWith(
        `An exception was thrown while initializing ${state}.never.`
      );
    });

    it('will warn if throws on update', async () => {
      class Test extends State {
        shouldFail = false;

        value = set(this, (state) => {
          if (state.shouldFail) throw new Error();
          else return undefined;
        });
      }

      const state = Test.new();

      void state.value;
      state.shouldFail = true;

      await expect(state).toHaveUpdated();

      expect(warn).toBeCalledWith(
        `An exception was thrown while refreshing ${state}.value.`
      );
      expect(error).toBeCalled();
    });

    it('will throw if source is another instruction', () => {
      class Test extends State {
        peer = set(this, () => 'foobar');

        value = set(this.peer, () => {});
      }

      expect(() => Test.new('ID')).toThrow(
        `Attempted to use an instruction result (probably use or get) as computed source for ID.value. This is not allowed.`
      );
    });
  });

  describe('circular', () => {
    it('will access own previous value', async () => {
      class Test extends State {
        multiplier = 0;
        previous: number | undefined | null = null;

        value = set(this, (state) => {
          const { value, multiplier } = state;

          // use set to bypass subscriber
          this.previous = value;

          return Math.ceil(Math.random() * 10) * multiplier;
        });
      }

      const test = Test.new();

      // shouldn't exist until getter's side-effect
      expect(test.previous).toBe(null);

      const initial = test.value;

      // will start at 0 because of multiple
      expect(initial).toBe(0);

      // should now exist but be undefined (initial get)
      expect('previous' in test).toBe(true);
      expect(test.previous).toBe(undefined);

      // change upstream value to trigger re-compute
      test.multiplier = 1;
      await expect(test).toHaveUpdated();

      // getter should see current value while producing new one
      expect(test.previous).toBe(initial);
      expect(test.value).not.toBe(initial);
    });

    it('will not trigger itself', async () => {
      const didGetOldValue = vi.fn();
      const didGetNewValue = vi.fn();

      class Test extends State {
        input = 1;
        value = set(this, (state) => {
          const { input, value } = state;

          didGetOldValue(value);

          return input + 1;
        });
      }

      const test = Test.new();

      test.get((state) => {
        didGetNewValue(state.value);
      });

      expect(test.value).toBe(2);
      expect(didGetNewValue).toBeCalledWith(2);
      expect(didGetOldValue).toBeCalledWith(undefined);

      test.input = 2;

      expect(test.value).toBe(3);
      expect(didGetOldValue).toBeCalledWith(2);

      await expect(test).toHaveUpdated();
      expect(didGetNewValue).toBeCalledWith(3);
      expect(didGetOldValue).toBeCalledTimes(2);
    });
  });

  describe('method', () => {
    it('will create computed via factory', async () => {
      class Test extends State {
        foo = 1;
        bar = set(true, this.getBar);

        getBar() {
          return 1 + this.foo;
        }
      }

      const test = Test.new();

      expect(test.bar).toBe(2);

      test.foo++;

      await expect(test).toHaveUpdated();
      expect(test.bar).toBe(3);
    });

    it('will run a method bound to instance', async () => {
      class Hello extends State {
        friend = 'World';

        greeting = set(true, this.generateGreeting);

        generateGreeting() {
          return `Hello ${this.friend}!`;
        }
      }

      const test = Hello.new();

      expect(test.greeting).toBe('Hello World!');

      test.friend = 'Foo';
      await expect(test).toHaveUpdated();

      expect(test.greeting).toBe('Hello Foo!');
    });

    it('will use top-most method of class', () => {
      class Test extends State {
        foo = 1;
        bar = set(true, this.getBar);

        getBar() {
          return 1 + this.foo;
        }
      }

      class Test2 extends Test {
        getBar() {
          return 2 + this.foo;
        }
      }

      const test = Test2.new();

      expect(test.bar).toBe(3);
    });

    it('will provide key and self to factory', () => {
      const factory = vi.fn<(key: string, test: Test) => 'foo'>(() => 'foo');

      class Test extends State {
        fooBar = set(true, factory);
      }

      const test = Test.new();

      expect(test.fooBar).toBe('foo');
      expect(factory).toBeCalledWith('fooBar', expect.any(Test));
    });

    it('will subscribe from self argument', async () => {
      class Test extends State {
        foo = 'foo';

        fooBar = set(true, (key: string, self: Test) => {
          return self.foo;
        });
      }

      const test = Test.new();

      expect(test.fooBar).toBe('foo');

      test.foo = 'bar';
      await expect(test).toHaveUpdated();

      expect(test.foo).toBe('bar');
    });
  });
});
