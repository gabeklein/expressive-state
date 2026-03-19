import { useState } from 'react';
import examples from 'virtual:examples';

const names = Object.keys(examples);

export default function App() {
  const [active, setActive] = useState(names[0]);
  const Demo = examples[active];

  return (
    <div style={{ fontFamily: 'system-ui', padding: 20 }}>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {names.map(name => (
          <button
            key={name}
            onClick={() => setActive(name)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: name === active ? '#333' : '#fff',
              color: name === active ? '#fff' : '#333',
              cursor: 'pointer'
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <Demo />
    </div>
  );
}
