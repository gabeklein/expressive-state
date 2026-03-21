import { useRef } from 'react';
import { Settings, UserData } from './UserData';
import { Provider } from '@expressive/react';

const Demo = () => {
  return (
    // By creating UserData in a provider somewhere near root,
    // we can access it anywhere in the component tree.
    <Provider for={UserData}>
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
    </Provider>
  );
};

const UserProfile = () => {
  const {
    is: userData,
    notifications,
    profile: { is: profile, name, email }
  } = UserData.get();

  return (
    <div className="card">
      <RenderCount />
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
          <button onClick={() => userData.notifications++}>
            Add Notification
          </button>
          <button onClick={() => (userData.notifications = 0)}>Clear</button>
        </div>
      </div>
    </div>
  );
};

const ThemeSettings = () => {
  // While you could just access settings from UserData.get(), you can access
  // directly because UserData "owns" it and will provide it for you.
  const { theme, language, is: settings } = Settings.get();

  return (
    <div className={`card theme-card ${theme}`}>
      <RenderCount />
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

const RenderCount = () => {
  const renders = useRef(0);
  return (
    <div className="render-count">Rendered {renders.current++} times.</div>
  );
};

export default Demo;
