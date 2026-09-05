import { Children, isValidElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { host } from '@expressive/mvc/runtime';

import type { JSX as ReactJSX, ReactNode } from 'react';

declare module '@expressive/mvc/runtime' {
  interface Host {
    node: ReactNode;
    intrinsics: ReactJSX.IntrinsicElements;
  }
}

host({
  jsx,
  jsxs,
  Fragment,
  isElement: isValidElement,
  childrenOf: Children.toArray,
  typeOf(node){
    return isValidElement(node) ? node.type : undefined;
  },
  propsOf(node){
    return isValidElement(node) ? node.props as Record<string, unknown> : {};
  }
});
