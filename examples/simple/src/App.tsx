import State from '@expressive/react';

// State management is portable because values are held in an object.
// Updates may originate from anywhere with a reference to the model.

class Control extends State {
  count = 0;
  message = 'Hello';

  increment() {
    this.count++;
  }
}

const App = () => {
  const { count, message, is, increment } = Control.use();

  return (
    <div className="container">
      <h1>Simple Updates</h1>
      <div className="card">
        <p onClick={() => (is.count += 10)}>Count: {count}</p>
        <p onClick={() => (is.message = 'Updated!')}>Message: {message}</p>
        <button onClick={increment}>Increment</button>
      </div>
    </div>
  );
};

export default App;
