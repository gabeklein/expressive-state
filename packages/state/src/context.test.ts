import { vi, describe, it, expect } from 'vitest';
import { context, Context } from './context';
import { State } from './state';

class Example extends State {}
class Example2 extends Example {}

it('will add instance to context', () => {
  const example = Example.new();
  const context = new Context();

  context.add(example);

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
  const attempt = () => new Context(State);

  expect(attempt).toThrow('Cannot create base State.');
});

it('will include children of State', () => {
  class Test extends State {
    example = new Example();
  }

  const context = new Context(Test);

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it('will access upstream controller', () => {
  const example = Example.new();

  const context = new Context();
  context.add(example);

  expect(context.push().get(Example)).toBe(example);
});

it('will register all subtypes', () => {
  const example2 = new Example2();
  const context = new Context();

  context.add(example2);

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
});

it('will return undefined if not required', () => {
  const context = new Context();
  const got = context.get(Example, false);

  expect(got).toBeUndefined();
});

it('will remove implicit children on pop', () => {
  class Parent extends State {
    child = new Example();
  }

  const ctx = new Context(Parent);
  const { child } = ctx.get(Parent);

  expect(context(child)).toBe(ctx);

  ctx.pop();

  expect(context(child, false)).toBeUndefined();
});

it('child pop is safe to call before parent pop', () => {
  const destroyed = vi.fn();

  class Test extends State {
    protected new() {
      return destroyed;
    }
  }

  const parent = new Context();
  const child = parent.push(Test);

  child.pop();

  expect(destroyed).toBeCalledTimes(1);

  // parent.pop() cascades into already-popped child — must not double-destroy
  parent.pop();

  expect(destroyed).toBeCalledTimes(1);
});

it('will register children implicitly', () => {
  class Foo extends State {}
  class Bar extends State {
    foo = new Foo();
  }

  const bar = new Bar();
  const context = new Context(bar);

  expect(context.get(Bar)).toBe(bar);
  expect(context.get(Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const ctx = new Context(Parent);
  const parent = ctx.get(Parent);

  expect(ctx.get(Foo)).toBe(foo1);

  parent.child = foo2;

  expect(ctx.get(Foo)).toBe(foo2);
});

it('will notify downstream subscriber when implicit child is replaced', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const parent = new Parent();
  const ctx = new Context(parent);
  const cb = vi.fn();

  ctx.get(Foo, cb);

  // called immediately with existing instance
  expect(cb).toBeCalledTimes(1);
  expect(cb).toBeCalledWith(foo1, true);

  parent.child = foo2;

  // should be called again with replacement
  expect(cb).toBeCalledTimes(2);
  expect(cb.mock.calls[1][0]).toBe(foo2);
});

it('will not add stale implicit if property changes before context attaches', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  // State.new initializes the state (runs manage) but doesn't attach a context yet
  const parent = new Parent();

  // overwrite child before context attaches - queues second context callback
  parent.child = foo2;

  const ctx = new Context(parent);

  // only foo2 should be in context; stale foo1 callback was skipped
  expect(ctx.get(Foo)).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo = new Foo();
    bar = new Bar();
  }

  const ctx = new Context(Parent);

  expect(ctx.get(Bar)).toBeInstanceOf(Bar);
  expect(ctx.get(Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo: Foo | undefined = new Foo();
    bar = new Bar();
  }

  const ctx = new Context(Parent);
  const parent = ctx.get(Parent);

  expect(ctx.get(Foo)).toBeNull();

  parent.foo = undefined;

  expect(ctx.get(Foo)).toBeInstanceOf(Bar);
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
  const context = new Context(Test);

  context.push(Test2).push(Test3);
  context.pop();

  expect(didDestroy).toBeCalledWith(1, 'Test3');
  expect(didDestroy).toBeCalledWith(2, 'Test2');
  expect(didDestroy).toBeCalledWith(3, 'Test');
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

  it('will return entries registered downstream', () => {
    const context = new Context();
    context.push(DownstreamState);

    const entries = context.has(DownstreamState);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will call callback for already-registered downstream states', () => {
    const context = new Context();
    const child = context.push(DownstreamState);
    const existing = child.get(DownstreamState);
    const cb = vi.fn();

    context.has(DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(existing, true);
  });

  it('will flag existing vs new in callback', () => {
    const context = new Context();
    context.push(DownstreamState);
    const cb = vi.fn();

    context.has(DownstreamState, cb);

    // existing gets true flag
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBe(true);

    // new addition has no flag
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[1][1]).toBeUndefined();
  });

  it('will call callback for multiple existing downstream states', () => {
    const context = new Context();
    context.push(DownstreamState);
    context.push(DownstreamState);
    const cb = vi.fn();

    context.has(DownstreamState, cb);

    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[0][1]).toBe(true);
    expect(cb.mock.calls[1][1]).toBe(true);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends State {}

  it('will call callback when type is added to parent', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);
    parent.set(Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Upstream);
  });

  it('will cancel subscription', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    const cancel = child.get(Upstream, cb);
    cancel();
    parent.set(Upstream);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const parent = new Context();
    const child = parent.push();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    child.get(Upstream, cb);
    parent.set(Upstream);

    expect(cb).toBeCalledTimes(1);

    parent.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will call callback for already-registered upstream state', () => {
    const parent = new Context(Upstream);
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBe(true);
  });

  it('will flag existing vs new upstream in callback', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    // subscribe before anything exists
    child.get(Upstream, cb);

    expect(cb).not.toBeCalled();

    // new addition has no flag
    parent.set(Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBeUndefined();
  });
});

describe('with existing context', () => {
  class Foo extends State {}

  it('will not reassign context if state already has one', () => {
    const foo = Foo.new();
    const original = new Context(foo);
    const other = new Context();

    other.add(foo);

    expect(other.get(Foo)).toBe(foo);
    expect(context(foo)).toBe(original);
  });

  it('will keep original context after second context pops', () => {
    const foo = Foo.new();
    const original = new Context(foo);
    const other = new Context();

    other.add(foo);
    other.pop();

    expect(context(foo)).toBe(original);
  });

  it('will flush waiting callbacks on first context only', () => {
    const foo = Foo.new();
    const mock = vi.fn();

    context(foo, mock);

    const first = new Context(foo);
    expect(mock).toBeCalledWith(first);

    const second = new Context();
    second.add(foo);

    expect(mock).toBeCalledTimes(1);
  });
});

describe('context helper', () => {
  class Test extends State {}

  it('will get context', () => {
    const test = new Test();

    expect(context(test, false)).toBeUndefined();

    const ctx = new Context();
    ctx.add(test);

    expect(context(test)).toBe(ctx);
  });

  it('will throw if context not found by default', () => {
    const test = new Test();

    expect(() => context(test)).toThrow();
    expect(() => context(test, true)).toThrow();
  });

  it('will return undefined if required is false', () => {
    const test = new Test();

    expect(context(test, false)).toBeUndefined();

    const ctx = new Context();
    ctx.add(test);

    expect(context(test)).toBe(ctx);
  });

  it('will callback when attached', () => {
    const test = new Test();
    const mock = vi.fn();

    context(test, mock);

    expect(mock).not.toBeCalled();

    const ctx = new Context();
    ctx.add(test);

    expect(mock).toBeCalledWith(ctx);
  });

  it('will callback immediately if context already exists', () => {
    const test = new Test();
    const ctx = new Context();

    ctx.add(test);

    const mock = vi.fn();

    context(test, mock);

    expect(mock).toBeCalledWith(ctx);
  });
});

describe('set method', () => {
  it('will register multiple', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });

    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  });

  it('will complain if multiple of same type', () => {
    const context = new Context({
      e1: Example,
      e2: Example
    });

    const fetch = () => context.get(Example);

    expect(fetch).toThrow(
      `Did find Example in context, but multiple were defined.`
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const context = new Context({
      e1: example,
      e2: example
    });

    const got = context.get(Example);

    expect(got).toBe(example);
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends State {}
    class Bar extends State {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const context = new Context();

    context.set({ foo, Bar: foobar });

    expect(context.get(Bar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  });

  it('will keep child in context if still referenced by another parent', () => {
    class Foo extends State {}

    const shared = new Foo();

    class ParentA extends State {
      child: Foo | undefined = shared;
    }

    class ParentB extends State {
      child: Foo | undefined = shared;
    }

    const ctx = new Context({ ParentA, ParentB });

    expect(ctx.get(Foo)).toBe(shared);

    ctx.get(ParentA).child = undefined;

    expect(ctx.get(Foo)).toBe(shared);

    ctx.get(ParentB).child = undefined;

    expect(ctx.get(Foo, false)).toBeUndefined();
  });

  it('will destroy state created by layer', () => {
    class Test extends State {
      destroyed = vi.fn();

      new() {
        return this.destroyed;
      }
    }

    class Test1 extends Test {}
    class Test2 extends Test {}
    class Test3 extends Test {}

    const test2 = Test2.new();

    const context1 = new Context(Test1);
    const context2 = context1.push({ test2, Test3 });

    const test1 = context2.get(Test1)!;
    const test3 = context2.get(Test3)!;

    context2.pop();

    expect(test1.destroyed).not.toBeCalled();
    expect(test2.destroyed).not.toBeCalled();
    expect(test3.destroyed).toBeCalled();
  });

  it('will throw on bad include', () => {
    const Thing = { toString: () => 'Foobar' };
    const context = new Context();

    // @ts-ignore
    expect(() => context.set(Thing)).toThrow(
      'Context can only include an instance or class of State but got'
    );
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

  it('will remove implicit children when parent removed via set', () => {
    class Parent extends State {
      child = new Example();
    }

    const ctx = new Context(Parent);
    const { child } = ctx.get(Parent);

    ctx.set({});

    expect(context(child, false)).toBeUndefined();
    expect(ctx.get(Example, false)).toBeUndefined();
  });

  it('will remove implicit downstream on removal', () => {
    class Parent extends State {
      child = new Example();
    }

    const context = new Context(Parent);
    const parent = context.get(Parent);
    expect(context.get(Example)).toBe(parent.child);

    context.set({});

    expect(context.get(Example, false)).toBeUndefined();
  });

  it('will remove multiple implicit children when parent is removed', () => {
    class Parent extends State {
      a = new Example();
      b = new Example2();
    }

    const context = new Context(Parent);
    // Example2 extends Example, so both a and b register under Example key
    // This creates an implicit collision on Example — returns null
    expect(context.get(Example)).toBeNull();
    expect(context.get(Example2)).toBeInstanceOf(Example2);

    context.set({});

    expect(context.get(Example, false)).toBeUndefined();
    expect(context.get(Example2, false)).toBeUndefined();
  });

  it('will callback once per unique added', () => {
    class Foo extends State {}
    class Bar extends State {}

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
    class Foo extends State {}

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

    const context = new Context(Bar);
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

    const context = new Context(Baz);
    const baz = context.get(Baz);

    context.set({ Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(context.get(Baz, false)).toBeUndefined();
    expect(context.get(Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    class Bar extends State {}

    const bar = Bar.new();
    const context = new Context(bar);

    expect(context.get(Bar)).toBe(bar);

    context.set({});

    expect(context.get(Bar, false)).toBeUndefined();
    // bar should still be alive (not owned by context)
    expect(bar.is).not.toBeNull();
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const context = new Context(Child);

    expect(context.get(Child)).toBeInstanceOf(Child);
    expect(context.get(Base)).toBeInstanceOf(Child);

    context.set({});

    expect(context.get(Child, false)).toBeUndefined();
    expect(context.get(Base, false)).toBeUndefined();
  });
});
