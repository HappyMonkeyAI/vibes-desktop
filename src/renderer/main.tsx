import React from 'react';
import ReactDOM from 'react-dom/client';
// Must precede App so Arco's static Message/Modal APIs use createRoot, not the removed ReactDOM.render.
import './arco-react19';
import App from './App';
import 'virtual:uno.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
