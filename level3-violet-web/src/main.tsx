import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import './index.css';
import VioletLevel from './components/VioletLevel';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VioletLevel />
  </React.StrictMode>,
);
