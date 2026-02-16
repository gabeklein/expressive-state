import { access, follow, State, PARENT, STATE, uid, update } from '../state';

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

function use<T extends State>(
  Type: State.Type<T>,
  required: false
): T | undefined;

function use<T extends State>(Type: State.Type<T>, ready?: (i: T) => void): T;

function use(
  arg1: State.Type | Instruction,
  arg2?: ((i: State) => void) | boolean
) {
  if (State.is(arg1)) arg1 = childInstruction(arg1, arg2);

  const token = Symbol('instruction-' + uid());
  INSTRUCTION.set(token, arg1);
  return token;
}

function childInstruction(
  type: State.Type<State>,
  arg2?: ((i: State) => void) | boolean
): Instruction<any, any> {
  return (key, subject) => {
    function set(next: State | undefined) {
      if (next ? !(next instanceof type) : arg2 !== false)
        throw new Error(
          `${subject}.${key} expected State of type ${type} but got ${
            next && next.constructor
          }.`
        );

      update(subject, key, next);

      if (next && typeof arg2 == 'function') arg2(next);

      return false;
    }

    const value = new type();

    set(value);
    PARENT.set(value, subject);
    value.set();

    return { set };
  };
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
        return follow(
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
