import { State, provides, detach, link } from '@expressive/state';
import type { Accept } from '@expressive/state';
import {
  createContext,
  createElement,
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useMemo
} from 'react';

class Boundary extends State {}

export const Layers = createContext<State>(Boundary.new());

export function useBoundary(): State {
  return useContext(Layers);
}

declare namespace Consumer {
  type Props<T extends State> = {
    /** Type of controller to fetch from context. */
    for: State.Extends<T>;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Called every render of parent component.
     * Similar to `State.get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => ReactNode | void;
  };
}

function Consumer<T extends State>(props: Consumer.Props<T>) {
  return props.for.get((i) => props.children(i));
}

declare namespace Provider {
  type ForEach<T> = (state: T) => void | (() => void);

  interface Props<T extends State> {
    /** State or group of States to provide to descendant Consumers. */
    for: Accept<T>;

    /**
     * Callback to run for each provided State.
     */
    forEach?: ForEach<T>;

    /**
     * Children to render within this Provider.
     */
    children?: ReactNode;

    /** A fallback tree to show when suspended. */
    fallback?: ReactNode;

    /**
     * A name for this Suspense boundary for instrumentation purposes.
     * The name will help identify this boundary in React DevTools.
     */
    name?: string | undefined;
  }
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const ambient = useContext(Layers);
  const context = useMemo(() => {
    const b = Boundary.new();
    link(ambient, b);
    return b;
  }, [ambient]);

  useEffect(() => () => detach(context), [context]);

  provides(
    context,
    props.for,
    props.forEach &&
      ((state) => {
        const cleanup = props.forEach!(state);
        if (cleanup) state.set(cleanup, null);
      })
  );

  return createElement(Provide, { context, ...props });
}

interface ProvideProps {
  context: State;
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string | undefined;
}

function Provide(props: ProvideProps) {
  let { context, children, fallback, name } = props;

  if (fallback !== undefined)
    children = createElement(Suspense, { fallback, name }, children);

  return createElement(Layers.Provider, {
    key: String(context),
    value: context,
    children
  });
}

export { Consumer, Provider, Provide };
