import { observing } from '../observable';
import { access, State, STATE, uid, update } from '../state';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T = any, M extends State = any> =
  // TODO: Should this allow for numbers/symbol properties?
  (
    this: M,
    key: Extract<State.Field<M>, string>,
    thisArg: M,
    state: State.Values<M>
  ) => Instruction.Descriptor<T> | ((source: M) => T) | void;

declare namespace Instruction {
  type Getter<T> = (source: State) => T;

  type Descriptor<T = any> = {
    get?: Getter<T> | boolean;
    set?: State.Setter<T> | boolean;
    enumerable?: boolean;
    value?: T;
  };
}

const INSTRUCTION = new Map<symbol, Instruction>();

function use<T>(instruction: Instruction<T>): T extends void ? unknown : T;

function use(arg1: Instruction) {
  const token = Symbol('instruction-' + uid());
  INSTRUCTION.set(token, arg1);
  return token;
}

function init(this: State) {
  const state = STATE.get(this)!;

  for (const key in this) {
    const { value } = Object.getOwnPropertyDescriptor(this, key)!;
    const instruction = INSTRUCTION.get(value);

    if (!instruction) continue;

    INSTRUCTION.delete(value);
    delete (this as any)[key];

    const output = instruction.call(this, key, this, state);

    if (!output) continue;

    const desc = typeof output == 'object' ? output : { get: output };

    if ('value' in desc) state[key] = desc.value;

    const self = this;

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
}

State.on(init);

export { use, Instruction };
