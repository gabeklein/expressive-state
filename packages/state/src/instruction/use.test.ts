import { vi, describe, it, expect } from '../../vitest';
import { State } from '../state';
import { use } from './use';

describe('instruction', () => {
  it('will run on create', () => {
    class Test extends State {
      property = use((key) => {
        didRunInstruction(key);
      });
    }

    const didRunInstruction = vi.fn();

    Test.new();

    expect(didRunInstruction).toBeCalledWith('property');
  });

  describe('symbol', () => {
    it('will use unique symbol as placeholder', async () => {
      class Test extends State {
        value = use(() => ({ value: 1 })) as unknown;
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
        value = use(() => {
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
      const mockAccess = vi.fn((_subscriber) => 'foobar');
      const mockApply = vi.fn((_key) => mockAccess);

      class Test extends State {
        property = use(mockApply);
      }

      const instance = Test.new();

      expect(mockApply).toBeCalledWith('property', expect.any(Test), {});
      expect(mockAccess).not.toBeCalled();

      expect(instance.property).toBe('foobar');
      expect(mockAccess).toBeCalledWith(instance);
    });

    it('will pass subscriber if within one', () => {
      const didGetValue = vi.fn();

      class Test extends State {
        property = use(() => didGetValue);
      }

      const state = Test.new();

      state.get((own) => {
        void own.property;
      });

      expect(didGetValue).toBeCalledWith(expect.any(Test));
    });

    it('will not throw suspense if get (required) is false', async () => {
      class Test extends State {
        value = use(() => ({ get: false }));
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
    it('will reject update if false', () => {
      class Test extends State {
        value = use(() => ({ set: false }));
      }

      const test = Test.new('ID');
      const assign = () => (test.value = 'foo');

      expect(assign).toThrow(`ID.value is read-only.`);
    });

    it('will prevent update if returns false', async () => {
      const didSetValue = vi.fn((newValue) => {
        if (newValue == 'ignore') return false;
      });

      class Test extends State {
        property = use(() => {
          return {
            value: 'foobar',
            set: didSetValue
          };
        });
      }

      const test = Test.new();

      expect(test.property).toBe('foobar');

      test.property = 'test';
      expect(didSetValue).toBeCalledWith('test', 'foobar');
      expect(test.property).toBe('test');
      await expect(test).toHaveUpdated();

      test.property = 'ignore';
      expect(didSetValue).toBeCalledWith('ignore', 'test');
      expect(test.property).toBe('test');
      await expect(test).not.toHaveUpdated();
    });

    // duplicate test?
    it('will revert update if returns false', async () => {
      let ignore = false;

      class Test extends State {
        property = use(() => {
          return {
            value: 0,
            set: (value) => (ignore ? false : () => value + 10)
          };
        });
      }

      const instance = Test.new();

      expect(instance.property).toBe(0);

      instance.property = 10;
      expect(instance.property).toBe(20);
      await expect(instance).toHaveUpdated();

      ignore = true;

      instance.property = 0;
      expect(instance.property).toBe(20);
      await expect(instance).not.toHaveUpdated();
    });

    it('will not duplicate explicit update', () => {
      class Test extends State {
        property = use<string>(() => ({
          value: 'foobar',
          set: (value) => () => value + '!'
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

    it('will not update on reassignment', () => {
      class Test extends State {
        property = use<string>((key) => ({
          value: 'foobar',
          set: (value: any) => {
            return () => value + '!';
          }
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

