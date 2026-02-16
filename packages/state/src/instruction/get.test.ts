import { Context } from '../context';
import { vi, describe, it, expect, mockPromise } from '../../vitest';
import { State } from '../state';
import { get } from './get';
import { set } from './set';
import { use } from './use';

// is this desirable?
it.todo('will add pending compute to frame immediately');
it.todo('will suspend if necessary');

describe('fetch mode', () => {
  it('will fetch sibling', () => {
    class Sibling extends State {}
    class Test extends State {
      sibling = get(Sibling);
    }

    const context = new Context({ Sibling, Test });

    const test = context.get(Test, true);
    const sibling = context.get(Sibling);

    expect(test.sibling).toBe(sibling);
  });

  it('will fetch multiple', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient1 = get(Ambient);
      ambient2 = get(Ambient);
    }

    const test = Test.new();
    const ambient = Ambient.new();

    new Context({ ambient }).push({ test });

    expect(test.ambient1).toBe(ambient);
    expect(test.ambient2).toBe(ambient);
  });

  it('will allow overwrite', async () => {
    class Foo extends State {
      bar = new Bar();
      value = 'foo';
    }

    class Bar extends State {
      foo = get(Foo);
      value = 'foo';
    }

    const foo = Foo.new();
    const mockEffect = vi.fn();
    let promise = mockPromise();

    expect(foo.bar.foo).toBe(foo);

    foo.get((state) => {
      mockEffect(state.bar.foo.value);
      promise.resolve();
    });

    promise = mockPromise();
    foo.value = 'bar';
    await promise;

    expect(mockEffect).toBeCalledWith('bar');

    promise = mockPromise();
    foo.bar.foo = Foo.new();
    await promise;

    expect(mockEffect).toBeCalledWith('foo');
    expect(mockEffect).toBeCalledTimes(3);
  });

  it('creates parent-child relationship', () => {
    class Foo extends State {
      child = new Bar();
    }
    class Bar extends State {
      parent = get(Foo);
    }

    const foo = Foo.new();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  });

  it('will throw if not found in context', () => {
    class Parent extends State {}
    class Child extends State {
      expects = get(Parent);
      constructor() {
        super('ID');
      }
    }

    const attempt = () => new Context({ Child });

    // should this throw immediately, or only on access?
    expect(attempt).toThrow(`Required Parent not found in context for ID.`);
  });

  it('will return undefined if required is false', () => {
    class MaybeParent extends State {}
    class StandAlone extends State {
      maybe = get(MaybeParent, false);
    }

    const instance = StandAlone.new();

    new Context({ instance });

    expect(instance.maybe).toBeUndefined();
  });

  it('will not throw if has parent but not type-required', () => {
    class Expected extends State {}
    class Unexpected extends State {
      child = new Adopted('ID');
    }
    class Adopted extends State {
      expects = get(Expected);
    }

    const attempt = () => Unexpected.new('ID');

    expect(attempt).not.toThrow();
  });

  it('will track recursively', async () => {
    class Child extends State {
      value = 'foo';
      parent = get(Parent);
    }

    class Parent extends State {
      child = new Child();
      value = 'foo';
    }

    const { child } = Parent.new();
    const effect = vi.fn((it: Child) => {
      void it.value;
      void it.parent.value;
    });

    child.get(effect);

    child.value = 'bar';
    await expect(child).toHaveUpdated();
    expect(effect).toBeCalledTimes(2);

    child.parent.value = 'bar';
    await expect(child.parent).toHaveUpdated();
    expect(effect).toBeCalledTimes(3);
  });

  it('will inherit parent context', () => {
    class Foo extends State {}
    class Bar extends State {
      baz = use(Baz);
    }

    class Baz extends State {
      foo = get(Foo);
    }

    const context = new Context({ Foo, Bar });
    const bar = context.get(Bar, true);

    expect(bar.baz.foo).toBeInstanceOf(Foo);
  });

  it('will not be enumerable', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient = get(Ambient);
      foo = 'bar';
    }
    const test = Test.new();
    const ambient = Ambient.new();

    new Context({ ambient, test });

    expect(test.ambient).toBe(ambient);
    expect(Object.keys(test)).toMatchObject(['foo']);
  });
});

describe('downstream collection', () => {
  it('will collect children', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true);
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  });

  it('will collect multiple children', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true);
    }

    const parent = Parent.new();
    const child1 = Child.new();
    const child2 = Child.new();

    new Context({ parent }).push({ child1, child2 });

    expect(parent.children).toEqual([child1, child2]);
  });

  it('will not be enumerable', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true);
    }

    const parent = Parent.new();

    new Context({ parent }).push({ Child });

    expect(Object.keys(parent)).not.toContain('children');
    expect(parent.children).toEqual([expect.any(Child)]);
  });

  it('will collect a subclass', () => {
    abstract class Child extends State {}

    class Child2 extends Child {}
    class Parent extends State {
      children = get(Child, true);
    }

    const parent = Parent.new();
    const child = Child2.new();

    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  });

  it('will not register superclass', () => {
    class Child extends State {}
    class Child2 extends Child {}
    class Parent extends State {
      children = get(Child2, true);
    }

    const parent = Parent.new();

    new Context({ parent }).push({ Child });

    expect(parent.children.length).toBe(0);
  });

  it('will regsiter for superclass', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true);
    }
    class Parent2 extends Parent {}

    const parent = Parent2.new();

    new Context({ parent }).push({ Child });

    expect(parent.children.length).toBe(1);
  });

  it('will remove children which unmount', async () => {
    class Child extends State {
      value = 0;
    }
    class Parent extends State {
      children = get(Child, true);
    }

    const parent = Parent.new();
    const child1 = Child.new();
    const child2 = Child.new();

    const context = new Context({ parent });
    const context2 = context.push({ child1, child2 });

    expect(parent.children).toEqual([child1, child2]);

    context2.pop();

    await expect(parent).toHaveUpdated();
    expect(parent.children.length).toBe(0);
  });

  it('will collect own type', async () => {
    class Test extends State {
      tests = get(Test, true);
    }

    const test = Test.new('1');
    const test2 = Test.new('2');
    const test3 = Test.new('3');

    new Context({ test }).push({ test2 }).push({ test3 });

    expect(test.tests).toEqual([test2]);
    expect(test2.tests).toEqual([test3]);
  });

  it('will ignore redundant child', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, gotChild);
    }

    const gotChild = vi.fn();
    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child }).push({ child });

    expect(gotChild).toBeCalledTimes(1);
  });

  it('will register implicit', () => {
    class Baz extends State {}
    class Foo extends State {
      bar = new Bar();
    }
    class Bar extends State {
      baz = get(Baz, true, gotBaz);
    }

    const gotBaz = vi.fn();
    const foo = Foo.new();
    const baz = Baz.new();

    new Context({ foo }).push({ baz });

    expect(gotBaz).toBeCalledWith(baz, foo.bar);
  });

  it('will register for implicit', () => {
    class Baz extends State {}
    class Foo extends State {
      baz = get(Baz, true);
    }
    class Bar extends State {
      baz = new Baz();
    }

    const foo = Foo.new();
    const bar = Bar.new();

    new Context({ foo }).push({ bar });

    expect(foo.baz).toEqual([bar.baz]);
  });
});

describe('lifecycle callbacks', () => {
  it('will run callback on upstream mount', () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteCallback = vi.fn();

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const remote = Remote.new();
    const test = Test.new();

    new Context({ remote, test });

    expect(remoteCallback).toBeCalledTimes(1);
    expect(remoteCallback).toBeCalledWith(remote, test);
  });

  it('will run callback on downstream mount', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, gotChild);
    }

    const gotChild = vi.fn();
    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(gotChild).toBeCalledWith(child, parent);
  });

  it('will run cleanup on downstream unmount', async () => {
    const didRemove = vi.fn();
    const didAdd = vi.fn(() => didRemove);

    class Child extends State {
      value = 0;
    }
    class Parent extends State {
      children = get(Child, true, didAdd);
    }

    const parent = Parent.new();
    const child1 = Child.new();
    const child2 = Child.new();

    const context = new Context({ parent });
    const context2 = context.push({ child1, child2 });

    expect(didAdd).toBeCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);

    context2.pop();

    await expect(parent).toHaveUpdated();
    expect(didRemove).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);
  });

  it('will not register if callback returns false', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, hasChild);
    }

    const hasChild = vi.fn(() => false);
    const parent = Parent.new();
    const context = new Context({ parent });

    context.push({
      child: Child.new(),
      child2: Child.new()
    });

    expect(hasChild).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);

    context.push({ child: Child.new() });

    await expect(parent).not.toUpdate();
    expect(hasChild).toBeCalledTimes(3);
    expect(parent.children.length).toBe(0);
  });

  it('upstream callback is not reactive', async () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteCallback = vi.fn((remote: Remote) => {
      // Access value but should not subscribe
      void remote.value;
    });

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const remote = Remote.new();
    const test = Test.new();

    new Context({ remote, test });

    expect(remoteCallback).toBeCalledTimes(1);

    // Change should NOT trigger callback again
    remote.value = 'bar';
    await remote.set();

    expect(remoteCallback).toBeCalledTimes(1);
  });

  it('will run cleanup on state destruction', async () => {
    class Remote extends State {}

    const cleanup = vi.fn();
    const remoteCallback = vi.fn(() => cleanup);

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const remote = Remote.new();
    const test = Test.new();

    new Context({ remote, test });

    expect(remoteCallback).toBeCalledTimes(1);
    expect(cleanup).not.toBeCalled();

    test.set(null);

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will receive ready instance', async () => {
    const didSet = vi.fn();

    class Child extends State {
      value = set(undefined, didSet);
    }

    class Parent extends State {
      children = get(Child, true, (child) => {
        child.value = 'Hello';
      });
    }

    const context = new Context();

    context.push({ Parent }).push({ Child });

    expect(didSet).toBeCalledWith('Hello', undefined);
  });

  it('will cleanup before destroying', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, (child) => {
        didNotify();
        return () => {
          // this should occur before both
          // target and recipient are destroyed.
          expect(this.get(null)).toBe(false);
          expect(child.get(null)).toBe(false);
          didRemove();
        };
      });
    }

    const didNotify = vi.fn();
    const didRemove = vi.fn();

    const context = new Context();

    context.push({ Parent }).push({ Child });

    expect(didNotify).toBeCalledTimes(1);
    expect(didRemove).not.toBeCalled();

    context.pop();

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });

  it('will cleanup effects before destroying', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, () => {
        didNotify();
        this.get(() => {
          return didRemove;
        });
      });
    }

    const didNotify = vi.fn();
    const didRemove = vi.fn();

    const context = new Context({ Parent });
    const inner = context.push({ Child });

    expect(didNotify).toBeCalledTimes(1);
    expect(didRemove).not.toBeCalled();

    inner.pop();

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });
});

describe('async', () => {
  class Foo extends State {
    value = 'foobar';
  }

  it('will suspend if not ready', async () => {
    class Bar extends State {
      foo = get(Foo);
    }

    const bar = Bar.new();
    let caught: unknown;

    setTimeout(() => new Context({ Foo, bar }));

    try {
      void bar.foo;
      throw false;
    } catch (err) {
      expect(err).toBeInstanceOf(Promise);
      caught = err;
    }

    await expect(caught).resolves.toBeInstanceOf(Foo);
    expect(bar.foo).toBeInstanceOf(Foo);
  });
});
