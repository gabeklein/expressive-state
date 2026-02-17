import State from '@expressive/react';

// Here we want just an MVP which fetches a name from `randomuser.me`.
// We don't need anything fancy, so let instead of installing a library,
// we'll just do it ourselves. We'll use a State to track the state of
// the request and then render the result of the request to the page.

class Query extends State {
  // All we need to track are response, error and whether request is pending.

  response?: string = undefined;
  error?: Error = undefined;
  waiting = false;

  // To activate the flow, just call an async method as normal.
  // Assignments to `this` will refresh a component at the appropriate times.

  async run() {
    this.waiting = true;

    try {
      const res = await fetch('https://randomuser.me/api?nat=us&results=1');
      const data = await res.json();
      const { first, last } = data.results[0].name;

      // let's pretend it took a second or two
      await new Promise((res) => setTimeout(res, 500));

      this.response = `Hello ${first} ${last}`;
    } catch (error) {
      if (error instanceof Error) this.error = error;
    } finally {
      this.waiting = false;
    }
  }
}

const SayHello = () => {
  const { error, response, waiting, run } = Query.use();

  if (response) return <p>Server said: {response}</p>;

  if (error) return <p>Error was: {error.message}</p>;

  if (waiting) return <p>Sent! Waiting on response...</p>;

  return <button onClick={run}>Say hello to server!</button>;
};

export default SayHello;
