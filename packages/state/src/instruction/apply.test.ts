import { vi, describe, it, expect } from '../../vitest';
import { State } from '../state';
import { apply } from './apply';

describe('instruction', () => {
  it('will run on create', () => {
    class Test extends State {
      property = apply((key) => {
        didApply(key);
      });
    }

    const didApply = vi.fn();

    Test.new();

    expect(didApply).toBeCalledWith('property');
  });

  describe('symbol', () => {
    it('will use unique symbol as placeholder', async () => {
      class Test extends State {
        value = apply(() => ({ value: 1 })) as unknown;
      }

      const test = new Test();

      if (typeof test.value !== 'symbol')
        throw new Error('value is not a symbol');
      else expect(test.value.description).toMatch(/instruction-\w{6}/);

      await test.set();

      expect(test.value).toBe(1);
    });

    it('will be deleted prior to instruction', () => {
      class Test extends State {
        value = apply(() => {
          expect('value' in this).toBe(false);
        });
      }

      Test.new();
    });

    it('will ignore normal symbol', () => {
      class Test extends State {
        value = Symbol('hello');
      }

      const test = Test.new();

      expect(typeof test.value).toBe('symbol');
    });
  });

  describe('getter', () => {
    it('will run upon access', () => {
      const mockAccess = vi.fn((_subscriber: State) => 'foobar');

      class Test extends State {
        property = apply(() => ({ get: mockAccess }));
      }

      const instance = Test.new();

      expect(mockAccess).not.toBeCalled();
      expect(instance.property).toBe('foobar');
      expect(mockAccess).toBeCalledWith(instance);
    });

    it('will pass subscriber if within one', () => {
      const didGetValue = vi.fn();

      class Test extends State {
        property = apply(() => ({ get: didGetValue }));
      }

      const state = Test.new();

      state.get((own) => {
        void own.property;
      });

      expect(didGetValue).toBeCalledWith(expect.any(Test));
    });

    it('will not throw suspense if get (required) is false', async () => {
      class Test extends State {
        value = apply(() => ({ get: false }));
      }

      const test = Test.new('ID');
      const effect = vi.fn((test: Test) => void test.value);

      test.get(effect);
      test.value = 'foo';

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);
    });
  });

  describe('setter', () => {
    describe('boolean', () => {
      it('will reject update if false', () => {
        class Test extends State {
          value = apply(() => ({ set: false }));
        }

        const test = Test.new('ID');
        const assign = () => (test.value = 'foo');

        expect(assign).toThrow(`ID.value is read-only.`);
      });
    });

    describe('function', () => {
      it('will ignore update if callback throws false', async () => {
        const setValue = vi.fn((value) => {
          if (value == 'ignore') throw false;
        });

        class Test extends State {
          property = apply(() => ({
            value: 'foobar',
            set: setValue
          }));
        }

        const test = Test.new();

        expect(test.property).toBe('foobar');

        test.property = 'test';
        expect(setValue).toBeCalledWith('test', 'foobar');
        expect(test.property).toBe('test');
        await expect(test).toHaveUpdated();

        test.property = 'ignore';
        expect(setValue).toBeCalledWith('ignore', 'test');
        expect(test.property).toBe('test');
        await expect(test).not.toHaveUpdated();
      });

      // duplicate test?
      it('will reject update if throws false', async () => {
        let ignore = false;

        class Test extends State {
          property = apply(() => ({
            value: 0,
            set: () => {
              if (ignore) throw false;
            }
          }));
        }

        const instance = Test.new();

        expect(instance.property).toBe(0);

        instance.property = 10;
        expect(instance.property).toBe(10);
        await expect(instance).toHaveUpdated();

        ignore = true;

        instance.property = 0;
        expect(instance.property).toBe(10);
        await expect(instance).not.toHaveUpdated();
      });

      it('will not update twice on reassignment', () => {
        class Test extends State {
          property = apply<string>(() => ({
            value: 'foobar',
            set: (value) => value + '!'
          }));
        }

        const test = Test.new();
        const didUpdate = vi.fn();

        test.set(didUpdate);

        expect(test.property).toBe('foobar');

        test.property = 'test';

        expect(test.property).toBe('test!');
        expect(didUpdate).toBeCalledTimes(1);
      });
    });
  });

  describe('cleanup', () => {
    it('will call cleanup function on destroy', () => {
      const cleanup = vi.fn();

      class Test extends State {
        property = apply(() => cleanup);
      }

      const test = Test.new();
      expect(cleanup).not.toBeCalled();

      test.set(null);
      expect(cleanup).toBeCalled();
    });

    it('will call config destroy on destroy', () => {
      const destroy = vi.fn();

      class Test extends State {
        property = apply(() => ({
          value: 'hello',
          destroy
        }));
      }

      const test = Test.new();
      expect(test.property).toBe('hello');
      expect(destroy).not.toBeCalled();

      test.set(null);
      expect(destroy).toBeCalled();
    });
  });
});
