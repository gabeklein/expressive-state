import { vi, describe, it, expect } from 'vitest';
import { Context } from './context';
import { State } from './state';

class Example extends State {}
class Example2 extends Example {}

it('will add instance to context', () => {
  const example = Example.new();
  const context = new Context();

  context.set(example);

  expect(context.get(Example)).toBe(example);
});

it('will UID context', () => {
  const contextA = new Context();
  const contextB = new Context();

  expect(String(contextA)).toBe('Context-' + contextA.id);
  expect(String(contextA)).not.toBe(String(contextB));
});

it('will create instance in context', () => {
  const context = new Context(Example);

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it("will throw if context doesn't exist if required", () => {
  const context = new Context();

  const attempt = () => context.get(Example, true);

  expect(attempt).toThrow('Could not find Example in context.');
});

it('will not create base State', () => {
  // @ts-expect-error
  const attempt = () => new Context({ State });

  expect(attempt).toThrow('Cannot create base State.');
});

it('will include children of State', () => {
  class Test extends State {
    example = new Example();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it('will not include initialized child', () => {
  class Test extends State {
    // this will be initialized before parent is
    example = Example.new();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeUndefined();
});

it('will access upstream controller', () => {
  const example = Example.new();

  const context = new Context({ example });
  const context2 = context.push();

  expect(context2.get(Example)).toBe(example);
});

it('will register all subtypes', () => {
  const example2 = new Example2();
  const context = new Context({ example2 });

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
});

it('will return undefined if not found', () => {
  const context = new Context();
  const got = context.get(Example);

  expect(got).toBeUndefined();
});

it('will complain if multiple registered', () => {
  const context = new Context({
    e1: Example,
    e2: Example
  });

  const fetch = () => context.get(Example);

  expect(fetch).toThrow(
    `Did find Example in context, but multiple were defined.`
  );
});

it('will ignore if multiple but same', () => {
  const example = Example.new();
  const context = new Context({
    e1: example,
    e2: example
  });

  const got = context.get(Example);

  expect(got).toBe(example);
});

it('will destroy modules created by layer', () => {
  class Test extends State {
    destroyed = vi.fn();

    constructor(...args: State.Args) {
      super(args);
      this.get(null, this.destroyed);
    }
  }

  class Test1 extends Test {}
  class Test2 extends Test {}
  class Test3 extends Test {}

  const test2 = Test2.new();

  const context1 = new Context({ Test1 });
  const context2 = context1.push({ test2, Test3 });

  const test1 = context2.get(Test1)!;
  const test3 = context2.get(Test3)!;

  context2.pop();

  expect(test1.destroyed).not.toBeCalled();
  expect(test2.destroyed).not.toBeCalled();
  expect(test3.destroyed).toBeCalled();
});

describe('include', () => {
  class Foo extends State {}
  class Bar extends State {}
  class FooBar extends State {
    foo = new Foo();
  }

  it('will register in batch', () => {
    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });

    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  });

  it('will callback once per unique added', () => {
    const foo = Foo.new();
    const bar = Bar.new();
    const cb = vi.fn();

    const context = new Context();

    context.set({ foo, bar }, cb);

    expect(cb).toBeCalledWith(foo);
    expect(cb).toBeCalledWith(bar);
    expect(cb).toBeCalledTimes(2);

    context.set({ foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    context.set({ foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2);
    expect(cb).toBeCalledTimes(3);
  });

  it('will ignore subsequent if callback', () => {
    const cb = vi.fn();
    const context = new Context();

    context.set(Foo, cb);
    context.set(Foo, cb);

    expect(context.get(Foo)).toBeInstanceOf(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will remove and delete state of type absent', () => {
    class Bar extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    const context = new Context({ Bar });
    const bar = context.get(Bar, true);

    context.set({});

    expect(bar.didDie).toBeCalled();
    expect(context.get(Bar)).toBeUndefined();
  });

  it('will replace owned instance when key changes', () => {
    class Baz extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    class Baz2 extends State {}

    const context = new Context({ Baz });
    const baz = context.get(Baz, true);

    context.set({ Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(context.get(Baz)).toBeUndefined();
    expect(context.get(Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    const bar = Bar.new();
    const context = new Context({ bar });

    expect(context.get(Bar)).toBe(bar);

    context.set({});

    expect(context.get(Bar)).toBeUndefined();
    // bar should still be alive (not owned by context)
    expect(bar.is).not.toBeNull();
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const context = new Context({ Child });

    expect(context.get(Child)).toBeInstanceOf(Child);
    expect(context.get(Base)).toBeInstanceOf(Child);

    context.set({});

    expect(context.get(Child)).toBeUndefined();
    expect(context.get(Base)).toBeUndefined();
  });

  it('will register children implicitly', () => {
    const foobar = FooBar.new();
    const context = new Context({ foobar });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).toBe(foobar.foo);
  });

  it('will prefer explicit over implicit', () => {
    const foo = Foo.new();
    const foobar = FooBar.new();
    const context = new Context({ foobar, foo });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  });
});

it('will pop child context', () => {
  let order = 0;

  class Test extends State {
    constructor(...args: State.Args) {
      super(args);
      this.set(() => {
        didDestroy(++order, this.constructor.name);
      }, null);
    }
  }

  class Test2 extends Test {}
  class Test3 extends Test {}

  const didDestroy = vi.fn();
  const context = new Context({ Test });

  context.push({ Test2 }).push({ Test3 });
  context.pop();

  expect(didDestroy).toBeCalledWith(1, 'Test3');
  expect(didDestroy).toBeCalledWith(2, 'Test2');
  expect(didDestroy).toBeCalledWith(3, 'Test');
});

it('will throw on bad include', () => {
  const Thing = { toString: () => 'Foobar' };
  const context = new Context();

  // TODO: check for specific error
  // @ts-ignore
  expect(() => context.set(Thing)).toThrow();
});

it('will throw on base State include', () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.set({ State })).toThrow('Cannot create base State.');
});

it('will throw on bad include property', () => {
  const Thing = { toString: () => 'Foobar' };
  const context = new Context();

  // @ts-ignore
  expect(() => context.set({ Thing })).toThrow(
    "Context can only include an instance or class of State but got Foobar (as 'Thing')."
  );
});

it('will throw on bad include property (no alias)', () => {
  const Thing = { toString: () => 'Thing' };
  const context = new Context();

  // @ts-ignore
  expect(() => context.set({ [0]: Thing })).toThrow(
    'Context can only include an instance or class of State but got Thing.'
  );
});

describe('Context.get callback overload (downstream registration)', () => {
  class DownstreamState extends State {}

  it('should call callback when type is added downstream', () => {
    const context = new Context();
    const cb = vi.fn();

    // Register callback for DownstreamState
    context.get(DownstreamState, cb);

    // Add DownstreamState after callback registration
    context.push(DownstreamState);

    // Callback should be called with the instance
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('should clean up callback when context is popped', () => {
    const context = new Context();
    const cb = vi.fn();

    // Register callback for DownstreamState
    const cancel = context.get(DownstreamState, cb);

    // Add DownstreamState after callback registration
    context.push(DownstreamState);

    // Callback should be called
    expect(cb).toBeCalledTimes(1);

    // Remove callback
    cancel();

    // Add another DownstreamState (simulate re-adding)
    context.push(DownstreamState);

    // Callback should not be called again
    expect(cb).toBeCalledTimes(1);

    context.pop();
  });

  it('should call callback when inner is popped', () => {
    const context = new Context();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    context.get(DownstreamState, cb);

    // Create a child context and register callback there
    const child = context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);

    // Pop child context
    child.pop();

    expect(cleanup).toBeCalledTimes(1);
  });
});
