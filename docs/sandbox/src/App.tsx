import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider
} from '@codesandbox/sandpack-react';
import EXAMPLES from 'virtual:examples';
import State, { set } from '@expressive/react';

class Control extends State {
  names = Object.keys(EXAMPLES);
  active = this.names[0];

  files = set((is: this) => EXAMPLES[is.active]);
}

export default function App() {
  const { is, files, names, active } = Control.use();

  return (
    <div style={$.container}>
      <h1 style={$.title}>Expressive MVC</h1>
      <nav style={$.nav}>
        {names.map((name) => (
          <button
            key={name}
            onClick={() => (is.active = name)}
            style={{ ...$.tab, ...(name === active && $.active) }}>
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
          <SandpackCodeEditor style={$.editor} />
          <SandpackPreview style={$.editor} />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}

const $: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'system-ui',
    padding: 20,
    maxWidth: 1200,
    margin: '0 auto'
  },
  title: { margin: '0 0 16px' },
  nav: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: {
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    color: '#333',
    cursor: 'pointer'
  },
  active: { background: '#333', color: '#fff' },
  editor: { height: 500 }
};
