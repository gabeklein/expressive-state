import './index.css';

import { createRoot } from 'react-dom/client';

import MyComponent from './Demo';

createRoot(document.getElementById('root')!).render(
  <div className="container">
    <h1>Simple Updates</h1>
    <MyComponent />
  </div>
);
