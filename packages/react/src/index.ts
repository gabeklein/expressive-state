import { State } from '@expressive/state';

import { createElement, useEffect, useState } from 'react';

import { ReactState, Pragma } from './state';
import './component';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

/**
 * Augmented State namespace to include ReactState hooks as static methods.
 *
 * This retroactively adds React support to agnostic State defined
 * by component libraries which import `@expressive/state` directly.
 */
declare module '@expressive/state' {
  namespace State {
    export import get = ReactState.get;
    export import use = ReactState.use;
  }
}

State.get = ReactState.get;
State.use = ReactState.use;

export { ReactState as State, ReactState as default };
export { Context, Observable, get, use, ref, set } from '@expressive/state';
export { Consumer, Provider } from './context';
export { Fragment, createElement } from 'react';
export { Pragma };
