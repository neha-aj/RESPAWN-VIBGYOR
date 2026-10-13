import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/exo-2/500.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/700.css';
import '@fontsource/exo-2/800.css';
import '@fontsource/exo-2/900-italic.css';
import '@fontsource/exo-2/700-italic.css';
import './index.css';
import IndigoLevel from './components/IndigoLevel';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IndigoLevel />
  </React.StrictMode>,
);
