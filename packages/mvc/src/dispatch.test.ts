import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks, mockError } from '../test.setup';
import { watch } from './observable';
import { enqueue, pending } from './dispatch';
import { State } from './state';

describe('dispatch', () => {
  const error = mockError();

  function scheduler(log: string[], name = 'transition') {
    return (work: () => void) => {
      log.push(`${name}:start`);
      work();
      log.push(`${name}:end`);
    };
  }

  it('will replay queued work through the subscriber own scheduler', async () => {
    const log: string[] = [];

    pending(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'), scheduler(log));
    });

    expect(log).toEqual(['work']);

    await flushMicrotasks();

    expect(log).toEqual([
      'work',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will replay each subscriber through its own', async () => {
    const log: string[] = [];

    pending(() => {
      enqueue(() => log.push('a'), scheduler(log, 'a'));
      enqueue(() => log.push('b'), scheduler(log, 'b'));
    });

    await flushMicrotasks();

    expect(log).toEqual([
      'a:start', 'a', 'a:end',
      'b:start', 'b', 'b:end'
    ]);
  });

  it('will not bracket a subscriber with no scheduler', async () => {
    const log: string[] = [];

    pending(() => enqueue(() => log.push('dispatch')));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);
  });

  it('will not bracket work queued on its own', async () => {
    const log: string[] = [];

    enqueue(() => log.push('dispatch'), scheduler(log));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);
  });

  it('will preserve priority through cascading work', async () => {
    const log: string[] = [];
    const host = scheduler(log);

    pending(() => enqueue(() => {
      log.push('first');
      enqueue(() => log.push('second'), host);
    }, host));

    expect(log).toEqual([]);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'first',
      'transition:end',
      'transition:start',
      'second',
      'transition:end'
    ]);
  });

  it('will fold a nested call into the one in flight', async () => {
    const done: string[] = [];

    let release!: () => void;

    pending(() => {
      pending(() => {
        enqueue(() => {
          release = pending()!;
        });
      }).then(() => done.push('inner'));
    }).then(() => done.push('outer'));

    await flushMicrotasks();

    expect(done).toEqual(['inner']);

    release();
    await flushMicrotasks();

    expect(done).toEqual(['inner', 'outer']);
  });

  it('will let urgent priority win for one handler', async () => {
    const log: string[] = [];
    const host = scheduler(log);
    const mixed = () => log.push('mixed');

    pending(() => {
      enqueue(mixed, host);
      enqueue(() => log.push('deferred'), host);
    });
    enqueue(mixed, host);

    await flushMicrotasks();

    expect(log).toEqual([
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
    }, undefined, host);

    watch(model, ({ deferred, urgent }) => {
      if (deferred || urgent) priorities.push(`mixed:${transitioning}`);
    }, undefined, host);

    pending(() => void (model.deferred = 1));
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

    watch(model, ({ source }) => void (model.derived = source * 2), undefined, host);
    watch(model, ({ derived }) => {
      if (derived) values.push(`${derived}:${transitioning}`);
    }, undefined, host);

    pending(() => {
      model.source = 1;
      model.source = 2;
    });

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

  it('will settle when a subscriber absorbs its replay', async () => {
    const log: string[] = [];

    let release!: () => void;

    pending(() => {
      enqueue(() => {
        log.push('dispatch');
        release = pending()!;
      });
    }).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);

    release();
    await flushMicrotasks();

    expect(log).toEqual(['dispatch', 'settled']);
  });

  it('will settle on replay where no subscriber claims absorption', async () => {
    let settled = false;

    pending(() => enqueue(() => {})).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will ignore a claim released more than once', async () => {
    let release!: () => void;
    let settled = 0;

    pending(() => enqueue(() => {
      release = pending()!;
    })).then(() => settled++);

    await flushMicrotasks();

    release();
    release();
    await flushMicrotasks();

    expect(settled).toBe(1);
  });

  it('will wait on every claim a single replay makes', async () => {
    const held: (() => void)[] = [];
    let settled = false;

    pending(() => enqueue(() => {
      held.push(pending()!, pending()!);
    })).then(() => (settled = true));

    await flushMicrotasks();

    held[0]();
    await flushMicrotasks();

    expect(settled).toBe(false);

    held[1]();
    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will settle a second call when its own replay is absorbed', async () => {
    const handler = () => {
      release = pending()!;
    };

    let release!: () => void;
    const done: string[] = [];

    pending(() => enqueue(handler)).then(() => done.push('first'));
    pending(() => enqueue(handler)).then(() => done.push('second'));

    await flushMicrotasks();

    expect(done).toEqual([]);

    release();
    await flushMicrotasks();

    expect(done).toEqual(['first', 'second']);
  });

  it('will await updates cascading from a replay', async () => {
    const log: string[] = [];
    const held: (() => void)[] = [];

    pending(() => enqueue(() => {
      log.push('source');
      held.push(pending()!);
      enqueue(() => {
        log.push('derived');
        held.push(pending()!);
      });
    })).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    held[0]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    held[1]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived', 'settled']);
  });

  it('will release every claim on a handler urgency strips', async () => {
    const handler = () => {};
    const settled: string[] = [];

    pending(() => enqueue(handler)).then(() => settled.push('first'));
    pending(() => enqueue(handler)).then(() => settled.push('second'));
    enqueue(handler);

    await flushMicrotasks();

    expect(settled).toEqual(['first', 'second']);
  });
});
