import { listener, observing } from '../observable';
import { access, State, STATE, uid, update } from '../state';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Apply<T = any, M extends State = any> =
  // TODO: Should this allow for numbers/symbol properties?
  (
    this: M,
    key: Extract<State.Field<M>, string>,
    thisArg: M,
    state: State.Values<M>
  ) => Apply.Config<T> | (() => void) | void;

declare namespace Apply {
  type Config<T = any> = {
    get?: ((source: State) => T) | boolean;
    set?: State.Setter<T> | boolean;
    enumerable?: boolean;
    destroy?: () => void;
    value?: T;
  };
}

const APPLY = new Map<symbol, Apply>();

function apply<T>(instruction: Apply<T>): T extends void ? unknown : T;

function apply(arg1: Apply) {
  const token = Symbol('instruction-' + uid());
  APPLY.set(token, arg1);
  return token;
}

State.on((_key, self) => {
  const state = STATE.get(self)!;

  for (const key in self) {
    const { value } = Object.getOwnPropertyDescriptor(self, key)!;
    const instruction = APPLY.get(value);

    if (!instruction) continue;

    APPLY.delete(value);
    delete (self as any)[key];

    const output = instruction.call(self, key, self, state);

    if (!output) continue;

    const desc = typeof output == 'function' ? { destroy: output } : output;

    if ('value' in desc) state[key] = desc.value;

    if (desc.destroy) listener(self, desc.destroy, null);

    Object.defineProperty(self, key, {
      enumerable: desc.enumerable !== false,
      get(this: State) {
        return observing(
          this,
          key,
          typeof desc.get == 'function'
            ? desc.get(this)
            : access(self, key, desc.get)
        );
      },
      set(next) {
        if (desc.set === false) {
          throw new Error(`${self}.${key} is read-only.`);
        }

        update(self, key, next, desc.set);
      }
    });
  }

  return null;
});

export { apply, Apply };
