import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/special-elite/400.css';
import '@fontsource/im-fell-english-sc/400.css';
import './index.css';
import GreenLevel from './components/GreenLevel';

/** When running inside the full game, tell the host this level is done. */
const notifyComplete = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level: 'green' }, '*'); };
/** When running inside the full game, tell the host the level was lost (its Game Over screen), so it can send Thanos back to the last checkpoint. */
const notifyDeath = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:death', level: 'green' }, '*'); };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GreenLevel onComplete={notifyComplete} onDeath={notifyDeath} />
  </React.StrictMode>,
);
