import { State, Context, watch, unbind } from '@expressive/state';
import { ReactNode, createElement, useState, useEffect } from 'react';
import { Layers, Provide } from './context';

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
     */
    is?: (instance: T) => void;

    /**
     * A fallback react tree to show when suspended.
     * If not provided, `fallback` property of the State will be used.
     */
    fallback?: ReactNode;

    /**
     * Children to render within component. Will be passed as `children` prop.
     */
    children?: ReactNode;
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
    function as<T extends State, P extends object = {}>(
      this: State.Type<T>,
      render?: Render<T, P>
    ): ComponentType<T, P>;

    function as<T extends State, P extends object = {}>(
      this: ComponentType<T, P>,
      withProps: StateProps<T>
    ): ComponentType<T, P>;

    function as<T extends State>(
      this: State.Type<T>,
      withProps: StateProps<T>
    ): ComponentType<T, {}>;
  }

  namespace State {
    export type { Component, Props };
  }
}

State.as = function <T extends State, P extends object = {}>(
  this: State.Type<T>,
  argument?: ((props: P, self: T) => ReactNode) | StateProps<T>
) {
  const render = typeof argument === 'function' ? argument : undefined;

  class ReactType extends (this as unknown as State.Type<State>) {
    static contextType = Layers;

    fallback?: ReactNode;

    get props(): Props<any> {
      return PROPS.get(this.is)!;
    }

    private set props(props: Props<any>) {
      PROPS.set(this.is, props);
      this.set(props as {});
    }

    get state() {
      return this.get();
    }

    private set state(_state: State.Values<this>) {}

    shouldComponentUpdate() {
      return true;
    }

    constructor(nextProps: any, ...rest: any[]) {
      const { is, ...props } = nextProps;
      const defaults = typeof argument === 'object' ? argument : {};

      if (rest[0] instanceof Context) rest.shift();

      super(props, defaults, rest, is && ((x) => void is(x)));
      PROPS.set(this, props);
    }
  }

  if (render)
    Object.defineProperty(ReactType.prototype, 'render', {
      configurable: true,
      writable: true,
      value: render
    });

  Object.defineProperty(ReactType, 'name', { value: 'React' + this.name });

  return ReactType as unknown as ComponentType<T, P>;
};

Object.defineProperty(State, 'contextType', {
  configurable: true,
  writable: true,
  value: Layers
});

Object.defineProperties(State.prototype, {
  isReactComponent: { value: true },
  shouldComponentUpdate: {
    configurable: true,
    value(this: Component, props: any) {
      PROPS.set(this.is, props);
      this.set(props);
      return true;
    }
  },
  componentWillUnmount: {
    configurable: true,
    value(this: Component) {
      this.context.pop();
      this.set(null);
    }
  },
  context: {
    configurable: true,
    set(this: Component, ctx: Context) {
      const { is: self, props = {} } = this;
      const child = ctx.push(self);

      Object.defineProperty(self, 'context', {
        get: () => child,
        set() {}
      });

      if (!PROPS.has(self)) {
        PROPS.set(self, props);
        if (typeof props.is === 'function') props.is(self);
      }

      const render = unbind(this.render);
      const Wrapped = Render.bind(self, render);
      self.render = () => createElement(Wrapped);
    },
    get() {
      return Context.get(this);
    }
  }
});

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

      return createElement(Provide, {
        context: this.context,
        name: String(this),
        fallback: this.props.fallback || active.fallback,
        children: createElement(View)
      });
    };
  });

  return state[0]();
}
