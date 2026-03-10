import { State, apply, detach, link } from '@expressive/state';
import type { Accept } from '@expressive/state';
import {
  createContext,
  createComponent,
  JSXElement,
  onCleanup,
  useContext
} from 'solid-js';

class Boundary extends State {}

const Lookup = createContext<State>(Boundary.new());

declare namespace Provider {
  interface Props<T extends State> {
    for: Accept<T>;
    set?: State.Assign<T>;
    children?: JSXElement;
  }
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const ambient = useContext(Lookup);
  const boundary = Boundary.new();

  link(ambient, boundary);
  apply(boundary, props.for, props.set && ((x) => void x.set(props.set!)));

  onCleanup(() => detach(boundary));

  return createComponent(Lookup.Provider, {
    value: boundary,
    get children() {
      return props.children;
    }
  });
}

export { Provider, Lookup };
