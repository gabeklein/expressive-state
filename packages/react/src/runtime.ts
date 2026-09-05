import type { Component } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import type { Context } from './context';

export const Runtime = {} as {
  /** Host own-property keys to trap out of observed state; assigned by each adapter. */
  ignore: string[];
  createElement(type: any, props?: any, ...children: any[]): any;
  createContext<T>(value: T): any;
  useContext(context: any): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
  /** Consumed to observe deferred work; absent where the host cannot report it. */
  useTransition?(): [boolean, (work: () => void) => void];
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
 * Mount-effect with a refreshable return value, safe under React StrictMode.
 *
 * @param callback Setup handler, run on creation; receives a setter, plus a
 *   reset which invalidates the rendered value so in-flight render attempts
 *   revalidate, and returns a mount handler, which in turn returns a cleanup.
 *   All share this hook's render counter, so a StrictMode remount repeats
 *   none of them.
 * @returns Latest value published via the setter (`undefined` until set).
 */
export function useHook<T = void>(
  callback: (
    refresh: (next: T) => void,
    reset: () => void
  ) => () => (() => void) | void
) {
  const { current } = Runtime.useRef(
    { rendered: 0, revision: 0 } as {
      rendered: number;
      revision: number;
      mounted?: boolean;
      pending?: boolean;
      commit?: () => (() => void) | void;
      release?: (() => void) | void;
      update?: (next: (previous: number) => number) => void;
      output: T;
    }
  );

  current.update = Runtime.useState(() => {
    if (!current.rendered)
      current.commit = callback(
        (next) => {
          current.output = next;
          if (current.mounted) current.update?.((x) => x + 1);
          else if (current.update) current.pending = true;
        },
        () => {
          current.revision++;
        }
      );

    return current.rendered++;
  })[1];

  const getRevision = () => current.revision;

  Runtime.useSyncExternalStore?.(noop, getRevision, getRevision);

  Runtime.useEffect(() => {
    current.mounted = true;

    if (current.commit) {
      current.release = current.commit();
      current.commit = undefined;
    }

    if (current.pending) {
      current.pending = false;
      current.update!((x) => x + 1);
    }

    return () => {
      if (--current.rendered <= 0) current.release?.();
    }
  }, []);

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
    });

    return () => {
      const cleanup = mount?.();

      return () => {
        release();
        cleanup?.();
      };
    };
  }) ?? from;
}
