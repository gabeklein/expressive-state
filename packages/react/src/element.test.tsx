import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, describe, vi } from 'vitest';
import React, { Suspense } from 'react';

import { mockError, mockPromise } from '../test.setup';
import { Component, Consumer, Provider, State, get, has, map } from '.';
import { pending } from '@expressive/mvc';

describe('instance element', () => {
  class Control extends Component {
    value = '';

    render() {
      return <span>{this.value}</span>;
    }
  }

  it('will render an existing instance', async () => {
    const instance = Control.new({ value: 'first' });
    const element = render(<>{instance}</>, { reactStrictMode: true });

    expect(React.isValidElement(instance)).toBe(true);
    expect((instance as any).$$typeof).toBe(
      (React.createElement('template') as any).$$typeof
    );
    expect((instance as any).key).toBe(String(instance));
    expect(screen).toHaveText('first');

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen).toHaveText('second');

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will activate a plain-constructed instance', async () => {
    const instance = new Control({ value: 'first' });

    render(<>{instance}</>);

    expect(screen).toHaveText('first');

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen).toHaveText('second');
  });

  it('will use an overridden key', () => {
    class Custom extends Control {
      override readonly key = 'custom';
    }

    const instance = Custom.new({});

    expect(React.isValidElement(instance)).toBe(true);
    expect(instance.key).toBe('custom');
  });

  it('will render an array', async () => {
    const error = mockError();
    const first = Control.new({ value: 'foo' });
    const second = Control.new({ value: 'bar' });
    const collection = [first, second];
    const element = render(<>{collection}</>);

    expect(element.container.textContent).toBe('foobar');
    expect(error).not.toBeCalled();
    expect((first as any)._store).not.toBe((second as any)._store);

    await act(async () => {
      first.value = 'baz';
      second.value = 'qux';
    });

    expect(element.container.textContent).toBe('bazqux');

    element.unmount();

    expect(first.get(null)).toBe(false);
    expect(second.get(null)).toBe(false);
  });

  it('will render one instance in multiple places', async () => {
    const error = mockError();
    const instance = Control.new({ value: 'first' });
    const element = render(
      <>
        <section>{instance}</section>
        <aside>{instance}</aside>
      </>
    );

    expect(screen.getAllByText('first')).toHaveLength(2);
    expect(error).not.toBeCalled();

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(2);

    element.rerender(<>{instance}</>);

    expect(screen.getAllByText('second')).toHaveLength(1);

    await act(async () => {
      instance.value = 'third';
    });

    expect(screen.getAllByText('third')).toHaveLength(1);

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will render an owned collection through its owner', async () => {
    const error = mockError();

    class Item extends Component {
      value = '';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends Component {
      items = [Item.new({ value: 'a' }), Item.new({ value: 'b' })];

      remove(item: Item) {
        item.set(null);
        this.items = this.items.filter((x) => x !== item);
      }

      render() {
        return <>{this.items}</>;
      }
    }

    const owner = Owner.new({});
    const [first] = owner.items;
    const element = render(<>{owner}</>);

    expect(element.container.textContent).toBe('ab');

    await act(async () => {
      owner.items = [...owner.items, Item.new({ value: 'c' })];
    });

    expect(element.container.textContent).toBe('abc');

    await act(async () => {
      owner.remove(first);
    });

    expect(element.container.textContent).toBe('bc');
    expect(first.get(null)).toBe(true);
    expect(error).not.toBeCalled();

    element.unmount();

    for (const item of owner.items)
      expect(item.get(null)).toBe(false);
  });

  it('will render a spawned collection through its owner', async () => {
    const error = mockError();

    class Item extends Component {
      label = '';

      render() {
        return <span>{this.key}={this.label};</span>;
      }
    }

    class Store extends Component {
      items = has(Item);

      render() {
        return <>{[...this.items]}</>;
      }
    }

    const store = Store.new({});
    const first = store.items.add({ key: 'a' });
    const element = render(<>{store}</>);

    expect(first.key).toBe('a');
    expect(element.container.textContent).toBe('a=;');

    await act(async () => {
      first.label = 'apple';
    });

    expect(element.container.textContent).toBe('a=apple;');

    await act(async () => {
      store.items.add({ key: 'b' }).label = 'berry';
    });

    expect(element.container.textContent).toBe('a=apple;b=berry;');

    await act(async () => {
      store.items.delete(first);
    });

    expect(element.container.textContent).toBe('b=berry;');
    expect(first.get(null)).toBe(true);
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will resolve provided context from spawned member', async () => {
    const error = mockError();

    class Theme extends State {
      color = '';
    }

    class Item extends Component {
      theme = get(Theme);

      render() {
        return <span>{this.theme.color}</span>;
      }
    }

    class Store extends Component {
      items = has(Item);

      render() {
        return <>{[...this.items]}</>;
      }
    }

    let store!: Store;
    let item!: Item;

    const element = render(
      <Provider for={Theme} color="red">
        <Store is={(x) => (store = x)} />
      </Provider>
    );

    await act(async () => {
      item = store.items.add({ key: 'a' });
    });

    expect(item.theme.color).toBe('red');
    expect(screen.getByText('red')).toBeDefined();
    expect(error).not.toBeCalled();

    element.unmount();

    expect(item.get(null)).toBe(true);
  });

  it('will render a parent-owned instance', async () => {
    const error = mockError();

    class Item extends Component {
      owner = get(Owner);
      value = '';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends State {
      item = new Item({ value: 'a' });
    }

    const owner = Owner.new({});
    const { item } = owner;

    expect(item.owner).toBe(owner);

    const element = render(<>{item}</>);

    expect(element.container.textContent).toBe('a');

    await act(async () => {
      item.value = 'b';
    });

    expect(element.container.textContent).toBe('b');

    await act(async () => {
      owner.set(null);
    });

    expect(item.get(null)).toBe(true);
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will keep a child placement across owner renders', async () => {
    const error = mockError();

    class Child extends Component {
      value = 'a';

      render() {
        return <span>{this.value}</span>;
      }
    }

    class Owner extends Component {
      label = '';
      child = new Child({});

      render() {
        return (
          <>
            <i>{this.label}</i>
            {this.child}
          </>
        );
      }
    }

    const owner = Owner.new({});
    const { child } = owner;
    const element = render(<>{owner}</>);

    expect(element.container.textContent).toBe('a');

    await act(async () => {
      owner.label = '!';
    });

    expect(child.get(null)).toBe(false);

    await act(async () => {
      child.value = 'b';
    });

    expect(element.container.textContent).toBe('!b');
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will warn when rendering one instance twice as siblings', () => {
    const error = mockError();
    const instance = Control.new({ value: 'first' });
    const element = render(<>{[instance, instance]}</>);

    expect(error.mock.calls.flat().join(' ')).toContain('same key');

    element.unmount();
  });

  it('will keep a sibling placement when one unmounts', async () => {
    const error = mockError();
    const instance = Control.new({ value: 'first' });

    const View = ({ both }: { both: boolean }) => (
      <>
        {both && <section>{instance}</section>}
        <aside>{instance}</aside>
      </>
    );

    const element = render(<View both />);

    expect(screen.getAllByText('first')).toHaveLength(2);

    element.rerender(<View both={false} />);

    expect(screen.getAllByText('first')).toHaveLength(1);

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(1);
    expect(instance.get(null)).toBe(false);
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will render again after unmount', async () => {
    const instance = Control.new({ value: 'first' });
    const first = render(<>{instance}</>);

    expect(screen.getAllByText('first')).toHaveLength(1);

    first.unmount();

    expect(instance.get(null)).toBe(false);

    const second = render(<>{instance}</>);

    expect(screen.getAllByText('first')).toHaveLength(1);

    await act(async () => {
      instance.value = 'second';
    });

    expect(screen.getAllByText('second')).toHaveLength(1);

    second.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will not mount a placed instance', () => {
    const didMount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
      }

      render() {
        return <span>hello</span>;
      }
    }

    const instance = Test.new();
    const element = render(
      <>
        <section>{instance}</section>
        <aside>{instance}</aside>
      </>
    );

    expect(didMount).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will resolve ancestor provided at placement', async () => {
    const error = mockError();

    class Theme extends State {
      color = '';
    }

    class Swatch extends Component {
      theme = get(Theme);

      render() {
        return <span>{this.theme.color}</span>;
      }
    }

    class Slot extends Component {
      render() {
        return <Swatch />;
      }
    }

    const instance = Slot.new({});
    const element = render(
      <>
        <Provider for={Theme} color="red">
          <section>{instance}</section>
        </Provider>
        <Provider for={Theme} color="blue">
          <aside>{instance}</aside>
        </Provider>
      </>
    );

    expect(screen.getByText('red')).toBeDefined();
    expect(screen.getByText('blue')).toBeDefined();
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });

  it('will resolve its own context per placement', async () => {
    const error = mockError();

    class Item extends Component {
      value = '';

      render() {
        return <Consumer for={Item}>{(self) => <span>{self.value}</span>}</Consumer>;
      }
    }

    const instance = Item.new({ value: 'a' });

    const View = ({ both }: { both: boolean }) => (
      <>
        {both && <section>{instance}</section>}
        <aside>{instance}</aside>
      </>
    );

    const element = render(<View both />);

    expect(screen.getAllByText('a')).toHaveLength(2);

    element.rerender(<View both={false} />);

    expect(screen.getAllByText('a')).toHaveLength(1);

    await act(async () => {
      instance.value = 'b';
    });

    expect(screen.getAllByText('b')).toHaveLength(1);
    expect(error).not.toBeCalled();

    element.unmount();

    expect(instance.get(null)).toBe(false);
  });
});

describe('repeated placement of a child field', () => {
  class Panel extends Component {
    text = '';

    get count() {
      return this.text.trim() ? this.text.trim().split(/\s+/).length : 0;
    }

    render() {
      const { text, count } = this;

      return (
        <i>
          <b data-testid="len">{text.length}</b>
          <u data-testid="count">{count}</u>
          <textarea
            data-testid="input"
            value={text}
            onChange={(e) => (this.text = e.target.value)}
          />
        </i>
      );
    }
  }

  /**
   * Type into the panel, read what it rendered, then detach and reattach it -
   * five times. Writes land in an event handler, where the owner's `this` is a
   * render proxy.
   */
  async function cycle() {
    const seen: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const text = Array.from({ length: i }, (_, n) => `w${n}`).join(' ');

      await act(async () => {
        fireEvent.change(screen.getByTestId('input'), { target: { value: text } });
      });

      seen.push(
        `${screen.getByTestId('len').textContent}/${
          screen.getByTestId('count').textContent
        }`
      );

      await act(async () => {
        fireEvent.click(screen.getByText('off'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('on'));
      });
    }

    return seen;
  }

  const expected = ['2/1', '5/2', '8/3', '11/4', '14/5'];

  it('will recompute for a plain-constructed instance', async () => {
    class Host extends Component {
      panel = new Panel();
      active?: Panel = this.panel;

      render() {
        return (
          <>
            <button onClick={() => (this.active = this.panel)}>on</button>
            <button onClick={() => (this.active = undefined)}>off</button>
            <span>{this.active}</span>
          </>
        );
      }
    }

    render(<>{Host.new()}</>);

    expect(await cycle()).toEqual(expected);
  });

  it('will recompute for an activated instance', async () => {
    class Host extends Component {
      panel = Panel.new();
      active?: Panel = this.panel;

      render() {
        return (
          <>
            <button onClick={() => (this.active = this.panel)}>on</button>
            <button onClick={() => (this.active = undefined)}>off</button>
            <span>{this.active}</span>
          </>
        );
      }
    }

    render(<>{Host.new()}</>);

    expect(await cycle()).toEqual(expected);
  });

  it('will recompute for an owned element', async () => {
    class Host extends Component {
      shown = true;

      render() {
        return (
          <>
            <button onClick={() => (this.shown = true)}>on</button>
            <button onClick={() => (this.shown = false)}>off</button>
            <span>{this.shown ? <Panel /> : null}</span>
          </>
        );
      }
    }

    render(<>{Host.new()}</>);

    expect(await cycle()).toEqual(expected);
  });

  it('will keep a child assigned through a render proxy', async () => {
    class Host extends Component {
      panel = new Panel();
      active?: Panel = this.panel;

      render() {
        return (
          <>
            <button onClick={() => (this.active = this.panel)}>on</button>
            <button onClick={() => (this.active = undefined)}>off</button>
            <span>{this.active}</span>
          </>
        );
      }
    }

    const host = Host.new();

    render(<>{host}</>);

    await act(async () => {
      fireEvent.click(screen.getByText('off'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('on'));
    });

    expect(Object.is(host.is.active, host.panel)).toBe(true);
  });
});

describe('map element', () => {
  class Item extends Component {
    label = '';

    render() {
      return <span>{this.key}={this.label};</span>;
    }
  }

  it('will render a keyed map placed directly', async () => {
    const error = mockError();

    class Store extends Component {
      items = map<string, Item>();

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    const first = Item.new({ key: 'a', label: 'apple' });
    store.items.set('a', first);
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=apple;');

    await act(async () => {
      store.items.set('b', Item.new({ key: 'b', label: 'berry' }));
    });

    expect(element.container.textContent).toBe('a=apple;b=berry;');

    await act(async () => {
      store.items.delete('a');
    });

    expect(element.container.textContent).toBe('b=berry;');
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will render a spawning map placed directly', async () => {
    class Store extends Component {
      items = map((key: string) => new Item({ key, label: key }));

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    store.items.set('a');
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=a;');

    await act(async () => {
      store.items.set('b');
    });

    expect(element.container.textContent).toBe('a=a;b=b;');

    element.unmount();
  });

  it('will transition a direct map subscriber', async () => {
    const gate = mockPromise<void>();

    class Suspends extends Component {
      label = '';

      render() {
        if (this.label === 'wait') throw gate;
        return <span>{this.key}={this.label};</span>;
      }
    }

    class Store extends Component {
      items = map<string, Suspends>();

      render() {
        return <Suspense fallback={<i>loading</i>}>{this.items}</Suspense>;
      }
    }

    const store = Store.new({});
    store.items.set('a', Suspends.new({ key: 'a', label: 'ready' }));
    const element = render(<>{store}</>);

    await act(async () => {
      pending(() => {
        store.items.set('b', Suspends.new({ key: 'b', label: 'wait' }));
      });
      await Promise.resolve();
    });

    expect(element.container.textContent).toBe('a=ready;');

    store.items.delete('b');
    gate.resolve();
    await act(async () => {});
  });
});

describe('seam', () => {
  it('will seam host elements without a dev store', async () => {
    vi.resetModules();

    await import('.');

    const { Runtime } = await import('./runtime');
    const { seam } = await import('./element');
    const template = { $$typeof: Symbol.for('react.transitional.element') };

    vi.spyOn(Runtime, 'createElement').mockReturnValueOnce(template);

    const self = {} as any;
    const type = () => null;

    expect(seam(self, false, type, 'key')).toBe(template.$$typeof);
    expect(self.type).toBe(type);
    expect(self.key).toBe('key');
  });
});

describe('collection element', () => {
  class Item extends Component {
    label = '';

    render() {
      return <span>{this.key}={this.label};</span>;
    }
  }

  it('will render a pool placed directly', async () => {
    const error = mockError();

    class Store extends Component {
      items = has(Item);

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    const first = store.items.add({ key: 'a' });
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=;');

    await act(async () => {
      first.label = 'apple';
    });

    expect(element.container.textContent).toBe('a=apple;');

    await act(async () => {
      store.items.add({ key: 'b' }).label = 'berry';
    });

    expect(element.container.textContent).toBe('a=apple;b=berry;');

    await act(async () => {
      first.set(null);
    });

    expect(element.container.textContent).toBe('b=berry;');
    expect(error).not.toBeCalled();

    element.unmount();
  });

  it('will render a list placed directly', async () => {
    class Store extends Component {
      items = has([Item.new({ key: 'a', label: 'x' })]);

      render() {
        return <>{this.items}</>;
      }
    }

    const store = Store.new({});
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=x;');

    await act(async () => {
      store.items.push(Item.new({ key: 'b', label: 'y' }));
    });

    expect(element.container.textContent).toBe('a=x;b=y;');

    element.unmount();
  });

  it('will transition a direct list subscriber', async () => {
    const gate = mockPromise<void>();

    class Suspends extends Component {
      label = '';

      render() {
        if (this.label === 'wait') throw gate;
        return <span>{this.key}={this.label};</span>;
      }
    }

    class Store extends Component {
      items = has([Suspends.new({ key: 'a', label: 'ready' })]);

      render() {
        return <Suspense fallback={<i>loading</i>}>{this.items}</Suspense>;
      }
    }

    const store = Store.new({});
    const element = render(<>{store}</>);

    await act(async () => {
      pending(() => {
        store.items.push(Suspends.new({ key: 'b', label: 'wait' }));
      });
      await Promise.resolve();
    });

    expect(element.container.textContent).toBe('a=ready;');

    store.items.pop();
    gate.resolve();
    await act(async () => {});
  });

  it('will render the same collection in multiple places', async () => {
    class Store extends Component {
      items = has(Item);

      render() {
        return <>{this.items}{this.items}</>;
      }
    }

    const store = Store.new({});
    store.items.add({ key: 'a', label: 'z' });
    const element = render(<>{store}</>);

    expect(element.container.textContent).toBe('a=z;a=z;');

    element.unmount();
  });
});

describe('collection concurrent consistency', () => {
  class Item extends Component {
    label = '';

    render() {
      return <span>{this.key}={this.label};</span>;
    }
  }

  function harness(content: React.ReactNode, write: () => void) {
    const commits: (string | null)[][] = [];
    let reveal!: () => void;
    let scheduled = false;

    function Slow({ index }: { index: number }) {
      const started = performance.now();

      while (performance.now() - started < 1) {}

      if (!index && !scheduled) {
        scheduled = true;
        setTimeout(write);
      }

      return null;
    }

    function Recorder() {
      const root = React.useRef<HTMLDivElement>(null);

      React.useLayoutEffect(() => {
        commits.push(
          [...root.current!.querySelectorAll('div')].map((node) => node.textContent)
        );
      });

      return <div ref={root}>{content}</div>;
    }

    function App() {
      const [shown, setShown] = React.useState(false);
      reveal = () => React.startTransition(() => setShown(true));
      return shown && <Recorder />;
    }

    const view = render(<App />);

    return { commits, view, reveal: () => reveal(), Slow };
  }

  it('will not commit mixed revisions across repeated pool placements', async () => {
    class Store extends Component {
      items = has(Item);

      render() {
        const { items } = this;
        return (
          <>
            {Array.from({ length: 40 }, (_, index) => (
              <div key={index}>
                <Slow index={index} />
                {items}
              </div>
            ))}
          </>
        );
      }
    }

    const store = Store.new({});
    store.items.add({ key: 'a', label: 'a' });

    const { commits, view, reveal, Slow } = harness(<>{store}</>, () => {
      store.items.add({ key: 'b', label: 'b' });
    });

    reveal();

    await waitFor(() => {
      expect(commits[0]).toHaveLength(40);
    });

    expect(new Set(commits[0]).size).toBe(1);

    await waitFor(() => {
      expect(view.container.textContent).toBe('a=a;b=b;'.repeat(40));
    });
  });

  it('will not commit mixed revisions across repeated map placements', async () => {
    class Store extends Component {
      items = map((key: string) => new Item({ key, label: key }));

      render() {
        const { items } = this;
        return (
          <>
            {Array.from({ length: 40 }, (_, index) => (
              <div key={index}>
                <Slow index={index} />
                {items}
              </div>
            ))}
          </>
        );
      }
    }

    const store = Store.new({});
    store.items.set('a');

    const { commits, view, reveal, Slow } = harness(<>{store}</>, () => {
      store.items.set('b');
    });

    reveal();

    await waitFor(() => {
      expect(commits[0]).toHaveLength(40);
    });

    expect(new Set(commits[0]).size).toBe(1);

    await waitFor(() => {
      expect(view.container.textContent).toBe('a=a;b=b;'.repeat(40));
    });
  });
});
