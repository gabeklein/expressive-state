import { Runtime } from '@expressive/react/adapter';
import { Component } from '@expressive/mvc';
import { options, type ComponentChildren } from 'preact';
import {
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState
} from 'preact/compat';

import './jsx-runtime';
import { ErrorBoundary } from './boundary';

const vnode = options.vnode;

options.vnode = (node) => {
  vnode?.(node);
  reject(node.props.children);
};

function reject(children: ComponentChildren) {
  if (children instanceof Component)
    throw new TypeError(
      'Component instances cannot be rendered directly with @expressive/preact.'
    );

  if (Array.isArray(children))
    for (const child of children) reject(child);
}

Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  Suspense,
  ErrorBoundary,
  // Preact has no render-attempt stacking (no fiber-keyed supersession);
  // teardown is owned by the context, so dedupe is a no-op.
  dedupe: () => ({
    commit() {},
    remove() {}
  }),
  ignore: [
    '__v',
    '__n',
    '__d',
    '__e',
    '__h',
    '_sb',
    '__s',
    '__P',
    '__z',
    '__R',
    'base',
    'componentWillUnmount'
  ]
});

export { State, State as default, Consumer, Provider } from '@expressive/react/adapter'
export { Component, Context, def, get, has, ref, set, map } from '@expressive/mvc';
