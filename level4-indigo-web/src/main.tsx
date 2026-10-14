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

/** When running inside the full game, tell the host this level is done. */
const notifyComplete = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level: 'indigo' }, '*'); };
/** When running inside the full game, tell the host the level was lost (its Game Over screen), so it can send Thanos back to the last checkpoint. */
const notifyDeath = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:death', level: 'indigo' }, '*'); };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IndigoLevel onComplete={notifyComplete} onDeath={notifyDeath} />
  </React.StrictMode>,
);
