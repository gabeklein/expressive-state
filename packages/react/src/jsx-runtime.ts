import { State } from '@expressive/state';

import Runtime from 'react/jsx-runtime';
import React from 'react';

import { toComponent } from './component';

interface AsComponent extends State {
  props?: Record<string, any>;
  render?(): React.ReactNode;
  fallback?: React.ReactNode;
}

type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof AsComponent>]?: T[K];
};

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
  if (State.is(type) && !('isReactComponent' in type.prototype))
    if (RENDER.has(type)) type = RENDER.get(type)!;
    else RENDER.set(type, (type = toComponent.call(type)));

  return this(type as React.ElementType, ...args);
}

export const jsx = patch.bind(Runtime.jsx);
export const jsxs = patch.bind(Runtime.jsxs);

export { Fragment } from 'react';
