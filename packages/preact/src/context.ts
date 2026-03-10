import { State, apply, detach, link } from '@expressive/state';
import type { Accept } from '@expressive/state';

import { ComponentChildren, createContext, createElement } from 'preact';
import { useContext, useEffect, useMemo } from 'preact/hooks';

class Boundary extends State {}

const Lookup = createContext<State>(Boundary.new());

export function useBoundary(): State {
  return useContext(Lookup);
}

declare namespace Consumer {
  type Props<T extends State> = {
    /** Type of controller to fetch from context. */
    for: State.Extends<T> & typeof State;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Called every render of parent component.
     * Similar to `State.get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => ComponentChildren | void;
  };
}

function Consumer<T extends State>(props: Consumer.Props<T>) {
  return props.for.get((i) => props.children(i));
}

declare namespace Provider {
  type ForEach<T> = (state: T) => void | (() => void);

  interface Props<T extends State> {
    for: Accept<T>;
    forEach?: ForEach<T>;
    children?: ComponentChildren;
  }
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const ambient = useContext(Lookup);
  const boundary = useMemo(() => {
    const b = Boundary.new();
    link(ambient, b);
    return b;
  }, [ambient]);

  useEffect(() => () => detach(boundary), [boundary]);

  apply(
    boundary,
    props.for,
    props.forEach &&
      ((state) => {
        const cleanup = props.forEach!(state);
        if (cleanup) state.set(cleanup, null);
      })
  );

  return createElement(
    Lookup.Provider,
    {
      key: String(boundary),
      value: boundary
    },
    props.children
  );
}

export { Consumer, Provider, Lookup };
