import State from '@expressive/react';
import { useState } from 'react';

// Nested states demonstrate fine-grained reactivity.
// Components only re-render when accessed properties change.

class Profile extends State {
  name = 'John';
  email = 'john@example.com';
}

class Settings extends State {
  theme: 'light' | 'dark' = 'light';
  language = 'en';
}

class UserData extends State {
  profile = new Profile();
  settings = new Settings();
  notifications = 0;
}

const UserProfile = () => {
  const [renderCount, setRenderCount] = useState(0);
  const {
    profile: { name, email, is: profile },
    notifications,
    is
  } = UserData.use();

  // Track renders to demonstrate fine-grained reactivity
  const currentRender = renderCount + 1;
  if (currentRender !== renderCount) {
    setTimeout(() => setRenderCount(currentRender), 0);
  }

  // Only re-renders when name, email, or notifications change
  // Changes to settings.theme or settings.language won't affect this component!
  return (
    <div className="card">
      <div className="render-count">Renders: {currentRender}</div>
      <h2>User Profile</h2>
      <div className="field">
        <label>
          Name:
          <input
            type="text"
            value={name}
            onChange={(e) => (profile.name = e.target.value)}
          />
        </label>
      </div>
      <div className="field">
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => (profile.email = e.target.value)}
          />
        </label>
      </div>
      <div className="notification-panel">
        <strong>{notifications} notifications</strong>
        <div className="button-group">
          <button onClick={() => is.notifications++}>Add Notification</button>
          <button onClick={() => (is.notifications = 0)}>Clear</button>
        </div>
      </div>
    </div>
  );
};

const ThemeSettings = () => {
  const [renderCount, setRenderCount] = useState(0);
  const {
    settings: { theme, language, is: settings }
  } = UserData.use();

  // Track renders to demonstrate fine-grained reactivity
  const currentRender = renderCount + 1;
  if (currentRender !== renderCount) {
    setTimeout(() => setRenderCount(currentRender), 0);
  }

  // Only re-renders when theme or language changes
  // Changes to profile or notifications won't affect this component!
  return (
    <div className={`card theme-card ${theme}`}>
      <div className="render-count">Renders: {currentRender}</div>
      <h2>Theme Settings</h2>
      <div className="field">
        <button
          onClick={() =>
            (settings.theme = settings.theme === 'light' ? 'dark' : 'light')
          }>
          Toggle Theme (current: {theme})
        </button>
      </div>
      <div>
        <label>
          Language:
          <select
            value={language}
            onChange={(e) => (settings.language = e.target.value)}>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
      </div>
    </div>
  );
};

const Demo = () => {
  return (
    <div className="container">
      <h1>Fine-Grained Reactivity Demo</h1>
      <p className="description">
        Watch the render counters! The UserProfile component only re-renders
        when you change the name, email, or notifications. The ThemeSettings
        component only re-renders when you change the theme or language. Each
        component subscribes only to the properties it accesses.
      </p>
      <div className="grid">
        <UserProfile />
        <ThemeSettings />
      </div>
    </div>
  );
};

export default Demo;
