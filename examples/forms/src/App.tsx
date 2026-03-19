import { Provider } from '@expressive/react';

import { Form, Input } from './Form';

/*
  Form here facilitates logic and context for any given form.
  By extending it, we can inherit features and focus on values
  we actually care about.
*/
class Control extends Form {
  firstname = '';
  lastname = '';
  email = '';
}

const Demo = () => {
  /*
    In order to for this to work, we will need to provide a
    controller downstream. Here that's pretty easy as <Provider />
    will both create and add a new Control instance to context.
  */
  return (
    <Provider for={Control}>
      <h1>Example Form</h1>
      <Input name="firstname" placeholder="Firstname" />
      <Input name="lastname" placeholder="Lastname" />
      <Input name="email" placeholder="Email Address" />
      <Alert />
    </Provider>
  );
};

/*
  For CTA we create a button to respond to a click, alerting current
  values in the form. This is a one-off so we'll use Form.get directly.
  Returned value will be the callback function itself, memoized with
  access to the nearest instance of Form via closure.
*/
const Alert = () => {
  const alertValues = Form.get((form) => () => {
    const values = JSON.stringify(form.get(), null, 2)
      .replace(/[",]/g, '')
      .slice(2, -2);

    alert(`Current values in form are:\n\n` + values);
  });

  return <button onClick={alertValues}>Show Values</button>;
};

export default Demo;
