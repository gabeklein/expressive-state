import { State, Context } from '@expressive/state';
import {
  createContext,
  createComponent,
  JSXElement,
  onCleanup,
  useContext
} from 'solid-js';

const Lookup = createContext(new Context());

declare namespace Provider {
  interface Props<T extends State> {
    for: Context.Accept<T>;
    set?: State.Assign<T>;
    children?: JSXElement;
  }
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const context = useContext(Lookup).push();

  context.set(props.for, props.set && ((x) => void x.set(props.set!)));

  onCleanup(() => context.pop());

  return createComponent(Lookup.Provider, {
    value: context,
    get children() {
      return props.children;
    }
  });
}

export { Provider, Lookup };
