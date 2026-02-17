import './index.css';

import { createRoot } from 'react-dom/client';

import SayHello from './SayHello';

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Simplest Fetch Example</h1>
    <SayHello />
  </div>
);
