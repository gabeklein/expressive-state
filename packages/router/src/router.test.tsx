import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { browserRouter } from '../test.setup';
import { Context } from '@expressive/mvc';
import { BrowserRouter, Router } from './router';

describe('Router (headless)', () => {
  it('defaults to root', () => {
    expect(Router.new().path).toBe('/');
  });

  it('goto updates path in memory', () => {
    const router = Router.new();
    router.goto('/bar');
    expect(router.path).toBe('/bar');
  });

  it('goto normalizes . and ..', () => {
    const router = Router.new();
    router.goto('/posts/foo/../bar');
    expect(router.path).toBe('/posts/bar');
  });

  it('goto throws on relative paths', () => {
    expect(() => Router.new().goto('./x')).toThrow(/absolute path/);
  });

  it('seeds the history stack from the initial path', () => {
    const router = Router.new({ path: '/start' });
    expect(router.entries).toEqual(['/start']);
    expect(router.index).toBe(0);
  });

  it('goto pushes onto the stack; back/forward move the cursor', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    expect(router.entries).toEqual(['/', '/a', '/b']);

    router.back();
    expect(router.path).toBe('/a');
    router.back();
    expect(router.path).toBe('/');
    router.forward();
    expect(router.path).toBe('/a');
  });

  it('back does nothing at the oldest entry', () => {
    const router = Router.new();
    router.back();
    expect(router.path).toBe('/');
    expect(router.index).toBe(0);
  });

  it('forward does nothing at the newest entry', () => {
    const router = Router.new();
    router.goto('/a');
    router.forward();
    expect(router.path).toBe('/a');
    expect(router.index).toBe(1);
  });

  it('goto drops an empty query', () => {
    const router = Router.new();
    router.goto('/a?&');
    expect(router.path).toBe('/a');
    expect(router.entries).toEqual(['/', '/a']);
  });

  it('url omits query params set to undefined', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.query.set('page', undefined as any);
    expect(router.url).toBe('/posts');
  });

  it('goto with replace overwrites the current entry', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b', true);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('goto after back truncates the forward history', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    router.back();
    router.goto('/c');
    expect(router.entries).toEqual(['/', '/a', '/c']);
    expect(router.path).toBe('/c');
  });

  it('goto splits query string from path', () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    expect(router.path).toBe('/posts');
    expect(router.url).toBe('/posts?page=2&sort=asc');
  });

  it('goto without query clears the query', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.goto('/posts');
    expect(router.url).toBe('/posts');
  });

  it('canonicalizes the query so navigation does not push a duplicate entry', async () => {
    const encoded = Router.new();
    encoded.goto('/x?q=a%20b');
    await encoded.set();
    expect(encoded.entries).toEqual(['/', '/x?q=a+b']);
    encoded.set(null);

    const repeated = Router.new();
    repeated.goto('/x?a=1&a=2');
    await repeated.set();
    expect(repeated.entries).toEqual(['/', '/x?a=2']);
  });

  it('query exposes params as a map', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    expect(router.query.get('page')).toBe('2');
  });

  it('direct query mutation pushes a new entry', async () => {
    const router = Router.new();
    router.goto('/posts');
    await router.set();

    router.query.set('page', '2');
    await router.set();

    expect(router.entries).toEqual(['/', '/posts', '/posts?page=2']);
    expect(router.url).toBe('/posts?page=2');
  });

  it('stops tracking query once destroyed', async () => {
    const router = Router.new();
    router.goto('/posts');
    await router.set();

    router.set(null);

    expect(router.get(null)).toBe(true);
    expect(router.entries).toEqual(['/', '/posts']);
  });

  it('query updates reactively when search changes', async () => {
    const router = Router.new();
    const seen: (string | undefined)[] = [];

    router.get(state => {
      seen.push(state.query.get('page'));
    });

    router.goto('/posts?page=1');
    await router.set();
    router.goto('/posts?page=2');
    await router.set();

    expect(seen).toEqual([undefined, '1', '2']);
  });

  it('writing a query param pushes a new history entry', async () => {
    const router = Router.new();
    router.goto('/posts?page=1');
    router.query.set('page', '2');
    await router.set();

    expect(router.url).toBe('/posts?page=2');
    router.back();
    expect(router.url).toBe('/posts?page=1');
  });

  it('deleting a query param navigates', async () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    router.query.delete('sort');
    await router.set();

    expect(router.query.get('sort')).toBeUndefined();
    expect(router.path).toBe('/posts');
  });

  it('assigning url navigates (push)', () => {
    const router = Router.new();
    router.goto('/a');
    router.url = '/b?x=1';

    expect(router.path).toBe('/b');
    expect(router.query.get('x')).toBe('1');
    expect(router.entries).toEqual(['/', '/a', '/b?x=1']);
  });

  it('back/forward restore the query from the stack', () => {
    const router = Router.new();
    router.goto('/a?x=1');
    router.goto('/b?y=2');

    router.back();
    expect(router.url).toBe('/a?x=1');

    router.forward();
    expect(router.url).toBe('/b?y=2');
  });

  it('match ignores the query string', () => {
    const router = Router.new();
    router.goto('/posts/123?tab=info');
    expect(router.match('/posts', ':id')).not.toBeNull();
  });
});

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo?from=start');
    expect(router.current.path).toBe('/foo');
    expect(router.current.url).toBe('/foo?from=start');
  });

  it('goto pushes history and updates path', () => {
    act(() => router.current.goto('/bar'));
    expect(router.current.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', () => {
    const before = window.history.length;
    act(() => router.current.goto('/replaced', true));
    expect(router.current.path).toBe('/replaced');
    expect(window.location.pathname).toBe('/replaced');
    expect(window.history.length).toBe(before);
  });

  it('updates path on popstate', () => {
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.current.path).toBe('/elsewhere');
  });

  it('notices external history.pushState', () => {
    act(() => window.history.pushState(null, '', '/external'));
    expect(router.current.path).toBe('/external');
  });

  it('goto with query updates location and url', () => {
    act(() => router.current.goto('/results?q=hello'));
    expect(window.location.pathname).toBe('/results');
    expect(window.location.search).toBe('?q=hello');
    expect(router.current.path).toBe('/results');
    expect(router.current.url).toBe('/results?q=hello');
    expect(router.current.query.get('q')).toBe('hello');
  });

  it('clears the query when navigation drops it', () => {
    act(() => router.current.goto('/results?q=hi'));
    act(() => window.history.pushState(null, '', '/results'));
    expect(router.current.url).toBe('/results');
  });

  it('notices external history.replaceState', () => {
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.current.path).toBe('/replaced-external');
  });

  it('does not re-push when external navigation uses non-canonical encoding', async () => {
    const len = window.history.length;
    act(() => window.history.pushState(null, '', '/enc?q=a%20b'));
    await router.current.set();

    expect(router.current.query.get('q')).toBe('a b');
    // The query listener must treat %20 and + as equal, not push a corrected dup.
    expect(window.history.length).toBe(len + 1);
  });

  it('writing a query param pushes to window.history', async () => {
    act(() => router.current.goto('/page?x=1'));
    router.current.query.set('x', '9');
    await router.current.set();

    expect(window.location.search).toBe('?x=9');
    expect(window.location.pathname).toBe('/page');
  });

  it('back/forward delegate to window.history', () => {
    const back = vi.spyOn(window.history, 'back');
    const forward = vi.spyOn(window.history, 'forward');

    router.current.back();
    router.current.forward();

    expect(back).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);

    back.mockRestore();
    forward.mockRestore();
  });

  it('removes popstate listener on destroy', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    router.current.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });

  it('is a global on the client', () => {
    expect(Context.root.get(BrowserRouter)).toBe(router.current);
  });

  it('constructs without a window, and is not global there (server render)', () => {
    const saved = (globalThis as any).window;

    try {
      delete (globalThis as any).window;

      const server = BrowserRouter.new();

      expect(server.path).toBe('/');
      // did not register a global - else it would throw on collision with the
      // live client instance
      expect(Context.root.get(BrowserRouter)).toBe(router.current);

      server.set(null);
    } finally {
      (globalThis as any).window = saved;
    }
  });

  it('will throw where window has no location (React Native)', () => {
    const saved = (globalThis as any).window;

    try {
      (globalThis as any).window = Object.create(null);

      expect(typeof window).not.toBe('undefined');
      expect(() => BrowserRouter.new()).toThrow(/pathname/);
    } finally {
      (globalThis as any).window = saved;
    }
  });
});

describe('transition seam', () => {
  it('brackets goto, back and forward', () => {
    const log: string[] = [];

    class Test extends Router {
      static global = false;

      protected transition(commit: () => void) {
        log.push('bracket');
        commit();
      }
    }

    const router = Test.new();
    router.goto('/a');
    router.goto('/b');
    router.back();
    router.forward();

    expect(log).toEqual(['bracket', 'bracket', 'bracket', 'bracket']);
    expect(router.path).toBe('/b');
  });

  it('applies navigation only once the bracket runs commit', () => {
    let staged!: () => void;

    class Test extends Router {
      static global = false;

      protected transition(commit: () => void) {
        staged = commit;
      }
    }

    const router = Test.new();
    router.goto('/next');

    expect(router.path).toBe('/');
    expect(router.entries).toEqual(['/']);

    staged();

    expect(router.path).toBe('/next');
    expect(router.entries).toEqual(['/', '/next']);
  });

  it('brackets browser navigation, popstate included', () => {
    window.history.replaceState(null, '', '/');
    const log: string[] = [];

    class Test extends BrowserRouter {
      static global = false;

      protected transition(commit: () => void) {
        log.push('bracket');
        commit();
      }
    }

    const router = Test.new();
    expect(log.length).toBe(1);

    router.goto('/a');
    expect(router.path).toBe('/a');
    expect(log.length).toBe(2);

    act(() => {
      window.history.pushState(null, '', '/b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.path).toBe('/b');
    expect(log.length).toBe(4);

    router.set(null);
  });
});
