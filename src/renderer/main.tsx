import React from 'react';
import ReactDOM from 'react-dom/client';
// Must precede App so Arco's static Message/Modal APIs use createRoot, not the removed ReactDOM.render.
import './arco-react19';
// Arco's full stylesheet — without it every component renders unstyled (the "basic HTML" look).
import '@arco-design/web-react/dist/css/arco.css';
// Design system: dark Mission Control default (Stitch); light via ThemeToggle.
import './theme.css';
import App from './App';
import 'virtual:uno.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
