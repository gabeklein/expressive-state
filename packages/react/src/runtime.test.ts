import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import './index';
import { Runtime, useHook } from './runtime';

// Stub Runtime with a hand-driven lifecycle so a subscription update can fire
// before vs. after commit, and watch whether the React setter actually runs.
// useHook takes more than one ref (its own record, plus useSettle's) and
// registers more than one effect (mount, plus useSettle's release), so slots
// are handed out in call order and every effect runs on commit.
function harness() {
  const refs: { current: any }[] = [];
  let slot = 0;
  let inited = false;
  let state = 0;
  const effects: (() => (() => void) | void)[] = [];
  let refresh: (next?: any) => void;
  let reset: () => void;
  const unmount = vi.fn();

  // Apply the updater like React would, so the `(x) => x + 1` path is exercised.
  const update = vi.fn((fn: (prev: number) => number) => void (state = fn(state)));

  Runtime.useRef = ((value: any) => {
    const ref = refs[slot] || (refs[slot] = { current: value });
    slot++;
    return ref;
  }) as typeof Runtime.useRef;

  Runtime.useState = ((value: any) => {
    if (!inited) {
      inited = true;
      if (typeof value === 'function') value(); // run initializer (subscribes)
    }
    return [state, update];
  }) as typeof Runtime.useState;

  Runtime.useEffect = ((fn: any) => void effects.push(fn)) as typeof Runtime.useEffect;
  Runtime.useSyncExternalStore = undefined;

  let cleanups: ((() => void) | void)[] = [];

  return {
    update,
    unmount,
    render: () => {
      slot = 0;
      effects.length = 0;
      return useHook((r, x) => ((refresh = r), (reset = x), () => unmount));
    },
    commit: () => void (cleanups = effects.map((fn) => fn())),
    unwind: () => cleanups.forEach((fn) => fn && fn()),
    refresh: (next?: any) => refresh(next),
    reset: () => reset()
  };
}

let saved: Partial<typeof Runtime>;
beforeEach(() => void (saved = { ...Runtime }));
afterEach(() => void Object.assign(Runtime, saved));

it('does not call the setter before commit', () => {
  const { update, render, refresh } = harness();

  render();
  refresh('early'); // e.g. a sibling mutating shared state during render

  expect(update).not.toHaveBeenCalled();
});

it('coalesces deferred refreshes into a single flush on commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  refresh('a');
  refresh('b');
  expect(update).not.toHaveBeenCalled();

  commit();
  expect(update).toHaveBeenCalledTimes(1);
});

it('refreshes immediately for updates after commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  commit();
  update.mockClear();

  refresh('later');
  expect(update).toHaveBeenCalledTimes(1);
});

it('runs the callback cleanup on unmount', () => {
  const { render, commit, unwind, unmount } = harness();

  render();
  commit();
  expect(unmount).not.toHaveBeenCalled();

  unwind();
  expect(unmount).toHaveBeenCalledTimes(1);
});

it('will advance revision on reset', () => {
  const { render, reset } = harness();
  let getRevision!: () => number;

  Runtime.useSyncExternalStore = (_subscribe, get) => (getRevision = get)();

  render();
  expect(getRevision()).toBe(0);

  reset();
  expect(getRevision()).toBe(1);

  render();
  expect(getRevision()).toBe(1);
});


