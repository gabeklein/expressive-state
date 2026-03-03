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

it("will throw if context doesn't exist", () => {
  const context = new Context();

  const attempt = () => context.get(Example);

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

//TODO: not sure if should remain this case.
it.skip('will not include initialized child', () => {
  class Test extends State {
    // this will be initialized before parent is
    example = Example.new();
  }

  const context = new Context({ Test });

  expect(context.get(Example, false)).toBeUndefined();
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

it('will return undefined if not required', () => {
  const context = new Context();
  const got = context.get(Example, false);

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

it('will remove implicit children on pop', () => {
  class Parent extends State {
    child = new Example();
  }

  const ctx = new Context({ Parent });
  const { child } = ctx.get(Parent);

  expect(Context.for(child)).toBe(ctx);

  ctx.pop();

  expect(Context.for(child, false)).toBeUndefined();
});

it('will remove implicit children when parent removed via set', () => {
  class Parent extends State {
    child = new Example();
  }

  const ctx = new Context({ Parent });
  const { child } = ctx.get(Parent);

  ctx.set({});

  expect(Context.for(child, false)).toBeUndefined();
  expect(ctx.get(Example, false)).toBeUndefined();
});

it('will remove implicit downstream on removal', () => {
  class Parent extends State {
    child = new Example();
  }

  const ctx = new Context({ Parent });
  const parent = ctx.get(Parent);
  expect(ctx.get(Example)).toBe(parent.child);

  ctx.set({});

  expect(ctx.get(Example, false)).toBeUndefined();
});

it('will remove multiple implicit children when parent is removed', () => {
  class Parent extends State {
    a = new Example();
    b = new Example2();
  }

  const ctx = new Context({ Parent });
  // Example2 extends Example, so both a and b register under Example key
  // This creates an implicit collision on Example — returns null
  expect(ctx.get(Example)).toBeNull();
  expect(ctx.get(Example2)).toBeInstanceOf(Example2);

  ctx.set({});

  expect(ctx.get(Example, false)).toBeUndefined();
  expect(ctx.get(Example2, false)).toBeUndefined();
});

it('child pop is safe to call before parent pop', () => {
  const destroyed = vi.fn();

  class Test extends State {
    protected new() {
      return destroyed;
    }
  }

  const parent = new Context();
  const child = parent.push({ Test });

  child.pop();

  expect(destroyed).toBeCalledTimes(1);

  // parent.pop() cascades into already-popped child — must not double-destroy
  parent.pop();

  expect(destroyed).toBeCalledTimes(1);
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
    const bar = context.get(Bar);

    context.set({});

    expect(bar.didDie).toBeCalled();
    expect(context.get(Bar, false)).toBeUndefined();
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
    const baz = context.get(Baz);

    context.set({ Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(context.get(Baz, false)).toBeUndefined();
    expect(context.get(Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    const bar = Bar.new();
    const context = new Context({ bar });

    expect(context.get(Bar)).toBe(bar);

    context.set({});

    expect(context.get(Bar, false)).toBeUndefined();
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

    expect(context.get(Child, false)).toBeUndefined();
    expect(context.get(Base, false)).toBeUndefined();
  });

  it('will register children implicitly', () => {
    const foobar = new FooBar();
    const context = new Context({ foobar });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).toBe(foobar.foo);
  });

  it('will drop implicit child when property is overwritten', () => {
    const foo1 = new Foo();
    const foo2 = new Foo();

    class Parent extends State {
      child: Foo = foo1;
    }

    const ctx = new Context({ Parent });
    const parent = ctx.get(Parent);

    expect(ctx.get(Foo)).toBe(foo1);

    parent.child = foo2;

    expect(ctx.get(Foo)).toBe(foo2);
  });

  it('will not add stale implicit if property changes before context attaches', () => {
    const foo1 = new Foo();
    const foo2 = new Foo();

    class Parent extends State {
      child: Foo = foo1;
    }

    // State.new initializes the state (runs manage) but doesn't attach a context yet
    const parent = new Parent();

    // overwrite child before context attaches - queues second Context.for callback
    parent.child = foo2;

    const ctx = new Context({ parent });

    // only foo2 should be in context; stale foo1 callback was skipped
    expect(ctx.get(Foo)).toBe(foo2);
  });

  it('will collide implicit children with shared ancestor', () => {
    class Bar extends Foo {}

    class Parent extends State {
      foo = new Foo();
      bar = new Bar();
    }

    const ctx = new Context({ Parent });

    expect(ctx.get(Bar)).toBeInstanceOf(Bar);
    expect(ctx.get(Foo)).toBeNull();
  });

  it('will uncollide when one implicit child is removed', () => {
    class Bar extends Foo {}

    class Parent extends State {
      foo: Foo | undefined = new Foo();
      bar = new Bar();
    }

    const ctx = new Context({ Parent });
    const parent = ctx.get(Parent);

    expect(ctx.get(Foo)).toBeNull();

    parent.foo = undefined;

    expect(ctx.get(Foo)).toBeInstanceOf(Bar);
  });

  it('will keep child in context if still referenced by another parent', () => {
    const shared = new Foo();

    class ParentA extends State {
      child: Foo | undefined = shared;
    }

    class ParentB extends State {
      child = shared;
    }

    const ctx = new Context({ ParentA, ParentB });

    expect(ctx.get(Foo)).toBe(shared);

    ctx.get(ParentA).child = undefined;

    expect(ctx.get(Foo)).toBe(shared);
  });

  it('will prefer explicit over implicit', () => {
    const foo = new Foo();
    const foobar = new FooBar();
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

describe('has method', () => {
  class DownstreamState extends State {}

  it('will call callback when type is added downstream', () => {
    const context = new Context();
    const cb = vi.fn();

    context.has(DownstreamState, cb);
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('will clean up callback on cancel', () => {
    const context = new Context();
    const cb = vi.fn();

    const cancel = context.has(DownstreamState, cb);
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);

    cancel();
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
    context.pop();
  });

  it('will call cleanup when state is removed', () => {
    const context = new Context();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    context.has(DownstreamState, cb);

    const child = context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);

    child.pop();

    expect(cleanup).toBeCalledTimes(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('will not call callback for new additions after cancel', () => {
    const context = new Context();
    const cb = vi.fn();

    const cancel = context.has(DownstreamState, cb);
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
    cancel();

    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
    context.pop();
  });

  it('will fire for existing entries when current is true', () => {
    const context = new Context();
    const cb = vi.fn();

    context.push(DownstreamState);
    context.has(DownstreamState, cb, true);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('will not fire for existing entries by default', () => {
    const context = new Context();
    const cb = vi.fn();

    context.push(DownstreamState);
    context.has(DownstreamState, cb);

    expect(cb).not.toBeCalled();
  });

  it.fails('will return entries registered downstream', () => {
    const context = new Context();
    context.push(DownstreamState);

    const entries = context.has(DownstreamState);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });
});

describe('with existing context', () => {
  class Foo extends State {}

  it('will not reassign context if state already has one', () => {
    const foo = Foo.new();
    const original = new Context({ foo });
    const other = new Context();

    other.set(foo);

    expect(other.get(Foo)).toBe(foo);
    expect(Context.for(foo)).toBe(original);
  });

  it('will keep original context after second context pops', () => {
    const foo = Foo.new();
    const original = new Context({ foo });
    const other = new Context();

    other.set(foo);
    other.pop();

    expect(Context.for(foo)).toBe(original);
  });

  it('will flush waiting callbacks on first context only', () => {
    const foo = Foo.new();
    const mock = vi.fn();

    Context.for(foo, mock);

    const first = new Context({ foo });
    expect(mock).toBeCalledWith(first);

    const second = new Context();
    second.set(foo);

    expect(mock).toBeCalledTimes(1);
  });
});

describe('for method (static)', () => {
  class Test extends State {}

  it('will get context', () => {
    const test = new Test();

    expect(Context.for(test, false)).toBeUndefined();

    const context = new Context({ test });

    expect(Context.for(test)).toBe(context);
  });

  it('will throw if context not found by default', () => {
    const test = new Test();

    expect(() => Context.for(test)).toThrow();
    expect(() => Context.for(test, true)).toThrow();
  });

  it('will return undefined if required is false', () => {
    const test = new Test();

    expect(Context.for(test, false)).toBeUndefined();

    const context = new Context({ test });

    expect(Context.for(test)).toBe(context);
  });

  it('will callback when attached', () => {
    const test = new Test();
    const mock = vi.fn();

    Context.for(test, mock);

    expect(mock).not.toBeCalled();

    const context = new Context({ test });

    expect(mock).toBeCalledWith(context);
  });

  it('will callback immediately if context already exists', () => {
    const test = new Test();
    const context = new Context({ test });
    const mock = vi.fn();

    Context.for(test, mock);

    expect(mock).toBeCalledWith(context);
  });
});
