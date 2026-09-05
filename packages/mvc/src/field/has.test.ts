import { vi, describe, it, expect } from 'vitest';
import { State } from '../state';
import { flushMicrotasks as flush } from '../../test.setup';
import { watch } from '../observable';
import { get } from './get';
import { has } from './has';

function reactive<T>(initial?: Iterable<T> | false | null): has.List<T>;

function reactive<T extends State>(
  Type: new (...args: State.Args<T>) => T
): has.Pool<T, State.Args<T> | [T]>;

function reactive<T extends State, K extends State.Field<T>>(
  Type: new (...args: State.Args<T>) => T,
  fromKey: K
): has.Pool<T, [T[K]] | [T]>;

function reactive<R, A extends unknown[]>(
  make: (...args: A) => R
): has.Pool<Exclude<R, null | undefined>, A, R>;

function reactive(...args: any[]): any {
  const arg = args[0];

  return typeof arg == 'function'
    ? new has.Pool(arg, args[1])
    : new has.List(arg);
}

describe('factory', () => {
  it('will create empty', () => {
    const list = reactive<number>();

    expect(list).toBeInstanceOf(has.List);
    expect(list.size).toBe(0);
    expect(list.get()).toEqual([]);
  });

  it('will accept array', () => {
    const list = reactive([1, 2, 3]);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will accept any iterable', () => {
    function* gen() {
      yield 'a';
      yield 'b';
    }

    expect(reactive(gen()).get()).toEqual(['a', 'b']);
  });

  it('will copy from initial', () => {
    const source = [1, 2, 3];
    const list = reactive(source);

    source.push(4);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will treat falsy initial as empty', () => {
    expect(reactive<number>(null).size).toBe(0);
    expect(reactive<number>(false).size).toBe(0);
  });

  it('will throw if assigned', () => {
    class Host extends State {
      value = has<number>();
    }

    const host = Host.new();

    expect(() => {
      // @ts-expect-error
      host.value = null;
    }).toThrow();
  });

  it('will clear when owner is destroyed', () => {
    class Host extends State {
      value = has([1, 2, 3]);
    }

    const host = Host.new();
    const list = host.value;

    host.set(null);

    expect(list.size).toBe(0);
  });
});

describe('get', () => {
  it('will return snapshot with no args', () => {
    const list = reactive([1, 2, 3]);
    const snap = list.get();

    expect(snap).toEqual([1, 2, 3]);

    snap.push(4);

    expect(list.size).toBe(3);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const list = reactive([inner]);

    expect(list.get()).toEqual(['unwrapped']);
  });

  it('will read by positive index', () => {
    const list = reactive(['a', 'b', 'c']);

    expect(list.get(1)).toBe('b');
  });

  it('will normalize negative index', () => {
    const list = reactive(['a', 'b', 'c']);

    expect(list.get(-1)).toBe('c');
    expect(list.get(-3)).toBe('a');
  });

  it('will return undefined for out-of-range index', () => {
    const list = reactive(['a', 'b']);

    expect(list.get(5)).toBeUndefined();
    expect(list.get(-5)).toBeUndefined();
  });

  it('will read range with start, end', () => {
    const list = reactive([10, 20, 30, 40]);

    expect(list.get(1, 3)).toEqual([20, 30]);
  });

  it('will normalize negative start in range', () => {
    const list = reactive([10, 20, 30, 40]);

    expect(list.get(-2, 4)).toEqual([30, 40]);
  });

  it('will clamp end to length in range', () => {
    const list = reactive([1, 2]);

    expect(list.get(0, 99)).toEqual([1, 2]);
  });

  it('will return first match for predicate', () => {
    const list = reactive([1, 2, 3, 4]);

    expect(list.get((v) => v > 2)).toBe(3);
  });

  it('will return undefined when predicate matches nothing', () => {
    const list = reactive([1, 2, 3]);

    expect(list.get((v) => v > 99)).toBeUndefined();
  });
});

describe('set', () => {
  it('will replace value at index', () => {
    const list = reactive(['a', 'b', 'c']);

    list.set(1, 'B');

    expect(list.get()).toEqual(['a', 'B', 'c']);
  });

  it('will normalize negative index', () => {
    const list = reactive(['a', 'b', 'c']);

    list.set(-1, 'C');

    expect(list.get()).toEqual(['a', 'b', 'C']);
  });

  it('will not write out-of-range positive', () => {
    const list = reactive(['a']);

    list.set(5, 'x');

    expect(list.get()).toEqual(['a']);
  });

  it('will not write out-of-range negative', () => {
    const list = reactive(['a']);

    list.set(-5, 'x');

    expect(list.get()).toEqual(['a']);
  });

  it('will not notify for unchanged value', async () => {
    const list = reactive(['a']);
    const fn = vi.fn();

    watch(list, fn);
    fn.mockClear();

    list.set(0, 'a');
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('put', () => {
  it('will insert at index, shifting subsequent', () => {
    const list = reactive([1, 2, 4]);

    list.put(2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will insert multiple', () => {
    const list = reactive([1, 4]);

    list.put(1, 2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will append when index equals length', () => {
    const list = reactive([1, 2]);

    list.put(2, 3);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will normalize negative index', () => {
    const list = reactive([1, 4]);

    list.put(-1, 2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will not notify when no items provided', async () => {
    const list = reactive([1, 2]);
    const fn = vi.fn();

    watch(list, fn);
    fn.mockClear();

    list.put(0);
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('push', () => {
  it('will append and return new length', () => {
    const list = reactive([1]);

    expect(list.push(2, 3)).toBe(3);
    expect(list.get()).toEqual([1, 2, 3]);
  });
});

describe('pop', () => {
  it('will remove from tail by default', () => {
    const list = reactive([1, 2, 3]);

    expect(list.pop()).toBe(3);
    expect(list.get()).toEqual([1, 2]);
  });

  it('will remove at index', () => {
    const list = reactive([1, 2, 3]);

    expect(list.pop(0)).toBe(1);
    expect(list.get()).toEqual([2, 3]);
  });

  it('will remove a count and return array', () => {
    const list = reactive([1, 2, 3, 4]);

    expect(list.pop(1, 2)).toEqual([2, 3]);
    expect(list.get()).toEqual([1, 4]);
  });

  it('will normalize negative index', () => {
    const list = reactive([1, 2, 3]);

    expect(list.pop(-2)).toBe(2);
    expect(list.get()).toEqual([1, 3]);
  });

  it('will return undefined on empty list', () => {
    const list = reactive<number>();

    expect(list.pop()).toBeUndefined();
  });
});

describe('clear', () => {
  it('will remove all items', () => {
    const list = reactive([1, 2, 3]);

    list.clear();

    expect(list.size).toBe(0);
  });

  it('will not notify on empty list', async () => {
    const list = reactive<number>();
    const fn = vi.fn();

    watch(list, fn);
    fn.mockClear();

    list.clear();
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('iteration', () => {
  it('will iterate via for-of', () => {
    const out: number[] = [];

    for (const v of reactive([1, 2, 3])) out.push(v);

    expect(out).toEqual([1, 2, 3]);
  });

  it('will spread', () => {
    expect([...reactive(['a', 'b'])]).toEqual(['a', 'b']);
  });
});

describe('map', () => {
  it('will produce a plain array', () => {
    const list = reactive([1, 2, 3]);
    const out = list.map((v) => v * 2);

    expect(out).toEqual([2, 4, 6]);
    expect(Array.isArray(out)).toBe(true);
  });

  it('will skip results matching ignore value', () => {
    const list = reactive([1, 2, 3, 4]);
    const out = list.map((v) => (v % 2 ? v : null), null);

    expect(out).toEqual([1, 3]);
  });

  it('will receive index and list', () => {
    const list = reactive(['a']);
    const fn = vi.fn((_v: string, _i: number, _l: unknown) => 0);

    list.map(fn);

    expect(fn).toHaveBeenCalledWith('a', 0, list);
  });
});

describe('filter', () => {
  it('will return matching items', () => {
    const list = reactive([1, 2, 3, 4]);

    expect(list.filter((v) => v > 2)).toEqual([3, 4]);
  });
});

describe('any / all', () => {
  it('will return true when match exists', () => {
    expect(reactive([1, 2, 3]).any((v) => v > 2)).toBe(true);
  });

  it('will return false when no match', () => {
    expect(reactive([1, 2, 3]).any((v) => v > 99)).toBe(false);
  });

  it('will return boolean independent of value truthiness', () => {
    const list = reactive([1, 0, 2]);

    expect(list.any((v) => v === 0)).toBe(true);
  });

  it('will return true when predicate true for every item', () => {
    expect(reactive([2, 4, 6]).all((v) => v % 2 === 0)).toBe(true);
  });

  it('will return false on first failure', () => {
    expect(reactive([2, 3, 4]).all((v) => v % 2 === 0)).toBe(false);
  });

  it('will return true on empty list', () => {
    expect(reactive<number>().all((v) => v > 0)).toBe(true);
  });
});

describe('subscriptions', () => {
  it('will update on size when length changes', async () => {
    const list = reactive([1, 2]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on get(i) only when that index changes', async () => {
    const list = reactive(['a', 'b', 'c']);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.get(1);
      fn();
    });
    fn.mockClear();

    list.set(0, 'A');
    await flush();

    expect(fn).not.toHaveBeenCalled();

    list.set(1, 'B');
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on iteration when any index changes', async () => {
    const list = reactive([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.set(1, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on iteration when length grows', async () => {
    const list = reactive([1, 2]);
    const fn = vi.fn();

    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update any() with no match on append', async () => {
    const list = reactive([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.any((v) => v > 99);
      fn();
    });
    fn.mockClear();

    list.push(100);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update all() when appended item violates predicate', async () => {
    const list = reactive([2, 4]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.all((v) => v % 2 === 0);
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update get(predicate) when earlier item becomes candidate', async () => {
    const list = reactive([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.get((v) => v > 2);
      fn();
    });
    fn.mockClear();

    list.set(0, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will subscribe get(start, end) to indices in range only', async () => {
    const list = reactive([1, 2, 3, 4, 5]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.get(1, 3);
      fn();
    });
    fn.mockClear();

    list.set(4, 99);
    await flush();

    expect(fn).not.toHaveBeenCalled();

    list.set(2, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will subscribe out-of-range get to length so growth re-evaluates', async () => {
    const list = reactive([1]);
    const fn = vi.fn();

    watch(list, ($) => {
      void $.get(5);
      fn();
    });
    fn.mockClear();

    list.push(2);
    await flush();

    expect(fn).toHaveBeenCalled();
  });
});

describe('pool', () => {
  class Item extends State {
    value = 0;
  }

  it('will create pool for class', () => {
    const pool = reactive(Item);

    expect(pool).toBeInstanceOf(has.Pool);
    expect(pool.size).toBe(0);
  });

  it('will create pool for class without keys', () => {
    const pool = new has.Pool<Item>(Item);
    const item = pool.add({ value: 3 });

    expect(item.value).toBe(3);
    expect(pool.size).toBe(1);
  });

  it('will create pool for factory', () => {
    const pool = reactive(() => ({ value: 0 }));

    expect(pool).toBeInstanceOf(has.Pool);
  });

  it('will construct mode as class identity', () => {
    const list = reactive<number>();
    const pool = reactive(Item);

    expect(list).toBeInstanceOf(has.List);
    expect(list).not.toBeInstanceOf(has.Pool);
    expect(pool).not.toBeInstanceOf(has.List);
  });

  it('will not define add on list', () => {
    const list = reactive<number>();

    expect(() => (list as any).add()).toThrow(TypeError);
  });

  it('will not define push on pool', () => {
    const pool = reactive(Item);

    expect(() => (pool as any).push(new Item())).toThrow(TypeError);
  });

  it('will return spawned value from add', () => {
    const pool = reactive(Item);
    const item = pool.add();

    expect(item).toBeInstanceOf(Item);
    expect(pool.has(item)).toBe(true);
    expect(pool.size).toBe(1);
  });

  it('will forward add arguments to class constructor', () => {
    const pool = reactive(Item);
    const item = pool.add({ value: 5 });

    expect(item.value).toBe(5);
  });

  it('will forward add arguments to factory', () => {
    const pool = reactive((n: number) => ({ n }));
    const item = pool.add(3);

    expect(item.n).toBe(3);
  });

  it('will not add if factory returns nothing', () => {
    const pool = reactive((n: number) => (n > 0 ? { n } : undefined));

    expect(pool.add(1)).toEqual({ n: 1 });
    expect(pool.add(0)).toBeUndefined();
    expect(pool.size).toBe(1);
  });

  it('will pass through guest from factory', () => {
    const pool = reactive((value?: Item) => value || Item.new());
    const guest = Item.new();

    expect(pool.add(guest)).toBe(guest);
    expect(pool.has(guest)).toBe(true);
  });

  it('will admit instance of class instead of constructing', () => {
    const pool = reactive(Item);
    const guest = Item.new();

    expect(pool.add(guest)).toBe(guest);
    expect(pool.size).toBe(1);
  });

  it('will admit subclass instance', () => {
    class Special extends Item {}

    const pool = reactive(Item);
    const special = Special.new();

    expect(pool.add(special)).toBe(special);
    expect(pool.has(special)).toBe(true);
  });

  it('will still construct from props object', () => {
    const pool = reactive(Item);
    const item = pool.add({ value: 7 });

    expect(item).toBeInstanceOf(Item);
    expect(item.value).toBe(7);
  });

  it('will construct when args are not a lone instance', () => {
    const pool = reactive(Item);
    const item = pool.add({ value: 1 }, { value: 2 });

    expect(item).toBeInstanceOf(Item);
    expect(item.value).toBe(2);
  });

  it('will own admitted instance which is fresh', () => {
    const pool = reactive(Item);
    const item = new Item();

    pool.add(item);
    pool.delete(item);

    expect(item.get(null)).toBe(true);
  });

  it('will not destroy admitted instance which is active', () => {
    const pool = reactive(Item);
    const guest = Item.new();

    pool.add(guest);

    expect(pool.delete(guest)).toBe(true);
    expect(guest.get(null)).toBe(false);
  });

  it('will not admit instance in factory mode', () => {
    const pool = reactive((value: Item) => new Item({ value: value.value + 1 }));
    const seed = Item.new({ value: 1 });
    const made = pool.add(seed);

    expect(made).not.toBe(seed);
    expect(made.value).toBe(2);
  });

  it('will ignore repeat add of same value', async () => {
    const pool = reactive((value?: Item) => value || Item.new());
    const guest = Item.new();
    const fn = vi.fn();

    pool.add(guest);

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    pool.add(guest);
    await flush();

    expect(fn).not.toHaveBeenCalled();
    expect(pool.size).toBe(1);
  });

  it('will remove plain values on delete', () => {
    const pool = reactive(() => ({}));
    const value = pool.add();

    expect(pool.delete(value)).toBe(true);
    expect(pool.delete(value)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will destroy member on delete', () => {
    const pool = reactive(Item);
    const item = pool.add();

    expect(item.get(null)).toBe(false);

    pool.delete(item);

    expect(item.get(null)).toBe(true);
  });

  it('will destroy members on clear', () => {
    const pool = reactive(Item);
    const a = pool.add();
    const b = pool.add();

    pool.clear();

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will not destroy guest on delete', () => {
    const pool = reactive((value?: Item) => value || Item.new());
    const guest = Item.new();

    pool.add(guest);
    pool.delete(guest);

    expect(guest.get(null)).toBe(false);
  });

  it('will own fresh value made by factory', () => {
    const pool = reactive(() => new Item());
    const item = pool.add();

    pool.delete(item);

    expect(item.get(null)).toBe(true);
  });

  it('will evict member when it dies', () => {
    const pool = reactive(Item);
    const item = pool.add();

    item.set(null);

    expect(pool.has(item)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will not notify clear on empty pool', async () => {
    const pool = reactive(Item);
    const fn = vi.fn();

    watch(pool, fn);
    fn.mockClear();

    pool.clear();
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('pool lookup', () => {
  class Item extends State {
    id = '';
  }

  it('will adopt instance returned by factory', () => {
    const known = new Map([['abc', Item.new({ id: 'abc' })]]);
    const pool = reactive((id: string) => known.get(id) || new Item({ id }));

    expect(pool.add('abc')).toBe(known.get('abc'));
    expect(pool.add('xyz')).not.toBe(known.get('abc'));
    expect(pool.size).toBe(2);
  });

  it('will not add member returned twice', async () => {
    const known = new Map([['abc', Item.new({ id: 'abc' })]]);
    const pool = reactive((id: string) => known.get(id));
    const fn = vi.fn();

    pool.add('abc');

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    expect(pool.add('abc')).toBe(known.get('abc'));
    await flush();

    expect(fn).not.toHaveBeenCalled();
    expect(pool.size).toBe(1);
  });

  it('will not add if factory declines', async () => {
    const known = new Map([['abc', Item.new({ id: 'abc' })]]);
    const pool = reactive((id: string) => known.get(id));
    const fn = vi.fn();

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    expect(pool.add('nope')).toBeUndefined();
    await flush();

    expect(fn).not.toHaveBeenCalled();
    expect(pool.size).toBe(0);
  });

  it('will not add if factory returns null', async () => {
    const known = new Map([['abc', Item.new({ id: 'abc' })]]);
    const pool = reactive((id: string) => known.get(id) || null);
    const fn = vi.fn();

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    expect(pool.add('nope')).toBeNull();
    await flush();

    expect(fn).not.toHaveBeenCalled();
    expect(pool.size).toBe(0);
  });

  it('will exclude nullish from member type', () => {
    const known = new Map([['abc', Item.new({ id: 'abc' })]]);
    const pool = reactive((id: string) => known.get(id) || null);

    pool.add('abc');

    expect(pool.map((item) => item.id)).toEqual(['abc']);
  });
});

describe('pool key', () => {
  class Cell extends State {
    at = '';
    color = 'white';
  }

  it('will assign argument to named property', () => {
    const pool = reactive(Cell, 'at');
    const cell = pool.add('a1');

    expect(cell.at).toBe('a1');
    expect(cell.color).toBe('white');
  });

  it('will still admit instance of class', () => {
    const pool = reactive(Cell, 'at');
    const guest = Cell.new({ at: 'b2' });

    expect(pool.add(guest)).toBe(guest);
    expect(pool.size).toBe(1);
  });

  it('will own member spawned through key', () => {
    class Member extends State {
      id = '';
      owner = get(Owner);
    }

    class Owner extends State {
      members = has(Member, 'id');
    }

    const owner = Owner.new();
    const member = owner.members.add('abc');

    expect(member.owner).toBe(owner);
    expect(member.id).toBe('abc');
  });
});

describe('pool adoption', () => {
  class Member extends State {
    owner = get(Owner);
  }

  class Owner extends State {
    members = has(Member);
  }

  it('will parent spawned member to owner', () => {
    const first = Owner.new();
    const second = Owner.new();

    expect(first.members.add().owner).toBe(first);
    expect(second.members.add().owner).toBe(second);
  });

  it('will destroy owned members with owner', () => {
    const owner = Owner.new();
    const a = owner.members.add();
    const b = owner.members.add();

    owner.set(null);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will not destroy guest with owner', () => {
    class Guest extends State {}

    class Host extends State {
      members = has((value?: Guest) => value || new Guest());
    }

    const host = Host.new();
    const guest = Guest.new();

    host.members.add(guest);
    host.set(null);

    expect(guest.get(null)).toBe(false);
  });

  it('will hold a member of one pool in another', () => {
    class Thing extends State {}

    class Store extends State {
      items = has(Thing);
      selected = has(Thing);
    }

    const store = Store.new();
    const item = store.items.add();

    expect(store.selected.add(item)).toBe(item);

    store.selected.delete(item);

    expect(item.get(null)).toBe(false);
    expect(store.items.has(item)).toBe(true);

    item.set(null);

    expect(store.items.has(item)).toBe(false);
  });

  it('will own instances injected into pool', () => {
    class Thing extends State {}

    class Store extends State {
      items = has(Thing);
    }

    const store = Store.new();
    const injected = new Thing();

    store.items.add(injected);
    store.set(null);

    expect(injected.get(null)).toBe(true);
  });
});

describe('pool reads', () => {
  class Item extends State {
    value = 0;
  }

  it('will return snapshot array with no args', () => {
    const pool = reactive(Item);

    pool.add({ value: 1 });
    pool.add({ value: 2 });

    const snap = pool.get();

    expect(Array.isArray(snap)).toBe(true);
    expect(snap).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('will return first match for predicate', () => {
    const pool = reactive(Item);

    pool.add({ value: 1 });
    const two = pool.add({ value: 2 });

    expect(pool.get((item) => item.value > 1)).toBe(two);
  });

  it('will return undefined when predicate matches nothing', () => {
    const pool = reactive(Item);

    pool.add();

    expect(pool.get((item) => item.value > 99)).toBeUndefined();
  });

  it('will iterate members', () => {
    const pool = reactive((n: number) => ({ n }));
    const a = pool.add(1);
    const b = pool.add(2);

    expect([...pool]).toEqual([a, b]);
  });

  it('will map to plain array', () => {
    const pool = reactive((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);

    expect(pool.map((v) => v.n * 2)).toEqual([2, 4]);
  });

  it('will skip map results matching ignore value', () => {
    const pool = reactive((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);
    pool.add(3);

    expect(pool.map((v) => (v.n % 2 ? v.n : null), null)).toEqual([1, 3]);
  });

  it('will filter members', () => {
    const pool = reactive((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);
    pool.add(3);

    expect(pool.filter((v) => v.n > 1).map((v) => v.n)).toEqual([2, 3]);
  });

  it('will support any and all', () => {
    const pool = reactive((n: number) => ({ n }));

    pool.add(2);
    pool.add(4);

    expect(pool.any((v) => v.n > 3)).toBe(true);
    expect(pool.any((v) => v.n > 9)).toBe(false);
    expect(pool.all((v) => v.n % 2 === 0)).toBe(true);
    expect(pool.all((v) => v.n > 2)).toBe(false);
  });
});

describe('pool subscriptions', () => {
  class Item extends State {
    value = 0;
  }

  it('will update on size when membership changes', async () => {
    const pool = reactive(Item);
    const fn = vi.fn();

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    const item = pool.add();
    await flush();

    expect(fn).toHaveBeenCalled();
    fn.mockClear();

    pool.delete(item);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update has(value) only for that value', async () => {
    const pool = reactive(Item);
    const item = pool.add();
    const fn = vi.fn();

    watch(pool, ($) => {
      void $.has(item);
      fn();
    });
    fn.mockClear();

    pool.add();
    await flush();

    expect(fn).not.toHaveBeenCalled();

    pool.delete(item);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update iteration when membership changes', async () => {
    const pool = reactive(Item);
    const fn = vi.fn();

    watch(pool, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    pool.add();
    await flush();

    expect(fn).toHaveBeenCalled();
  });
});
