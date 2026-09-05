import './jsx-runtime';

import { describe, expect, it, vi } from 'vitest';
import { createElement, Fragment as PreactFragment } from 'preact';
import { childrenOf, Fragment, isElement, jsx, propsOf, typeOf } from '@expressive/mvc/runtime';
import { transition } from '@expressive/mvc/runtime';

const element = createElement('div', { id: 'foo' });

describe('host registration', () => {
  it('will create host elements', () => {
    const node = jsx('span', { children: 'hi' }) as preact.VNode;

    expect(isElement(node)).toBe(true);
    expect(node.type).toBe('span');
  });

  it('will translate Fragment sentinel to host Fragment', () => {
    const node = jsx(Fragment, {}) as preact.VNode;

    expect(node.type).toBe(PreactFragment);
    expect(typeOf(node)).toBe(Fragment);
  });

  it('will expose transition scheduling', () => {
    const work = vi.fn();

    transition(work);

    expect(work).toHaveBeenCalledOnce();
  });
});

describe('introspection', () => {
  it('will flatten children', () => {
    const items = childrenOf(['a', ['b', element]]);

    expect(items).toHaveLength(3);
    expect(items[0]).toBe('a' as never);
  });

  it('will identify elements', () => {
    expect(isElement(element)).toBe(true);
    expect(isElement({ type: 'div' })).toBe(false);
  });

  it('will read element type', () => {
    expect(typeOf(element)).toBe('div');
    expect(typeOf('text')).toBeUndefined();
  });

  it('will read element props', () => {
    expect(propsOf(element)).toEqual({ id: 'foo' });
    expect(propsOf('text')).toEqual({});
  });
});
