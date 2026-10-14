import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import './index.css';
import YellowLevel from './components/YellowLevel';

/** When running inside the full game, tell the host this level is done. */
const notifyComplete = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level: 'yellow' }, '*'); };
/** When running inside the full game, tell the host the level was lost (its Game Over screen), so it can send Thanos back to the last checkpoint. */
const notifyDeath = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:death', level: 'yellow' }, '*'); };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <YellowLevel onComplete={notifyComplete} onDeath={notifyDeath} />
  </React.StrictMode>,
);
