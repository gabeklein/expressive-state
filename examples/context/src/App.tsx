import State, { Provider } from '@expressive/react';

/*
  When using context the first step is to make some model
  as you normally would. It can contain values which some
  components may read and others may write. Shared state
  is de-facto, easy communication between components!
*/
class FooBar extends State {
  foo = 0;
  bar = 0;
}

const Demo = () => {
  /*
    Expressive Provider is universal; it accepts a `for` prop,
    which can be a State class, instance, or a collection of either.
  */
  return (
    <Provider for={FooBar}>
      <Foo />
      <Bar />
    </Provider>
  );
};

const Foo = () => {
  /*
    Any model passed to `for` will be available to all children of the
    provider via the `get` method of that class.
  */
  const { is: foobar, bar } = FooBar.get();

  return (
    <div className="card">
      <button
        onClick={() => {
          foobar.foo++;
        }}>
        Foo
      </button>
      <small>(Bar was clicked {bar} times)</small>
    </div>
  );
};

const Bar = () => {
  /*
    Components which access particlar values will only refresh when those values change.
    Where `bar` may update many times, this will only update when `foo` changes.
  */
  const { is: foobar, foo } = FooBar.get();

  return (
    <div className="card">
      <button
        onClick={() => {
          foobar.bar++;
        }}>
        Bar
      </button>
      <small>(Foo was clicked {foo} times)</small>
    </div>
  );
};

export default Demo;
