import './App.css';

import { Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

class Museum extends Router {
  static global = false;

  deferred = true;

  toggle() {
    this.deferred = !this.deferred;
  }

  protected transition(commit: () => void) {
    if (this.deferred) super.transition(commit);
    else commit();
  }
}

const router = new Museum();

const unlock = async () => {
  await new Promise((resolve) => setTimeout(resolve, 700));
};

export default () => (
  <Provider for={router}>
    <Route as={Frame}>
      <Route as={Foyer} />
      <Route to="paintings" label="Paintings" meta={{ tone: 'rose' }} as={Wing} redirect={unlock} fallback={<Opening />} />
      <Route to="sculpture" label="Sculpture" meta={{ tone: 'gold' }} as={Wing} redirect={unlock} fallback={<Opening />} />
      <Route to="archives" label="Archives" meta={{ tone: 'teal' }} as={Wing} redirect={unlock} fallback={<Opening />} />
    </Route>
  </Provider>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Transitions</h1>
    <p>
      Every navigation commits through the router&apos;s protected{' '}
      <code>transition</code> seam. The default marks the commit non-urgent
      (React <code>startTransition</code>), so moving to a page that is not
      ready yet <em>holds the current screen</em> until the next one is - no
      fallback flash between pages that were already up.
    </p>
    <Address />
    <nav className="nav">
      <Link to="/">Foyer</Link>
      <Link to="/paintings">Paintings</Link>
      <Link to="/sculpture">Sculpture</Link>
      <Link to="/archives">Archives</Link>
    </nav>
    <div className="view">{props.children}</div>
    <Deferral />
    <small>
      Each wing takes 700ms to unlock (an async entry guard). With deferral,
      nothing moves until the next wing is ready - address and page swap
      together, no flash. Untick the box to override the seam with an urgent
      commit: the address jumps at once and the wing flashes its fallback while
      it unlocks. A cold load falls back either way - there is no previous
      screen to hold.
    </small>
  </div>
);

const Address = () => {
  const { path } = Museum.get();

  return <code className="address">museum.example{path}</code>;
};

const Deferral = () => {
  const { deferred, toggle } = Museum.get();

  return (
    <label className="mode">
      <input type="checkbox" checked={deferred} onChange={toggle} />
      hold the screen while the next page loads (default)
    </label>
  );
};

const Foyer = () => (
  <section className="room">
    <h2>Foyer</h2>
    <p>Pick a wing. Each one is behind a slow door.</p>
  </section>
);

const Wing = () => {
  const { label, meta } = Route.get();

  return (
    <section className={`room ${meta!.tone}`}>
      <h2>{label}</h2>
      <p>The {label!.toLowerCase()} wing, fully loaded.</p>
    </section>
  );
};

const Opening = () => <p className="gate">unlocking…</p>;
