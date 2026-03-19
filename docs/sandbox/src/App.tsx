import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider
} from '@codesandbox/sandpack-react';
import EXAMPLES from 'virtual:examples';
import State, { set } from '@expressive/react';
import './App.css';

class Control extends State {
  names = Object.keys(EXAMPLES);
  active = this.names[0];

  files = set((is: this) => EXAMPLES[is.active]);
}

export default function App() {
  const { is, files, names, active } = Control.use();

  return (
    <div className="container">
      <h1>Expressive MVC</h1>
      <nav>
        {names.map((name) => (
          <button
            key={name}
            className={name === active ? 'active' : ''}
            onClick={() => (is.active = name)}>
            {name}
          </button>
        ))}
      </nav>
      <SandpackProvider
        key={active}
        template="react-ts"
        files={files}
        customSetup={{
          dependencies: {
            '@expressive/react': 'latest'
          }
        }}>
        <SandpackLayout>
          <SandpackCodeEditor style={{ height: '100%' }} />
          <SandpackPreview style={{ height: '100%' }} />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}

