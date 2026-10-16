import ReactDOM from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import './menu.css';
import './touch.css';
import App from './App';
import { IS_TOUCH } from './touch';

if (IS_TOUCH) document.documentElement.classList.add('is-touch');   // phones: touch.css takes over the hints and the rotate prompt

// No StrictMode: the director is a single timed sequence and must run exactly once.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
