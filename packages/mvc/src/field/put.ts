import { def } from './def';

/**
 * Store a value on the instance without managing it.
 *
 * The property is a plain, writable own value - reads and writes use normal
 * property syntax, never notify subscribers, and never throw after destroy.
 * Excluded from snapshots, iteration, and `ref(this)`.
 *
 * Use for mechanism and memory - subscription handles, side-pocket data,
 * comparison tokens. State the UI observes belongs in a managed field.
 *
 * An overlay (constructor argument, `set({ ... })`, or Component props) may
 * assign one, same as a managed field.
 *
 * Note instructions are values, not declarations - a subclass which overrides
 * this field with a plain value gets an ordinary managed property instead.
 * Restate the instruction to keep it.
 *
 * @param value - Starting value for property.
 */
function put<T>(value: T): T;

/**
 * Store a value on the instance without managing it. Initially `undefined`.
 *
 * The property is a plain, writable own value - reads and writes use normal
 * property syntax, never notify subscribers, and never throw after destroy.
 * Excluded from snapshots, iteration, and `ref(this)`. Access never suspends.
 *
 * Use for mechanism and memory - subscription handles, side-pocket data,
 * comparison tokens. State the UI observes belongs in a managed field.
 *
 * An overlay (constructor argument, `set({ ... })`, or Component props) may
 * assign one, same as a managed field.
 *
 * Note instructions are values, not declarations - a subclass which overrides
 * this field with a plain value gets an ordinary managed property instead.
 * Restate the instruction to keep it.
 */
function put<T>(): T | undefined;

function put<T>(value?: T): any {
  return def<T>((key, subject) => {
    Object.defineProperty(subject, key, {
      value,
      writable: true,
      enumerable: false,
      configurable: true
    });
  });
}

export { put };
