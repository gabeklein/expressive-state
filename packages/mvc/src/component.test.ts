import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockWarn } from '../test.setup';
import { Component } from './component';
import { Context } from './context';
import { pending } from './dispatch';

it('will default fallback to null', () => {
  const foo = Component.new({});

  expect(foo.fallback).toBe(null);
});

it('will construct without props', () => {
  const foo = Component.new();

  expect(foo.fallback).toBe(null);
});

it('will accept fallback as prop', () => {
  const foo = Component.new({ fallback: 'Loading' });

  expect(foo.fallback).toBe('Loading');
});

it('will render children by default', () => {
  const foo = Component.new({ children: 'hello' });

  expect(foo.render()).toBe('hello');
});

it('will render null without children', () => {
  const foo = Component.new({});

  expect(foo.render()).toBe(null);
});

it('will derive key from instance identity', () => {
  const foo = Component.new({});

  expect(foo.key).toBe(String(foo));
  expect(foo.hasOwnProperty('key')).toBe(false);
  expect(Object.keys(foo.get())).not.toContain('key');
});

it('will allow key override', () => {
  class Foo extends Component {
    override readonly key = 'foo';
  }

  const foo = Foo.new({});

  expect(foo.key).toBe('foo');
  expect(Object.keys(foo)).not.toContain('key');
  expect(Object.keys(foo.get())).not.toContain('key');
  expect(() => ((foo as any).key = 'bar')).toThrow();
});

it('will lock key after imperative write', () => {
  const foo = Component.new({ });

  (foo as any).key = 'imperative';

  expect(foo.key).toBe('imperative');
  expect(Object.keys(foo.get())).not.toContain('key');
  expect(() => ((foo as any).key = 'again')).toThrow();
});

it('will call is callback once with instance', () => {
  const is = vi.fn();
  const foo = Component.new({ is });

  expect(is).toBeCalledWith(foo);
  expect(is).toBeCalled();

  // ressigning props from another render.
  (foo as any).props = { is };

  expect(is).toHaveBeenCalledTimes(1);
});

it('will merge state when props reassigned', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  expect(foo.value).toBe(5);
  expect(foo.other).toBe(2);

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.value).toBe(7);
});

it('will reset omitted props on reassignment', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.other).toBeUndefined();
});

// Seam: React may instantiate the class twice with the same props object
// (e.g. StrictMode / reconciliation) before init completes. The second
// construction must return the first instance, not a duplicate.
it('will dedupe construction by props object', () => {
  const props = { value: 1 };

  const a = new Component(props);
  const b = new Component(props);

  expect(b).toBe(a);
});

it('will release the twin discarded by dedupe', async () => {
  const warn = mockWarn();
  const props = { value: 1 };

  const a = new Component(props);
  const b = new Component(props);

  expect(b).toBe(a);

  await flushMicrotasks();

  expect(warn).toBeCalledTimes(1);
  expect(warn).toBeCalledWith(expect.stringContaining(String(a)));
});

// Seam: React passes context as a constructor argument alongside props.
// Context instances must be filtered so they never apply as state overlays.
it('will ignore Context passed as constructor argument', () => {
  class Foo extends Component {
    value?: number = 10;
  }

  const foo = Foo.new({ value: 5 }, new Context() as any);

  expect(foo.value).toBe(5);
  expect(Object.keys(foo.get())).not.toContain('0');
});

describe('render chain', () => {
  // Render layering: a subclass authors content; each super render up the
  // prototype chain wraps it as `children`, base-outermost. Asserted directly
  // on the composed `render` - no host needed.
  it('will compose subclass render as children of super', () => {
    class Outer extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        return ['outer', props.children];
      }
    }

    class Inner extends Outer {
      render(): Component.Node {
        return 'content';
      }
    }

    expect(Inner.new({}).render()).toEqual(['outer', 'content']);
  });

  it('will nest three levels inner to outer', () => {
    class A extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        return { a: props.children };
      }
    }

    class B extends A {
      render(props = {} as { children?: unknown }): Component.Node {
        return { b: props.children };
      }
    }

    class C extends B {
      render(): Component.Node {
        return 'leaf';
      }
    }

    // A (outermost) wraps B wraps C (innermost content).
    expect(C.new({}).render()).toEqual({ a: { b: 'leaf' } });
  });

  it('will bind each composed layer to live instance state', () => {
    class Frame extends Component {
      title = 'Base';

      render(props = {} as { children?: unknown }): Component.Node {
        return [this.title, props.children];
      }
    }

    class Page extends Frame {
      body = 'Hello';

      render(): Component.Node {
        return this.body;
      }
    }

    const page = Page.new({});

    expect(page.render()).toEqual(['Base', 'Hello']);

    // Both layers read `this` off the same instance - render reflects updates.
    page.title = 'Updated';
    page.body = 'World';

    expect(page.render()).toEqual(['Updated', 'World']);
  });

  // Documented footgun: a wrapper that never reads `props.children` drops the
  // derived content. The children getter is lazy, so inner never even runs.
  it('will drop derived content if wrapper omits children', () => {
    const inner = vi.fn(() => 'never seen');

    class Shell extends Component {
      render(): Component.Node {
        return 'shell only';
      }
    }

    class Lost extends Shell {
      render(): Component.Node {
        return inner();
      }
    }

    expect(Lost.new({}).render()).toBe('shell only');
    expect(inner).not.toHaveBeenCalled();
  });

  it('will preserve identity for single-level override', () => {
    class Solo extends Component {
      render(): Component.Node {
        return 'just me';
      }
    }

    // One override composes with the pass-through default to exactly itself.
    expect(Solo.new({}).render()).toBe('just me');
  });

  // Intentional inverse of the footgun: a base may opt out of wrapping by
  // detecting that a subclass supplied content. Composition synthesizes a fresh
  // `children`, so it is not identical to the original `this.props.children`.
  it('lets a base defer to a subclass render via children identity', () => {
    class Base extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        if (props.children !== this.props.children)
          return props.children;

        return ['base', props.children];
      }
    }

    class Override extends Base {
      render(): Component.Node {
        return 'replaced';
      }
    }

    class Passthrough extends Base {}

    // Subclass authored a render -> base defers, no wrapping.
    expect(Override.new({}).render()).toBe('replaced');

    // Plain base and render-less subclass keep the base output (no composition
    // layer, so `children` is the original props.children). The framework
    // invokes render with the instance's own props - mirror that here.
    const base = Base.new({ children: 'x' });
    const pass = Passthrough.new({ children: 'y' });
    expect(base.render(base.props)).toEqual(['base', 'x']);
    expect(pass.render(pass.props)).toEqual(['base', 'y']);
  });
});

describe('leading function argument', () => {
  it('will run as init callback (State semantics)', () => {
    class Test extends Component {
      value = '';
    }

    const test = Test.new(function (this: Test) {
      this.value = 'initialized';
    });

    expect(test.value).toBe('initialized');
  });

  it('will register returned function as cleanup', () => {
    const cleanup = vi.fn();
    const test = Component.new(() => cleanup);

    expect(cleanup).not.toHaveBeenCalled();
    test.set(null);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('props (static types)', () => {
  class Test extends Component {
    value = 0;
    onClick = () => {};
    readonly id = 1;
    get computed() { return this.value * 2 }
    get pair() { return this.value }
    set pair(next: number) { this.value = next }
    method() {}
  }

  it('will accept writable fields and callbacks', () => {
    const props: Component.StateProps<Test> = {
      value: 1,
      onClick: () => {},
      pair: 2,
      method() {}
    };

    expect(props).toBeDefined();
  });

  it('will reject get-only accessors', () => {
    const props: Component.StateProps<Test> = {
      // @ts-expect-error - get-only accessor is not a settable prop
      computed: 4
    };

    expect(props).toBeDefined();
  });

  it('will reject readonly fields', () => {
    const props: Component.StateProps<Test> = {
      // @ts-expect-error - readonly field is not a settable prop
      id: 2
    };

    expect(props).toBeDefined();
  });
});

describe('transition', () => {
  it('will run work and resolve where nothing observes', async () => {
    class Test extends Component {
      value = 'a';
    }

    const test = Test.new();
    let settled = false;

    await pending(() => {
      test.value = 'b';
    }).then(() => {
      settled = true;
    });

    expect(test.value).toBe('b');
    expect(settled).toBe(true);
  });
});
