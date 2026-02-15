import { State } from '@expressive/state';
import { SolidState } from './state';

/**
 * Augmented State namespace to include SolidState hooks as static methods.
 *
 * This retroactively adds Solid support to agnostic State defined
 * by component libraries which import `@expressive/state` directly.
 */
declare module '@expressive/state' {
  namespace State {
    export import get = SolidState.get;
    export import use = SolidState.use;
  }
}

State.get = SolidState.get;
State.use = SolidState.use;

export { Provider } from './context';
export { SolidState as State, SolidState as default };
export { Context, get, use, ref, set } from '@expressive/state';
