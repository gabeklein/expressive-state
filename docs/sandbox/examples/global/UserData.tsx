import State from '@expressive/react';

class Profile extends State {
  name = 'John';
  email = 'john@example.com';
}

class Settings extends State {
  theme: 'light' | 'dark' = 'light';
  language = 'en';
}

class UserData extends State {
  // child states can be created with new keyword (rather than method)
  // this allows for composition, where this state "owns" these children.
  profile = new Profile();
  settings = new Settings();

  notifications = 0;
}

// Exporting will allow us to fetch this state in other files.
// Any component can access it via `UserData.get()`.
export { UserData, Settings, Profile };
