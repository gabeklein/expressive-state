import { describe, expect, it, vi } from 'vitest';

import { State } from '../state';
import { put } from './put';
import { ref } from './ref';

describe('put', () => {
  it('will store value on instance', () => {
    class Test extends State {
      value = put('foo');
    }

    const test = Test.new();

    expect(test.value).toBe('foo');

    test.value = 'bar';

    expect(test.value).toBe('bar');
  });

  it('will be undefined without initial value', () => {
    class Test extends State {
      value = put<string>();
    }

    const test = Test.new();

    expect(test.value).toBeUndefined();
  });

  it('will not trigger update', async () => {
    class Test extends State {
      managed = 1;
      opaque = put(1);
    }

    const test = Test.new();

    test.opaque = 2;

    await expect(test).not.toHaveUpdated();

    test.managed = 2;

    await expect(test).toHaveUpdated('managed');
  });

  it('will not notify effect on write', async () => {
    class Test extends State {
      managed = 1;
      opaque = put(1);
    }

    const test = Test.new();
    const effect = vi.fn((self: Test) => void [self.managed, self.opaque]);

    test.get(effect);
    expect(effect).toBeCalledTimes(1);

    test.opaque = 2;
    await test.set();

    expect(effect).toBeCalledTimes(1);

    test.managed = 2;
    await test.set();

    expect(effect).toBeCalledTimes(2);
  });

  it('will exclude from snapshot and iteration', () => {
    class Test extends State {
      managed = 1;
      opaque = put(2);
    }

    const test = Test.new();

    expect(test.get()).toEqual({ managed: 1 });
    expect([...test]).toEqual([['managed', 1]]);
    expect(Object.keys(test)).not.toContain('opaque');
  });

  it('will exclude from ref proxy', () => {
    class Test extends State {
      managed = 1;
      opaque = put(2);
    }

    const test = Test.new();

    class Refs extends State {
      to = ref(test);
    }

    const refs = Refs.new().to as Record<string, unknown>;

    expect(refs.managed).toBeInstanceOf(Function);
    expect(refs.opaque).toBeUndefined();
  });

  it('will write after destroy', () => {
    class Test extends State {
      managed = 1;
      opaque = put<number>();
    }

    const test = Test.new();

    test.set(null);

    expect(() => (test.managed = 2)).toThrowError(
      `Tried to update ${test}.managed but state is destroyed.`
    );

    test.opaque = 2;

    expect(test.opaque).toBe(2);
  });

  it('will apply from constructor argument', () => {
    class Test extends State {
      opaque = put('foo');
    }

    const test = Test.new({ opaque: 'bar' });

    expect(test.opaque).toBe('bar');
  });

  it('will apply from set overlay', async () => {
    class Test extends State {
      managed = 1;
      opaque = put('foo');
    }

    const test = Test.new();

    test.set({ opaque: 'bar' });

    expect(test.opaque).toBe('bar');
    await expect(test).not.toHaveUpdated();
  });

  it('will not be reactive if subclass overrides', async () => {
    class Test extends State {
      value = put(1);
    }

    class Subclass extends Test {
      value = 2;
    }

    const test = Subclass.new();

    test.value = 3;

    await expect(test).toHaveUpdated('value');
  });
});
