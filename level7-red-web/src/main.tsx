import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/700.css';
import './index.css';
import RedLevel from './components/RedLevel';

/** When running inside the full game, tell the host this level is done. */
const notifyComplete = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level: 'red' }, '*'); };
/** When running inside the full game, tell the host the level was lost (its Game Over screen), so it can send Thanos back to the last checkpoint. */
const notifyDeath = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:death', level: 'red' }, '*'); };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RedLevel onComplete={notifyComplete} onDeath={notifyDeath} />
  </React.StrictMode>,
);
