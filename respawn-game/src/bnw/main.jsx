import ReactDOM from 'react-dom/client';
import BnWGame from '../../../BnWGame.jsx';

const inGame = window.parent !== window;

/** When running inside the full game, tell the host BnW is done (both boards solved). */
const notifyComplete = () => { if (inGame) window.parent.postMessage({ type: 'respawn:complete', level: 'bnw' }, '*'); };

/** …and when a board's clock runs out (on EASY the host offers TRY AGAIN or SKIP). */
const notifyLost = (level) => { if (inGame) window.parent.postMessage({ type: 'respawn:bnw-lost', level }, '*'); };

/** The host starts a board (0 = Level 1, 1 = Level 2) after the player picks on its fallen screen. */
const control = { current: null };
window.addEventListener('message', (e) => {
  if (e.source === window.parent && e.data?.type === 'respawn:bnw-start') control.current?.start(e.data.level);
});

// Rendered exactly as play.html renders it (no StrictMode).
ReactDOM.createRoot(document.getElementById('root')).render(<BnWGame onGameComplete={notifyComplete} onLevelLost={notifyLost} controlRef={control} />);
