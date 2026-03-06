import { expect, afterEach, afterAll, vi } from 'vitest';
import { State } from './packages/state/src';
import { listener } from './packages/state/src/observable';

interface CustomMatchers<R = unknown> {
  /** Flush pending updates, optionally asserting specific keys were updated. */
  toHaveUpdated(...keys: (string | symbol | number)[]): Promise<R>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({ toHaveUpdated });

export { mockError, mockPromise, mockWarn, MockPromise };

async function toHaveUpdated(received: State, ...keys: string[]) {
  if (!(received instanceof State))
    return {
      pass: false,
      message: () => `Expected State but got ${received}.`
    };

  // Eagerly collect keys and detect flush, before any await.
  const updated: string[] = [];
  let didFlush = false;

  const remove = listener(received.is, (key) => {
    if (typeof key == 'string' || typeof key == 'number' || typeof key == 'symbol')
      updated.push(key as string);
    else if (key === false)
      didFlush = true;
  });

  // Check if already pending.
  let didUpdate = await received.set();

  // If nothing was pending, wait for microtask queue to drain fully.
  if (!didUpdate.length && !didFlush)
    await new Promise<void>((r) => setTimeout(r, 0));

  remove();

  if (!didUpdate.length)
    didUpdate = updated;

  if (!didUpdate.length)
    return {
      pass: false,
      message: () => `Expected ${received} to have pending updates.`
    };

  if (!keys.length)
    return {
      pass: true,
      message: () => `Expected ${received} not to have pending updates.`
    };

  for (const key of keys)
    if (!didUpdate.includes(key))
      return {
        pass: false,
        message: () => {
          return `Expected ${received} to have updated keys [${keys
            .map(String)
            .join(', ')}] but got [${didUpdate.join(', ')}].`;
        }
      };

  return {
    pass: true,
    message: () =>
      `Expected ${received} not to have updated keys [${keys
        .map(String)
        .join(', ')}].`
  };
}

interface MockPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

function mockPromise<T = void>() {
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}

function mockWarn() {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => warn.mockClear());
  afterAll(() => warn.mockRestore());

  return warn;
}

function mockError() {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => error.mockClear());
  afterAll(() => error.mockRestore());

  return error;
}
