import { State, Context, watch, unbind } from '@expressive/state';
import { ReactNode, createElement, useState, useEffect } from 'react';
import { provide, Layers } from './context';

const PROPS = new WeakMap<object, Props<any>>();

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

export type Render<T extends State, P extends object> = ((
  props: P & StateProps<T>,
  self: T
) => ReactNode) &
  PropsValid<P, T>;

type Overlap<P extends object, V extends object> = Extract<keyof P, keyof V>;

type PropsConflicting<P extends object, V extends object> = {
  [K in Overlap<P, V>]: [P[K]] extends [V[K]] ? never : K;
}[Overlap<P, V>];

type PropsValid<P extends object, T extends State> = [
  PropsConflicting<P, StateProps<T>>
] extends [never]
  ? unknown
  : never;

export type Props<T extends State> = Readonly<
  StateProps<T> & {
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
  readonly props: Props<this> & P;
  context: Context;
  state: State.Values<this>;
  fallback?: ReactNode;

  render(): ReactNode;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  setState: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  forceUpdate: (callback?: () => void) => void;

  componentWillUnmount(): void;
}

export type ComponentType<T, P = {}> = State.Type<T & Component<P>>;

declare module '@expressive/state' {
  namespace State {
    export function as<T extends State, P extends object = {}>(
      this: State.Type<T>,
      render: Render<T, P>
    ): ComponentType<T, P>;

    export function as<T extends State, P extends object = {}>(
      this: ComponentType<T, P>,
      withProps: StateProps<T>
    ): ComponentType<T, P>;

    export function as<T extends State>(
      this: State.Type<T>,
      withProps: StateProps<T>
    ): ComponentType<T, {}>;

    export type { Component, Props };
  }
}

State.as = toComponent;

export function toComponent<T extends State, P extends object = {}>(
  this: State.Type<T>,
  argument?: ((props: P, self: T) => ReactNode) | StateProps<T>
) {
  const Base = this as unknown as State.Type<State>;
  const render = typeof argument === 'function' ? argument : undefined;

  class ReactType extends Base {
    static contextType = Layers;

    get props(): Props<this> {
      return PROPS.get(this.is)!;
    }

    private set props(props: Props<this>) {
      PROPS.set(this.is, props);
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
    fallback?: ReactNode;

    constructor(nextProps: any, ...rest: any[]) {
      let context;
      const { is, ...props } = nextProps;
      const defaults = typeof argument === 'object' ? argument : {};

      if (rest[0] instanceof Context) {
        context = rest.shift() as Context;
      }

      super(props, defaults, rest, is && ((x) => void is(x)));
      PROPS.set(this, nextProps);

      if (context) context.push(this);

      const AsComponent = Render.bind(
        this,
        render || unbind((this as any).render)
      );
      this.render = () => createElement(AsComponent);
    }

    /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
    setState!: (state: any, callback?: () => void) => void;

    /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
    forceUpdate!: (callback?: () => void) => void;

    componentWillUnmount() {
      this.context.pop();
      this.set(null);
    }
  }

  Object.defineProperty(ReactType, 'name', { value: 'React' + this.name });
  Object.defineProperty(ReactType.prototype, 'isReactComponent', {
    get: () => true
  });

  return ReactType as unknown as ComponentType<T, P>;
}

function Render<T extends Component, P extends State.Assign<T>>(
  this: T,
  render?: (props: P, self: T) => ReactNode
) {
  const state = useState(() => {
    let ready: boolean | undefined;
    let active: T;

    watch(this, (current) => {
      active = current as T;

      if (ready) state[1]((x) => x.bind(null));
    });

    const View = render
      ? () => render.call(active, this.props as any, active)
      : () => this.props.children || null;

    return () => {
      ready = false;

      useEffect(() => {
        ready = true;
      });

      return provide(
        this.context,
        createElement(View),
        this.props.fallback || active.fallback,
        String(this)
      );
    };
  });

  return state[0]();
}
