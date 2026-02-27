import { State, Context } from '@expressive/state';
import {
  Component,
  createContext,
  createElement,
  ReactNode,
  Suspense,
  useContext
} from 'react';

export const Layers = createContext(new Context());

declare module '@expressive/state' {
  namespace Context {
    function use(create?: true): Context;
    function use(create: boolean): Context | null | undefined;
  }
}

Context.use = (required?: boolean) => {
  const context = useContext(Layers);

  if (context || !required) return context;

  throw new Error(
    'No context found. Make sure to render a Provider above this component.'
  );
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
  interface Props<T extends State> {
    /** State or group of States to provide to descendant Consumers. */
    for: Context.Accept<T>;

    /**
     * Callback to run for each provided State.
     */
    forEach?: Context.Expect<T>;

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

class Provider<T extends State> extends Component<Provider.Props<T>> {
  static contextType = Layers;

  ownContext: Context;

  constructor(props: Provider.Props<T>, context: Context) {
    super(props, context);
    this.ownContext = context.push();
  }

  componentWillUnmount() {
    this.ownContext.pop();
  }

  render() {
    const { for: source, forEach, children, fallback, name } = this.props;

    this.ownContext.set(source, (state) => {
      if (forEach) {
        const cleanup = forEach(state);

        if (cleanup) state.set(cleanup, null);
      }
    });

    return creactProvider(this.ownContext, children, fallback, name);
  }
}

function creactProvider(
  context: Context,
  children: ReactNode,
  fallback?: ReactNode,
  name?: string | undefined
): ReactNode {
  if (fallback !== undefined)
    children = createElement(Suspense, { fallback, name }, children);

  return createElement(Layers.Provider, {
    key: context.id,
    value: context,
    children
  });
}

export { Consumer, Provider, creactProvider };
