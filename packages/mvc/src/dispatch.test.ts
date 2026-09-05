import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockError, mockPromise } from '../test.setup';
import { watch } from './observable';
import { enqueue, schedule } from './dispatch';
import { State } from './state';

describe('dispatch', () => {
  const error = mockError();

  function transition(log: string[]) {
    return (work: () => void) => {
      log.push('transition:start');
      work();
      log.push('transition:end');
    };
  }

  it('will transition immediate and queued work', async () => {
    const log: string[] = [];

    schedule(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'));
    }, transition(log));

    expect(log).toEqual([
      'transition:start',
      'work',
      'transition:end'
    ]);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'work',
      'transition:end',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will preserve priority through nested and cascading work', async () => {
    const log: string[] = [];
    const host = transition(log);

    schedule(() => {
      schedule(() => enqueue(() => {
        log.push('first');
        enqueue(() => log.push('second'));
      }), host);
    }, host);

    expect(log).toEqual(['transition:start', 'transition:end']);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'transition:end',
      'transition:start',
      'first',
      'transition:end',
      'transition:start',
      'second',
      'transition:end'
    ]);
  });

  it('will let urgent priority win for one handler', async () => {
    const log: string[] = [];
    const mixed = () => log.push('mixed');

    schedule(() => {
      enqueue(mixed);
      enqueue(() => log.push('deferred'));
    }, transition(log));
    enqueue(mixed);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'transition:end',
      'mixed',
      'transition:start',
      'deferred',
      'transition:end'
    ]);
  });

  it('will only upgrade inseparable watchers to urgent', async () => {
    class Model extends State {
      deferred = 0;
      urgent = 0;
    }

    const model = Model.new();
    const priorities: string[] = [];
    let transitioning = false;
    const host = (work: () => void) => {
      transitioning = true;
      work();
      transitioning = false;
    };

    watch(model, ({ deferred }) => {
      if (deferred) priorities.push(`deferred:${transitioning}`);
    });
    watch(model, ({ deferred, urgent }) => {
      if (deferred || urgent) priorities.push(`mixed:${transitioning}`);
    });

    schedule(() => void (model.deferred = 1), host);
    model.urgent = 1;

    await flushMicrotasks();

    expect(priorities).toEqual(['deferred:true', 'mixed:false']);
  });

  it('will squash final state and transition cascading watchers', async () => {
    class Model extends State {
      source = 0;
      derived = 0;
    }

    const model = Model.new();
    const values: string[] = [];
    let transitioning = false;
    const host = (work: () => void) => {
      transitioning = true;
      work();
      transitioning = false;
    };

    watch(model, ({ source }) => void (model.derived = source * 2));
    watch(model, ({ derived }) => {
      if (derived) values.push(`${derived}:${transitioning}`);
    });

    schedule(() => {
      model.source = 1;
      model.source = 2;
    }, host);

    await flushMicrotasks();

    expect(values).toEqual(['4:true']);
  });

  it('will squash stacked handlers and continue after errors', async () => {
    const after = vi.fn();
    const expected = new Error('failed');
    const fail = () => {
      throw expected;
    };

    enqueue(fail);
    enqueue(fail);
    enqueue(after);

    await flushMicrotasks();

    expect(error).toHaveBeenCalledWith(expected);
    expect(after).toHaveBeenCalledOnce();
  });

  it('will settle when the host reports the replay presented', async () => {
    const presented = mockPromise<void>();
    const log: string[] = [];

    const settled = schedule(() => {
      enqueue(() => log.push('dispatch'));
    }, (work) => {
      work();
      return presented;
    });

    let done = false;
    settled.then(() => (done = true));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);
    expect(done).toBe(false);

    presented.resolve();
    await flushMicrotasks();

    expect(done).toBe(true);
  });

  it('will settle a second transition when its own replay is presented', async () => {
    const presented = mockPromise<void>();
    const host = (work: () => void) => {
      work();
      return presented;
    };

    const handler = vi.fn();
    const done: string[] = [];

    schedule(() => enqueue(handler), host).then(() => done.push('first'));
    schedule(() => enqueue(handler), host).then(() => done.push('second'));

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(done).toEqual([]);

    presented.resolve();
    await flushMicrotasks();

    expect(done).toEqual(['first', 'second']);
  });

  it('will await updates cascading from a replay', async () => {
    const gates: ReturnType<typeof mockPromise<void>>[] = [];
    const host = (work: () => void) => {
      work();

      const gate = mockPromise<void>();
      gates.push(gate);
      return gate;
    };

    const log: string[] = [];

    schedule(() => enqueue(() => {
      log.push('source');
      enqueue(() => log.push('derived'));
    }), host).then(() => log.push('settled'));

    await flushMicrotasks();

    // gates: [0] the scheduling bracket, [1] source replay, [2] derived replay
    gates[1].resolve();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    gates[2].resolve();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived', 'settled']);
  });

  it('will release every claim on a handler urgency strips', async () => {
    const host = (work: () => void) => {
      work();
      return mockPromise<void>();
    };

    const handler = () => {};
    const settled: string[] = [];

    schedule(() => enqueue(handler), host).then(() => settled.push('first'));
    schedule(() => enqueue(handler), host).then(() => settled.push('second'));
    enqueue(handler);

    await flushMicrotasks();

    expect(settled).toEqual(['first', 'second']);
  });

  it('will settle when the host reports a failed replay', async () => {
    const presented = mockPromise<void>();

    const settled = schedule(() => {
      enqueue(() => {});
    }, (work) => {
      work();
      return presented;
    });

    let done = false;
    settled.then(() => (done = true));

    presented.reject(new Error('abandoned'));
    await flushMicrotasks();

    expect(done).toBe(true);
  });
});
