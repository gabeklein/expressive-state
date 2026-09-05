import { describe, expect, it, vi } from 'vitest';

import { childrenOf, Fragment, host, isElement, jsx, jsxs, owns, propsOf, transition, typeOf } from './runtime';
import { jsxDEV, Fragment as devFragment } from './jsx-dev-runtime';
import * as compat from './jsx-runtime';
import type { HostRuntime } from './runtime';

const HOST_FRAGMENT = Symbol('host.Fragment');

function mockHost(overrides?: Partial<HostRuntime>): HostRuntime {
  return {
    jsx: vi.fn((type, props, key) => ({ kind: 'jsx', type, props, key })),
    jsxs: vi.fn((type, props, key) => ({ kind: 'jsxs', type, props, key })),
    Fragment: HOST_FRAGMENT,
    childrenOf: vi.fn((children) => [children]),
    isElement: vi.fn((node) => !!node),
    typeOf: vi.fn((node: any) => node.type),
    propsOf: vi.fn((node: any) => node.props),
    ...overrides
  };
}

const runtime = mockHost();

describe('unregistered', () => {
  const noHost = 'No JSX host is registered for @expressive/mvc.';

  // Ordering matters: these run before any host() call in this module,
  // and no other test file touches the jsx module.
  it('will throw on element creation', () => {
    expect(() => jsx('div', {})).toThrow(noHost);
  });

  it('will throw on introspection', () => {
    const noHost = /No JSX host/;
    expect(() => childrenOf([])).toThrow(noHost);
    expect(() => isElement({})).toThrow(noHost);
    expect(() => typeOf({})).toThrow(noHost);
    expect(() => propsOf({})).toThrow(noHost);
  });

  it('will run transition work inline', () => {
    const work = vi.fn();
    expect(() => transition(work)).not.toThrow();
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe('registration', () => {
  it('will register a host', () => {
    host(runtime);
    expect(jsx('div', { a: 1 }, 'k')).toEqual({
      kind: 'jsx', type: 'div', props: { a: 1 }, key: 'k'
    });
  });

  it('will accept same host again', () => {
    expect(() => host(runtime)).not.toThrow();
  });

  it('will throw on conflicting host', () => {
    expect(() => host(mockHost())).toThrow(
      'A different JSX host is already registered'
    );
  });
});

describe('runtime', () => {
  it('will delegate jsxs', () => {
    expect(jsxs('ul', { children: [] })).toEqual({
      kind: 'jsxs', type: 'ul', props: { children: [] }, key: undefined
    });
  });

  it('will translate Fragment to host Fragment', () => {
    expect(devFragment).toBe(Fragment);
    expect((jsx(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
    expect((jsxs(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
    expect((jsxDEV(Fragment, {}) as any).type).toBe(HOST_FRAGMENT);
  });

  it('will fall back to jsx when host lacks jsxDEV', () => {
    expect(jsxDEV('div', {}, 'k', false)).toEqual({
      kind: 'jsx', type: 'div', props: {}, key: 'k'
    });
    expect(jsxDEV('div', {}, 'k', true)).toEqual({
      kind: 'jsxs', type: 'div', props: {}, key: 'k'
    });
  });

  it('will run transition work inline when host has no scheduler', () => {
    const work = vi.fn();
    transition(work);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('will invoke the host scheduler around transition work', () => {
    // same-runtime re-registration is how a host extends its seams
    runtime.transition = vi.fn((work: () => void) => work());
    host(runtime);

    const work = vi.fn();
    transition(work);

    expect(runtime.transition).toHaveBeenCalledWith(work);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('will delegate jsxDEV when host provides it', () => {
    // same-runtime re-registration is how a host extends its seams
    runtime.jsxDEV = vi.fn((type, props, key, isStatic) => ({
      kind: 'jsxDEV', type, props, key, isStatic
    }) as any);
    host(runtime);

    expect(jsxDEV('div', {}, 'k', true)).toEqual({
      kind: 'jsxDEV', type: 'div', props: {}, key: 'k', isStatic: true
    } as any);
  });
});

describe('introspection', () => {
  it('will delegate to host', () => {
    expect(childrenOf('x')).toEqual(['x']);
    expect(isElement(0)).toBe(false);
    expect(isElement({})).toBe(true);
    expect(typeOf({ type: 'div' })).toBe('div');
    expect(propsOf({ props: { to: '/' } })).toEqual({ to: '/' });
  });

  it('will surface host Fragment as agnostic Fragment', () => {
    expect(typeOf({ type: HOST_FRAGMENT })).toBe(Fragment);
  });
});

describe('jsx-runtime module', () => {
  it('will carry exactly the transform contract', () => {
    expect(Object.keys(compat).sort()).toEqual(['Fragment', 'jsx', 'jsxs']);
    expect(compat.jsx).toBe(jsx);
    expect(compat.jsxs).toBe(jsxs);
    expect(compat.Fragment).toBe(Fragment);
  });

  it('will prefer an owner scheduler over the ambient one', () => {
    const owner = {};
    const own = vi.fn((work: () => void) => work());

    runtime.transition = vi.fn((work: () => void) => work());
    host(runtime);

    const release = owns(owner, own);
    const work = vi.fn();

    transition(work, owner);

    expect(own).toHaveBeenCalledWith(work);
    expect(runtime.transition).not.toHaveBeenCalled();

    release();
    transition(work, owner);

    expect(runtime.transition).toHaveBeenCalledWith(work);
  });
});
