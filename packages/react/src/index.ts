import { createElement, useEffect, useState } from 'react';

import { Pragma, State } from './state';
import { Consumer, Provider } from './context';

import './component';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export { State, State as default };
export { Context, Observable, apply, get, ref, set } from '@expressive/state';
export { Consumer, Provider };
