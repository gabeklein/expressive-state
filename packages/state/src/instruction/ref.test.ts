import { vi, describe, it, expect, afterEach } from '../../vitest';
import { State } from '../state';
import { ref } from './ref';
import { set } from './set';

describe('property', () => {
  it('will contain value from ref-object', async () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const state = Subject.new();

    state.ref.current = 'foobar';

    await expect(state).toHaveUpdated();
    expect(state.ref.current).toBe('foobar');
  });

  it('will reference parent', () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const state = Subject.new();

    expect(state.ref.is).toBe(state);
    expect(state.ref.key).toBe('ref');
  });

  it('will get value from ref-object', async () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const state = Subject.new();

    expect(state.ref.get()).toBeNull();

    state.ref.current = 'foobar';

    expect(state.ref.get()).toBe('foobar');
  });

  it('will subscribe from ref-object', async () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const state = Subject.new();
    const callback = vi.fn();

    state.ref.get(callback);

    expect(callback).not.toBeCalled();

    state.ref.current = 'foobar';

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith('foobar');
  });

  it('will watch "current" of property', async () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const state = Subject.new();
    const didCallback = vi.fn();

    state.set((key) => {
      if (key == 'ref') didCallback();
    });

    state.ref.current = 'foobar';

    await expect(state).toHaveUpdated();
    expect(didCallback).toBeCalledWith();
  });

  it('will invoke callback', async () => {
    const didTrigger = vi.fn();
    const didUpdate = vi.fn();

    class Subject extends State {
      ref = ref<string>(didTrigger);
    }

    const state = Subject.new();

    expect(didTrigger).not.toBeCalled();

    state.set((key) => {
      if (key == 'ref') didUpdate();
    });

    state.ref.current = 'foobar';
    expect(didTrigger).toBeCalledWith('foobar');

    await expect(state).toHaveUpdated();
    expect(didUpdate).toBeCalledWith();
  });

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends State {
      ref = ref<number>(() => didTrigger);
    }

    const state = Subject.new();
    const didTrigger = vi.fn();

    state.ref.current = 1;

    await expect(state).toHaveUpdated();
    expect(didTrigger).not.toBeCalled();
    state.ref.current = 2;

    await expect(state).toHaveUpdated();
    expect(didTrigger).toBeCalled();
  });

  it('will not callback when set to null', async () => {
    const callback = vi.fn();

    class Subject extends State {
      ref = ref<string | null>(callback);
    }

    const state = Subject.new();

    state.ref.current = 'hello';
    expect(callback).toBeCalledWith('hello');

    state.ref.current = null;
    expect(callback).not.toBeCalledWith(null);
  });

  it('will callback when on null if ignore false', async () => {
    const callback = vi.fn();

    class Subject extends State {
      ref = ref<string | null>(callback, false);
    }

    const state = Subject.new();

    state.ref.current = 'hello';
    expect(callback).toBeCalledWith('hello');

    state.ref.current = null;
    expect(callback).toBeCalledWith(null);
  });

  it('will reset nested effects', async () => {
    class Subject extends State {
      name = 'World';

      hello = ref((value) => {
        this.get(({ name }) => {
          effect(`${value} ${name}!`);
        });
      });
    }

    const effect = vi.fn();
    const state = Subject.new();

    state.hello.current = 'Hola';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Hola World!');

    state.hello.current = 'Bonjour';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour World!');

    state.name = 'Earth';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour Earth!');
    expect(effect).not.toBeCalledWith('Hola Earth!');
  });

  it('will export value of ref-properties', () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const test = Subject.new();
    const values = { ref: 'foobar' };

    test.ref.current = values.ref;

    expect(test.get()).toMatchObject(values);
  });

  it('will be accessible from a proxy', () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const test = Subject.new();

    test.get((state) => {
      expect(state.ref).not.toBeUndefined();
    });
  });

  it.skip('will subscribe if current accessed', async () => {
    class Subject extends State {
      ref = ref<string>();
    }

    const test = Subject.new();
    const effect = vi.fn(($: Subject) => {
      void $.ref.current;
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);

    test.ref.current = 'foobar';

    await expect(test).toHaveUpdated();
    expect(effect).toBeCalledTimes(2);
  });
});

describe('proxy', () => {
  class Subject extends State {
    foo = 'foo';
    bar = 'bar';

    refs = ref(this);
  }

  it('will match properties', () => {
    const test = Subject.new();

    for (const key in test) expect(test.refs).toHaveProperty(key);
  });

  it('will match values via current', () => {
    const test = Subject.new();
    const { refs } = test;

    for (const key in test) {
      const value = (test as any)[key];
      const { current } = (refs as any)[key];

      expect(current).toBe(value);
    }
  });

  it('will update values', async () => {
    const test = Subject.new();

    expect(test.foo).toBe('foo');
    expect(test.bar).toBe('bar');

    test.refs.foo.current = 'bar';
    test.refs.bar.current = 'foo';

    await expect(test).toHaveUpdated();

    expect(test.foo).toBe('bar');
    expect(test.bar).toBe('foo');
  });

  it('will subscribe from property', async () => {
    const test = Subject.new();
    const callback = vi.fn();
    const { refs } = test;

    const done = refs.foo.get(callback);
    expect(callback).not.toBeCalled();

    test.foo = 'bar';
    await expect(test).toHaveUpdated();
    expect(callback).toBeCalledWith('bar');

    done();

    test.foo = 'baz';
    await expect(test).toHaveUpdated();
    expect(callback).toBeCalledTimes(1);
  });

  it('will reference parent', () => {
    class Subject extends State {
      refs = ref(this);
      foo = 'foo';
      bar = 'bar';
    }

    const { is: subject, refs } = Subject.new();

    expect(refs.foo.is).toBe(subject);
    expect(refs.bar.is).toBe(subject);

    expect(refs.foo.key).toBe('foo');
    expect(refs.bar.key).toBe('bar');
  });
});

describe('set instruction', () => {
  it('will include computed properties', () => {
    class Subject extends State {
      ref = ref(this);
      foo = set(() => 'foo');
    }

    const test = Subject.new();

    expect(test.ref).toHaveProperty('foo');
    expect(test.ref.foo.current).toBe('foo');
  });

  it('will trigger callback', () => {
    const callback = vi.fn();

    class Subject extends State {
      ref = ref(this);
      foo = set(() => 'foo', callback);
    }

    const test = Subject.new();

    test.ref.foo.current = 'bar';
    expect(callback).toBeCalledWith('bar', 'foo');
  });
});

describe('mapped', () => {
  const generateRef = vi.fn((key: any) => key as string);

  class Test extends State {
    foo = 'foo';
    bar = 'bar';

    fields = ref(this, generateRef);
  }

  afterEach(() => {
    generateRef.mockClear();
  });

  it('will run function for accessed keys', () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe('foo');
    expect(fields.bar).toBe('bar');

    expect(generateRef).toBeCalledWith('foo');
    expect(generateRef).toBeCalledWith('bar');
  });

  it('will run function only for accessed property', () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe('foo');

    expect(generateRef).toBeCalledWith('foo');
    expect(generateRef).not.toBeCalledWith('bar');
  });

  it('will run function only once per property', () => {
    const { fields } = Test.new();

    expect(fields.foo).toBe('foo');
    expect(fields.foo).toBe('foo');

    expect(generateRef).toBeCalledTimes(1);
  });

  it('will throw if object is not this', () => {
    class Test extends State {
      foo = 'foo';
      bar = 'bar';

      // @ts-expect-error
      fields = ref({});
    }

    expect(() => Test.new()).toThrow(
      `ref instruction does not support object which is not 'this'`
    );
  });

  it('will include undefined properties', () => {
    class Test extends State {
      foo = undefined;
      fields = ref(this);
    }

    const { fields } = Test.new();

    expect(fields.foo).toBeDefined();
  });

  it.skip('will not break on recursive', () => {
    class Test extends State {
      foo = ref<boolean>();
      bar = ref(this);
    }

    Test.new();
  });
});
