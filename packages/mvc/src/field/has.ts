import { Context } from '../context';
import { event, listener, touch } from '../observable';
import { State, parent } from '../state';
import { def } from './def';

const LENGTH = Symbol('length');
const SHAPE = Symbol('shape');

const ITEMS = new WeakMap<object, unknown[]>();
const MEMBERS = new WeakMap<object, Set<unknown>>();
const OWNED = new WeakMap<object, Map<unknown, () => void>>();
const MAKE = new WeakMap<object, Make>();

type Make = (...args: unknown[]) => unknown;
type Predicate<T> = (value: T, index: number, self: unknown) => boolean;
type Mapper<T, U> = (value: T, index: number, self: unknown) => U;

declare namespace has {
  export { Predicate, Mapper, List, Pool }
}

function has<T>(initial?: Iterable<T> | false | null): List<T>;

function has<T extends State>(
  Type: new (...args: State.Args<T>) => T
): Pool<T, State.Args<T> | [T]>;

function has<T extends State, K extends State.Field<T>>(
  Type: new (...args: State.Args<T>) => T,
  fromKey: K
): Pool<T, [T[K]] | [T]>;

function has<R, A extends unknown[]>(
  make: (...args: A) => R
): Pool<Exclude<R, null | undefined>, A, R>;

function has(
  arg?: Iterable<unknown> | Function | false | null,
  fromKey?: string
): unknown {
  return def((_key, subject) => {
    const value =
      typeof arg == 'function' ? new Pool(arg, fromKey) : new List(arg);

    parent(value, subject);
    listener(subject, () => value.clear(), null);

    return { set: false, value };
  });
}

class List<T> {
  constructor(initial?: Iterable<T> | false | null) {
    ITEMS.set(this, initial ? Array.from(initial) : []);
    OWNED.set(this, new Map());

    event(this);
  }

  get size(): number {
    return touch(this, LENGTH, items<T>(this).length);
  }

  get(): State.Export<T>[];
  get(index: number): T | undefined;
  get(start: number, end: number): T[];
  get(predicate: Predicate<T>): T | undefined;
  get(arg?: number | Predicate<T>, second?: number): any {
    const values = items<T>(this);

    if (arg === undefined) return values.map(exportValue);

    if (typeof arg === 'function') return findOf(this, arg);

    if (typeof second !== 'number') {
      const at = arg < 0 ? values.length + arg : arg;

      return at < 0 || at >= values.length
        ? touch(this, LENGTH)
        : touch(this, at, values[at]);
    }

    touch(this, LENGTH);

    const start = arg < 0 ? Math.max(values.length + arg, 0) : arg;

    return values
      .slice(start, Math.min(second, values.length))
      .map((v, i) => touch(this, start + i, v));
  }

  set(index: number, value: T) {
    const target = source(this);
    const values = ITEMS.get(target) as T[];
    const at = index < 0 ? values.length + index : index;

    if (at < 0 || at >= values.length || values[at] === value) return;

    values[at] = value;
    event(target, at);
  }

  put(index: number, ...values: T[]) {
    if (!values.length) return;

    const target = source(this);
    const arr = ITEMS.get(target) as T[];
    const at =
      index < 0
        ? Math.max(arr.length + index, 0)
        : Math.min(index, arr.length);

    arr.splice(at, 0, ...values);

    for (let i = at; i < arr.length; i++) event(target, i);
    event(target, LENGTH);
  }

  push(...values: T[]): number {
    this.put(items(this).length, ...values);
    return items(this).length;
  }

  pop(): T | undefined;
  pop(index: number): T | undefined;
  pop(index: number, count: number): T[];
  pop(index = -1, count?: number): T | T[] | undefined {
    const target = source(this);
    const values = ITEMS.get(target) as T[];
    const before = values.length;
    const start =
      index < 0 ? Math.max(before + index, 0) : Math.min(index, before);
    const removed = values.splice(start, count ?? 1);

    if (removed.length) {
      const end = Math.max(before, values.length);
      for (let i = start; i < end; i++) event(target, i);
      event(target, LENGTH);
    }

    return count === undefined ? removed[0] : removed;
  }

  clear() {
    this.pop(0, items(this).length);
  }

  *[Symbol.iterator](): IterableIterator<T> {
    const values = items<T>(this);

    touch(this, LENGTH);

    for (let i = 0; i < values.length; i++) yield touch(this, i, values[i]);
  }

  map<U>(fn: Mapper<T, U>): U[];
  map<U, X extends U>(fn: Mapper<T, U>, ignore: X): Exclude<U, X>[];
  map<U>(fn: Mapper<T, U>, ignore?: U): U[] {
    return mapOf(this, fn, arguments.length > 1, ignore);
  }

  filter(fn: Predicate<T>): T[] {
    return filterOf(this, fn);
  }

  any(fn: Predicate<T>): boolean {
    return anyOf(this, fn);
  }

  all(fn: Predicate<T>): boolean {
    return !anyOf(this, (v, i, self) => !fn(v, i, self));
  }
}

class Pool<T, A extends unknown[] = unknown[], R = T> {
  constructor(make: Function, fromKey?: string) {
    if (State.is(make)) {
      const Type = make as unknown as State.Type;

      make = (...args: State.Args) =>
        args.length == 1 && args[0] instanceof Type ? args[0] :
        fromKey ? new Type({ [fromKey]: args[0] }) :
        new Type(...args);
    }

    MEMBERS.set(this, new Set());
    MAKE.set(this, make as Make);
    OWNED.set(this, new Map());

    event(this);
  }

  get size(): number {
    return touch(this, SHAPE, members<T>(this).size);
  }

  add(...args: A): R {
    const target = source(this);
    const made = MAKE.get(target)!(...args) as T | null | undefined;

    if (made == null) return made as R;

    const values = MEMBERS.get(target) as Set<T>;

    if (!values.has(made)) {
      values.add(made);
      adopt(target, made, made);
      event(target, made as never);
      event(target, SHAPE);
    }

    return made as R;
  }

  get(): State.Export<T>[];
  get(predicate: Predicate<T>): T | undefined;
  get(predicate?: Predicate<T>): any {
    return predicate
      ? findOf(this, predicate)
      : Array.from(members<T>(this), exportValue);
  }

  has(value: T): boolean {
    return touch(this, value, members<T>(this).has(value));
  }

  delete(value: T): boolean {
    const target = source(this);
    const values = MEMBERS.get(target) as Set<T>;

    if (!values.has(value)) return false;

    release(target, value);
    values.delete(value);

    event(target, value as never);
    event(target, SHAPE);

    return true;
  }

  clear() {
    const target = source(this);
    const values = MEMBERS.get(target) as Set<T>;

    if (!values.size) return;

    const removed = Array.from(values);

    for (const value of removed) release(target, value);

    values.clear();

    for (const value of removed) event(target, value as never);
    event(target, SHAPE);
  }

  *[Symbol.iterator](): IterableIterator<T> {
    const values = members<T>(this);

    touch(this, SHAPE);

    for (const value of values) yield touch(this, value, value);
  }

  map<U>(fn: Mapper<T, U>): U[];
  map<U, X extends U>(fn: Mapper<T, U>, ignore: X): Exclude<U, X>[];
  map<U>(fn: Mapper<T, U>, ignore?: U): U[] {
    return mapOf(this, fn, arguments.length > 1, ignore);
  }

  filter(fn: Predicate<T>): T[] {
    return filterOf(this, fn);
  }

  any(fn: Predicate<T>): boolean {
    return anyOf(this, fn);
  }

  all(fn: Predicate<T>): boolean {
    return !anyOf(this, (v, i, self) => !fn(v, i, self));
  }
}

function source<T extends object>(from: T): T {
  return OWNED.has(from) ? from : Object.getPrototypeOf(from);
}

function adopt(
  target: { delete(key: never): boolean },
  key: unknown,
  value: unknown
) {
  if (!(value instanceof State)) return;

  const owner = parent(target as object);
  const fresh = parent(value, owner ?? null);
  const evict = listener(value, () => void target.delete(key as never), null);

  let detach: (() => void) | undefined;

  if (fresh && owner)
    detach = Context.get(owner).add(value);

  OWNED.get(target)!.set(key, () => {
    evict();
    if (detach) detach();
    if (fresh) value.set(null);
  });

  if (fresh) event(value);
}

function release(target: object, key: unknown) {
  const owned = OWNED.get(target)!;
  const free = owned.get(key);

  if (free) {
    owned.delete(key);
    free();
  }
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

function items<T>(from: object): T[] {
  return ITEMS.get(source(from)) as T[];
}

function members<T>(from: object): Set<T> {
  return MEMBERS.get(source(from)) as Set<T>;
}

function findOf<T>(
  self: Iterable<T>,
  fn: Predicate<T>
): T | undefined {
  let i = 0;

  for (const value of self)
    if (fn(value, i++, self)) return value;
}

function anyOf<T>(self: Iterable<T>, fn: Predicate<T>): boolean {
  let i = 0;

  for (const value of self)
    if (fn(value, i++, self)) return true;

  return false;
}

function mapOf<T, U>(
  self: Iterable<T>,
  fn: Mapper<T, U>,
  skip: boolean,
  ignore?: U
): U[] {
  const out: U[] = [];
  let i = 0;

  for (const value of self) {
    const result = fn(value, i++, self);
    if (skip && result === ignore) continue;
    out.push(result);
  }

  return out;
}

function filterOf<T>(self: Iterable<T>, fn: Predicate<T>): T[] {
  const out: T[] = [];
  let i = 0;

  for (const value of self) if (fn(value, i++, self)) out.push(value);

  return out;
}

Object.assign(has, { List, Pool });

export { has };
