import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';

import { Component, Provider, State } from '.';
import { Runtime } from './adapter';
import { mockPromise } from '../test.setup';

describe('Component.act', () => {
  class Data extends State {
    value = 'a';
  }

  /** A screen which suspends on `b` until its gate resolves. */
  function scenario() {
    const gate = mockPromise<void>();
    const data = Data.new();
    let ready = false;

    gate.then(() => {
      ready = true;
    });

    const Screen = () => {
      const { value } = Data.get();

      if (value === 'b' && !ready) throw gate;

      return <span>{value}</span>;
    };

    const Content = () => (
      <Suspense fallback={<i>fallback</i>}>
        <Screen />
      </Suspense>
    );

    return { gate, data, Content };
  }

  it('will hold current content until the replacement is presented', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    class Shell extends Component {
      busy = false;

      act(work: () => void) {
        this.busy = true;
        return super.act(work).then(() => {
          this.busy = false;
        });
      }

      render() {
        return <Content />;
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      shell.act(() => {
        data.value = 'b';
      });
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('a');
    expect(shell.busy).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('b');
    expect(shell.busy).toBe(false);
  });

  it('will settle on dispatch where the host cannot report', async () => {
    const { useTransition } = Runtime;
    delete Runtime.useTransition;

    try {
      const { gate, data, Content } = scenario();
      let shell!: Shell;
      let settled = false;

      class Shell extends Component {
        act(work: () => void) {
          return super.act(work);
        }

        render() {
          return <Content />;
        }
      }

      const view = render(
        <Provider for={data}>
          <Shell is={(i) => (shell = i)} />
        </Provider>
      );

      await act(async () => {});

      await act(async () => {
        shell.act(() => {
          data.value = 'b';
        }).then(() => {
          settled = true;
        });
        await Promise.resolve();
      });

      expect(settled).toBe(true);

      await act(async () => {
        gate.resolve();
        await gate;
      });

      expect(view.container.textContent).toBe('b');
    } finally {
      Runtime.useTransition = useTransition;
    }
  });

  it('will settle on dispatch before mount', async () => {
    const data = Data.new();
    const shell = (class extends Component {}).new();
    let settled = false;

    await shell.act(() => {
      data.value = 'b';
    }).then(() => {
      settled = true;
    });

    expect(settled).toBe(true);
  });

  it('will track pending without an own transition', async () => {
    const { gate, data, Content } = scenario();
    let shell!: Shell;

    const Status = () => <b>{Shell.get().pending ? 'busy' : 'idle'}</b>;

    class Shell extends Component {
      pending = false;

      go(to: string) {
        this.pending = true;
        this.act(() => {
          data.value = to;
        }).then(() => {
          this.pending = false;
        });
      }

      render() {
        return (
          <>
            <Status />
            <Content />
          </>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    expect(view.container.textContent).toBe('idlea');

    await act(async () => {
      shell.go('b');
      await Promise.resolve();
    });

    expect(view.container.querySelector('i')).toBeNull();
    expect(view.container.textContent).toBe('busya');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('idleb');
  });

});

describe('Driver teardown', () => {
  it('will settle work left pending by an unmount', async () => {
    class Data extends State {
      value = 'a';
    }

    const data = Data.new();
    const gate = mockPromise<void>();
    let shell!: Shell;
    let settled = false;

    const Screen = () => {
      const { value } = Data.get();
      if (value === 'b') throw gate;
      return <span>{value}</span>;
    };

    class Shell extends Component {
      render() {
        return (
          <Suspense fallback={<i>fallback</i>}>
            <Screen />
          </Suspense>
        );
      }
    }

    const view = render(
      <Provider for={data}>
        <Shell is={(i) => (shell = i)} />
      </Provider>
    );

    await act(async () => {});

    await act(async () => {
      shell.act(() => {
        data.value = 'b';
      }).then(() => {
        settled = true;
      });
      await Promise.resolve();
    });

    expect(settled).toBe(false);

    await act(async () => {
      view.unmount();
      await Promise.resolve();
    });

    expect(settled).toBe(true);
  });
});
