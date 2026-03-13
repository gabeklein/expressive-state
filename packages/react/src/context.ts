import { State, Context } from '@expressive/state';
import {
  createContext,
  createElement,
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useMemo
} from 'react';

export const Layers = createContext(new Context());

const _get = Context.get;

Context.get = (state?: State) => {
  if (state) return _get(state);
  try {
    return useContext(Layers);
  } catch {
    return Context.root;
  }
};

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

  interface SharedProps {
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

  type ForSingleProps<T extends State> = SharedProps & {
    for: T | State.Type<T>;
  } & { [K in State.Field<T>]?: T[K] };

  type ForEachProps<T extends State> = SharedProps & {
    for: Context.Accept<T>;
    forEach?: ForEach<T>;
  };

  type Props<T extends State = State> = ForSingleProps<T> | ForEachProps<T>;
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const {
    for: input,
    children,
    fallback,
    name,
    ...rest
  } = props as Provider.ForSingleProps<T> & Provider.ForEachProps<T>;

  const ambient = useContext(Layers);
  const context = useMemo(() => ambient.push(), []);

  context.set(input, (added) => rest.forEach && rest.forEach(added));

  if (Object.keys(rest).length)
    if (State.is(input)) context.get(input).set(rest as State.Assign<T>);
    else if (input instanceof State) input.set(rest as State.Assign<T>);

  useEffect(() => () => context.pop(), []);

  return createElement(Provide, { context, children, fallback, name });
}

interface ProvideProps {
  context: Context;
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string | undefined;
}

function Provide(props: ProvideProps) {
  let { context, children, fallback, name } = props;

  if (fallback !== undefined)
    children = createElement(Suspense, { fallback, name }, children);

  return createElement(Layers.Provider, {
    key: context.id,
    value: context,
    children
  });
}

export { Consumer, Provider, Provide };
