import { State } from '@expressive/state';
import { createElement, useEffect, useState } from 'react';

import { Pragma } from './state';
import { Consumer, Provider } from './context';

import './component';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;

export { State, State as default };
export { Context, Observable, get, use, ref, set } from '@expressive/state';
export { Consumer, Provider };
