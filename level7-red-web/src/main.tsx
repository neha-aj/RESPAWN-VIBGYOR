import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/700.css';
import './index.css';
import RedLevel from './components/RedLevel';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RedLevel />
  </React.StrictMode>,
);
