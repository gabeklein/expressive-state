import type { Component } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { pending } from '@expressive/mvc';
import type { Context } from './context';

interface Settle {
  waiting: (() => void)[];
  claim(): void;
  release(): void;
}

interface Setup {
  rendered: number;
  revision: number;
  mounted?: boolean;
  commit?: () => (() => void) | void;
  release?: (() => void) | void;
}

interface Hook<T> extends Setup {
  queued?: boolean;
  update?: (next: (previous: number) => number) => void;
  output: T;
}

export const Runtime = {} as {
  /** Host own-property keys to trap out of observed state; assigned by each adapter. */
  ignore: string[];
  createElement(type: any, props?: any, ...children: any[]): any;
  createContext<T>(value: T): any;
  useContext(context: any): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
  /** Non-urgent bracket a subscriber replays through; absent where the host
   *  cannot defer, which keeps normal timing. */
  transition?(work: () => void): void;
  /** Consumed for pre-commit revision validation; absent where commits
   *  cannot interleave with writes. */
  useSyncExternalStore?(
    subscribe: (notify: () => void) => () => void,
    getSnapshot: () => number,
    getServerSnapshot?: () => number
  ): number;
  /** Per-render-attempt lifecycle, set by each adapter (React stacks attempts; others no-op). */
  dedupe(from: Component, context: Context): { commit(): void; remove(): void };
  /** Host error-boundary component, wrapping a Component whose `catch` is set. */
  ErrorBoundary: unknown;
  Suspense: any;
};

const noop = () => () => {};

export function useFactory<T extends Function>(factory: () => T) {
  const ref = Runtime.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
}

/**
 * Returns a claim on the update being replayed, held until this hook commits
 * carrying it - or until unmount, where it never will. Keyed on `tick` so an
 * urgent commit in the meantime, which leaves the deferred update queued, does
 * not release it.
 */
export function useSettle(tick: number) {
  const ref = Runtime.useRef<Settle | null>(null);
  const settle = ref.current || (ref.current = {
    waiting: [],
    claim() {
      const held = pending();

      if (held) settle.waiting.push(held);
    },
    release() {
      for (const held of settle.waiting.splice(0)) held();
    }
  });

  Runtime.useEffect(() => {
    settle.release();
    return settle.release;
  }, [tick]);

  return settle.claim;
}

/**
 * Run `init` once for the life of a hook and clean up when it unmounts, safe
 * under React StrictMode - a remount shares the render counter, so neither the
 * setup nor its cleanup repeats. `reset` invalidates the rendered value so
 * in-flight render attempts revalidate.
 *
 * @returns The hook's own record, plus the render counter and its setter.
 */
export function useSetup<T extends Setup>(
  init: (self: T, reset: () => void) => () => (() => void) | void
) {
  const { current } = Runtime.useRef({ rendered: 0, revision: 0 } as T);

  const [tick, update] = Runtime.useState(() => {
    if (!current.rendered)
      current.commit = init(current, () => {
        current.revision++;
      });

    return current.rendered++;
  });

  const getRevision = () => current.revision;

  Runtime.useSyncExternalStore?.(noop, getRevision, getRevision);

  Runtime.useEffect(() => {
    current.mounted = true;

    if (current.commit) {
      current.release = current.commit();
      current.commit = undefined;
    }

    return () => {
      if (--current.rendered <= 0) current.release?.();
    }
  }, []);

  return [current, tick, update] as const;
}

/**
 * Mount-effect with a refreshable return value. Publishing a value before mount
 * defers the update to it, and one published after claims the update being
 * replayed until this hook commits carrying it.
 *
 * @returns Latest value published via the setter (`undefined` until set).
 */
export function useHook<T = void>(
  callback: (
    refresh: (next: T) => void,
    reset: () => void
  ) => () => (() => void) | void
) {
  const [current, tick, update] = useSetup<Hook<T>>((self, reset) => {
    const mount = callback((next) => {
      self.output = next;

      if (self.mounted) {
        claim();
        self.update?.((x) => x + 1);
      }
      else if (self.update) self.queued = true;
    }, reset);

    return () => {
      const cleanup = mount();

      if (self.queued) {
        self.queued = false;
        self.update!((x) => x + 1);
      }

      return cleanup;
    };
  });

  const claim = useSettle(tick);

  current.update = update;

  return current.output;
}

export function useWatch<T extends object>(
  from: T,
  mount?: () => (() => void) | void
) {
  return useHook<T>((refresh, reset) => {
    const release = watch(from, (current) => {
      refresh(current);

      return (update) => {
        if (update === true) reset();
      };
    }, undefined, Runtime.transition);

    return () => {
      const cleanup = mount?.();

      return () => {
        release();
        cleanup?.();
      };
    };
  }) ?? from;
}
