import { Component } from '@expressive/mvc';
import React, {
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';

import './element';
import './jsx-runtime';

import { Runtime } from './adapter';
import { ErrorBoundary, dedupe } from './boundary';

// React detects class components by this brand (preact reads `prototype.render`).
Object.defineProperty(Component.prototype, 'isReactComponent', {
  value: true
});

Object.assign(Runtime, {
  dedupe,
  ErrorBoundary,
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore: React.useSyncExternalStore,
  transition: React.startTransition,
  Suspense,
  ignore: [
    'updater',
    'refs',
    '_reactInternals',
    '_reactInternalInstance'
  ]
});

export { State, State as default, Consumer, Provider } from './adapter';
export { Component, Context, def, get, ref, set, pending } from '@expressive/mvc';
export { has } from './has';
export { map } from './map';
