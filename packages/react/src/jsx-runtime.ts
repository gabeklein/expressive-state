import { State, Context, watch, METHOD } from '@expressive/state';

import Runtime from 'react/jsx-runtime';
import React from 'react';

import { Pragma } from './state';
import { provide } from './context';

type Reserved = keyof State | 'props' | 'render' | 'fallback';

type StateProps<T extends State> = {
  [K in Exclude<keyof T, Reserved>]?: T[K];
};

interface AsComponent extends State {
  props?: Record<string, any>;
  render?(): React.ReactNode;
  fallback?: React.ReactNode;
}

type BaseProps<T extends State> = {
  is?: (instance: T) => void;
  fallback?: React.ReactNode;
};

type DefaultProps<T extends State> = T extends {
  render: (...args: any[]) => any;
}
  ? {}
  : { children?: React.ReactNode };

type ExplicitProps<T extends State> = T extends {
  props?: infer P;
}
  ? NonNullable<P>
  : {};

type Props<T extends State> = StateProps<T> &
  ExplicitProps<T> &
  DefaultProps<T> &
  BaseProps<T>;

type NormalComponent<P> = new (...args: any[]) => { props: P };

export declare namespace JSX {
  type ElementType =
    | State.Extends<AsComponent>
    | React.JSX.ElementType
    | ((props: {}, ref?: any) => void);

  type LibraryManagedAttributes<C, P> =
    C extends State.Extends<infer U>
      ? Props<U>
      : C extends NormalComponent<infer U>
        ? U
        : React.JSX.LibraryManagedAttributes<C, P>;

  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}

  // This is a hack to make TypeScript happy - React's interface insists on `props` property existing.
  // I await the "Find Out" phase of this in git issues.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute
    extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX
    .IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

const RENDER = new WeakMap<Function, React.ComponentType>();

export function patch(
  this: (type: React.ElementType, ...args: any[]) => React.ReactElement,
  type: React.ElementType | State.Type,
  ...args: any[]
): React.ReactElement {
  if (State.is(type))
    if (RENDER.has(type)) type = RENDER.get(type)!;
    else RENDER.set(type, (type = Render.bind(type)));

  return this(type, ...args);
}

export const jsx = patch.bind(Runtime.jsx);
export const jsxs = patch.bind(Runtime.jsxs);

function Render<T extends AsComponent>(
  this: State.Type<T>,
  props: Props<T>,
  props2?: Props<T>
) {
  const { is, ...rest } = { ...props, ...props2 };

  const ambient = Context.use();
  const state = Pragma.useState<(props: any) => any>(() => {
    const instance = this.new(rest as {}, is && ((x) => void is(x)));
    const context = ambient.push(instance);

    let ready: boolean | undefined;
    let active: T;

    watch(instance, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        context.pop();
        instance.set(null);
      };
    }

    function Render(props: { children?: React.ReactNode }) {
      const render = METHOD.get(active.render) || active.render;

      return render ? render.call(active) : props.children;
    }

    return (props: Props<T>) => {
      ready = false;

      instance.props = props;

      Pragma.useEffect(didMount, []);
      Promise.resolve(instance.set(props)).finally(() => {
        ready = true;
      });

      return provide(
        context,
        Pragma.createElement(Render, props),
        props.fallback || active.fallback,
        String(instance)
      );
    };
  });

  return state[0](rest);
}

export { Fragment } from 'react';
