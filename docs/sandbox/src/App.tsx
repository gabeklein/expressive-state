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

  files = set((is: this) => {
    const source = EXAMPLES[is.active];
    const files: Record<string, any> = {
      '/index.tsx': {
        hidden: true,
        code: [
          `import './index.css';`,
          `import { createRoot } from 'react-dom/client';`,
          `import App from './App';`,
          `createRoot(document.getElementById('root')!).render(<App />);`
        ].join('\n')
      }
    };

    for (const [path, code] of Object.entries(source)) files[path] = code;

    return files;
  });
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

