import { State } from '@expressive/state';
import { Signal, createSignal, onCleanup, useContext } from 'solid-js';

import { Lookup } from './context';

export const SIGNALS = new WeakMap<State, Map<string, Signal<unknown>>>();

/**
 * Replaces all values which are not functions into signal getters,
 * usable within a SolidJS root, such as a component.
 */
type Reactive<T extends State> = {
  [P in keyof T]: P extends keyof State
    ? T[P]
    : T[P] extends (...args: unknown[]) => unknown
      ? T[P]
      : () => T[P];
};

declare namespace SolidState {
  export import Extends = State.Extends;
  export import Type = State.Type;
  export import Args = State.Args;
  export import Init = State.Init;
  export import Assign = State.Assign;
  export import Field = State.Field;
  export import Event = State.Event;
  export import Export = State.Export;
  export import Value = State.Value;
  export import Setter = State.Setter;
  export import OnEvent = State.OnEvent;
  export import OnUpdate = State.OnUpdate;
  export import Values = State.Values;
  export import Partial = State.Partial;
  export import Ref = State.Ref;
  export import Effect = State.Effect;
  export import EffectCallback = State.EffectCallback;

  export { Reactive };
}

abstract class SolidState extends State {
  static get<T extends State>(this: State.Type<T>): Reactive<T> {
    const instance = useContext(Lookup).get(this);

    if (!instance) throw new Error(`State not found in context: ${this.name}`);

    return signalProxy(instance);
  }

  static use<T extends State>(this: State.Type<T>, argument?: State.Assign<T>) {
    const instance = this.new(argument);

    onCleanup(() => instance.set(null));

    return signalProxy(instance);
  }
}

function signalProxy<T extends State>(instance: T) {
  let signals = SIGNALS.get(instance);

  if (!signals) SIGNALS.set(instance, (signals = new Map()));

  instance.set((key) => {
    if (typeof key === 'string') {
      const signal = signals.get(key);
      if (signal) {
        const value = (instance as any)[key];
        signal[1](value);
      }
    }
  });

  return new Proxy(instance, {
    get(target, prop: string | symbol) {
      const value = (target as any)[prop];

      if (
        typeof value === 'function' ||
        typeof prop === 'symbol' ||
        prop === 'is'
      ) {
        return value;
      }

      let signal = signals!.get(prop as string);

      if (!signal) {
        signal = createSignal(value);
        signals!.set(prop as string, signal);
      }

      return signal[0];
    }
  }) as Reactive<T>;
}

export { SolidState };
