import { listener, observing } from '../observable';
import { access, State, STORE, uid, update } from '../state';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Apply<T = any, M extends State = any> = (
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
  const store = STORE.get(self)!;

  for (const key in self) {
    const desc = Object.getOwnPropertyDescriptor(self, key)!;
    const instruction = APPLY.get(desc.value);

    if (!instruction) continue;

    APPLY.delete(desc.value);
    delete (self as any)[key];

    const output = instruction.call(self, key, self, store);

    if (!output) continue;

    const config = typeof output == 'function' ? { destroy: output } : output;

    if ('value' in config) store[key] = config.value;
    if (config.destroy) listener(self, config.destroy, null);

    Object.defineProperty(self, key, {
      enumerable: config.enumerable !== false,
      get(this: State) {
        return observing(
          this,
          key,
          typeof config.get == 'function'
            ? config.get(this)
            : access(self, key, config.get)
        );
      },
      set(next) {
        if (config.set === false) {
          throw new Error(`${self}.${key} is read-only.`);
        }

        if (typeof config.set === 'function')
          try {
            const output = config.set(next, store[key]);
            if (output !== undefined) next = output;
          } catch (err: unknown) {
            if (err === false) return;
            if (err === true) {
              update(self, key, next, true);
              return;
            }
            throw err;
          }

        update(self, key, next);
      }
    });
  }

  return null;
});

export { apply, Apply };
