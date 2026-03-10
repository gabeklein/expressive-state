import { vi, describe, it, expect } from 'vitest';
import { find, include, apply, detach, parent, link } from './context';
import { State } from './state';
import { event } from './observable';

import type { Accept, Expect, ForEach } from './context';

class Example extends State {}
class Example2 extends Example {}

export class Context extends State {
  constructor(include?: Accept, parent?: Context) {
    super();
    if (parent) link(parent, this);
    if (include) apply(this, include);
  }

  add(target: State, implicit?: boolean) {
    include(this, target, implicit);
    event(target);
    return target;
  }

  use(inputs: Accept, forEach?: ForEach<State>) {
    apply(this, inputs, forEach);
  }

  has<T extends State>(Type: State.Extends<T>): T;
  has<T extends State>(Type: State.Extends<T>, required: false): T | undefined;
  has<T extends State>(Type: State.Extends<T>, below: true): T[];
  has<T extends State>(Type: State.Extends<T>, callback: Expect<T>): () => void;
  has<T extends State>(Type: State.Extends<T>, arg?: any): any {
    return find(this, Type, arg);
  }

  push(include?: Accept) {
    return new Context(include, this);
  }

  pop() {
    detach(this);
  }
}

it('will add instance to context', () => {
  const example = Example.new();
  const context = new Context(example);

  expect(context.has(Example)).toBe(example);
});

it('will create instance in context', () => {
  const context = new Context(Example);

  expect(context.has(Example)).toBeInstanceOf(Example);
});

it("will throw if context doesn't exist", () => {
  const context = new Context();

  expect(() => context.has(Example)).toThrow(
    'Could not find Example in context.'
  );
});

it('will not create base State', () => {
  const context = new Context();

  // @ts-expect-error
  expect(() => context.use(State)).toThrow('Cannot create base State.');
});

it('will include children of State', () => {
  class Test extends State {
    example = new Example();
  }

  const context = new Context(Test);

  expect(context.has(Example)).toBeInstanceOf(Example);
});

it('will access upstream controller', () => {
  const example = Example.new();
  const context = new Context(example);
  const child = context.push();

  expect(child.has(Example)).toBe(example);
});

it('will register all subtypes', () => {
  const example2 = new Example2();
  const context = new Context();

  context.add(example2);

  expect(context.has(Example2)).toBe(example2);
  expect(context.has(Example)).toBe(example2);
});

it('will return undefined if not required', () => {
  const context = new Context();

  expect(context.has(Example, false)).toBeUndefined();
});

it('will register children implicitly', () => {
  class Foo extends State {}
  class Bar extends State {
    foo = new Foo();
  }

  const context = new Context();
  const bar = new Bar();

  context.add(bar);

  expect(context.has(Bar)).toBe(bar);
  expect(context.has(Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const context = new Context(Parent);
  const p = context.has(Parent);

  expect(context.has(Foo)).toBe(foo1);

  p.child = foo2;

  expect(context.has(Foo)).toBe(foo2);
});

it('will notify downstream subscriber when implicit child is replaced', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const context = new Context();
  const p = new Parent();

  context.add(p);

  const cb = vi.fn();
  context.has(Foo, cb);

  expect(cb).toBeCalledTimes(1);
  expect(cb).toBeCalledWith(foo1, false, true);

  p.child = foo2;

  expect(cb).toBeCalledTimes(2);
  expect(cb.mock.calls[1][0]).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo = new Foo();
    bar = new Bar();
  }

  const context = new Context(Parent);

  expect(context.has(Bar)).toBeInstanceOf(Bar);
  expect(context.has(Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo: Foo | undefined = new Foo();
    bar = new Bar();
  }

  const context = new Context(Parent);
  const p = context.has(Parent);

  expect(context.has(Foo)).toBeNull();

  p.foo = undefined;

  expect(context.has(Foo)).toBeInstanceOf(Bar);
});

it('will detach children recursively', () => {
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
  const mid = context.push(Test2);
  mid.push(Test3);

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

  it('will return entries registered downstream', () => {
    const context = new Context();
    context.push(DownstreamState);

    const entries = context.has(DownstreamState, true);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will return entries from deeply nested children', () => {
    const root = new Context();
    const mid = root.push();
    mid.push(DownstreamState);

    const entries = root.has(DownstreamState, true);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will skip nodes without matching type', () => {
    class Unrelated extends State {}

    const root = new Context();
    root.push(Unrelated);

    expect(root.has(DownstreamState, true)).toHaveLength(0);
  });

  it('will call callback for already-registered downstream states', () => {
    const context = new Context();
    const child = context.push(DownstreamState);

    const existing = child.has(DownstreamState);
    const cb = vi.fn();

    context.has(DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(existing, true, true);
  });

  it('will flag existing vs new in callback', () => {
    const context = new Context();
    context.push(DownstreamState);

    const cb = vi.fn();
    context.has(DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(DownstreamState), true, true);

    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(2);
    expect(cb).toBeCalledWith(expect.any(DownstreamState), true, false);
  });

  it('will notify has-subscriber for state created before context', () => {
    const context = new Context();

    const cb = vi.fn();
    context.has(DownstreamState, cb);

    const state = DownstreamState.new();
    context.push(state);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(state, true, false);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends State {}

  it('will call callback when type is added to parent', () => {
    const context = new Context();
    const child = context.push();

    const cb = vi.fn();
    child.has(Upstream, cb);

    context.use(Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Upstream);
  });

  it('will cancel subscription', () => {
    const context = new Context();
    const child = context.push();

    const cb = vi.fn();
    const cancel = child.has(Upstream, cb);
    cancel();

    context.use(Upstream);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const context = new Context();
    const child = context.push();

    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    child.has(Upstream, cb);
    context.use(Upstream);

    expect(cb).toBeCalledTimes(1);

    context.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will call callback for already-registered upstream state', () => {
    const context = new Context(Upstream);
    const child = context.push();

    const cb = vi.fn();
    child.has(Upstream, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false, true);
  });

  it('will flag existing vs new upstream in callback', () => {
    const context = new Context();
    const child = context.push();

    const cb = vi.fn();
    child.has(Upstream, cb);

    expect(cb).not.toBeCalled();

    context.use(Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false, false);
  });
});

describe('apply method', () => {
  it('will register multiple', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });

    expect(context.has(Foo)).toBe(foo);
    expect(context.has(Bar)).toBe(bar);
  });

  it('will complain if multiple of same type', () => {
    const context = new Context({ e1: Example, e2: Example });

    expect(() => context.has(Example)).toThrow(
      `Did find Example in context, but multiple were defined.`
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const context = new Context({ e1: example, e2: example });

    expect(context.has(Example)).toBe(example);
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends State {}
    class Bar extends State {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const context = new Context();

    context.use({ foo, Bar: foobar });

    expect(context.has(Bar)).toBe(foobar);
    expect(context.has(Foo)).not.toBe(foobar.foo);
    expect(context.has(Foo)).toBe(foo);
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

    const context = new Context({ Test1 });

    const child = context.push();
    child.use({ test2, Test3 });

    const test1 = context.has(Test1)!;
    const test3 = child.has(Test3)!;

    child.pop();

    expect(test1.destroyed).not.toBeCalled();
    expect(test2.destroyed).not.toBeCalled();
    expect(test3.destroyed).toBeCalled();
  });

  it('will throw on bad include', () => {
    const Thing = { toString: () => 'Foobar' };
    const context = new Context();

    // @ts-ignore
    expect(() => context.use({ Thing })).toThrow(
      'Context can only include an instance or class of State but got'
    );
  });

  it('will throw on base State include', () => {
    const context = new Context();

    // @ts-ignore
    expect(() => context.use({ State })).toThrow('Cannot create base State.');
  });

  it('will throw on bad include property', () => {
    const Thing = { toString: () => 'Foobar' };
    const context = new Context();

    // @ts-ignore
    expect(() => context.use({ Thing })).toThrow(
      "Context can only include an instance or class of State but got Foobar (as 'Thing')."
    );
  });

  it('will throw on bad include property (no alias)', () => {
    const Thing = { toString: () => 'Thing' };
    const context = new Context();

    // @ts-ignore
    expect(() => context.use({ [0]: Thing })).toThrow(
      'Context can only include an instance or class of State but got Thing.'
    );
  });

  it('will callback once per unique added', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();
    const cb = vi.fn();

    const context = new Context();

    context.use({ foo, bar }, cb);

    expect(cb).toBeCalledWith(foo);
    expect(cb).toBeCalledWith(bar);
    expect(cb).toBeCalledTimes(2);

    context.use({ foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    context.use({ foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2);
    expect(cb).toBeCalledTimes(3);
  });

  it('will ignore subsequent if callback', () => {
    class Foo extends State {}

    const cb = vi.fn();
    const context = new Context();

    context.use(Foo, cb);
    context.use(Foo, cb);

    expect(context.has(Foo)).toBeInstanceOf(Foo);

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
    const bar = context.has(Bar);

    context.use({});

    expect(bar.didDie).toBeCalled();
    expect(context.has(Bar, false)).toBeUndefined();
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
    const baz = context.has(Baz);

    context.use({ Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(context.has(Baz, false)).toBeUndefined();
    expect(context.has(Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    class Bar extends State {}

    const bar = Bar.new();
    const context = new Context({ bar });

    expect(context.has(Bar)).toBe(bar);

    context.use({});

    expect(context.has(Bar, false)).toBeUndefined();
    expect(bar.is).not.toBeNull();
  });

  it('will set multiple types and cleanup all', () => {
    class A extends State {}
    class B extends State {}

    const context = new Context({ A, B });

    expect(context.has(A)).toBeInstanceOf(A);
    expect(context.has(B)).toBeInstanceOf(B);

    context.pop();

    expect(context.has(A, false)).toBeUndefined();
    expect(context.has(B, false)).toBeUndefined();
  });

  it('will remove state from registry on cleanup', () => {
    class Foo extends State {}

    const context = new Context(Foo);

    expect(context.has(Foo)).toBeInstanceOf(Foo);

    context.pop();

    expect(context.has(Foo, false)).toBeUndefined();
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const context = new Context({ Child });

    expect(context.has(Child)).toBeInstanceOf(Child);
    expect(context.has(Base)).toBeInstanceOf(Child);

    context.use({});

    expect(context.has(Child, false)).toBeUndefined();
    expect(context.has(Base, false)).toBeUndefined();
  });
});

describe('ambiguous implicit entries', () => {
  it('will not call callback when two implicit entries of same type exist', () => {
    class Base extends State {}
    class ChildA extends Base {}
    class ChildB extends Base {}

    const context = new Context();

    context.add(ChildA.new(), true);
    context.add(ChildB.new(), true);

    const cb = vi.fn();
    const child = context.push();

    child.has(Base, cb);

    expect(cb).not.toBeCalled();
  });

  it('will throw on multiple explicit entries of same type in callback get', () => {
    class Base extends State {}

    const context = new Context();

    context.add(Base.new());
    context.add(Base.new());

    const cb = vi.fn();

    expect(() => context.has(Base, cb)).toThrow(
      'Did find Base in context, but multiple were defined.'
    );
  });

  it('will ignore implicit when explicit already found in callback get', () => {
    class Base extends State {}

    const context = new Context();
    const explicit = Base.new();
    const implicit = Base.new();

    context.add(explicit);
    context.add(implicit, true);

    const cb = vi.fn();
    context.has(Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(explicit, false, true);
  });

  it('will deduplicate same state in callback get entries', () => {
    class Base extends State {}

    const context = new Context();
    const a = Base.new();

    context.add(a);
    context.add(a);

    const cb = vi.fn();
    context.has(Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(a, false, true);
  });
});

describe('include listener lookup', () => {
  it('will notify listeners on child when state added to parent', () => {
    class Foo extends State {}

    const context = new Context();
    const child = context.push();

    const cb = vi.fn();
    child.has(Foo, cb);

    context.use(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will notify listeners on parent when state added to child', () => {
    class Foo extends State {}

    const context = new Context();
    const cb = vi.fn();

    context.has(Foo, cb);
    context.push(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callbacks across hierarchy in include', () => {
    class Foo extends State {}
    class Bar extends Foo {}

    const context = new Context();
    const cb = vi.fn();

    context.has(Foo, cb);
    context.push(Bar);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callback in above path during include', () => {
    class Foo extends State {}

    const grandparent = new Context();
    const p = grandparent.push();
    const child = p.push();

    const cb = vi.fn();
    grandparent.has(Foo, cb);
    p.has(Foo, cb);

    child.use(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will skip child without matching listener type in below path', () => {
    class Foo extends State {}
    class Bar extends State {}

    const context = new Context();
    const child = context.push();

    child.has(Bar, vi.fn());

    context.use(Foo);

    expect(context.has(Foo)).toBeInstanceOf(Foo);
  });

  it('will deduplicate callback found in both above and below during include', () => {
    class Foo extends State {}

    const context = new Context();
    const middle = context.push();
    const child = middle.push();

    const cb = vi.fn();
    context.has(Foo, cb);
    child.has(Foo, cb);

    middle.use(Foo);

    expect(cb).toBeCalledTimes(1);
  });
});

describe('parent function', () => {
  it('will return parent state', () => {
    const context = new Context();
    const child = Example.new();
    include(context, child);

    expect(parent(child)).toBe(context);
  });

  it('will return undefined if no parent', () => {
    const context = new Context();

    expect(parent(context)).toBeUndefined();
  });
});
