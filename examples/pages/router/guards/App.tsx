import './App.css';

import State, { Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

const DOCS = ['charter', 'ledger'];

class Session extends State {
  user: string | null = null;

  toggle() {
    this.user = this.user ? null : 'Ada';
  }
}

const session = new Session();
const router = new Router();

const vet = async () => {
  if (!session.user) return '/login';

  await new Promise((resolve) => setTimeout(resolve, 600));

  return DOCS.includes(router.path.split('/').pop()!) ? '' : null;
};

export default () => (
  <Provider for={{ session, router }}>
    <Route as={Frame}>
      <Route as={Lobby} />
      <Route to="login" as={Login} />
      <Route to="vault/:doc" as={Doc} redirect={vet} fallback={<p className="gate">checking…</p>} />
      <Route default as={NotFound} />
    </Route>
  </Provider>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Guards</h1>
    <p>
      A <code>redirect</code> function is an entry guard, run when its route is
      matched, and one function covers every verdict: a path sends the visitor
      elsewhere, nothing at all lets the render through, and <code>null</code>{' '}
      cedes the path - the scope falls through to its <code>default</code> rather
      than admitting whether anything was there.
    </p>
    <nav className="nav">
      <Link to="/">Lobby</Link>
      <Link to="/vault/charter">Charter</Link>
      <Link to="/vault/secrets">Secrets</Link>
    </nav>
    <div className="view">{props.children}</div>
    <small>
      Signed out, both vault links land on the sign-in page. The verdict is cached
      for the space it was decided in, so return to the lobby between attempts.
      While an async check runs, navigation holds your current page; the route’s{' '}
      <code>fallback</code> appears only when there is nothing to hold (a cold
      load).
    </small>
  </div>
);

const Lobby = () => {
  const { user, toggle } = Session.get();

  return (
    <p className="gate">
      {user ? `Signed in as ${user}` : 'Signed out'} -{' '}
      <button onClick={toggle}>{user ? 'Sign out' : 'Sign in'}</button>
    </p>
  );
};

const Login = () => (
  <p className="gate">
    The guard sent you here. Sign in from the lobby, then try the vault again.
  </p>
);

const Doc = () => {
  const { match } = Route.get();

  return <p className="doc">Reading {match?.doc}</p>;
};

const NotFound = () => <p className="gate">No such document in the vault.</p>;
