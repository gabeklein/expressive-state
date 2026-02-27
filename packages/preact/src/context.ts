import { Context } from '@expressive/state';
import { State } from '@expressive/react/state';

import { ComponentChildren, createContext, createElement } from 'preact';
import { useContext, useEffect, useMemo } from 'preact/hooks';

const Lookup = createContext(new Context());

declare module '@expressive/state' {
  namespace Context {
    function use(create?: true): Context;
    function use(create: boolean): Context | null | undefined;
  }
}

Context.use = (create?: boolean) => {
  const ambient = useContext(Lookup);

  return create ? useMemo(() => ambient.push(), [ambient]) : ambient;
};

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
  interface Props<T extends State> {
    for: Context.Accept<T>;
    forEach?: Context.Expect<T>;
    children?: ComponentChildren;
  }
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const context = Context.use(true);

  useEffect(() => () => context.pop(), [context]);

  context.set(props.for, (state) => {
    if (props.forEach) {
      const cleanup = props.forEach(state);

      if (cleanup) state.set(cleanup, null);
    }
  });

  return createElement(
    Lookup.Provider,
    {
      key: context.id,
      value: context
    },
    props.children
  );
}

export { Consumer, Provider, Lookup };
