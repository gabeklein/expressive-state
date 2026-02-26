import { State, Context, watch, event, METHOD } from '@expressive/state';
import { ReactNode } from 'react';
import { provide, Layers } from './context';
import { Pragma } from './state';

const PROPS = new WeakMap<object, ComponentProps<any>>();

export type Props<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

export type Render<T extends State, P extends object> = ((
  props: P & Props<T>,
  self: T
) => ReactNode) &
  PropsValid<P, T>;

type Overlap<P extends object, V extends object> = Extract<keyof P, keyof V>;

type PropsConflicting<P extends object, V extends object> = {
  [K in Overlap<P, V>]: [P[K]] extends [V[K]] ? never : K;
}[Overlap<P, V>];

type PropsValid<P extends object, T extends State> = [
  PropsConflicting<P, Props<T>>
] extends [never]
  ? unknown
  : never;

type ComponentProps<T extends State> = Readonly<
  Props<T> & {
    /**
     * Callback for newly created instance. Only called once.
     * @returns Callback to run when instance is destroyed.
     */
    is?: (instance: T) => void;

    /**
     * A fallback react tree to show when suspended.
     * If not provided, `fallback` property of the State will be used.
     */
    fallback?: React.ReactNode;

    /**
     * Children to render within component. Will be passed as `children` prop.
     */
    children?: React.ReactNode;
  }
>;

export interface Component<P = {}> extends State {
  readonly props: ComponentProps<this> & P;
  context: Context;
  state: State.Values<this>;
  fallback?: ReactNode;

  render(): ReactNode;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  setState: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  forceUpdate: (callback?: () => void) => void;
}

export type ComponentType<T, P = {}> = State.Type<T & Component<P>>;

export function toComponent<T extends State, P>(
  Type: State.Type<T>,
  argument?: ((props: P, self: T) => ReactNode) | Props<T>
) {
  const Base = Type as unknown as State.Type<State>;
  const render = typeof argument === 'function' ? argument : undefined;

  class ReactType extends Base {
    static contextType = Layers;

    get props(): ComponentProps<this> {
      return PROPS.get(this)!;
    }

    private set props(props: ComponentProps<this>) {
      PROPS.set(this, props);
      this.set(props as {});
    }

    get context() {
      return Context.get(this)!;
    }

    private set context(context: Context) {}

    get state() {
      return this.get();
    }

    private set state(_state: State.Values<this>) {}

    render!: () => ReactNode;
    fallback?: ReactNode = undefined;

    constructor(nextProps: any, ...rest: any[]) {
      let context;
      const { is } = nextProps;
      const defaults = typeof argument === 'object' ? argument : {};

      if (rest[0] instanceof Context) {
        context = rest.shift() as Context;
      }

      super(nextProps, defaults, is, rest);
      PROPS.set(this, nextProps);

      if (context) context.push(this);

      const renderMethod = (this as any).render;
      const r = render || METHOD.get(renderMethod) || renderMethod;

      if (r) {
        const AsComponent = Render.bind(this, r);
        this.render = () => Pragma.createElement(AsComponent);
      } else {
        this.render = () =>
          provide(
            this.context,
            this.props.children || null,
            this.props.fallback,
            String(this)
          );
      }
    }

    /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
    setState!: (state: any, callback?: () => void) => void;

    /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
    forceUpdate!: (callback?: () => void) => void;
  }

  Object.defineProperty(ReactType, 'name', { value: 'React' + Type.name });
  Object.defineProperty(ReactType.prototype, 'isReactComponent', {
    get: () => true
  });

  return ReactType;
}

function Render<T extends Component, P extends State.Assign<T>>(
  this: T,
  render: (props: P, self: T) => ReactNode
) {
  const state = Pragma.useState(() => {
    event(this);

    const { context } = this;

    let ready: boolean | undefined;
    let active: T;

    watch(this, (current) => {
      active = current as T;

      if (ready) state[1]((x) => x.bind(null));
    });

    const didMount = () => {
      ready = true;
      return () => {
        context.pop();
        this.set(null);
      };
    };

    const View = () => render.call(active, this.props as any, active);

    return () => {
      ready = false;

      Pragma.useEffect(didMount, []);
      setTimeout(() => (ready = true), 0);

      return provide(
        context,
        Pragma.createElement(View),
        this.props.fallback || this.fallback,
        String(this)
      );
    };
  });

  return state[0]();
}
