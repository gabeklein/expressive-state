import State from '@expressive/react';

class Control extends State {
  agent = 'Bond';
  remaining = 30;
  dead?: boolean = undefined;

  // `this.new` is called hen a model becomes ready.
  // The method will only be called once and return function
  // will be called on `null` event, when model is destroyed.
  protected new() {
    const done = () => clearInterval(timer);
    const timer = setInterval(() => {
      const remains = this.remaining--;

      if (remains === 0) {
        this.dead = Math.random() > 0.5;
        done();
      }
    }, 1000);

    return done;
  }

  async getNewAgent() {
    const res = await fetch('https://randomuser.me/api?nat=gb&results=1');
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  }
}

const Situation = () => {
  const { agent, dead, getNewAgent, remaining } = Control.use();

  if (dead === true) {
    return <h2>🙀💥 Unforunately, the cat exploded.</h2>;
  }

  if (dead === false) {
    return <h2>😸👍 Oh, the cat did not explode.</h2>;
  }

  return (
    <div className="timer">
      <h1 className="box">📦</h1>
      <p>
        <b>Agent {agent}</b>, we need you to diffuse the bomb!
      </p>
      <p>
        If you can't do it in {remaining} seconds, Schrödinger's cat may or may
        not die!
      </p>
      <p>
        But there's still time!
        <button onClick={getNewAgent}>Tap another agent</button>
        if you think they can do it.
      </p>
    </div>
  );
};

export default Situation;
