import { act, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Component, Consumer } from '@expressive/react';

import { location, browserRouter, mockError, mockPromise, renderAct } from '../test.setup';
import { Route } from './route';
import { Router } from './router';

const router = browserRouter();

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.match!.id}</article>}
    </Consumer>
  );
};

/** Render an anonymous root Route over `children`, capturing it, then settle.
 * Returns the captured root plus the view for content assertions. */
async function mount(children: React.ReactNode) {
  let root!: Route;
  const view = render(<Route is={(r) => (root = r)}>{children}</Route>);
  await act(async () => {});
  return { root, view };
}

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    const view = render(
      <>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    location('/unknown');
    const view = render(<Route to="/" as={Home} />);
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    location('/posts/foo');
    const view = render(<Route to="/posts/:id" as={Post} />);
    expect(view.container.textContent).toBe('id: foo');
  });

  it('exposes the router query', () => {
    const route = Route.new();
    route.router.goto('/posts?q=hi&page=2');

    expect(route.query.get('q')).toBe('hi');
    expect(route.query.get('page')).toBe('2');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    location('/posts/foo');
    let mountCount = 0;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
    };

    const view = render(<Route to="/posts/:id" as={Page} />);

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.current.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('renders alongside non-Route siblings', () => {
    const view = render(
      <>
        <div>chrome</div>
        <Route to="/" as={Home} />
      </>
    );
    expect(view.container.textContent).toBe('chromeHome');
  });

  it('preserves non-Route children inside a passthrough Route', () => {
    // Non-Route children (elements, text nodes) pass through to the
    // rendered output - structural elements survive resolution.
    const view = render(
      <Route to="/*">
        <div>chrome</div>
        {' text node '}
        <Route to="" as={Home} />
      </Route>
    );
    expect(view.container.textContent).toBe('chrome text node Home');
  });

  it('defaults `as` to a children-passthrough', () => {
    location('/anything');
    const view = render(
      <Route to="/anything">
        <span>inline</span>
      </Route>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('bare Route (no `to`) is its own root - always on at any path', async () => {
    location('/anything/deep');
    const view = await renderAct(<Route as={Home} />);
    expect(view.container.textContent).toBe('Home');
  });

  it('explicit to="" at root is an index (matches only root)', async () => {
    location('/anything');
    expect((await renderAct(<Route to="" as={Home} />)).container.textContent).toBe('');

    location('/');
    expect((await renderAct(<Route to="" as={Home} />)).container.textContent).toBe('Home');
  });

  it('specific sibling declared first beats bare-default Route', () => {
    location('/about');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('default Route renders when no earlier sibling matches', () => {
    location('/nope');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route default as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('Fallback');
  });

  it('params is undefined when match invalidated by navigation', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    expect(leaf.match).toEqual({ id: 'foo' });

    await act(async () => router.current.goto('/elsewhere'));
    expect(leaf.match).toBeUndefined();
  });

  it('anchor handles patterns that already end with /', () => {
    let leaf!: Route;
    render(<Route to="/" is={(r) => (leaf = r)} />);
    expect(leaf.anchor).toBe('/');
  });

  it('Route.goto resolves relative paths via anchor', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    await act(async () => leaf.goto('./edit'));
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('Route.goto with no argument navigates to the Route itself', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    await act(async () => leaf.goto());
    expect(window.location.pathname).toBe('/posts/foo');
  });

  it('Route.goto with no argument pops to a param ancestor from below', async () => {
    location('/posts/foo/edit');
    let post!: Route;
    render(
      <Route to="/posts/:id" is={(r) => (post = r)}>
        <Route to="edit" as={() => <div>edit</div>} />
      </Route>
    );
    await act(async () => post.goto());
    expect(window.location.pathname).toBe('/posts/foo');
  });

  it('Route.goto resolves relative paths from a nested route against its full base', async () => {
    location('/posts/foo/edit');
    let leaf!: Route;
    render(
      <Route to="/posts/:id">
        <Route to="edit" is={(r) => (leaf = r)} as={() => <div>edit</div>} />
      </Route>
    );
    await act(async () => leaf.goto('../tags'));
    expect(window.location.pathname).toBe('/posts/foo/tags');
  });

  it('Route.goto throws when resolving relative from an unmatched Route', () => {
    location('/elsewhere');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    expect(() => leaf.goto()).toThrow(/unresolved parameters/);
  });

  it('Route.goto passes through absolute paths to Router', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(
      <>
        <Route to="/posts/:id" is={(r) => (leaf = r)} />
        <Route to="/about" as={() => <div>about</div>} />
      </>
    );
    await act(async () => leaf.goto('/about'));
    expect(window.location.pathname).toBe('/about');
  });

  it('Router.goto throws on relative paths', () => {
    expect(() => router.current.goto('./x')).toThrow(/absolute path/);
  });

  describe('Route.goto param swap', () => {
    it('swaps a single param against the route pattern', async () => {
      location('/document/123');
      let leaf!: Route;
      render(<Route to="/document/:id" is={(r) => (leaf = r)} />);
      await act(async () => leaf.goto({ id: '456' }));
      expect(window.location.pathname).toBe('/document/456');
    });

    it('swaps any param in a multi-param pattern, keeping the rest', async () => {
      location('/a/1/2');
      let leaf!: Route;
      render(<Route to="/a/:b/:c" is={(r) => (leaf = r)} />);

      await act(async () => leaf.goto({ c: '9' }));
      expect(window.location.pathname).toBe('/a/1/9');

      await act(async () => leaf.goto({ b: '8' }));
      expect(window.location.pathname).toBe('/a/8/9');
    });

    it('throws when the route owns no params', async () => {
      location('/about');
      let leaf!: Route;
      render(<Route to="/about" is={(r) => (leaf = r)} />);
      await act(async () => {});
      expect(() => leaf.goto({ id: '1' })).toThrow(/owns only \[none\]/);
    });

    it('swaps a param on a nested leaf, same as the flat form', async () => {
      location('/document/123');
      let leaf!: Route;
      render(
        <Route to="/document">
          <Route to=":id" is={(r) => (leaf = r)} as={() => <div>doc</div>} />
        </Route>
      );
      await act(async () => leaf.goto({ id: '456' }));
      expect(window.location.pathname).toBe('/document/456');
    });

    it('fills purely from overrides when the route is unmatched', async () => {
      location('/elsewhere');
      let leaf!: Route;
      render(<Route to="/document/:id" is={(r) => (leaf = r)} />);
      await act(async () => leaf.goto({ id: '7' }));
      expect(window.location.pathname).toBe('/document/7');
    });

    it('throws when a param is left unresolved', () => {
      location('/elsewhere');
      let leaf!: Route;
      render(<Route to="/document/:id" is={(r) => (leaf = r)} />);
      expect(() => leaf.goto({})).toThrow(/unresolved parameters/);
    });

    it('honors the replace flag', async () => {
      location('/document/123');
      let leaf!: Route;
      render(<Route to="/document/:id" is={(r) => (leaf = r)} />);
      const before = window.history.length;
      await act(async () => leaf.goto({ id: '456' }, true));
      expect(window.location.pathname).toBe('/document/456');
      expect(window.history.length).toBe(before);
    });

    it('throws on a param the route does not declare', () => {
      location('/document/123');
      let leaf!: Route;
      render(<Route to="/document/:id" is={(r) => (leaf = r)} />);
      expect(() => leaf.goto({ nope: 'x' })).toThrow(/cannot set param "nope"/);
    });

    it('a flat leaf owns every param in its multi-segment pattern', async () => {
      location('/org/1/user/2');
      let leaf!: Route;
      render(<Route to="/org/:orgId/user/:userId" is={(r) => (leaf = r)} />);
      await act(async () => leaf.goto({ orgId: '9' }));
      expect(window.location.pathname).toBe('/org/9/user/2');
    });

    it('a nested leaf owns only its own segment, not an inherited param', () => {
      location('/org/1/user/2');
      let leaf!: Route;
      render(
        <Route to="org/:orgId">
          <Route to="user/:userId" is={(r) => (leaf = r)} as={() => null} />
        </Route>
      );
      // userId is the leaf's own; orgId belongs to the parent scope.
      expect(() => leaf.goto({ orgId: '9' })).toThrow(/cannot set param "orgId"/);
    });
  });

  it('default `as` renders nothing when given no children', () => {
    location('/blank');
    const view = render(<Route to="/blank" />);
    expect(view.container.textContent).toBe('');
  });

  it('resolves Routes rendered through an intermediate component', () => {
    location('/about');
    const Pages = () => (
      <>
        <Route to="/about" as={() => <span>About</span>} />
        <Route to="/contact" as={() => <span>Contact</span>} />
      </>
    );
    // Wrapping in a Route gives both Routes the same parent for sibling
    // arbitration. The Routes themselves use `get(Route, false)` from
    // context, so resolving through an intermediate component is transparent.
    const view = render(
      <Route>
        <Pages />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('sibling Routes re-resolve winner on navigation', async () => {
    location('/a');
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.current.goto('/b'));
    expect(view.container.textContent).toBe('B');
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('switches between specific and bare-default on navigation', async () => {
    location('/a');
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route as={() => <span>Other</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.current.goto('/b'));
    expect(view.container.textContent).toBe('Other');
  });

  it('parallel Route groups under one parent resolve independently', () => {
    location('/admin/users');
    const Admin = () => (
      <div>
        <Route>
          <Route to="users" as={() => <header>User Header + </header>} />
          <Route as={() => <header>Admin Header + </header>} />
        </Route>
        <Route>
          <Route to="users" as={() => <main>Users Page</main>} />
          <Route to="settings" as={() => <main>Settings Page</main>} />
        </Route>
      </div>
    );
    const view = render(<Route to="admin/*" as={Admin} />);
    expect(view.container.textContent).toBe('User Header + Users Page');
  });

  it('resolves Routes nested in a Fragment', () => {
    location('/about');
    const view = render(
      <Route>
        <>
          <Route to="/about" as={() => <span>About</span>} />
          <Route to="/contact" as={() => <span>Contact</span>} />
        </>
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  describe('declaration order', () => {
    it('first matching sibling wins, shadowing later ones', () => {
      location('/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="/posts/new" as={() => <span>literal</span>} />
        </Route>
      );
      // :id matches /posts/new first, so it shadows the literal below it.
      expect(view.container.textContent).toBe('dynamic');
    });

    it('literal declared first takes precedence', () => {
      location('/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/new" as={() => <span>literal</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('literal');
    });

    it(':param declared first shadows a later catch-all', () => {
      location('/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="*" as={() => <span>catch-all</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('dynamic');
    });

    it('catch-all declared last catches what earlier siblings miss', () => {
      location('/anything/at/all');
      const view = render(
        <Route>
          <Route to="/" as={() => <span>home</span>} />
          <Route to="*" as={() => <span>not-found</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('not-found');
    });

    it('re-resolves the winner on navigation', async () => {
      location('/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/new" as={() => <span>literal</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('literal');

      await act(async () => router.current.goto('/posts/bar'));
      expect(view.container.textContent).toBe('dynamic');

      await act(async () => router.current.goto('/posts/new'));
      expect(view.container.textContent).toBe('literal');
    });

    it('first declared wins among equal matches', () => {
      location('/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:a" as={() => <span>a</span>} />
          <Route to="/posts/:b" as={() => <span>b</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('a');
    });
  });

  describe('passthrough Routes', () => {
    it('do not block sibling Routes from competing for selection', () => {
      // A Route without `as` is a grouping container - it must not
      // prevent its siblings (with `as`) from being chosen.
      location('/about');
      const view = render(
        <Route>
          <Route>
            <Route to="/about" as={() => <span>Grouped</span>} />
          </Route>
          <Route to="/about" as={() => <span>Sibling</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('GroupedSibling');
    });

    it('allow Routes nested inside structural wrapper components', () => {
      // Nested Routes inside an `as` component or children are relative
      // to the enclosing Route via context, not by lexical inspection.
      location('/blog/hello');
      const Layout = (props: { children?: React.ReactNode }) => (
        <main>
          <header>chrome</header>
          <section>{props.children}</section>
        </main>
      );
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":id" as={Post} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromeid: hello');
    });
  });

  describe('nested routes', () => {
    const Layout = (props: { children?: React.ReactNode }) => (
      <section><nav>chrome</nav>{props.children}</section>
    );
    const BlogIndex = () => <p>blog-index</p>;
    const BlogPost = () => (
      <Consumer for={Route}>{(r) => <p>post {r.match!.slug}</p>}</Consumer>
    );

    it('layout mounts its prefix-matched child', () => {
      location('/blog');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromeblog-index');
    });

    it('layout resolves :param child', () => {
      location('/blog/hello');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromepost hello');
    });

    it('layout does not mount when out of prefix', () => {
      location('/elsewhere');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('');
    });

    it('unregisters a child destroyed after its scope', async () => {
      location('/a/b');
      let scope!: Route;
      let leaf!: Route;
      const view = render(
        <Route>
          <Route to="a/*" is={(r) => (scope = r)}>
            <Route to="b" is={(r) => (leaf = r)} as={() => <span>b</span>} />
          </Route>
        </Route>
      );
      await act(async () => {});
      expect(view.container.textContent).toBe('b');
      expect(scope.inner).toEqual([leaf]);

      await act(async () => scope.set(null));
      await act(async () => leaf.set(null));
      expect(leaf.get(null)).toBe(true);
      expect(scope.inner).toEqual([leaf]);
    });

    it('three-level nesting composes bases correctly', () => {
      location('/admin/users/42');
      const AdminChrome = (props: { children?: React.ReactNode }) => (
        <main>admin/{props.children}</main>
      );
      const UsersChrome = (props: { children?: React.ReactNode }) => (
        <>users/{props.children}</>
      );
      const UserDetail = () => (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
      const view = render(
        <Route to="/admin/*" as={AdminChrome}>
          <Route to="users/*" as={UsersChrome}>
            <Route to=":id" as={UserDetail} />
          </Route>
        </Route>
      );
      expect(view.container.textContent).toBe('admin/users/42');
    });

    it('catch-all layout (to="*") nests children at root base', () => {
      location('/about');
      const Chrome = (props: { children?: React.ReactNode }) => (
        <main>{props.children}</main>
      );
      const view = render(
        <Route to="*" as={Chrome}>
          <Route to="/about" as={() => <span>about</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('about');
    });

    it('own captures only - parent params not in child', () => {
      location('/blog/hello');
      let inner!: Route;
      render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" is={(r) => (inner = r)} />
        </Route>
      );
      expect(inner.match).toEqual({ slug: 'hello' });
    });
  });

  // A multi-segment `to` ("users/:id") is a flat leaf - it does NOT synthesize an
  // intermediate "users" scope. Only explicit nesting opens a scope that can hold
  // a section `default` / shared chrome. These pin that the two forms differ.
  describe('scope vs segment (no desugaring)', () => {
    const Chrome = (props: { children?: React.ReactNode }) => (
      <main>chrome/{props.children}</main>
    );
    const Detail = () => <span>detail</span>;
    const SectionMissing = () => <span>section-404</span>;
    const AppMissing = () => <span>app-404</span>;

    it('nested form exposes a section scope: a miss hits the section default within chrome', () => {
      location('/users');
      const view = render(
        <Route to="users" as={Chrome}>
          <Route to=":id" as={Detail} />
          <Route default as={SectionMissing} />
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('mixed children make a content route, not a scope', () => {
      location('/posts');
      const view = render(
        <Route to="posts/*" as={Chrome}>
          hello
          <Route to="recent" as={Detail} />
        </Route>
      );
      expect(view.container.textContent).toContain('hello');
    });

    it('flat form has no section scope: the same miss falls through to the app default, no chrome', () => {
      location('/users');
      const view = render(
        <Route>
          <Route to="users/:id" as={Detail} />
          <Route default as={AppMissing} />
        </Route>
      );
      expect(view.container.textContent).toBe('app-404');
    });

    it('both forms match the resolved path identically', () => {
      location('/users/42');

      const nested = render(
        <Route to="users" as={Chrome}>
          <Route to=":id" as={Detail} />
          <Route default as={SectionMissing} />
        </Route>
      );
      expect(nested.container.textContent).toBe('chrome/detail');
      nested.unmount();

      const flat = render(
        <Route>
          <Route to="users/:id" as={Detail} />
          <Route default as={AppMissing} />
        </Route>
      );
      expect(flat.container.textContent).toBe('detail');
    });

    it('nested form interposes a section Route the flat form lacks', () => {
      location('/users/42');

      let nestedLeaf!: Route;
      const nested = render(
        <Route to="users" as={Chrome}>
          <Route to=":id" is={(r) => (nestedLeaf = r)} as={Detail} />
        </Route>
      );
      // the :id leaf hangs off a /users section scope
      expect(nestedLeaf.parent!.path).toBe('/users');
      nested.unmount();

      let flatLeaf!: Route;
      render(
        <Route>
          <Route to="users/:id" is={(r) => (flatLeaf = r)} as={Detail} />
        </Route>
      );
      // flat leaf hangs directly off the app root - no /users layer
      expect(flatLeaf.parent!.path).toBe('');
    });

    it('nested chrome persists across a param swap', async () => {
      location('/users/1');
      const Id = () => (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
      let leaf!: Route;
      const view = render(
        <Route to="users" as={Chrome}>
          <Route to=":id" is={(r) => (leaf = r)} as={Id} />
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/1');

      await act(async () => leaf.goto({ id: '2' }));
      expect(view.container.textContent).toBe('chrome/2');
    });

    it('a literal sibling beats the param in both forms', () => {
      const New = () => <span>new</span>;
      location('/users/new');

      const nested = render(
        <Route to="users" as={Chrome}>
          <Route to="new" as={New} />
          <Route to=":id" as={Detail} />
        </Route>
      );
      expect(nested.container.textContent).toBe('chrome/new');
      nested.unmount();

      const flat = render(
        <Route>
          <Route to="users/new" as={New} />
          <Route to="users/:id" as={Detail} />
        </Route>
      );
      expect(flat.container.textContent).toBe('new');
    });
  });

  // A section scope owning a `default` is claimed by that default for any path
  // within it - the same verdict whether the scope is the root route or sits
  // under a wrapper alongside other `as`-bearing siblings.
  describe('section default under a wrapper', () => {
    const Chrome = (props: { children?: React.ReactNode }) => (
      <main>chrome/{props.children}</main>
    );
    const Detail = () => <span>detail</span>;
    const SectionMissing = () => <span>section-404</span>;
    const Index = () => <span>index</span>;

    const docs = (
      <Route to="docs" as={Chrome}>
        <Route to=":id" as={Detail} />
        <Route default as={SectionMissing} />
      </Route>
    );

    it('catches a miss when the section is the root route', () => {
      location('/docs');
      const view = render(docs);
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('catches a deep miss when the section is the root route', () => {
      location('/docs/a/b');
      const view = render(docs);
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('catches a miss under a plain wrapper', () => {
      location('/docs');
      const view = render(<Route>{docs}</Route>);
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('catches a deep miss under a plain wrapper', () => {
      location('/docs/a/b');
      const view = render(<Route>{docs}</Route>);
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('catches a miss with an index sibling present', () => {
      location('/docs');
      const view = render(
        <Route>
          <Route as={Index} />
          {docs}
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('catches a deep miss with an index sibling present', () => {
      location('/docs/a/b');
      const view = render(
        <Route>
          <Route as={Index} />
          {docs}
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/section-404');
    });

    it('resolves a real child with an index sibling present', () => {
      location('/docs/intro');
      const view = render(
        <Route>
          <Route as={Index} />
          {docs}
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/detail');
    });

    it('does not let the section claim the index path', () => {
      location('/');
      const view = render(
        <Route>
          <Route as={Index} />
          {docs}
        </Route>
      );
      expect(view.container.textContent).toBe('index');
    });

    it('keeps outer chrome when an inner section default catches', () => {
      location('/site/docs');
      const Outer = (props: { children?: React.ReactNode }) => (
        <div>outer/{props.children}</div>
      );
      const view = render(
        <Route to="site" as={Outer}>
          <Route to="docs" as={Chrome}>
            <Route to=":id" as={Detail} />
            <Route default as={SectionMissing} />
          </Route>
        </Route>
      );
      expect(view.container.textContent).toBe('outer/chrome/section-404');
    });

    it('will throw if a later sibling is shadowed by a section default', () => {
      location('/docs/team/roster');
      const Roster = () => <span>roster</span>;
      expect(() =>
        render(
          <Route>
            {docs}
            <Route to="docs/team/roster" as={Roster} />
          </Route>
        )
      ).toThrow(/Route "\/docs\/team\/roster" is unreachable/);
    });

    it('will throw if a param section default shadows a later sibling', () => {
      location('/');
      expect(() =>
        render(
          <Route>
            <Route to=":section" as={Chrome}>
              <Route default as={SectionMissing} />
            </Route>
            <Route to="docs/intro" as={Detail} />
          </Route>
        )
      ).toThrow(/unreachable/);
    });

    it('will not throw for a later sibling above the section', () => {
      location('/docs');
      const view = render(
        <Route>
          <Route to="docs/team" as={Chrome}>
            <Route default as={SectionMissing} />
          </Route>
          <Route to="docs" as={Index} />
        </Route>
      );
      expect(view.container.textContent).toBe('index');
    });

    it('yields to an earlier flat sibling under the section path', () => {
      location('/docs/team/roster');
      const Roster = () => <span>roster</span>;
      const view = render(
        <Route>
          <Route to="docs/team/roster" as={Roster} />
          {docs}
        </Route>
      );
      expect(view.container.textContent).toBe('roster');
    });

    it('does not claim a sibling path outside the section', () => {
      location('/about');
      const About = () => <span>about</span>;
      const view = render(
        <Route>
          {docs}
          <Route to="about" as={About} />
        </Route>
      );
      expect(view.container.textContent).toBe('about');
    });
  });

  describe('redirect prop', () => {
    it('redirects (replacing) when matched', async () => {
      const before = window.history.length;
      await act(async () => {
        render(
          <>
            <Route to="" redirect="/home" />
            <Route to="/home" as={Home} />
          </>
        );
      });
      expect(window.location.pathname).toBe('/home');
      expect(window.history.length).toBe(before);
    });

    it('does not redirect when unmatched', () => {
      location('/elsewhere');
      render(<Route to="" redirect="/home" />);
      expect(window.location.pathname).toBe('/elsewhere');
    });

    it('resolves a relative target against the Route anchor', async () => {
      location('/posts/foo');
      await act(async () => {
        render(
          <>
            <Route to="/posts/:id" redirect="./edit" />
            <Route to="/posts/:id/edit" as={() => null} />
          </>
        );
      });
      expect(window.location.pathname).toBe('/posts/foo/edit');
    });

    describe('functional guard', () => {
      it('redirects when a sync guard returns a string', async () => {
        location('/admin');
        await act(async () => {
          render(
            <>
              <Route to="/admin" redirect={() => '/login'} as={() => <h1>secret</h1>} />
              <Route to="/login" as={() => <h1>login</h1>} />
            </>
          );
        });
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      it('renders normally when a sync guard allows (falsy)', async () => {
        location('/admin');
        await act(async () => {
          render(<Route to="/admin" redirect={() => undefined} as={() => <h1>secret</h1>} />);
        });
        expect(window.location.pathname).toBe('/admin');
        expect(screen.getByText('secret')).toBeDefined();
      });

      it('treats an empty-string verdict as allow', async () => {
        location('/admin');
        await act(async () => {
          render(<Route to="/admin" redirect={() => ''} as={() => <h1>secret</h1>} />);
        });
        expect(window.location.pathname).toBe('/admin');
        expect(screen.getByText('secret')).toBeDefined();
      });

      it('does not run the guard while unmatched', async () => {
        location('/elsewhere');
        let ran = 0;
        await act(async () => {
          render(
            <>
              <Route to="/admin" redirect={() => { ran++; return '/login'; }} as={() => <h1>secret</h1>} />
              <Route to="/elsewhere" as={() => <h1>here</h1>} />
            </>
          );
        });
        expect(ran).toBe(0);
        expect(screen.getByText('here')).toBeDefined();
      });

      it('runs the guard on a route whose own pattern has a param', async () => {
        location('/document/123');
        let ran = 0;
        await act(async () => {
          render(
            <>
              <Route to="/document/:id" redirect={() => { ran++; return '/login'; }} as={() => <h1>doc</h1>} />
              <Route to="/login" as={() => <h1>login</h1>} />
            </>
          );
        });
        expect(ran).toBe(1);
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      it('guards a whole section, redirecting from a deep child path', async () => {
        location('/admin/users');
        const Layout = (props: { children?: React.ReactNode }) => <main>{props.children}</main>;
        await act(async () => {
          render(
            <>
              <Route to="/admin/*" redirect={() => '/login'} as={Layout}>
                <Route to="users" as={() => <h1>users</h1>} />
              </Route>
              <Route to="/login" as={() => <h1>login</h1>} />
            </>
          );
        });
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      describe('async', () => {
        it('shows fallback while pending, then allows', async () => {
          location('/admin');
          const gate = mockPromise<string | void>();
          await act(async () => {
            render(
              <Route
                to="/admin"
                fallback={<h1>checking</h1>}
                redirect={() => gate}
                as={() => <h1>secret</h1>}
              />
            );
          });
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => { gate.resolve(undefined); });
          expect(window.location.pathname).toBe('/admin');
          expect(screen.getByText('secret')).toBeDefined();
        });

        it('shows fallback while pending, then redirects', async () => {
          location('/admin');
          const gate = mockPromise<string | void>();
          await act(async () => {
            render(
              <>
                <Route
                  to="/admin"
                  fallback={<h1>checking</h1>}
                  redirect={() => gate}
                  as={() => <h1>secret</h1>}
                />
                <Route to="/login" as={() => <h1>login</h1>} />
              </>
            );
          });
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => { gate.resolve('/login'); });
          expect(window.location.pathname).toBe('/login');
          expect(screen.getByText('login')).toBeDefined();
        });
      });

      describe('caching', () => {
        it('runs the guard once per entry, reusing it for in-space navigation', async () => {
          location('/admin/users');
          let ran = 0;
          const guard = () => { ran++; return undefined; };
          const Layout = (props: { children?: React.ReactNode }) => <main>{props.children}</main>;
          await act(async () => {
            render(
              <Route to="/admin/*" redirect={guard} as={Layout}>
                <Route to="users" as={() => <h1>users</h1>} />
                <Route to="roles" as={() => <h1>roles</h1>} />
              </Route>
            );
          });
          expect(ran).toBe(1);
          expect(screen.getByText('users')).toBeDefined();

          await act(async () => router.current.goto('/admin/roles'));
          expect(screen.getByText('roles')).toBeDefined();
          expect(ran).toBe(1);
        });

        it('re-runs the guard on re-entry', async () => {
          location('/admin');
          let ran = 0;
          const guard = () => { ran++; return undefined; };
          await act(async () => {
            render(
              <>
                <Route to="/admin" redirect={guard} as={() => <h1>secret</h1>} />
                <Route to="/elsewhere" as={() => <h1>here</h1>} />
              </>
            );
          });
          expect(ran).toBe(1);

          await act(async () => router.current.goto('/elsewhere'));
          expect(screen.getByText('here')).toBeDefined();

          await act(async () => router.current.goto('/admin'));
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(2);
        });

        it('re-runs the redirect on re-entry under a persistent parent', async () => {
          location('/admin/secret');
          let ran = 0;
          const redirect = () => { ran++; return undefined; };
          const Layout = (props: { children?: React.ReactNode }) => <main>{props.children}</main>;
          await act(async () => {
            render(
              <Route to="/admin/*" as={Layout}>
                <Route to="secret" redirect={redirect} as={() => <h1>secret</h1>} />
                <Route to="open" as={() => <h1>open</h1>} />
              </Route>
            );
          });
          expect(ran).toBe(1);
          expect(screen.getByText('secret')).toBeDefined();

          await act(async () => router.current.goto('/admin/open'));
          expect(screen.getByText('open')).toBeDefined();

          await act(async () => router.current.goto('/admin/secret'));
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(2);
        });

        it('re-runs an async redirect on re-entry under a persistent parent', async () => {
          location('/admin/secret');
          let ran = 0;
          let gate = mockPromise<string | void>();
          const redirect = () => { ran++; return gate; };
          const Layout = (props: { children?: React.ReactNode }) => <main>{props.children}</main>;
          await act(async () => {
            render(
              <Route to="/admin/*" as={Layout}>
                <Route to="secret" fallback={<h1>checking</h1>} redirect={redirect} as={() => <h1>secret</h1>} />
                <Route to="open" as={() => <h1>open</h1>} />
              </Route>
            );
          });
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => gate.resolve(undefined));
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(1);

          await act(async () => router.current.goto('/admin/open'));
          expect(screen.getByText('open')).toBeDefined();

          gate = mockPromise<string | void>();
          await act(async () => router.current.goto('/admin/secret'));
          expect(screen.getByText('open')).toBeDefined();
          expect(ran).toBe(2);

          await act(async () => gate.resolve(undefined));
          expect(screen.getByText('secret')).toBeDefined();
        });
      });

      describe('force-404 (null verdict)', () => {
        const Layout = (props: { children?: React.ReactNode }) => <main>{props.children}</main>;
        const Document = () => <article>doc</article>;
        const NotFound = () => <h1>not found</h1>;

        it('cedes the path so the scope falls through to its default', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          await act(async () => {
            render(
              <Route to="document" as={Layout}>
                <Route to=":id" fallback={<h1>loading</h1>} redirect={() => gate} as={Document} />
                <Route default as={NotFound} />
              </Route>
            );
          });
          expect(screen.getByText('loading')).toBeDefined();

          await act(async () => gate.resolve(null));
          expect(screen.queryByText('doc')).toBeNull();
          expect(screen.getByText('not found')).toBeDefined();
          expect(window.location.pathname).toBe('/document/123');
        });

        it('a non-null verdict still renders the document (control)', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          await act(async () => {
            render(
              <Route to="document" as={Layout}>
                <Route to=":id" fallback={<h1>loading</h1>} redirect={() => gate} as={Document} />
                <Route default as={NotFound} />
              </Route>
            );
          });
          await act(async () => gate.resolve(undefined));
          expect(screen.getByText('doc')).toBeDefined();
          expect(screen.queryByText('not found')).toBeNull();
        });

        it('marks the forfeited path on the router, cleared on navigation', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          let router!: Router;
          await act(async () => {
            render(
              <Route to="document" as={Layout} is={(r) => (router = r.router)}>
                <Route to=":id" redirect={() => gate} as={Document} />
                <Route default as={NotFound} />
              </Route>
            );
          });
          await act(async () => { gate.resolve(null); });
          expect(router.rejected).toBe('/document/123');
          expect(screen.getByText('not found')).toBeDefined();

          await act(async () => router.goto('/document/999'));
          expect(router.rejected === router.path).toBe(false);
          expect(screen.getByText('doc')).toBeDefined();
        });

        it('clears the rejection when the guard later allows', async () => {
          location('/admin');
          let allow = false;
          let owner!: Router;
          const gate = () => (allow ? undefined : null);
          const tree = () => (
            <Route is={(r) => (owner = r.router)}>
              <Route to="admin" redirect={() => gate()} as={() => <h1>secret</h1>} />
              <Route default as={NotFound} />
            </Route>
          );

          let view!: ReturnType<typeof render>;
          await act(async () => { view = render(tree()); });
          expect(owner.rejected).toBe('/admin');
          expect(screen.getByText('not found')).toBeDefined();

          allow = true;
          await act(async () => view.rerender(tree()));
          expect(owner.rejected).toBe('');
          expect(screen.getByText('secret')).toBeDefined();
        });

        it('a force-404\'d leaf is not reported as the active child', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          let scope!: Route;
          await act(async () => {
            render(
              <Route to="document" as={Layout} is={(r) => (scope = r)}>
                <Route to=":id" redirect={() => gate} as={Document} />
                <Route default as={NotFound} />
              </Route>
            );
          });
          await act(async () => { gate.resolve(null); });
          expect(scope.active).toBeUndefined();
        });
      });
    });
  });
});

describe('extends', () => {
  it('subclass authors content via render(); base gates on match', () => {
    let ran = 0;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        ran++;
        return <span>profile</span> as any;
      }
    }

    location('/profile');
    const view = render(<Route><Profile /></Route>);
    expect(view.container.textContent).toBe('profile');
    expect(ran).toBe(1);
  });

  it('does not run subclass content when unmatched (lazy children gate)', () => {
    let ran = 0;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        ran++;
        return <span>profile</span> as any;
      }
    }

    location('/elsewhere');
    const view = render(<Route><Profile /></Route>);
    expect(view.container.textContent).toBe('');
    expect(ran).toBe(0); // never invoked while unmatched
  });

  it('subclass owns nested routes that respect its mount path', () => {
    class Profile extends Route {
      to = 'profile/*';
      render() {
        return (
          <>
            <Route to="" as={() => <span>index</span>} />
            <Route to="settings" as={() => <span>settings</span>} />
          </>
        ) as any;
      }
    }

    location('/admin/profile/settings');
    const view = render(
      <Route>
        <Route to="admin/*"><Profile /></Route>
      </Route>
    );
    expect(view.container.textContent).toBe('settings');
  });

  it('is addressable in context by class identity from a descendant', () => {
    let found: Route | undefined;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        return <Inner /> as any;
      }
    }
    const Inner = () => {
      found = Profile.get();
      return <span>ok</span>;
    };

    location('/profile');
    render(<Route><Profile /></Route>);
    expect(found).toBeInstanceOf(Profile);
  });

  it('see-through scope chrome shows only when a subclass descendant matches', async () => {
    class Page extends Route {}
    const Chrome = ({ children }: { children?: React.ReactNode }) => (
      <div>chrome:{children}</div>
    );

    location('/section/info');
    const matched = await renderAct(
      <Route>
        <Route to="section/*" as={Chrome}>
          <Page to="info" as={() => <span>info</span>} />
        </Route>
      </Route>
    );
    expect(matched.container.textContent).toBe('chrome:info');

    location('/elsewhere');
    const unmatched = await renderAct(
      <Route>
        <Route to="section/*" as={Chrome}>
          <Page to="info" as={() => <span>info</span>} />
        </Route>
      </Route>
    );
    expect(unmatched.container.textContent).toBe('');
  });

  it('see-through scope resolves via a subclass default child', () => {
    class Fallback extends Route {}
    location('/section/anything');
    const view = render(
      <Route>
        <Route to="section/*">
          <Fallback default as={() => <span>fallback</span>} />
        </Route>
      </Route>
    );
    expect(view.container.textContent).toBe('fallback');
  });

  it('arbitrates the `as`-slot between subclass siblings by declaration order', () => {
    class Page extends Route {}
    location('/about');
    const view = render(
      <Route>
        <Page to="/about" as={() => <span>About</span>} />
        <Page to="/:slug" as={() => <span>Slug</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  describe('children seam', () => {
    class Page extends Route {
      Default: () => any = () => <span>fallback</span>;
      protected get children(): Component.Node {
        return (<>{super.children}<Route default as={this.Default} /></>) as any;
      }
    }

    it('tolerates the layer render invoked bare', async () => {
      router.current.goto('/a');
      const { root } = await mount(<Route to="a" as={Home} />);
      expect(Route.prototype.render.call(root)).toBeDefined();
    });

    it('converts a subclass Default into a child default route', () => {
      location('/section/missing');
      const view = render(
        <Route>
          <Page to="section/*">
            <Route to="info" as={() => <span>info</span>} />
          </Page>
        </Route>
      );
      expect(view.container.textContent).toBe('fallback');
    });

    it('lets a real sibling match win over the injected default', () => {
      location('/section/info');
      const view = render(
        <Route>
          <Page to="section/*">
            <Route to="info" as={() => <span>info</span>} />
          </Page>
        </Route>
      );
      expect(view.container.textContent).toBe('info');
    });

    it('reclassifies a leaf as a see-through scope when only a default is contributed', () => {
      location('/section/anything');
      const view = render(
        <Route>
          <Page to="section/*" />
        </Route>
      );
      expect(view.container.textContent).toBe('fallback');
    });

    it('contributed default suppresses an ancestor default (section 404)', () => {
      location('/section/missing');
      const view = render(
        <Route>
          <Page to="section/*">
            <Route to="info" as={() => <span>info</span>} />
          </Page>
          <Route default as={() => <span>app-404</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('fallback');
    });

    it('does not run subclass content when unmatched', () => {
      let ran = 0;
      class Tracked extends Route {
        protected get children(): Component.Node {
          return (
            <>{super.children}<Route default as={() => { ran++; return <span>x</span>; }} /></>
          ) as any;
        }
      }
      location('/elsewhere');
      const view = render(
        <Route>
          <Tracked to="section/*">
            <Route to="info" as={() => <span>info</span>} />
          </Tracked>
        </Route>
      );
      expect(view.container.textContent).toBe('');
      expect(ran).toBe(0);
    });
  });

  describe('structural children', () => {
    it('mounts child Routes even when the parent is unmatched', () => {
      location('/elsewhere');
      let mounted = false;
      const view = render(
        <Route to="foo/*">
          <Route to="bar" is={() => (mounted = true)} as={() => <span>bar</span>} />
        </Route>
      );
      expect(mounted).toBe(true);            // structural child mounted/registered
      expect(view.container.textContent).toBe(''); // ...but invisible (self-gated)
    });

    it('finds child Routes nested in a Fragment', () => {
      location('/elsewhere');
      let mounted = 0;
      render(
        <Route to="foo/*">
          <>
            <Route to="a" is={() => mounted++} />
            <Route to="b" is={() => mounted++} />
          </>
        </Route>
      );
      expect(mounted).toBe(2);               // both mount despite parent unmatched
    });

    it('shows the matched child once the parent matches', () => {
      location('/foo/bar');
      const view = render(
        <Route to="foo/*">
          <Route to="bar" as={() => <span>bar</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('bar');
    });

    it('treats non-Route content as a leaf (gated, not always-mounted)', () => {
      location('/elsewhere');
      let ran = false;
      const Content = () => { ran = true; return <span>content</span>; };
      const view = render(
        <Route to="foo/*">
          <Content />
        </Route>
      );
      expect(ran).toBe(false);               // leaf content gated off while unmatched
      expect(view.container.textContent).toBe('');
    });
  });
});

const ab = (
  <>
    <Route to="a" />
    <Route to="b" />
  </>
);

describe('active', () => {
  it('is undefined when no child matches', async () => {
    Router.new();
    const { root } = await mount(ab);
    expect(root.active).toBeUndefined();
  });

  it('returns the single matched child', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.active?.to).toBe('a');
  });

  it('updates on navigation', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.active?.to).toBe('a');

    await act(async () => router.current.goto('/b'));
    expect(root.active?.to).toBe('b');
  });

  it('is null when more than one child matches', async () => {
    router.current.goto('/a');
    const { root } = await mount(<><Route to="a" /><Route to="a" /></>);
    expect(root.active).toBeNull();
  });

  it('sees through a scope to the matched child', async () => {
    router.current.goto('/posts/recent');
    let recent!: Route;
    const { root } = await mount(
      <Route to="posts/*">
        <Route to="recent" is={(r) => (recent = r)} />
      </Route>
    );
    expect(root.active).toBe(recent);
  });

  it('is null when a scope yields competing matches', async () => {
    router.current.goto('/posts/recent');
    const { root } = await mount(
      <Route to="posts/*">
        <Route to=":id" />
        <Route to="recent" />
      </Route>
    );
    expect(root.active).toBeNull();
  });

  it('ignores redirect routes as candidates', async () => {
    router.current.goto('/a');
    let content!: Route;
    const { root } = await mount(
      <>
        <Route to="a" redirect="/a" />
        <Route to="a" is={(r) => (content = r)} />
      </>
    );
    expect(root.active).toBe(content);
  });
});

describe('matches', () => {
  it('is empty when no child matches', async () => {
    Router.new();
    const { root } = await mount(ab);
    expect(root.matches).toEqual([]);
  });

  it('lists the matched child path', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.matches).toEqual(['/a']);
  });

  it('lists every match when more than one applies', async () => {
    router.current.goto('/a');
    const { root } = await mount(<><Route to="a" /><Route to="a" /></>);
    expect(root.matches).toEqual(['/a', '/a']);
  });

  it('updates on navigation', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.matches).toEqual(['/a']);

    await act(async () => router.current.goto('/b'));
    expect(root.matches).toEqual(['/b']);
  });

  it('excludes redirect routes', async () => {
    router.current.goto('/a');
    const { root } = await mount(
      <>
        <Route to="a" redirect="/a" />
        <Route to="a" />
      </>
    );
    expect(root.matches).toEqual(['/a']);
  });
});

describe('default', () => {
  const aOr404 = (
    <>
      <Route to="a" as={() => <span>a</span>} />
      <Route default as={() => <span>404</span>} />
    </>
  );

  it('matches when no sibling matches (app 404)', async () => {
    router.current.goto('/x');
    const { view } = await mount(aOr404);
    expect(view.container.textContent).toBe('404');

    await act(async () => router.current.goto('/a'));
    expect(view.container.textContent).toBe('a');
  });

  it('never matches without a parent', async () => {
    Router.new();
    let lone!: Route;
    const view = render(
      <Route default as={() => <span>lone</span>} is={(r) => (lone = r)} />
    );
    await act(async () => {});
    expect(lone.matched).toBe(false);
    expect(view.container.textContent).toBe('');
  });

  it('path is its base', async () => {
    router.current.goto('/docs');
    let fallback!: Route;
    await mount(
      <Route to="docs/*">
        <Route default is={(r) => (fallback = r)} as={() => <span>404</span>} />
      </Route>
    );
    expect(fallback.path).toBe('/docs');
  });

  it('yields once a sibling matches and restores on navigation away', async () => {
    router.current.goto('/a');
    const { view } = await mount(aOr404);
    expect(view.container.textContent).toBe('a');

    await act(async () => router.current.goto('/missing'));
    expect(view.container.textContent).toBe('404');
  });

  it('is scoped to its parent (section 404 does not leak)', async () => {
    router.current.goto('/posts/recent');
    const { view } = await mount(
      <>
        <Route to="posts/*">
          <Route to="recent" as={() => <span>recent</span>} />
          <Route default as={() => <span>posts404</span>} />
        </Route>
        <Route default as={() => <span>app404</span>} />
      </>
    );
    expect(view.container.textContent).toBe('recent');

    await act(async () => router.current.goto('/posts/xyz'));
    expect(view.container.textContent).toBe('posts404');

    await act(async () => router.current.goto('/elsewhere'));
    expect(view.container.textContent).toBe('app404');
  });

  it('is excluded from matches and active', async () => {
    router.current.goto('/missing');
    const { root } = await mount(
      <>
        <Route to="a" />
        <Route default as={() => <span>404</span>} />
      </>
    );
    expect(root.matches).toEqual([]);
    expect(root.active).toBeUndefined();
  });

  it('sees through an anonymous group - nested match suppresses sibling default', async () => {
    router.current.goto('/a');
    const { view } = await mount(
      <>
        <Route>
          <Route to="a" as={() => <span>A</span>} />
        </Route>
        <Route default as={() => <span>F</span>} />
      </>
    );
    expect(view.container.textContent).toBe('A');

    await act(async () => router.current.goto('/missing'));
    expect(view.container.textContent).toBe('F');
  });
});
it('match keeps identity when recompute yields equal params', async () => {
  location('/posts/foo');
  let leaf!: Route;
  render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);

  const first = leaf.match;
  expect(first).toEqual({ id: 'foo' });

  // Case-insensitive literal: the path changes (forcing recompute) but the
  // captures are equal, so match returns the previous object - reactive
  // consumers see no change.
  await act(async () => router.current.goto('/POSTS/foo'));
  expect(leaf.match).toBe(first!);
});

it('deregisters a child from parent.inner on unmount', async () => {
  location('/');
  let parent!: Route;

  const view = await renderAct(
    <Route is={(r) => (parent = r)}>
      <Route to="a" />
    </Route>
  );
  expect(parent.inner.map((r) => r.path)).toEqual(['/a']);

  await act(async () => view.rerender(<Route is={(r) => (parent = r)} />));
  expect(parent.inner).toEqual([]);
});

describe('a Route passed as another Route', () => {
  // The dev-repo codegen shape `<Page to="seg" as={Default}>{children}</Page>`,
  // where the outer node carries the segment/overrides and the inner (user)
  // Route is the subtree controller. Delegation falls out of the existing
  // see-through machinery: the inner Route is the sole arbiter, sees the
  // outer's computed `nested`, and keeps Route.get / fallback / suspense intact.
  const Leaf = (label: string) => () => <span>{label}</span>;

  it('lets the inner Route arbitrate and render the matched child', async () => {
    location('/sub/a');
    class Inner extends Route {}

    const view = render(
      <Route to="sub" as={Inner}>
        <Route to="a" as={Leaf('A')} />
        <Route to="b" as={Leaf('B')} />
      </Route>
    );
    await act(async () => {});

    expect(view.container.textContent).toBe('A');
  });

  it('resolves Route.get to the inner instance within its own content', async () => {
    location('/sub');
    let innerInst!: Route;
    let resolved!: Route;

    class Inner extends Route {
      render() {
        innerInst = this.is;
        return (
          <Consumer for={Route}>{(r) => { resolved = r.is; return <span>inner</span>; }}</Consumer>
        );
      }
    }

    const view = render(<Route to="sub" as={Inner} />);
    await act(async () => {});

    expect(view.container.textContent).toBe('inner');
    expect(resolved).toBeInstanceOf(Inner);
    expect(resolved).toBe(innerInst);
  });

  it('sees the outer Route\'s computed children (outer-injected child matches)', async () => {
    location('/sub/extra');
    class Outer extends Route {
      protected get children() {
        return (
          <>
            {super.children}
            <Route to="extra" as={Leaf('EXTRA')} />
          </>
        );
      }
    }
    class Inner extends Route {}

    const view = render(
      <Outer to="sub" as={Inner}>
        <Route to="a" as={Leaf('A')} />
      </Outer>
    );
    await act(async () => {});

    expect(view.container.textContent).toBe('EXTRA');
  });

  it('keeps the inner Route\'s fallback/suspense intact', async () => {
    location('/sub');
    let ready = false;
    let resolve!: () => void;
    const pending = new Promise<void>((r) => (resolve = r)).then(() => { ready = true; });

    class Inner extends Route {
      fallback = <span>loading</span>;
      render() {
        return <Suspends />;
      }
    }
    const Suspends = () => {
      if (!ready) throw pending;
      return <span>ready</span>;
    };

    const view = render(<Route to="sub" as={Inner} />);
    await act(async () => {});
    expect(view.container.textContent).toBe('loading');

    await act(async () => { resolve(); await pending; });
    expect(view.container.textContent).toBe('ready');
  });
});

describe('a lazy page as `as`', () => {
  type Module = { default: () => any };

  it('suspends into the route fallback, then resolves in place', async () => {
    location('/posts/foo');
    const module = mockPromise<Module>();
    const Page = lazy(() => module);
    const created = vi.fn();
    let route!: Route;

    const view = await renderAct(
      <Route
        to="/posts/:id"
        fallback={<span>loading</span>}
        as={Page}
        is={(r) => { created(); route = r; }}
      />
    );

    expect(view.container.textContent).toBe('loading');

    await act(async () => {
      module.resolve({ default: Post });
      await module;
    });

    expect(view.container.textContent).toBe('id: foo');
    expect(created).toHaveBeenCalledTimes(1);
    expect(route.match).toEqual({ id: 'foo' });
  });

  it('suspends within a nested scope without remounting the layout', async () => {
    location('/admin/users/7');
    const module = mockPromise<Module>();
    const Users = lazy(() => module);
    let mounted = 0;
    let child!: Route;

    const Layout = (props: { children?: React.ReactNode }) => {
      mounted++;
      return <main>{props.children}</main>;
    };

    const view = await renderAct(
      <Route to="/admin/*" as={Layout}>
        <Route
          to="users/:id"
          fallback={<span>loading</span>}
          as={Users}
          is={(r) => (child = r)}
        />
      </Route>
    );

    expect(view.container.querySelector('main')!.textContent).toBe('loading');
    expect(mounted).toBe(1);

    await act(async () => {
      module.resolve({ default: Post });
      await module;
    });

    expect(view.container.querySelector('main')!.textContent).toBe('id: 7');
    expect(mounted).toBe(1);
    expect(child.match).toEqual({ id: '7' });
  });

  it('resolves a lazy scope layout, then its nested children', async () => {
    location('/admin/users');
    const module = mockPromise<{ default: (props: any) => any }>();
    const Layout = lazy(() => module);
    let scope!: Route;

    const view = await renderAct(
      <Route to="/admin/*" fallback={<span>loading</span>} as={Layout} is={(r) => (scope = r)}>
        <Route to="users" as={() => <span>users</span>} />
        <Route to="roles" as={() => <span>roles</span>} />
      </Route>
    );

    expect(view.container.textContent).toBe('loading');
    expect(scope.inner).toEqual([]);

    await act(async () => {
      module.resolve({ default: (props) => <main>{props.children}</main> });
      await module;
    });

    expect(view.container.querySelector('main')!.textContent).toBe('users');
    expect(scope.inner.map((r) => r.path)).toEqual(['/admin/users', '/admin/roles']);

    await act(async () => router.current.goto('/admin/roles'));

    expect(view.container.querySelector('main')!.textContent).toBe('roles');
  });

  it('reaches the Route catch when the module rejects', async () => {
    mockError();
    location('/posts/foo');
    const module = mockPromise<Module>();
    const failure = new Error('chunk load failed');
    let caught!: Error;

    class Page extends Route {
      fallback = (<span>loading</span>);

      async catch(error: Error) {
        caught = error;
        this.fallback = <span>offline</span>;
        await new Promise(() => {});
      }
    }

    const view = await renderAct(
      <Page to="/posts/:id" as={lazy(() => module)} />
    );

    expect(view.container.textContent).toBe('loading');

    await act(async () => {
      module.reject(failure);
      await module.catch(() => {});
    });

    expect(caught).toBe(failure);
    expect(view.container.textContent).toBe('offline');
  });

  it('does not mount a lazy page abandoned by navigation mid-load', async () => {
    location('/posts/foo');
    const module = mockPromise<Module>();
    const page = vi.fn(() => <span>post</span>);

    const view = await renderAct(
      <>
        <Route to="/posts/:id" fallback={<span>loading</span>} as={lazy(() => module)} />
        <Route to="/about" as={() => <span>about</span>} />
      </>
    );

    expect(view.container.textContent).toBe('loading');

    await act(async () => router.current.goto('/about'));

    expect(view.container.textContent).toBe('about');

    await act(async () => {
      module.resolve({ default: page });
      await module;
    });

    expect(view.container.textContent).toBe('about');
    expect(page).not.toHaveBeenCalled();
  });
});

describe('deferred presentation', () => {
  it('holds the current screen while the next page loads', async () => {
    location('/');
    const module = mockPromise<{ default: () => any }>();

    const view = await renderAct(
      <>
        <Route to="/" as={Home} />
        <Route to="/next" fallback={<span>loading</span>} as={lazy(() => module)} />
      </>
    );
    expect(view.container.textContent).toBe('Home');

    await act(async () => router.current.goto('/next'));

    expect(window.location.pathname).toBe('/next');
    expect(view.container.textContent).toBe('Home');

    await act(async () => {
      module.resolve({ default: () => <h1>next</h1> });
      await module;
    });

    expect(view.container.textContent).toBe('next');
  });

  it('holds the current screen while an entry guard pends', async () => {
    location('/');
    const gate = mockPromise<string | void>();

    const view = await renderAct(
      <>
        <Route to="/" as={Home} />
        <Route to="/secret" fallback={<span>checking</span>} redirect={() => gate} as={() => <h1>secret</h1>} />
      </>
    );
    expect(view.container.textContent).toBe('Home');

    await act(async () => router.current.goto('/secret'));

    expect(view.container.textContent).toBe('Home');

    await act(async () => gate.resolve(undefined));

    expect(view.container.textContent).toBe('secret');
  });
});
