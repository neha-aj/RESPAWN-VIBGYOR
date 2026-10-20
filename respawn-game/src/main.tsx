import ReactDOM from 'react-dom/client';
import { inject } from '@vercel/analytics';
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import './menu.css';
import App from './App';

// Vercel Web Analytics: anonymous page views (no cookies). It only reports from the live site;
// `npm run dev` just logs to the console.
inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

// No StrictMode: the director is a single timed sequence and must run exactly once.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
